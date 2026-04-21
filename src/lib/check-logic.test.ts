import { describe, it, expect } from "vitest";
import { checkPuzzle, clearErrors } from "./check-logic";
import type { CellData, PlayerLetters, CheckResult } from "./types";

// Helper: create a white cell with a given letter
function whiteCellWithLetter(letter: string): CellData {
  return {
    black: false,
    letter,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
  };
}

// Helper: create a white cell with no letter
function whiteCellEmpty(): CellData {
  return {
    black: false,
    letter: null,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
  };
}

// Helper: create a black cell
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

// Helper: create PlayerLetters from a 2D array of strings | null
function makePlayerLetters(
  letters: (string | null)[][]
): PlayerLetters {
  return letters.map((row) => row.map((l) => l ?? null));
}

// Helper: create a grid from a 2D array mixing black info and answer letters
// Each element is either null (black cell) or a string (white cell with that letter)
function buildGridWithAnswers(
  layout: (string | null)[][]
): CellData[][] {
  return layout.map((row) =>
    row.map((entry) =>
      entry === null
        ? blackCell()
        : whiteCellWithLetter(entry)
    )
  );
}

// ============================================================
// 1. checkPuzzle — Classification tests
// ============================================================
describe("checkPuzzle", () => {
  // ---- Complete & Correct ----
  it("returns complete-correct when all white cells are filled correctly", () => {
    // 2x2 grid, all white, all correct
    // A B
    // C D
    const grid = buildGridWithAnswers([
      ["A", "B"],
      ["C", "D"],
    ]);
    const playerLetters = makePlayerLetters([
      ["A", "B"],
      ["C", "D"],
    ]);

    const result = checkPuzzle(grid, playerLetters);

    expect(result.type).toBe("complete-correct");
    expect(result.incorrectCells).toHaveLength(0);
    expect(result.emptyCells).toHaveLength(0);
  });

  // ---- Complete & Incorrect ----
  it("returns complete-incorrect when all cells filled but some wrong", () => {
    // 2x2 grid
    // A B
    // C D
    const grid = buildGridWithAnswers([
      ["A", "B"],
      ["C", "D"],
    ]);
    const playerLetters = makePlayerLetters([
      ["A", "X"], // wrong at (0,1)
      ["Y", "D"], // wrong at (1,0)
    ]);

    const result = checkPuzzle(grid, playerLetters);

    expect(result.type).toBe("complete-incorrect");
    expect(result.emptyCells).toHaveLength(0);
    // incorrectCells contains the two wrong cells
    expect(result.incorrectCells).toHaveLength(2);
    expect(result.incorrectCells).toContainEqual({ row: 0, col: 1 });
    expect(result.incorrectCells).toContainEqual({ row: 1, col: 0 });
  });

  // ---- Incomplete & Correct ----
  it("returns incomplete-correct when some cells empty and all filled cells correct", () => {
    // 2x2 grid
    // A B
    // C D
    const grid = buildGridWithAnswers([
      ["A", "B"],
      ["C", "D"],
    ]);
    const playerLetters = makePlayerLetters([
      ["A", null], // empty at (0,1)
      ["C", null], // empty at (1,1)
    ]);

    const result = checkPuzzle(grid, playerLetters);

    expect(result.type).toBe("incomplete-correct");
    expect(result.incorrectCells).toHaveLength(0);
    expect(result.emptyCells).toHaveLength(2);
    expect(result.emptyCells).toContainEqual({ row: 0, col: 1 });
    expect(result.emptyCells).toContainEqual({ row: 1, col: 1 });
  });

  // ---- Incomplete & Incorrect ----
  it("returns incomplete-incorrect when some cells empty and some filled cells wrong", () => {
    // 2x2 grid
    // A B
    // C D
    const grid = buildGridWithAnswers([
      ["A", "B"],
      ["C", "D"],
    ]);
    const playerLetters = makePlayerLetters([
      ["A", null], // empty at (0,1)
      ["X", null], // wrong at (1,0), empty at (1,1)
    ]);

    const result = checkPuzzle(grid, playerLetters);

    expect(result.type).toBe("incomplete-incorrect");
    expect(result.incorrectCells).toHaveLength(1);
    expect(result.incorrectCells).toContainEqual({ row: 1, col: 0 });
    expect(result.emptyCells).toHaveLength(2);
    expect(result.emptyCells).toContainEqual({ row: 0, col: 1 });
    expect(result.emptyCells).toContainEqual({ row: 1, col: 1 });
  });

  // ---- Black cells are ignored ----
  it("ignores black cells — only white cells are checked", () => {
    // 3x3 grid with black center
    // A B _
    // C # E
    // F G H
    // (using null for black)
    const grid = buildGridWithAnswers([
      ["A", "B", "C"],
      ["D", null, "E"],
      ["F", "G", "H"],
    ]);
    // All white cells filled correctly, black cell ignored
    const playerLetters = makePlayerLetters([
      ["A", "B", "C"],
      ["D", null, "E"],
      ["F", "G", "H"],
    ]);

    const result = checkPuzzle(grid, playerLetters);

    expect(result.type).toBe("complete-correct");
    expect(result.incorrectCells).toHaveLength(0);
    expect(result.emptyCells).toHaveLength(0);
  });

  // ---- Player letter matching answer letter is correct ----
  it("player letter that matches answer letter is correct", () => {
    const grid = buildGridWithAnswers([["Z"]]);
    const playerLetters = makePlayerLetters([["Z"]]);

    const result = checkPuzzle(grid, playerLetters);

    expect(result.type).toBe("complete-correct");
  });

  // ---- Player letter null on white cell = empty cell ----
  it("player letter null on a white cell counts as empty cell", () => {
    const grid = buildGridWithAnswers([["A"]]);
    const playerLetters: PlayerLetters = [[null]];

    const result = checkPuzzle(grid, playerLetters);

    expect(result.type).toBe("incomplete-correct");
    expect(result.emptyCells).toHaveLength(1);
    expect(result.emptyCells[0]).toEqual({ row: 0, col: 0 });
  });

  // ---- Player letter wrong = incorrect cell ----
  it("player letter that differs from answer letter is incorrect", () => {
    const grid = buildGridWithAnswers([["A"]]);
    const playerLetters = makePlayerLetters([["B"]]);

    const result = checkPuzzle(grid, playerLetters);

    expect(result.type).toBe("complete-incorrect");
    expect(result.incorrectCells).toHaveLength(1);
    expect(result.incorrectCells[0]).toEqual({ row: 0, col: 0 });
  });

  // ---- All black grid → complete-correct (no white cells to check) ----
  it("returns complete-correct for an all-black grid (no white cells)", () => {
    const grid = buildGridWithAnswers([
      [null, null],
      [null, null],
    ]);
    const playerLetters = makePlayerLetters([
      [null, null],
      [null, null],
    ]);

    const result = checkPuzzle(grid, playerLetters);

    expect(result.type).toBe("complete-correct");
    expect(result.incorrectCells).toHaveLength(0);
    expect(result.emptyCells).toHaveLength(0);
  });

  // ---- Single cell grid ----
  it("works correctly for a single-cell grid", () => {
    const grid = buildGridWithAnswers([["A"]]);
    const playerLetters = makePlayerLetters([["A"]]);

    const result = checkPuzzle(grid, playerLetters);
    expect(result.type).toBe("complete-correct");

    // Now with empty cell
    const playerLetters2 = makePlayerLetters([[null]]);
    const result2 = checkPuzzle(grid, playerLetters2);
    expect(result2.type).toBe("incomplete-correct");
  });

  // ---- Mixed: correct, empty, incorrect, black in same grid ----
  it("correctly classifies a grid with correct, empty, incorrect, and black cells", () => {
    // 3x3 grid:
    // A B  _
    // D #  F
    // _  H  I
    // Player:
    // A B  _
    // X #  null
    // null H I
    const grid = buildGridWithAnswers([
      ["A", "B", "C"],
      ["D", null, "F"],
      ["G", "H", "I"],
    ]);
    const playerLetters = makePlayerLetters([
      ["A", "B", "C"],    // all correct
      ["X", null, null],  // (1,0) wrong, (1,2) empty
      [null, "H", "I"],   // (2,0) empty, rest correct
    ]);

    const result = checkPuzzle(grid, playerLetters);

    // We have both empty and incorrect cells → incomplete-incorrect
    expect(result.type).toBe("incomplete-incorrect");

    // Incorrect: (1,0) X≠D
    expect(result.incorrectCells).toHaveLength(1);
    expect(result.incorrectCells[0]).toEqual({ row: 1, col: 0 });

    // Empty: (1,2), (2,0)
    expect(result.emptyCells).toHaveLength(2);
    expect(result.emptyCells).toContainEqual({ row: 1, col: 2 });
    expect(result.emptyCells).toContainEqual({ row: 2, col: 0 });
  });

  // ---- Case sensitivity: answers are exact match ----
  it("treats letter comparison as exact (case-sensitive)", () => {
    // If the grid has "A" and the player has "a", it should be incorrect
    // (In practice the app uppercases input, but the check itself is strict)
    const grid = buildGridWithAnswers([["A"]]);
    const playerLetters = makePlayerLetters([["B"]]);

    const result = checkPuzzle(grid, playerLetters);
    expect(result.type).toBe("complete-incorrect");
  });

  // ---- Larger grid: all correct ----
  it("handles a larger grid where all cells are filled correctly", () => {
    // 5x5 all-white grid with unique letters
    const rows = [
      ["A", "B", "C", "D", "E"],
      ["F", "G", "H", "I", "J"],
      ["K", "L", "M", "N", "O"],
      ["P", "Q", "R", "S", "T"],
      ["U", "V", "W", "X", "Y"],
    ];
    const grid = buildGridWithAnswers(rows);
    const playerLetters = makePlayerLetters(rows);

    const result = checkPuzzle(grid, playerLetters);

    expect(result.type).toBe("complete-correct");
    expect(result.incorrectCells).toHaveLength(0);
    expect(result.emptyCells).toHaveLength(0);
  });
});

// ============================================================
// 2. clearErrors — Error clearing tests
// ============================================================
describe("clearErrors", () => {
  it("clears incorrect cells by setting them to null", () => {
    // 2x2: (0,1) is incorrect
    const playerLetters = makePlayerLetters([
      ["A", "X"],
      ["C", "D"],
    ]);
    const checkResult: CheckResult = {
      type: "complete-incorrect",
      incorrectCells: [{ row: 0, col: 1 }],
      emptyCells: [],
    };

    const result = clearErrors(playerLetters, checkResult);

    // (0,1) should be null now
    expect(result[0][1]).toBeNull();
    // Other cells unchanged
    expect(result[0][0]).toBe("A");
    expect(result[1][0]).toBe("C");
    expect(result[1][1]).toBe("D");
  });

  it("does not mutate the original playerLetters", () => {
    const playerLetters = makePlayerLetters([["X"]]);
    const checkResult: CheckResult = {
      type: "complete-incorrect",
      incorrectCells: [{ row: 0, col: 0 }],
      emptyCells: [],
    };

    // Capture original value
    const originalValue = playerLetters[0][0];

    const result = clearErrors(playerLetters, checkResult);

    // Original should be unchanged
    expect(playerLetters[0][0]).toBe(originalValue);
    // Result should have null at the cleared position
    expect(result[0][0]).toBeNull();
  });

  it("leaves empty cells untouched", () => {
    // 1x3: (0,2) is empty, (0,0) is incorrect, (0,1) is correct
    const playerLetters = makePlayerLetters([["X", "B", null]]);
    const checkResult: CheckResult = {
      type: "incomplete-incorrect",
      incorrectCells: [{ row: 0, col: 0 }],
      emptyCells: [{ row: 0, col: 2 }],
    };

    const result = clearErrors(playerLetters, checkResult);

    expect(result[0][0]).toBeNull(); // cleared
    expect(result[0][1]).toBe("B");  // unchanged
    expect(result[0][2]).toBeNull(); // was already null, stays null
  });

  it("leaves correct cells untouched", () => {
    const playerLetters = makePlayerLetters([["A", "X"]]);
    const checkResult: CheckResult = {
      type: "complete-incorrect",
      incorrectCells: [{ row: 0, col: 1 }],
      emptyCells: [],
    };

    const result = clearErrors(playerLetters, checkResult);

    expect(result[0][0]).toBe("A");  // correct, untouched
    expect(result[0][1]).toBeNull(); // cleared
  });

  it("clears all incorrect cells when multiple wrong", () => {
    const playerLetters = makePlayerLetters([
      ["X", "B"],
      ["C", "Y"],
    ]);
    const checkResult: CheckResult = {
      type: "complete-incorrect",
      incorrectCells: [
        { row: 0, col: 0 },
        { row: 1, col: 1 },
      ],
      emptyCells: [],
    };

    const result = clearErrors(playerLetters, checkResult);

    expect(result[0][0]).toBeNull();  // cleared
    expect(result[0][1]).toBe("B");   // correct, untouched
    expect(result[1][0]).toBe("C");   // correct, untouched
    expect(result[1][1]).toBeNull();   // cleared
  });

  it("mixed scenario: some correct, some empty, some incorrect", () => {
    // 3x3 grid with various cell states
    const playerLetters = makePlayerLetters([
      ["A", "X", null],   // (0,0) correct, (0,1) wrong, (0,2) empty
      ["D", null, "F"],   // (1,0) correct, (1,1) black (null), (1,2) correct
      [null, "H", "Y"],   // (2,0) empty, (2,1) correct, (2,2) wrong
    ]);
    const checkResult: CheckResult = {
      type: "incomplete-incorrect",
      incorrectCells: [
        { row: 0, col: 1 },
        { row: 2, col: 2 },
      ],
      emptyCells: [
        { row: 0, col: 2 },
        { row: 2, col: 0 },
      ],
    };

    const result = clearErrors(playerLetters, checkResult);

    // Incorrect cells cleared to null
    expect(result[0][1]).toBeNull();
    expect(result[2][2]).toBeNull();

    // Empty cells stay null (unchanged)
    expect(result[0][2]).toBeNull();
    expect(result[2][0]).toBeNull();

    // Correct cells stay the same
    expect(result[0][0]).toBe("A");
    expect(result[1][0]).toBe("D");
    expect(result[1][2]).toBe("F");
    expect(result[2][1]).toBe("H");

    // Black cell stays null
    expect(result[1][1]).toBeNull();
  });

  it("returns result with no modifications when there are no incorrect cells", () => {
    const playerLetters = makePlayerLetters([["A"]]);
    const checkResult: CheckResult = {
      type: "complete-correct",
      incorrectCells: [],
      emptyCells: [],
    };

    const result = clearErrors(playerLetters, checkResult);

    expect(result[0][0]).toBe("A");
  });

  it("deep copies the playerLetters array (modifying result does not affect original)", () => {
    const playerLetters = makePlayerLetters([["A", "B"]]);

    const checkResult: CheckResult = {
      type: "complete-correct",
      incorrectCells: [],
      emptyCells: [],
    };

    const result = clearErrors(playerLetters, checkResult);

    // Mutate the result and verify original is unaffected
    result[0][0] = "Z";
    expect(playerLetters[0][0]).toBe("A");
  });

  it("handles an all-black grid (no cells to clear)", () => {
    const playerLetters = makePlayerLetters([
      [null, null],
      [null, null],
    ]);
    const checkResult: CheckResult = {
      type: "complete-correct",
      incorrectCells: [],
      emptyCells: [],
    };

    const result = clearErrors(playerLetters, checkResult);

    expect(result[0][0]).toBeNull();
    expect(result[1][1]).toBeNull();
  });
});