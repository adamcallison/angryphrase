import type {
  CellData,
  DerivedWord,
  DisplacedClue,
  Word,
  WordChangeResult,
} from "./types";
import { toWordId } from "./chain-logic";

/**
 * Reconciles word metadata after a grid change in Design mode.
 *
 * Matches old words to new derived words by (startRow, startCol, direction),
 * preserving clue text and nextWord references for matched words, handling
 * shortened/lengthened words, creating displaced clues for destroyed words
 * with non-empty clues, and breaking chain references for destroyed words.
 *
 * Pure function — does not mutate any input.
 */
export function reconcileWordsOnGridChange(
  oldWords: Word[],
  newDerivedWords: DerivedWord[],
  oldDisplacedClues: DisplacedClue[],
): WordChangeResult {
  // Build a lookup map of old words by their WordId
  const oldWordsMap = new Map<string, Word>();
  for (const word of oldWords) {
    oldWordsMap.set(toWordId(word), word);
  }

  // Build a set of new word IDs for fast lookup
  const newWordIdSet = new Set<string>();
  for (const dw of newDerivedWords) {
    newWordIdSet.add(toWordId(dw));
  }

  // Track which old words matched a new word
  const matchedOldIds = new Set<string>();

  // Build updated words with metadata from old words where matched
  const updatedWords: Word[] = [];
  const shortenedWords: Word[] = [];
  const lengthenedWords: Word[] = [];

  for (const dw of newDerivedWords) {
    const id = toWordId(dw);
    const oldWord = oldWordsMap.get(id);

    if (oldWord) {
      matchedOldIds.add(id);
      const newWord: Word = {
        ...dw,
        clue: oldWord.clue,
        nextWord: oldWord.nextWord,
      };
      updatedWords.push(newWord);

      // Track length changes
      if (dw.length < oldWord.length) {
        shortenedWords.push(newWord);
      } else if (dw.length > oldWord.length) {
        lengthenedWords.push(newWord);
      }
    } else {
      // New word — create with empty metadata
      updatedWords.push({
        ...dw,
        clue: "",
        nextWord: null,
      });
    }
  }

  // Handle destroyed words: create displaced clues for non-empty clue text
  const newDisplacedClues: DisplacedClue[] = [...oldDisplacedClues];

  for (const [id, oldWord] of oldWordsMap) {
    if (matchedOldIds.has(id)) continue; // word survived

    // Word was destroyed
    if (oldWord.clue !== "") {
      newDisplacedClues.push({
        id: generateDisplacedClueId(),
        clue: oldWord.clue,
        direction: oldWord.direction,
      });
    }
  }

  // Clean up chain references
  // Phase 1: Remove nextWord references that point to destroyed words
  for (let i = 0; i < updatedWords.length; i++) {
    const word = updatedWords[i];
    if (word.nextWord !== null) {
      const targetId = toWordId(word.nextWord);
      if (!newWordIdSet.has(targetId)) {
        // Target was destroyed — remove the reference
        updatedWords[i] = { ...word, nextWord: null };
      }
    }
  }

  // Phase 2: Clear clues for downstream words of destroyed chain members
  // For each destroyed word, follow its nextWord chain to find surviving
  // downstream words whose "See" references are now invalidated.
  for (const [id, oldWord] of oldWordsMap) {
    if (matchedOldIds.has(id)) continue; // word survived, not destroyed

    // Follow the chain from the destroyed word using old word data
    let current: Word | undefined = oldWord;
    while (current && current.nextWord !== null) {
      const downstreamId = toWordId(current.nextWord);

      // Check if the downstream word exists in the updated words
      const downstreamIndex = updatedWords.findIndex(
        (w) => toWordId(w) === downstreamId
      );

      if (downstreamIndex >= 0) {
        // Downstream word survived — clear its clue
        updatedWords[downstreamIndex] = {
          ...updatedWords[downstreamIndex],
          clue: "",
        };
        // Continue following the chain from the old word data
        current = oldWordsMap.get(downstreamId);
      } else {
        // Downstream word was also destroyed — try to follow via old data
        // in case there's a surviving word further down the chain
        const oldDownstream = oldWordsMap.get(downstreamId);
        if (oldDownstream) {
          current = oldDownstream;
        } else {
          // Dangling reference — stop
          break;
        }
      }
    }
  }

  return {
    updatedWords,
    displacedClues: newDisplacedClues,
    shortenedWords,
    lengthenedWords,
  };
}

/**
 * Generates a unique ID for a displaced clue.
 * Uses crypto.randomUUID() for uniqueness.
 */
function generateDisplacedClueId(): string {
  return crypto.randomUUID();
}

/**
 * Reattaches a displaced clue to a target word.
 *
 * Sets the target word's clue to the displaced clue's text and removes
 * the displaced clue from the list. Returns null if the reattachment
 * is blocked (target word already has non-empty clue) or invalid
 * (invalid clue index or target word ID).
 *
 * Pure function — does not mutate any input.
 */
export function reattachClue(
  words: Word[],
  displacedClues: DisplacedClue[],
  clueIndex: number,
  targetWordId: string
): { words: Word[]; displacedClues: DisplacedClue[] } | null {
  // Validate clue index
  if (clueIndex < 0 || clueIndex >= displacedClues.length) {
    return null;
  }

  // Find the target word
  const targetIndex = words.findIndex(
    (w) => toWordId(w) === targetWordId
  );
  if (targetIndex === -1) {
    return null;
  }

  const targetWord = words[targetIndex];
  const displacedClue = displacedClues[clueIndex];

  // Block if target word already has non-empty clue text
  if (targetWord.clue !== "") {
    return null;
  }

  // Reattach: set target word's clue, remove displaced clue from list
  const newWords = words.map((w, i) => {
    if (i === targetIndex) {
      return { ...w, clue: displacedClue.clue };
    }
    return { ...w };
  });

  const newDisplacedClues = displacedClues.filter((_, i) => i !== clueIndex);

  return {
    words: newWords,
    displacedClues: newDisplacedClues,
  };
}

/**
 * Checks if the grid is blank: no letters in any cell,
 * no non-empty clue text in any word, and no displaced clues.
 *
 * Used to determine whether grid size can be changed (FR-08).
 */
export function isGridBlank(
  grid: CellData[][],
  words: Word[],
  displacedClues: DisplacedClue[]
): boolean {
  // Check for displaced clues
  if (displacedClues.length > 0) {
    return false;
  }

  // Check for non-empty clue text
  for (const word of words) {
    if (word.clue !== "") {
      return false;
    }
  }

  // Check for any cell with a letter
  for (const row of grid) {
    for (const cell of row) {
      if (cell.puzzleLetter !== null) {
        return false;
      }
    }
  }

  return true;
}