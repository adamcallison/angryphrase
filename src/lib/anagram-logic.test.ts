import { describe, it, expect } from "vitest";
import { computeAnagramState, deriveDisplayLetters, validateInput, shuffleNonFixedLetters } from "./anagram-logic";
import type { CellData, Word } from "./types";

// Helper: create a white cell
function whiteCell(playerLetter: string | null = null): CellData {
  return {
    black: false,
    puzzleLetter: null,
    playerLetter,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
  };
}

// Helper: create a simple across word
function makeAcrossWord(startRow: number, startCol: number, length: number, clue: string = ""): Word {
  return {
    startRow,
    startCol,
    direction: "across",
    length,
    number: 1,
    clue,
    nextWord: null,
  };
}

// Helper: create a grid row of white cells with optional player letters
function makeRow(letters: (string | null)[]): CellData[] {
  return letters.map((l) => whiteCell(l));
}

// ============================================================
// 1. computeAnagramState
// ============================================================
describe("computeAnagramState", () => {
  it("marks all positions as fixed when all cells have player letters", () => {
    // Word: 3-letter across word starting at (0,0), all filled
    const word = makeAcrossWord(0, 0, 3);
    const grid = [makeRow(["A", "B", "C"])];

    const state = computeAnagramState(word, grid);

    expect(state.length).toBe(3);
    expect(state.emptyCount).toBe(0);
    expect(state.fixedMask).toEqual([true, true, true]);
    expect(state.fixedLetters).toEqual(["A", "B", "C"]);
  });

  it("marks all positions as non-fixed when no cells have player letters", () => {
    const word = makeAcrossWord(0, 0, 3);
    const grid = [makeRow([null, null, null])];

    const state = computeAnagramState(word, grid);

    expect(state.length).toBe(3);
    expect(state.emptyCount).toBe(3);
    expect(state.fixedMask).toEqual([false, false, false]);
    expect(state.fixedLetters).toEqual([null, null, null]);
  });

  it("marks mixed fixed and non-fixed positions", () => {
    const word = makeAcrossWord(0, 0, 5);
    const grid = [makeRow(["A", null, "C", null, null])];

    const state = computeAnagramState(word, grid);

    expect(state.length).toBe(5);
    expect(state.emptyCount).toBe(3);
    expect(state.fixedMask).toEqual([true, false, true, false, false]);
    expect(state.fixedLetters).toEqual(["A", null, "C", null, null]);
  });

  it("works with a down word", () => {
    const word: Word = {
      startRow: 0,
      startCol: 0,
      direction: "down",
      length: 3,
      number: 1,
      clue: "",
      nextWord: null,
    };
    const grid = [
      makeRow(["A"]),  // (0,0)
      makeRow([null]),  // (1,0)
      makeRow(["C"]),   // (2,0)
    ];

    const state = computeAnagramState(word, grid);

    expect(state.length).toBe(3);
    expect(state.emptyCount).toBe(1);
    expect(state.fixedMask).toEqual([true, false, true]);
    expect(state.fixedLetters).toEqual(["A", null, "C"]);
  });

  it("correctly computes emptyCount for a single empty cell", () => {
    const word = makeAcrossWord(0, 0, 1);
    const grid = [makeRow([null])];

    const state = computeAnagramState(word, grid);

    expect(state.length).toBe(1);
    expect(state.emptyCount).toBe(1);
    expect(state.fixedMask).toEqual([false]);
    expect(state.fixedLetters).toEqual([null]);
  });

  it("correctly computes emptyCount for a single fixed cell", () => {
    const word = makeAcrossWord(0, 0, 1);
    const grid = [makeRow(["Z"])];

    const state = computeAnagramState(word, grid);

    expect(state.length).toBe(1);
    expect(state.emptyCount).toBe(0);
    expect(state.fixedMask).toEqual([true]);
    expect(state.fixedLetters).toEqual(["Z"]);
  });

  it("includes the word reference in the state", () => {
    const word = makeAcrossWord(2, 3, 4, "Test clue");
    const grid = [
      makeRow([null, null, null, null, null, null, null]),
      makeRow([null, null, null, null, null, null, null]),
      makeRow([null, null, null, "A", null, null, null]),
    ];

    const state = computeAnagramState(word, grid);

    expect(state.word).toBe(word);
    expect(state.word.startRow).toBe(2);
    expect(state.word.startCol).toBe(3);
  });
});

// ============================================================
// 2. deriveDisplayLetters
// ============================================================
describe("deriveDisplayLetters", () => {
  it("shows fixed letters and null for empty positions when input is incomplete", () => {
    // Word: [A, _, _, C] — positions 0 and 3 are fixed
    const fixedLetters: (string | null)[] = ["A", null, null, "C"];
    const fixedMask = [true, false, false, true];

    // User has only typed 2 letters
    const result = deriveDisplayLetters("AB", fixedLetters, fixedMask);

    // Not enough input (2 < 4), so show fixed letters and null for rest
    expect(result).toEqual(["A", null, null, "C"]);
  });

  it("shows fixed letters and null for empty when input is empty", () => {
    const fixedLetters: (string | null)[] = ["A", null, null, "C"];
    const fixedMask = [true, false, false, true];

    const result = deriveDisplayLetters("", fixedLetters, fixedMask);

    expect(result).toEqual(["A", null, null, "C"]);
  });

  it("distributes non-fixed letters from input after claiming fixed letters", () => {
    // Word: [A, _, _, C] — positions 0 and 3 are fixed
    const fixedLetters: (string | null)[] = ["A", null, null, "C"];
    const fixedMask = [true, false, false, true];

    // User types "ABCDE" — wait, length must equal word length
    // User types 4 letters: "AXYC"
    // Claim fixed: remove 'A' → remaining [X, Y], remove 'C' → remaining [X, Y]
    // Wait, let me think about this more carefully.
    // Input: "AXYC" (length 4 = word length)
    // Claim 'A' at position 0: remove 'A' from [A,X,Y,C] → remaining [X,Y,C]
    // Claim 'C' at position 3: remove 'C' from [X,Y,C] → remaining [X,Y]
    // Position 0 (fixed): A
    // Position 1 (non-fixed): X
    // Position 2 (non-fixed): Y
    // Position 3 (fixed): C
    const result = deriveDisplayLetters("AXYC", fixedLetters, fixedMask);

    expect(result).toEqual(["A", "X", "Y", "C"]);
  });

  it("claims multiple instances of the same fixed letter", () => {
    // Word: [E, _, E] — positions 0 and 2 are fixed with same letter
    const fixedLetters: (string | null)[] = ["E", null, "E"];
    const fixedMask = [true, false, true];

    // User types "EXE" — claim 'E' at position 0, claim 'E' at position 2
    // Pool after claim 'E' at pos 0: [X, E] → claim 'E' at pos 2: remaining [X]
    // Position 0 (fixed): E
    // Position 1 (non-fixed): X
    // Position 2 (fixed): E
    const result = deriveDisplayLetters("EXE", fixedLetters, fixedMask);

    expect(result).toEqual(["E", "X", "E"]);
  });

  it("handles word with no fixed letters (all empty)", () => {
    const fixedLetters: (string | null)[] = [null, null, null];
    const fixedMask = [false, false, false];

    // User types "ABC"
    const result = deriveDisplayLetters("ABC", fixedLetters, fixedMask);

    // No fixed letters to claim, all go to non-fixed positions
    expect(result).toEqual(["A", "B", "C"]);
  });

  it("handles word with all fixed letters", () => {
    const fixedLetters: (string | null)[] = ["A", "B", "C"];
    const fixedMask = [true, true, true];

    // User types "ABC" — all claimed, no pool remaining
    const result = deriveDisplayLetters("ABC", fixedLetters, fixedMask);

    expect(result).toEqual(["A", "B", "C"]);
  });

  it("distributes remaining pool letters in order to non-fixed positions", () => {
    // Word: [_, A, _, B] — positions 1 and 3 are fixed
    const fixedLetters: (string | null)[] = [null, "A", null, "B"];
    const fixedMask = [false, true, false, true];

    // User types "XAYB" — claim 'A' → [X, Y, B], claim 'B' → [X, Y]
    // Position 0 (non-fixed): X
    // Position 1 (fixed): A
    // Position 2 (non-fixed): Y
    // Position 3 (fixed): B
    const result = deriveDisplayLetters("XAYB", fixedLetters, fixedMask);

    expect(result).toEqual(["X", "A", "Y", "B"]);
  });

  it("handles single-letter word with fixed letter", () => {
    const fixedLetters: (string | null)[] = ["Z"];
    const fixedMask = [true];

    const result = deriveDisplayLetters("Z", fixedLetters, fixedMask);

    expect(result).toEqual(["Z"]);
  });

  it("handles single-letter word with no fixed letter", () => {
    const fixedLetters: (string | null)[] = [null];
    const fixedMask = [false];

    const result = deriveDisplayLetters("Q", fixedLetters, fixedMask);

    expect(result).toEqual(["Q"]);
  });

  it("returns null for non-fixed positions when pool runs out", () => {
    // This shouldn't normally happen with valid input, but let's test the edge case
    // Word: 3 letters, none fixed, but input is only 2 letters
    const fixedLetters: (string | null)[] = [null, null, null];
    const fixedMask = [false, false, false];

    const result = deriveDisplayLetters("AB", fixedLetters, fixedMask);

    // Input too short, so all positions show null
    expect(result).toEqual([null, null, null]);
  });
});

// ============================================================
// 3. validateInput
// ============================================================
describe("validateInput", () => {
  it("returns true when input matches word length and contains all fixed letters", () => {
    const fixedLetters: (string | null)[] = ["A", null, "C"];
    const fixedMask = [true, false, true];

    // "AXC" has length 3, contains 'A' and 'C'
    expect(validateInput("AXC", fixedLetters, fixedMask)).toBe(true);
  });

  it("returns false when input is too short", () => {
    const fixedLetters: (string | null)[] = ["A", null, "C"];
    const fixedMask = [true, false, true];

    expect(validateInput("AB", fixedLetters, fixedMask)).toBe(false);
  });

  it("returns false when input is too long", () => {
    const fixedLetters: (string | null)[] = ["A", null];
    const fixedMask = [true, false];

    expect(validateInput("ABC", fixedLetters, fixedMask)).toBe(false);
  });

  it("returns false when input is missing a fixed letter", () => {
    const fixedLetters: (string | null)[] = ["A", null, "C"];
    const fixedMask = [true, false, true];

    // "XBC" has length 3 but does not contain 'A'
    expect(validateInput("XBC", fixedLetters, fixedMask)).toBe(false);
  });

  it("returns false when input doesn't have enough copies of a duplicate fixed letter", () => {
    // Two E's fixed
    const fixedLetters: (string | null)[] = ["E", null, "E"];
    const fixedMask = [true, false, true];

    // "EXF" should validate because it has length 3 and contains two E's
    expect(validateInput("EEF", fixedLetters, fixedMask)).toBe(true);

    // "AXE" has length 3 but only one E — should fail
    expect(validateInput("AXE", fixedLetters, fixedMask)).toBe(false);
  });

  it("returns true when input contains more copies of a fixed letter than needed", () => {
    const fixedLetters: (string | null)[] = ["A", null];
    const fixedMask = [true, false];

    // "AA" has length 2 and contains at least one 'A'
    expect(validateInput("AA", fixedLetters, fixedMask)).toBe(true);
  });

  it("returns true for all-empty word (no fixed letters)", () => {
    const fixedLetters: (string | null)[] = [null, null, null];
    const fixedMask = [false, false, false];

    // Any 3-letter input is valid
    expect(validateInput("ABC", fixedLetters, fixedMask)).toBe(true);
    expect(validateInput("XYZ", fixedLetters, fixedMask)).toBe(true);
  });

  it("returns true for all-fixed word when input matches exactly", () => {
    const fixedLetters: (string | null)[] = ["A", "B", "C"];
    const fixedMask = [true, true, true];

    expect(validateInput("ABC", fixedLetters, fixedMask)).toBe(true);
    // "BCA" also contains A, B, C so should be valid
    expect(validateInput("BCA", fixedLetters, fixedMask)).toBe(true);
  });

  it("returns true when input rearranges fixed letters among non-fixed positions", () => {
    // Fixed: positions 0 and 2 have 'A' and 'C'
    const fixedLetters: (string | null)[] = ["A", null, "C"];
    const fixedMask = [true, false, true];

    // "CAX" — contains 'A' and 'C', length 3, valid despite different order
    expect(validateInput("CAX", fixedLetters, fixedMask)).toBe(true);
  });

  it("returns false for empty input on a non-empty word", () => {
    const fixedLetters: (string | null)[] = [null, null];
    const fixedMask = [false, false];

    expect(validateInput("", fixedLetters, fixedMask)).toBe(false);
  });

  it("returns true for single-letter empty word with matching input", () => {
    const fixedLetters: (string | null)[] = [null];
    const fixedMask = [false];

    expect(validateInput("A", fixedLetters, fixedMask)).toBe(true);
  });

  it("returns true for single-letter fixed word with matching input", () => {
    const fixedLetters: (string | null)[] = ["Z"];
    const fixedMask = [true];

    expect(validateInput("Z", fixedLetters, fixedMask)).toBe(true);
    expect(validateInput("A", fixedLetters, fixedMask)).toBe(false);
  });

  it("handles case-insensitive comparison (input is uppercase, fixed letters are uppercase)", () => {
    const fixedLetters: (string | null)[] = ["A", null];
    const fixedMask = [true, false];

    expect(validateInput("AB", fixedLetters, fixedMask)).toBe(true);
  });

  it("claims letters in order — first occurrence is claimed first", () => {
    // Fixed: 'A' at position 0, 'A' at position 2 (two As)
    const fixedLetters: (string | null)[] = ["A", null, "A"];
    const fixedMask = [true, false, true];

    // "AAX" contains two A's — valid
    expect(validateInput("AAX", fixedLetters, fixedMask)).toBe(true);

    // "AXA" contains two A's — valid
    expect(validateInput("AXA", fixedLetters, fixedMask)).toBe(true);

    // "XAA" contains two A's — valid
    expect(validateInput("XAA", fixedLetters, fixedMask)).toBe(true);

    // "BCD" — doesn't have 'A', invalid
    expect(validateInput("BCD", fixedLetters, fixedMask)).toBe(false);
  });
});

// ============================================================
// 4. shuffleNonFixedLetters
// ============================================================
describe("shuffleNonFixedLetters", () => {
  it("leaves fixed positions unchanged", () => {
    const display: (string | null)[] = ["A", "X", "Y", "C"];
    const fixedMask = [true, false, false, true];

    const result = shuffleNonFixedLetters(display, fixedMask);

    // Fixed positions must be unchanged
    expect(result[0]).toBe("A");
    expect(result[3]).toBe("C");
  });

  it("contains the same non-fixed letters, just rearranged", () => {
    const display: (string | null)[] = ["A", "X", "Y", "C"];
    const fixedMask = [true, false, false, true];

    const result = shuffleNonFixedLetters(display, fixedMask);

    // Non-fixed letters are [X, Y], after shuffle should still be [X, Y] in some order
    const nonFixedResult = [result[1], result[2]];
    expect(nonFixedResult).toContain("X");
    expect(nonFixedResult).toContain("Y");
    // Total length preserved
    expect(result).toHaveLength(4);
  });

  it("handles all-fixed display (nothing to shuffle)", () => {
    const display: (string | null)[] = ["A", "B", "C"];
    const fixedMask = [true, true, true];

    const result = shuffleNonFixedLetters(display, fixedMask);

    expect(result).toEqual(["A", "B", "C"]);
  });

  it("handles all-non-fixed display", () => {
    const display: (string | null)[] = ["A", "B", "C"];
    const fixedMask = [false, false, false];

    const result = shuffleNonFixedLetters(display, fixedMask);

    // Result should be a permutation of the input
    expect(result).toHaveLength(3);
    expect(result.sort()).toEqual(["A", "B", "C"]);
  });

  it("handles single non-fixed letter (shuffle is a no-op)", () => {
    const display: (string | null)[] = ["A", "X", "C"];
    const fixedMask = [true, false, true];

    const result = shuffleNonFixedLetters(display, fixedMask);

    // Only one non-fixed letter, shuffle can't change anything
    expect(result).toEqual(["A", "X", "C"]);
  });

  it("handles null values in non-fixed positions", () => {
    // This shouldn't normally happen with valid input, but let's test
    const display: (string | null)[] = ["A", null, "C"];
    const fixedMask = [true, false, true];

    const result = shuffleNonFixedLetters(display, fixedMask);

    // null in non-fixed position stays null (no non-fixed letters to shuffle)
    expect(result).toEqual(["A", null, "C"]);
  });

  it("produces a permutation of non-fixed letters over many shuffles", () => {
    // With enough non-fixed letters, shuffling should eventually produce
    // different orderings. For 3 letters there are 6 permutations,
    // so over 20 shuffles we should see at least 2 different orderings.
    const display: (string | null)[] = ["A", "X", "Y", "Z", "B"];
    const fixedMask = [true, false, false, false, true];

    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = shuffleNonFixedLetters(display, fixedMask);
      // Extract just the non-fixed positions as a string
      results.add(`${result[1]}${result[2]}${result[3]}`);
    }

    // Should see at least 2 different orderings (almost guaranteed with 3 letters)
    expect(results.size).toBeGreaterThan(1);
  });

  it("preserves all elements including duplicates", () => {
    const display: (string | null)[] = [null, "E", "E", "L"];
    const fixedMask = [false, false, false, true];

    const result = shuffleNonFixedLetters(display, fixedMask);

    expect(result).toHaveLength(4);
    // Fixed position unchanged
    expect(result[3]).toBe("L");
    // Non-fixed positions contain [null, E, E] in some permutation
    // (null won't be shuffled since shuffle only picks non-null non-fixed)
    // Actually, null values are skipped in the extraction, so:
    // nonFixed = ["E", "E"], indices = [1, 2]
    // After shuffle: still ["E", "E"] (order may be the same since both are E)
    expect(result[0]).toBeNull(); // position 0 stays null
    // Positions 1 and 2 should be "E" (both)
    expect([result[1], result[2]].sort()).toEqual(["E", "E"]);
  });

  it("does not mutate the input array", () => {
    const display: (string | null)[] = ["A", "X", "Y", "C"];
    const fixedMask = [true, false, false, true];
    const original = [...display];

    shuffleNonFixedLetters(display, fixedMask);

    expect(display).toEqual(original);
  });

  it("handles empty display", () => {
    const display: (string | null)[] = [];
    const fixedMask: boolean[] = [];

    const result = shuffleNonFixedLetters(display, fixedMask);

    expect(result).toEqual([]);
  });

  it("handles two non-fixed letters", () => {
    const display: (string | null)[] = ["A", "X", "Y", "C"];
    const fixedMask = [true, false, false, true];

    // Over many shuffles, should see both orderings: XY and YX
    const orderings = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const result = shuffleNonFixedLetters(display, fixedMask);
      orderings.add(`${result[1]}${result[2]}`);
    }

    // With 2 non-fixed letters, expect both XY and YX orderings
    expect(orderings.size).toBeGreaterThan(1);
    // Both orderings are valid
    expect(orderings.has("XY") || orderings.has("YX")).toBe(true);
  });
});