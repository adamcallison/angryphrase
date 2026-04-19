import type { Word, WordId, WordPosition, DisplacedClue } from "./types";
import type { CellData } from "./types";
import { getSingleWordLengthPattern } from "./grid-logic";

/**
 * Generates a WordId string from a WordPosition.
 * Format: `${startRow}-${startCol}-${direction}`
 */
export function toWordId(pos: WordPosition): WordId {
  return `${pos.startRow}-${pos.startCol}-${pos.direction}`;
}

/**
 * Finds a word in the array by its WordId.
 * Returns undefined if not found.
 */
function findWordById(words: Word[], id: WordId): Word | undefined {
  return words.find((w) => toWordId(w) === id);
}

/**
 * Follows nextWord links from startWord to build the complete chain.
 * Returns an array starting with startWord, followed by each linked word.
 */
export function getChain(words: Word[], startWord: Word): Word[] {
  const chain: Word[] = [startWord];
  let current = startWord;

  while (current.nextWord !== null) {
    const nextId = toWordId(current.nextWord);
    const nextWord = findWordById(words, nextId);
    if (!nextWord) {
      // Dangling reference — stop the chain here
      break;
    }
    chain.push(nextWord);
    current = nextWord;
  }

  return chain;
}

/**
 * Finds the first word (head) in the chain containing the given word.
 * Traverses backwards by searching for words that point to the current word.
 */
export function getChainHead(words: Word[], word: Word): Word {
  let current = word;
  let currentId = toWordId(current);

  // Keep looking for words that point to the current word
  while (true) {
    const predecessor = words.find((w) => {
      if (w.nextWord === null) return false;
      return toWordId(w.nextWord) === currentId;
    });

    if (!predecessor) {
      // No one points to current — it's the head
      return current;
    }

    current = predecessor;
    currentId = toWordId(current);
  }
}

/**
 * Returns true if the given word is the first in its chain
 * (i.e., no other word's nextWord points to it).
 */
export function isChainHead(words: Word[], word: Word): boolean {
  const wordId = toWordId(word);
  // A word is a chain head if no other word points to it
  for (const w of words) {
    if (w.nextWord !== null && toWordId(w.nextWord) === wordId) {
      return false;
    }
  }
  return true;
}

/**
 * Returns the display clue text for a word.
 * - If the word is a chain head (or not in any chain), returns its own clue text.
 * - If the word is a non-head in a chain, returns "See {number} {Direction}"
 *   referencing the chain's head word.
 */
export function getDisplayClue(word: Word, words: Word[]): string {
  if (isChainHead(words, word)) {
    return word.clue;
  }

  // Find the chain head to get the reference number and direction
  const head = getChainHead(words, word);
  const directionLabel = head.direction === "across" ? "Across" : "Down";
  return `See ${head.number} ${directionLabel}`;
}

/**
 * Joins source→target by setting source.nextWord = target position.
 * Returns a new words array with the updated source word, or null if the join is invalid.
 *
 * Validation rules:
 * - Source must not already have a nextWord
 * - Target must not already be pointed to by another word
 * - Source and target must be different words
 * - Both source and target must exist in the words array
 */
function joinWords(
  words: Word[],
  sourceId: WordId,
  targetId: WordId
): Word[] | null {
  // Source and target must be different
  if (sourceId === targetId) {
    return null;
  }

  // Find source and target
  const source = findWordById(words, sourceId);
  const target = findWordById(words, targetId);

  if (!source || !target) {
    return null;
  }

  // Source must not already have a nextWord
  if (source.nextWord !== null) {
    return null;
  }

  // Target must not already be pointed to by another word
  for (const w of words) {
    if (w.nextWord !== null && toWordId(w.nextWord) === targetId) {
      return null;
    }
  }

  // Create the join: source.nextWord = target position
  const nextWordRef: WordPosition = {
    startRow: target.startRow,
    startCol: target.startCol,
    direction: target.direction,
  };

  return words.map((w) => {
    if (toWordId(w) === sourceId) {
      return { ...w, nextWord: nextWordRef };
    }
    return { ...w };
  });
}

/**
 * Removes the nextWord link from the specified word.
 * The formerly linked word becomes independent with an empty clue slot.
 * Only the direct link is removed: if A→B→C and you unjoin A,
 * only A's nextWord is cleared. B retains its own nextWord→C,
 * and B gets an empty clue (replacing its "See" reference).
 */
export function unjoinWord(words: Word[], wordId: WordId): Word[] {
  const word = findWordById(words, wordId);

  if (!word || word.nextWord === null) {
    // Word doesn't exist or has no nextWord — return a shallow copy (no mutation)
    return words.map((w) => ({ ...w }));
  }

  // Find the formerly linked word
  const linkedId = toWordId(word.nextWord);
  const linkedWord = findWordById(words, linkedId);

  return words.map((w) => {
    const wId = toWordId(w);

    // Remove the nextWord from the specified word
    if (wId === wordId) {
      return { ...w, nextWord: null };
    }

    // The formerly linked word gets an empty clue (it was showing "See X",
    // now it's an independent word with an empty clue slot)
    if (linkedWord && wId === linkedId) {
      return { ...w, clue: "" };
    }

    return { ...w };
  });
}

/**
 * Breaks a chain at the destroyed word. Used when a grid change in Design mode
 * destroys a word that is part of a chain.
 *
 * Effects:
 * 1. Finds any word pointing TO the destroyed word and removes its nextWord.
 * 2. Words after the destroyed word (reachable via nextWord from the destroyed word)
 *    get their clue set to empty string (their "See" references are no longer valid).
 */
export function breakChainAtWord(words: Word[], destroyedWordId: WordId): Word[] {
  const destroyedWord = findWordById(words, destroyedWordId);

  // Find words that pointed to the destroyed word
  const predecessorIds: Set<WordId> = new Set();
  for (const w of words) {
    if (w.nextWord !== null && toWordId(w.nextWord) === destroyedWordId) {
      predecessorIds.add(toWordId(w));
    }
  }

  // Find all words reachable from the destroyed word via nextWord links
  // These are the "downstream" words that need their clues cleared
  const downstreamIds: Set<WordId> = new Set();
  if (destroyedWord) {
    let current: Word | null = destroyedWord;
    while (current?.nextWord !== null) {
      if (current.nextWord === null) break;
      const nextId = toWordId(current.nextWord);
      downstreamIds.add(nextId);
      const nextWord = findWordById(words, nextId);
      if (!nextWord) break;
      current = nextWord;
    }
  }

  return words.map((w) => {
    const wId = toWordId(w);

    // Remove nextWord from any predecessor
    if (predecessorIds.has(wId)) {
      return { ...w, nextWord: null };
    }

    // Clear clue for downstream words
    if (downstreamIds.has(wId)) {
      return { ...w, clue: "" };
    }

    return { ...w };
  });
}

/**
 * Validates that all chain references in the words array are valid.
 * Returns true if:
 * - No cycles exist (no chain loops back on itself)
 * - No branching (no word is pointed to by more than one word)
 * - All nextWord references point to existing words
 * - No self-references (a word doesn't point to itself)
 */
export function validateChains(words: Word[]): boolean {
  const wordIds = new Set(words.map((w) => toWordId(w)));

  // Check for branching: no word should be pointed to by more than one word
  const pointedToBy: Map<WordId, number> = new Map();
  for (const w of words) {
    if (w.nextWord !== null) {
      const targetId = toWordId(w.nextWord);

      // Self-reference check
      const sourceId = toWordId(w);
      if (sourceId === targetId) {
        return false;
      }

      // Dangling reference check
      if (!wordIds.has(targetId)) {
        return false;
      }

      const count = pointedToBy.get(targetId) ?? 0;
      pointedToBy.set(targetId, count + 1);
    }
  }

  // Check that no word is pointed to by more than one word
  for (const [, count] of pointedToBy) {
    if (count > 1) {
      return false;
    }
  }

  // Check for cycles: follow chains from each head and make sure we don't loop
  // A word is a head if no one points to it
  const pointedToSet = new Set(pointedToBy.keys());
  const heads = words.filter((w) => !pointedToSet.has(toWordId(w)));

  for (const head of heads) {
    const visited = new Set<WordId>();
    let current: Word | undefined = head;

    while (current !== undefined) {
      const currentId = toWordId(current);

      if (visited.has(currentId)) {
        // Cycle detected
        return false;
      }

      visited.add(currentId);

      if (current.nextWord === null) {
        break;
      }

      current = findWordById(words, toWordId(current.nextWord));
    }
  }

  // Also check chains that start from non-heads (in case of invalid state)
  // We've already checked all chains from heads, which covers all valid chains.
  // Any remaining word must be part of a cycle (already checked above via heads)
  // or pointed to by more than one word (already checked via branching check).
  // But if there are no heads (all words are in a cycle), the head filter
  // would produce an empty array. Handle this edge case:
  if (words.length > 0 && heads.length === 0) {
    // Every word is pointed to by at least one other word.
    // This means we have a cycle.
    return false;
  }

  return true;
}

/**
 * Returns a display string for the word's length pattern.
 *
 * - Simple word, no markers: "8"
 * - Word with space markers: "4, 4" (comma-space between segments)
 * - Word with hyphen markers: "4-4" (hyphen between segments)
 * - Chain head (joined words): "4,4" (comma, no space — each word's total length)
 *
 * Wrap the result in parens for display: `(${pattern})`
 */
export function getWordLengthPattern(
  grid: CellData[][],
  word: Word,
  allWords: Word[],
): string {
  // If this word is a chain head with nextWord, show each word's total length
  if (word.nextWord !== null) {
    const chain = getChain(allWords, word);
    return chain.map((w) => w.length.toString()).join(",");
  }

  // Single word: compute segments based on cell markers
  return getSingleWordLengthPattern(grid, word);
}

/**
 * Joins source→target words and, if the target had a non-empty clue,
 * displaces that clue so it can be reattached later.
 *
 * Returns null if the join is invalid (same word, already chained, etc.).
 * Otherwise returns the updated words array and the updated displaced clues.
 * Pure function — does not mutate any input.
 */
export function joinWordsAndDisplace(
  words: Word[],
  sourceWordId: WordId,
  targetWordId: WordId,
  existingDisplacedClues: DisplacedClue[],
): { words: Word[]; displacedClues: DisplacedClue[] } | null {
  // Same-word join is invalid
  if (sourceWordId === targetWordId) {
    return null;
  }

  // Attempt the join
  const joinedWords = joinWords(words, sourceWordId, targetWordId);
  if (joinedWords === null) {
    return null;
  }

  // If the target had a non-empty clue, displace it
  const targetWord = findWordById(words, targetWordId);
  const newDisplacedClue: DisplacedClue | null =
    targetWord && targetWord.clue.trim() !== ""
      ? { id: crypto.randomUUID(), clue: targetWord.clue, direction: targetWord.direction }
      : null;

  const displacedClues = newDisplacedClue
    ? [...existingDisplacedClues, newDisplacedClue]
    : [...existingDisplacedClues];

  return { words: joinedWords, displacedClues };
}