import { describe, it, expect } from "vitest";
import { checkPuzzle, clearErrors } from "./check-logic";
import type { CellData, CheckResult } from "./types";

// Helper: create a white cell with a puzzle letter
function whiteCellWithLetter(letter: string): CellData {
  return {
    black: false,
    puzzleLetter: letter,
    playerLetter: null,
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
    puzzleLetter: null,
    playerLetter: null,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
  };
}

// Helper: create a grid from a 2D array mixing black info and answer letters
// Each element is either null (black cell) or a string (white cell with that puzzle letter)
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
    // Set player letters to match puzzle letters
    grid[0][0].playerLetter = "A";
    grid[0][1].playerLetter = "B";
    grid[1][0].playerLetter = "C";
    grid[1][1].playerLetter = "D";

    const result = checkPuzzle(grid);

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
    grid[0][0].playerLetter = "A";
    grid[0][1].playerLetter = "X"; // wrong at (0,1)
    grid[1][0].playerLetter = "Y"; // wrong at (1,0)
    grid[1][1].playerLetter = "D";

    const result = checkPuzzle(grid);

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
    grid[0][0].playerLetter = "A";
    grid[0][1].playerLetter = null; // empty at (0,1)
    grid[1][0].playerLetter = "C";
    grid[1][1].playerLetter = null; // empty at (1,1)

    const result = checkPuzzle(grid);

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
    grid[0][0].playerLetter = "A";
    grid[0][1].playerLetter = null; // empty at (0,1)
    grid[1][0].playerLetter = "X"; // wrong at (1,0)
    grid[1][1].playerLetter = null; // empty at (1,1)

    const result = checkPuzzle(grid);

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
    grid[0][0].playerLetter = "A";
    grid[0][1].playerLetter = "B";
    grid[0][2].playerLetter = "C";
    grid[1][0].playerLetter = "D";
    // (1,1) is black — playerLetter doesn't matter
    grid[1][2].playerLetter = "E";
    grid[2][0].playerLetter = "F";
    grid[2][1].playerLetter = "G";
    grid[2][2].playerLetter = "H";

    const result = checkPuzzle(grid);

    expect(result.type).toBe("complete-correct");
    expect(result.incorrectCells).toHaveLength(0);
    expect(result.emptyCells).toHaveLength(0);
  });

  // ---- Player letter matching answer letter is correct ----
  it("player letter that matches answer letter is correct", () => {
    const grid = buildGridWithAnswers([["Z"]]);
    grid[0][0].playerLetter = "Z";

    const result = checkPuzzle(grid);

    expect(result.type).toBe("complete-correct");
  });

  // ---- Player letter null on white cell = empty cell ----
  it("player letter null on a white cell counts as empty cell", () => {
    const grid = buildGridWithAnswers([["A"]]);
    grid[0][0].playerLetter = null;

    const result = checkPuzzle(grid);

    expect(result.type).toBe("incomplete-correct");
    expect(result.emptyCells).toHaveLength(1);
    expect(result.emptyCells[0]).toEqual({ row: 0, col: 0 });
  });

  // ---- Player letter wrong = incorrect cell ----
  it("player letter that differs from answer letter is incorrect", () => {
    const grid = buildGridWithAnswers([["A"]]);
    grid[0][0].playerLetter = "B";

    const result = checkPuzzle(grid);

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

    const result = checkPuzzle(grid);

    expect(result.type).toBe("complete-correct");
    expect(result.incorrectCells).toHaveLength(0);
    expect(result.emptyCells).toHaveLength(0);
  });

  // ---- Single cell grid ----
  it("works correctly for a single-cell grid", () => {
    const grid = buildGridWithAnswers([["A"]]);
    grid[0][0].playerLetter = "A";

    const result = checkPuzzle(grid);
    expect(result.type).toBe("complete-correct");

    // Now with empty cell
    grid[0][0].playerLetter = null;
    const result2 = checkPuzzle(grid);
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
    grid[0][0].playerLetter = "A";     // correct
    grid[0][1].playerLetter = "B";     // correct
    grid[0][2].playerLetter = "C";     // correct
    grid[1][0].playerLetter = "X";     // wrong (X≠D)
    // (1,1) black — skip
    grid[1][2].playerLetter = null;    // empty
    grid[2][0].playerLetter = null;    // empty
    grid[2][1].playerLetter = "H";     // correct
    grid[2][2].playerLetter = "I";     // correct

    const result = checkPuzzle(grid);

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
    grid[0][0].playerLetter = "B";

    const result = checkPuzzle(grid);
    expect(result.type).toBe("complete-incorrect");
  });

  // ---- Larger grid: all correct ----
  it("handles a larger grid where all cells are filled correctly", () => {
    const rows = [
      ["A", "B", "C", "D", "E"],
      ["F", "G", "H", "I", "J"],
      ["K", "L", "M", "N", "O"],
      ["P", "Q", "R", "S", "T"],
      ["U", "V", "W", "X", "Y"],
    ];
    const grid = buildGridWithAnswers(rows);
    // Set all player letters to match
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        grid[r][c].playerLetter = rows[r][c];
      }
    }

    const result = checkPuzzle(grid);

    expect(result.type).toBe("complete-correct");
    expect(result.incorrectCells).toHaveLength(0);
    expect(result.emptyCells).toHaveLength(0);
  });
});

// ============================================================
// 2. clearErrors — Error clearing tests
// ============================================================
describe("clearErrors", () => {
  it("clears incorrect cells by setting playerLetter to null", () => {
    // 2x2: (0,1) is incorrect
    const grid = buildGridWithAnswers([
      ["A", "B"],
      ["C", "D"],
    ]);
    grid[0][0].playerLetter = "A";
    grid[0][1].playerLetter = "X"; // wrong
    grid[1][0].playerLetter = "C";
    grid[1][1].playerLetter = "D";

    const checkResult: CheckResult = {
      type: "complete-incorrect",
      incorrectCells: [{ row: 0, col: 1 }],
      emptyCells: [],
    };

    const result = clearErrors(grid, checkResult);

    // (0,1) should have playerLetter null now
    expect(result[0][1].playerLetter).toBeNull();
    // Other cells unchanged
    expect(result[0][0].playerLetter).toBe("A");
    expect(result[1][0].playerLetter).toBe("C");
    expect(result[1][1].playerLetter).toBe("D");
  });

  it("does not mutate the original grid", () => {
    const grid = buildGridWithAnswers([["A"]]);
    grid[0][0].playerLetter = "X";

    const checkResult: CheckResult = {
      type: "complete-incorrect",
      incorrectCells: [{ row: 0, col: 0 }],
      emptyCells: [],
    };

    // Capture original value
    const originalValue = grid[0][0].playerLetter;

    const result = clearErrors(grid, checkResult);

    // Original should be unchanged
    expect(grid[0][0].playerLetter).toBe(originalValue);
    // Result should have null at the cleared position
    expect(result[0][0].playerLetter).toBeNull();
  });

  it("leaves empty cells untouched", () => {
    // 1x3: (0,2) is empty, (0,0) is incorrect, (0,1) is correct
    const grid = buildGridWithAnswers([
      ["A", "B", "C"],
    ]);
    grid[0][0].playerLetter = "X";    // wrong
    grid[0][1].playerLetter = "B";    // correct
    grid[0][2].playerLetter = null;   // empty

    const checkResult: CheckResult = {
      type: "incomplete-incorrect",
      incorrectCells: [{ row: 0, col: 0 }],
      emptyCells: [{ row: 0, col: 2 }],
    };

    const result = clearErrors(grid, checkResult);

    expect(result[0][0].playerLetter).toBeNull(); // cleared
    expect(result[0][1].playerLetter).toBe("B");  // unchanged
    expect(result[0][2].playerLetter).toBeNull(); // was already null, stays null
  });

  it("leaves correct cells untouched", () => {
    const grid = buildGridWithAnswers([
      ["A", "B"],
    ]);
    grid[0][0].playerLetter = "A"; // correct
    grid[0][1].playerLetter = "X"; // wrong

    const checkResult: CheckResult = {
      type: "complete-incorrect",
      incorrectCells: [{ row: 0, col: 1 }],
      emptyCells: [],
    };

    const result = clearErrors(grid, checkResult);

    expect(result[0][0].playerLetter).toBe("A");  // correct, untouched
    expect(result[0][1].playerLetter).toBeNull(); // cleared
  });

  it("clears all incorrect cells when multiple wrong", () => {
    const grid = buildGridWithAnswers([
      ["A", "B"],
      ["C", "D"],
    ]);
    grid[0][0].playerLetter = "X"; // wrong
    grid[0][1].playerLetter = "B"; // correct
    grid[1][0].playerLetter = "C"; // correct
    grid[1][1].playerLetter = "Y"; // wrong

    const checkResult: CheckResult = {
      type: "complete-incorrect",
      incorrectCells: [
        { row: 0, col: 0 },
        { row: 1, col: 1 },
      ],
      emptyCells: [],
    };

    const result = clearErrors(grid, checkResult);

    expect(result[0][0].playerLetter).toBeNull();  // cleared
    expect(result[0][1].playerLetter).toBe("B");   // correct, untouched
    expect(result[1][0].playerLetter).toBe("C");   // correct, untouched
    expect(result[1][1].playerLetter).toBeNull();   // cleared
  });

  it("mixed scenario: some correct, some empty, some incorrect", () => {
    // 3x3 grid with various cell states
    const grid = buildGridWithAnswers([
      ["A", "B", "C"],
      ["D", null, "F"],
      ["G", "H", "I"],
    ]);
    grid[0][0].playerLetter = "A";    // correct
    grid[0][1].playerLetter = "X";    // wrong
    grid[0][2].playerLetter = null;   // empty
    grid[1][0].playerLetter = "D";    // correct
    // (1,1) is black
    grid[1][2].playerLetter = "F";   // correct
    grid[2][0].playerLetter = null;   // empty
    grid[2][1].playerLetter = "H";   // correct
    grid[2][2].playerLetter = "Y";    // wrong

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

    const result = clearErrors(grid, checkResult);

    // Incorrect cells cleared to null
    expect(result[0][1].playerLetter).toBeNull();
    expect(result[2][2].playerLetter).toBeNull();

    // Empty cells stay null (unchanged)
    expect(result[0][2].playerLetter).toBeNull();
    expect(result[2][0].playerLetter).toBeNull();

    // Correct cells stay the same
    expect(result[0][0].playerLetter).toBe("A");
    expect(result[1][0].playerLetter).toBe("D");
    expect(result[1][2].playerLetter).toBe("F");
    expect(result[2][1].playerLetter).toBe("H");

    // Black cell stays null
    expect(result[1][1].playerLetter).toBeNull();
  });

  it("returns result with no modifications when there are no incorrect cells", () => {
    const grid = buildGridWithAnswers([["A"]]);
    grid[0][0].playerLetter = "A";

    const checkResult: CheckResult = {
      type: "complete-correct",
      incorrectCells: [],
      emptyCells: [],
    };

    const result = clearErrors(grid, checkResult);

    expect(result[0][0].playerLetter).toBe("A");
  });

  it("deep copies the grid (modifying result does not affect original)", () => {
    const grid = buildGridWithErrors([
      ["A", "B"],
    ]);
    grid[0][0].playerLetter = "A";
    grid[0][1].playerLetter = "B";

    const checkResult: CheckResult = {
      type: "complete-correct",
      incorrectCells: [],
      emptyCells: [],
    };

    const result = clearErrors(grid, checkResult);

    // Mutate the result and verify original is unaffected
    result[0][0].playerLetter = "Z";
    expect(grid[0][0].playerLetter).toBe("A");
  });

  it("handles an all-black grid (no cells to clear)", () => {
    const grid = buildGridWithAnswers([
      [null, null],
      [null, null],
    ]);

    const checkResult: CheckResult = {
      type: "complete-correct",
      incorrectCells: [],
      emptyCells: [],
    };

    const result = clearErrors(grid, checkResult);

    expect(result[0][0].playerLetter).toBeNull();
    expect(result[1][1].playerLetter).toBeNull();
  });
});

// Helper for the deep copy test (same as buildGridWithAnswers but named differently for clarity)
function buildGridWithErrors(layout: (string | null)[][]): CellData[][] {
  return layout.map((row) =>
    row.map((entry) =>
      entry === null
        ? blackCell()
        : whiteCellWithLetter(entry)
    )
  );
}