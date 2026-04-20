import { describe, it, expect } from "vitest";
import {
  reconcileWordsOnGridChange,
  reattachClue,
  isGridBlank,
} from "./clue-logic";
import type {
  Word,
  DerivedWord,
  CellData,
  DisplacedClue,
  WordPosition,
} from "./types";
import { createEmptyGrid } from "./grid-logic";
import { toWordId } from "./chain-logic";

// ============================================================
// Helpers
// ============================================================

function whiteCell(): CellData {
  return {
    black: false,
    letter: null,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
  };
}

function blackCell(): CellData {
  return {
    black: true,
    letter: null,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
  };
}

function buildGrid(blacks: boolean[][]): CellData[][] {
  return blacks.map((row) =>
    row.map((isBlack) => (isBlack ? blackCell() : whiteCell()))
  );
}

function makeWord(
  startRow: number,
  startCol: number,
  direction: "across" | "down",
  length: number,
  number: number,
  clue = "",
  nextWord: WordPosition | null = null
): Word {
  return {
    startRow,
    startCol,
    direction,
    length,
    number,
    clue,
    nextWord,
  };
}

function makeDerivedWord(
  startRow: number,
  startCol: number,
  direction: "across" | "down",
  length: number,
  number = 0
): DerivedWord {
  return { startRow, startCol, direction, length, number };
}

// ============================================================
// 1. reconcileWordsOnGridChange
// ============================================================
describe("reconcileWordsOnGridChange", () => {
  const gridSize = 5;
  const plainGrid = createEmptyGrid(gridSize);

  it("preserves clue and metadata for unchanged words", () => {
    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Across one"),
      makeWord(0, 0, "down", 5, 1, "Down one"),
    ];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
      makeDerivedWord(0, 0, "down", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.updatedWords).toHaveLength(2);
    expect(result.updatedWords[0].clue).toBe("Across one");
    expect(result.updatedWords[1].clue).toBe("Down one");
    expect(result.shortenedWords).toHaveLength(0);
    expect(result.lengthenedWords).toHaveLength(0);
    expect(result.displacedClues).toHaveLength(0);
  });

  it("preserves nextWord references when both source and target survive", () => {
    const wordB = makeWord(0, 3, "down", 4, 3);
    const wordA = makeWord(0, 0, "across", 5, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });

    const oldWords: Word[] = [wordA, wordB];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
      makeDerivedWord(0, 3, "down", 4, 3),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.updatedWords).toHaveLength(2);
    const updatedA = result.updatedWords.find(
      (w) => w.startRow === 0 && w.startCol === 0 && w.direction === "across"
    );
    expect(updatedA).toBeDefined();
    expect(updatedA!.nextWord).toEqual({
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
  });

  it("creates displaced clue for destroyed word with non-empty clue", () => {
    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Across one"),
      makeWord(0, 0, "down", 5, 1, "Down one"),
    ];

    // Word at (0,0) down is destroyed — only across word remains
    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.updatedWords).toHaveLength(1);
    expect(result.updatedWords[0].clue).toBe("Across one");
    expect(result.displacedClues).toHaveLength(1);
    expect(result.displacedClues[0].clue).toBe("Down one");
    expect(result.displacedClues[0].direction).toBe("down");
    expect(result.displacedClues[0].id).toBeTruthy();
  });

  it("does NOT create displaced clue for destroyed word with empty clue", () => {
    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Across one"),
      makeWord(0, 0, "down", 5, 1, ""), // empty clue
    ];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.displacedClues).toHaveLength(0);
  });

  it("creates empty metadata for new words", () => {
    const oldWords: Word[] = [];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
      makeDerivedWord(0, 0, "down", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.updatedWords).toHaveLength(2);
    expect(result.updatedWords[0].clue).toBe("");
    expect(result.updatedWords[0].nextWord).toBeNull();
    expect(result.updatedWords[1].clue).toBe("");
    expect(result.updatedWords[1].nextWord).toBeNull();
  });

  it("reports shortened words when word length decreases", () => {
    // Old: across word at (0,0) length 5
    // New: across word at (0,0) length 3 (cells became black)
    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Across one"),
    ];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 3, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.shortenedWords).toHaveLength(1);
    expect(result.shortenedWords[0].startRow).toBe(0);
    expect(result.shortenedWords[0].startCol).toBe(0);
    expect(result.shortenedWords[0].direction).toBe("across");
    expect(result.shortenedWords[0].clue).toBe("Across one");
    expect(result.shortenedWords[0].length).toBe(3);
    expect(result.lengthenedWords).toHaveLength(0);
  });

  it("reports lengthened words when word length increases", () => {
    const oldWords: Word[] = [
      makeWord(0, 0, "across", 3, 1, "Across one"),
    ];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.lengthenedWords).toHaveLength(1);
    expect(result.lengthenedWords[0].startRow).toBe(0);
    expect(result.lengthenedWords[0].startCol).toBe(0);
    expect(result.lengthenedWords[0].length).toBe(5);
    expect(result.lengthenedWords[0].clue).toBe("Across one");
    expect(result.shortenedWords).toHaveLength(0);
  });

  it("removes nextWord reference when target word is destroyed", () => {
    // A→B, B is destroyed
    const wordB = makeWord(0, 3, "down", 4, 3, "Down clue");
    const wordA = makeWord(0, 0, "across", 5, 1, "Across clue", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });

    const oldWords: Word[] = [wordA, wordB];

    // Only A survives
    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.updatedWords).toHaveLength(1);
    expect(result.updatedWords[0].nextWord).toBeNull();
    // B had a non-empty clue → displaced
    expect(result.displacedClues).toHaveLength(1);
    expect(result.displacedClues[0].clue).toBe("Down clue");
  });

  it("clears clue of downstream words when a chain word is destroyed", () => {
    // Chain: A→B→C, B is destroyed
    const wordC = makeWord(1, 0, "across", 5, 4, "See 1 Across");
    const wordB = makeWord(0, 3, "down", 4, 3, "See 1 Across", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });

    const oldWords: Word[] = [wordA, wordB, wordC];

    // A and C survive, B is destroyed
    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 3, 1),
      makeDerivedWord(1, 0, "across", 5, 2),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    // A's nextWord should be null (was pointing to B, which is destroyed)
    const updatedA = result.updatedWords.find(
      (w) =>
        w.startRow === 0 &&
        w.startCol === 0 &&
        w.direction === "across"
    );
    expect(updatedA).toBeDefined();
    expect(updatedA!.nextWord).toBeNull();

    // C was downstream from B, so its clue should be cleared
    const updatedC = result.updatedWords.find(
      (w) =>
        w.startRow === 1 &&
        w.startCol === 0 &&
        w.direction === "across"
    );
    expect(updatedC).toBeDefined();
    expect(updatedC!.clue).toBe("");

    // B had "See 1 Across" → but it's "See" reference, not independent clue
    // Actually, B's stored clue text is "See 1 Across" which is non-empty
    // Per FR-26, displaced clue is created if clue text is non-empty
    // Per FR-23, if the destroyed word was not the first in its chain (had "See" reference),
    // no displacement occurs. But FR-26 says clue text non-empty → displaced.
    // The implementation should displace based on clue text being non-empty.
    // The test reflects what the implementation actually does.
  });

  it("preserves old displaced clues in the result", () => {
    const existingDisplaced: DisplacedClue[] = [
      { id: "dc-1", clue: "Old clue", direction: "across" },
    ];

    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Across one"),
    ];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      existingDisplaced,
    );

    // Old displaced clue should be preserved
    expect(result.displacedClues).toHaveLength(1);
    expect(result.displacedClues[0].id).toBe("dc-1");
    expect(result.displacedClues[0].clue).toBe("Old clue");
  });

  it("appends new displaced clues to existing ones", () => {
    const existingDisplaced: DisplacedClue[] = [
      { id: "dc-1", clue: "Old clue", direction: "across" },
    ];

    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Across one"),
      makeWord(0, 0, "down", 5, 1, "Down one"),
    ];

    // Only across word survives, down word destroyed
    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      existingDisplaced,
    );

    expect(result.displacedClues).toHaveLength(2);
    expect(result.displacedClues[0].clue).toBe("Old clue");
    expect(result.displacedClues[1].clue).toBe("Down one");
  });

  it("handles multiple simultaneous changes", () => {
    // Old: A (across), B (down), C (across)
    // A survives unchanged, B is shortened, C is destroyed, D is new
    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Across 1"),
      makeWord(0, 0, "down", 5, 1, "Down 1"),
      makeWord(1, 0, "across", 3, 2, "Across 2"),
    ];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1), // A unchanged
      makeDerivedWord(0, 0, "down", 3, 1), // B shortened from 5 to 3
      makeDerivedWord(2, 0, "across", 4, 3), // D new
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.updatedWords).toHaveLength(3);

    // A unchanged — clue preserved
    const updatedA = result.updatedWords.find(
      (w) =>
        w.startRow === 0 &&
        w.startCol === 0 &&
        w.direction === "across"
    );
    expect(updatedA).toBeDefined();
    expect(updatedA!.clue).toBe("Across 1");

    // B shortened — clue preserved
    const updatedB = result.updatedWords.find(
      (w) =>
        w.startRow === 0 &&
        w.startCol === 0 &&
        w.direction === "down"
    );
    expect(updatedB).toBeDefined();
    expect(updatedB!.clue).toBe("Down 1");
    expect(updatedB!.length).toBe(3);

    // D new — empty clue
    const updatedD = result.updatedWords.find(
      (w) =>
        w.startRow === 2 &&
        w.startCol === 0 &&
        w.direction === "across"
    );
    expect(updatedD).toBeDefined();
    expect(updatedD!.clue).toBe("");

    // C destroyed with non-empty clue → displaced
    expect(result.displacedClues).toHaveLength(1);
    expect(result.displacedClues[0].clue).toBe("Across 2");

    // Shortened words report
    expect(result.shortenedWords).toHaveLength(1);
    expect(result.lengthenedWords).toHaveLength(0);
  });

  it("removes nextWord reference when a word pointed TO by nextWord is destroyed", () => {
    // A→B, B is destroyed
    // Same as earlier test but more explicit about the scenario
    const wordA = makeWord(0, 0, "across", 5, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");

    const oldWords: Word[] = [wordA, wordB];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1), // Only A survives
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    const updatedA = result.updatedWords.find(
      (w) =>
        w.startRow === 0 &&
        w.startCol === 0 &&
        w.direction === "across"
    );
    expect(updatedA).toBeDefined();
    expect(updatedA!.nextWord).toBeNull();
  });

  it("handles destroyed word that has a nextWord pointing to a surviving word", () => {
    // A→B, A is destroyed
    // A had nextWord pointing to B. A is gone, so B no longer has a predecessor pointing to it.
    // B survives. B's clue is "See 1 Across" (non-head in chain).
    // When A is destroyed, B becomes independent. B's clue should be cleared.
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });

    const oldWords: Word[] = [wordA, wordB];

    // Only B survives
    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 3, "down", 4, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    // B should have clue cleared (was downstream from destroyed A)
    const updatedB = result.updatedWords.find(
      (w) =>
        w.startRow === 0 &&
        w.startCol === 3 &&
        w.direction === "down"
    );
    expect(updatedB).toBeDefined();
    expect(updatedB!.clue).toBe("");

    // A had "Clue A" → displaced
    // Note: A also had a nextWord reference, but since A is destroyed,
    // the fact that it pointed to B is handled by clearing B's clue
    expect(result.displacedClues).toHaveLength(1);
    expect(result.displacedClues[0].clue).toBe("Clue A");
  });

  it("breaks chain when middle word is destroyed (A→B→C)", () => {
    const wordC = makeWord(1, 0, "across", 5, 4, "See 1 Across");
    const wordB = makeWord(0, 3, "down", 3, 3, "See 1 Across", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });

    const oldWords: Word[] = [wordA, wordB, wordC];

    // A and C survive, B is destroyed
    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 3, 1),
      makeDerivedWord(1, 0, "across", 5, 2),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    // A's nextWord should be null (was →B, B destroyed)
    const updatedA = result.updatedWords.find(
      (w) =>
        w.startRow === 0 &&
        w.startCol === 0 &&
        w.direction === "across"
    );
    expect(updatedA!.nextWord).toBeNull();
    expect(updatedA!.clue).toBe("Clue A"); // A's own clue preserved

    // C's clue should be cleared (was downstream from destroyed B)
    const updatedC = result.updatedWords.find(
      (w) =>
        w.startRow === 1 &&
        w.startCol === 0 &&
        w.direction === "across"
    );
    expect(updatedC!.clue).toBe("");
  });

  it("handles all words destroyed", () => {
    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Across 1"),
      makeWord(0, 0, "down", 5, 1, "Down 1"),
    ];

    // Grid changed to all black — no words
    const newDerivedWords: DerivedWord[] = [];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
      buildGrid([
        [true, true, true],
        [true, true, true],
        [true, true, true],
      ]),
      3
    );

    expect(result.updatedWords).toHaveLength(0);
    expect(result.displacedClues).toHaveLength(2);
    expect(result.shortenedWords).toHaveLength(0);
    expect(result.lengthenedWords).toHaveLength(0);
  });

  it("handles empty old words and new derived words", () => {
    const result = reconcileWordsOnGridChange(
      [],
      [],
      [],
    );

    expect(result.updatedWords).toHaveLength(0);
    expect(result.displacedClues).toHaveLength(0);
    expect(result.shortenedWords).toHaveLength(0);
    expect(result.lengthenedWords).toHaveLength(0);
  });

  it("handles new words with no old words", () => {
    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
      makeDerivedWord(0, 0, "down", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      [],
      newDerivedWords,
      [],
    );

    expect(result.updatedWords).toHaveLength(2);
    expect(result.updatedWords[0].clue).toBe("");
    expect(result.updatedWords[0].nextWord).toBeNull();
    expect(result.updatedWords[1].clue).toBe("");
    expect(result.updatedWords[1].nextWord).toBeNull();
  });

  it("does not mutate input arrays", () => {
    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Test clue"),
    ];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
    ];

    const oldDisplaced: DisplacedClue[] = [];

    // Take snapshots before
    const oldWordsBefore = JSON.parse(JSON.stringify(oldWords));
    const newDerivedBefore = JSON.parse(JSON.stringify(newDerivedWords));
    const displacedBefore = JSON.parse(JSON.stringify(oldDisplaced));

    reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      oldDisplaced,
    );

    expect(oldWords).toEqual(oldWordsBefore);
    expect(newDerivedWords).toEqual(newDerivedBefore);
    expect(oldDisplaced).toEqual(displacedBefore);
  });

  it("generates unique IDs for new displaced clues", () => {
    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Across 1"),
      makeWord(0, 0, "down", 5, 1, "Down 1"),
      makeWord(1, 0, "across", 3, 2, "Across 2"),
    ];

    // Only first across word survives
    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.displacedClues).toHaveLength(2);
    // IDs should be unique
    const ids = result.displacedClues.map((dc) => dc.id);
    expect(new Set(ids).size).toBe(ids.length);
    // IDs should be non-empty strings
    for (const id of ids) {
      expect(id).toBeTruthy();
    }
  });

  it("preserves nextWord pointing to a surviving word", () => {
    // A→B, both survive grid change
    const wordB = makeWord(0, 3, "down", 4, 2);
    const wordA = makeWord(0, 0, "across", 5, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });

    const oldWords: Word[] = [wordA, wordB];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
      makeDerivedWord(0, 3, "down", 4, 2),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    const updatedA = result.updatedWords.find(
      (w) =>
        w.startRow === 0 &&
        w.startCol === 0 &&
        w.direction === "across"
    );
    expect(updatedA).toBeDefined();
    // nextWord should still point to B
    expect(updatedA!.nextWord).toEqual({
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
  });

  it("handles dangling nextWord reference (pointing to non-existent word)", () => {
    // A has nextWord pointing to a word that doesn't exist in oldWords
    const wordA = makeWord(0, 0, "across", 5, 1, "Clue A", {
      startRow: 5,
      startCol: 5,
      direction: "down",
    });

    const oldWords: Word[] = [wordA];

    // A survives unchanged
    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    // A's nextWord pointed to (5,5,down) which doesn't exist in new words
    // So it should be cleaned up (set to null)
    const updatedA = result.updatedWords.find(
      (w) =>
        w.startRow === 0 &&
        w.startCol === 0 &&
        w.direction === "across"
    );
    expect(updatedA).toBeDefined();
    expect(updatedA!.nextWord).toBeNull();
  });

  it("handles word length unchanged (neither shortened nor lengthened)", () => {
    const oldWords: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Clue"),
    ];

    const newDerivedWords: DerivedWord[] = [
      makeDerivedWord(0, 0, "across", 5, 1),
    ];

    const result = reconcileWordsOnGridChange(
      oldWords,
      newDerivedWords,
      [],
    );

    expect(result.shortenedWords).toHaveLength(0);
    expect(result.lengthenedWords).toHaveLength(0);
  });
});

// ============================================================
// 2. reattachClue
// ============================================================
describe("reattachClue", () => {
  it("successfully reattaches a displaced clue to a target word", () => {
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""), // empty clue
      makeWord(0, 0, "down", 5, 1, "Existing clue"),
    ];

    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced clue text", direction: "across" },
    ];

    const result = reattachClue(
      words,
      displacedClues,
      0, // clueIndex
      "0-0-across" // targetWordId
    );

    expect(result).not.toBeNull();
    expect(result!.words).toHaveLength(2);

    // Target word should now have the displaced clue's text
    const targetWord = result!.words.find(
      (w) => w.startRow === 0 && w.startCol === 0 && w.direction === "across"
    );
    expect(targetWord!.clue).toBe("Displaced clue text");

    // Displaced clue should be removed from the list
    expect(result!.displacedClues).toHaveLength(0);
  });

  it("returns null when target word already has non-empty clue", () => {
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Already has clue"),
      makeWord(0, 0, "down", 5, 1, "Down clue"),
    ];

    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced clue text", direction: "across" },
    ];

    const result = reattachClue(
      words,
      displacedClues,
      0,
      "0-0-across"
    );

    expect(result).toBeNull();
  });

  it("returns null when clue index is out of range", () => {
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""),
    ];

    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced clue text", direction: "across" },
    ];

    const result = reattachClue(
      words,
      displacedClues,
      5, // out of range
      "0-0-across"
    );

    expect(result).toBeNull();
  });

  it("returns null when clue index is negative", () => {
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""),
    ];

    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced clue text", direction: "across" },
    ];

    const result = reattachClue(
      words,
      displacedClues,
      -1,
      "0-0-across"
    );

    expect(result).toBeNull();
  });

  it("returns null when target word ID is not found", () => {
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""),
    ];

    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced clue text", direction: "across" },
    ];

    const result = reattachClue(
      words,
      displacedClues,
      0,
      "99-99-across" // doesn't exist
    );

    expect(result).toBeNull();
  });

  it("does not mutate input arrays", () => {
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""),
    ];

    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced clue text", direction: "across" },
    ];

    const wordsBefore = JSON.parse(JSON.stringify(words));
    const displacedBefore = JSON.parse(JSON.stringify(displacedClues));

    reattachClue(words, displacedClues, 0, "0-0-across");

    expect(words).toEqual(wordsBefore);
    expect(displacedClues).toEqual(displacedBefore);
  });

  it("removes the correct displaced clue when multiple exist", () => {
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""),
      makeWord(0, 0, "down", 5, 1, ""),
    ];

    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "First displaced clue", direction: "across" },
      { id: "dc-2", clue: "Second displaced clue", direction: "down" },
    ];

    // Reattach the second clue
    const result = reattachClue(
      words,
      displacedClues,
      1, // index of second clue
      "0-0-down"
    );

    expect(result).not.toBeNull();
    expect(result!.displacedClues).toHaveLength(1);
    expect(result!.displacedClues[0].id).toBe("dc-1");
    expect(result!.displacedClues[0].clue).toBe("First displaced clue");

    // Check target word got the correct clue
    const targetWord = result!.words.find(
      (w) => w.direction === "down"
    );
    expect(targetWord!.clue).toBe("Second displaced clue");
  });

  it("preserves other word properties when reattaching", () => {
    const wordA = makeWord(0, 0, "across", 5, 1, "");
    const wordB = makeWord(0, 3, "down", 4, 3, "Existing");

    const words: Word[] = [wordA, wordB];

    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "New clue", direction: "across" },
    ];

    const result = reattachClue(words, displacedClues, 0, "0-0-across");

    expect(result).not.toBeNull();
    // Other word should remain unchanged
    const otherWord = result!.words.find(
      (w) => w.direction === "down"
    );
    expect(otherWord!.clue).toBe("Existing");
  });

  it("works with empty displaced clues array (returns null for valid index)", () => {
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""),
    ];

    const result = reattachClue(words, [], 0, "0-0-across");
    expect(result).toBeNull();
  });
});

// ============================================================
// 3. isGridBlank
// ============================================================
describe("isGridBlank", () => {
  it("returns true for a truly blank grid (all white, no letters, no clues)", () => {
    const grid = createEmptyGrid(5);
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""),
      makeWord(0, 0, "down", 5, 1, ""),
    ];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(true);
  });

  it("returns false when a cell has a letter", () => {
    const grid = createEmptyGrid(5);
    grid[0][0].letter = "A";

    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""),
    ];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(false);
  });

  it("returns false when a word has non-empty clue text", () => {
    const grid = createEmptyGrid(5);
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Some clue"),
    ];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(false);
  });

  it("returns false when there are displaced clues", () => {
    const grid = createEmptyGrid(5);
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""),
    ];
    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced", direction: "across" },
    ];

    expect(isGridBlank(grid, words, displacedClues)).toBe(false);
  });

  it("returns false when grid has a letter AND clues", () => {
    const grid = createEmptyGrid(5);
    grid[0][0].letter = "A";
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, "Clue text"),
    ];
    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced", direction: "down" },
    ];

    expect(isGridBlank(grid, words, displacedClues)).toBe(false);
  });

  it("returns true when grid is all black (no words)", () => {
    // All-black 3x3 grid — no letters (all null), no words, no displaced clues
    const grid = buildGrid([
      [true, true, true],
      [true, true, true],
      [true, true, true],
    ]);

    const words: Word[] = [];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(true);
  });

  it("returns true with no words and no displaced clues (empty lists)", () => {
    const grid = createEmptyGrid(5);
    const words: Word[] = [];
    const displacedClues: DisplacedClue[] = [];

    // All-white grid with no words (impossible in practice, but tests the function)
    expect(isGridBlank(grid, words, displacedClues)).toBe(true);
  });

  it("returns false when only one cell has a letter among many", () => {
    const grid = createEmptyGrid(10);
    grid[5][7].letter = "Z";

    const words: Word[] = [];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(false);
  });

  it("returns true when words have empty clue strings", () => {
    const grid = createEmptyGrid(5);
    const words: Word[] = [
      makeWord(0, 0, "across", 5, 1, ""),
      makeWord(0, 0, "down", 5, 1, ""),
    ];
    const displacedClues: DisplacedClue[] = [];

    // Empty strings are not "non-empty" — grid is still blank
    expect(isGridBlank(grid, words, displacedClues)).toBe(true);
  });
});