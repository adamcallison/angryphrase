import { describe, it, expect } from "vitest";
import {
  createEmptyGrid,
  deriveWords,
  assignNumbers,
  getWordsAtCell,
  getWordInDirection,
  advancePosition,
  retreatPosition,
  movePosition,
  isSelectableCell,
  computeWordLength,
  getSingleWordLengthPattern,
} from "./grid-logic";
import type { CellData, Word } from "./types";

// Helper: create a single white cell with default values
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

// Helper: create a single black cell
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

// Helper: build a grid from a 2D boolean array (true = black)
function buildGrid(blacks: boolean[][]): CellData[][] {
  return blacks.map((row) =>
    row.map((isBlack) => (isBlack ? blackCell() : whiteCell()))
  );
}

// Helper: create a Word for testing (minimal fields)
function makeWord(
  startRow: number,
  startCol: number,
  direction: "across" | "down",
  length: number,
  number: number,
  clue = ""
): Word {
  return {
    startRow,
    startCol,
    direction,
    length,
    number,
    clue,
    nextWord: null,
  };
}

// ============================================================
// 1. createEmptyGrid
// ============================================================
describe("createEmptyGrid", () => {
  it("creates a 15x15 grid with all default cells", () => {
    const grid = createEmptyGrid(15);
    expect(grid).toHaveLength(15);
    for (let r = 0; r < 15; r++) {
      expect(grid[r]).toHaveLength(15);
      for (let c = 0; c < 15; c++) {
        const cell = grid[r][c];
        expect(cell.black).toBe(false);
        expect(cell.letter).toBeNull();
        expect(cell.spaceRight).toBe(false);
        expect(cell.spaceBottom).toBe(false);
        expect(cell.hyphenRight).toBe(false);
        expect(cell.hyphenBottom).toBe(false);
      }
    }
  });

  it("creates a 5x5 grid", () => {
    const grid = createEmptyGrid(5);
    expect(grid).toHaveLength(5);
    expect(grid[0]).toHaveLength(5);
    expect(grid[4][4].black).toBe(false);
  });

  it("creates a 25x25 grid", () => {
    const grid = createEmptyGrid(25);
    expect(grid).toHaveLength(25);
    expect(grid[24]).toHaveLength(25);
  });

  it("creates an empty array for size 0", () => {
    const grid = createEmptyGrid(0);
    expect(grid).toHaveLength(0);
  });

  it("creates a 1x1 grid", () => {
    const grid = createEmptyGrid(1);
    expect(grid).toHaveLength(1);
    expect(grid[0]).toHaveLength(1);
    expect(grid[0][0].black).toBe(false);
  });
});

// ============================================================
// 2. deriveWords
// ============================================================
describe("deriveWords", () => {
  it("all-white 5x5 grid produces 5 across and 5 down words", () => {
    const grid = createEmptyGrid(5);
    const words = deriveWords(grid);

    const acrossWords = words.filter((w) => w.direction === "across");
    const downWords = words.filter((w) => w.direction === "down");

    expect(acrossWords).toHaveLength(5);
    expect(downWords).toHaveLength(5);

    // Each across word starts at col 0, length 5
    for (let r = 0; r < 5; r++) {
      const word = acrossWords.find(
        (w) => w.startRow === r && w.startCol === 0
      );
      expect(word).toBeDefined();
      expect(word!.length).toBe(5);
    }

    // Each down word starts at row 0, length 5
    for (let c = 0; c < 5; c++) {
      const word = downWords.find(
        (w) => w.startRow === 0 && w.startCol === c
      );
      expect(word).toBeDefined();
      expect(word!.length).toBe(5);
    }
  });

  it("grid with black cells produces correct words", () => {
    // 3x3 grid:
    // W W B
    // W W B
    // B B B
    const grid = buildGrid([
      [false, false, true],
      [false, false, true],
      [true, true, true],
    ]);
    const words = deriveWords(grid);

    const acrossWords = words.filter((w) => w.direction === "across");
    const downWords = words.filter((w) => w.direction === "down");

    // Row 0: W-W → across word at (0,0) length 2
    // Row 1: W-W → across word at (1,0) length 2
    // Row 2: all black → no across word
    expect(acrossWords).toHaveLength(2);
    expect(acrossWords[0]).toMatchObject({
      startRow: 0,
      startCol: 0,
      length: 2,
    });
    expect(acrossWords[1]).toMatchObject({
      startRow: 1,
      startCol: 0,
      length: 2,
    });

    // Col 0: W-W-B → down word at (0,0) length 2
    // Col 1: W-W-B → down word at (0,1) length 2
    // Col 2: all black → no down word
    expect(downWords).toHaveLength(2);
    expect(downWords[0]).toMatchObject({
      startRow: 0,
      startCol: 0,
      length: 2,
    });
    expect(downWords[1]).toMatchObject({
      startRow: 0,
      startCol: 1,
      length: 2,
    });
  });

  it("isolated single white cells are NOT words", () => {
    // 3x3 grid:
    // W B W
    // B B B
    // B W B
    const grid = buildGrid([
      [false, true, false],
      [true, true, true],
      [true, false, true],
    ]);
    const words = deriveWords(grid);

    // (0,0) is isolated horizontally (right is black) and vertically (below is black) → not a word
    // (0,2) is isolated horizontally (left is black) and vertically (below is black) → not a word
    // (2,1) is isolated horizontally (left and right are black) and vertically (above is black) → not a word
    expect(words).toHaveLength(0);
  });

  it("W-B-W row pattern produces no across words (two 1-cell segments)", () => {
    // 3x3 grid where each row has the W-B-W pattern
    // W B W
    // W B W
    // B B B
    // Each row has two 1-cell segments — no across word ≥ 2
    // But columns 0 and 2 have down words of length 2
    const grid = buildGrid([
      [false, true, false],
      [false, true, false],
      [true, true, true],
    ]);
    const words = deriveWords(grid);

    const acrossWords = words.filter((w) => w.direction === "across");
    const downWords = words.filter((w) => w.direction === "down");
    expect(acrossWords).toHaveLength(0);
    // Column 0: W, W → down word of length 2
    // Column 2: W, W → down word of length 2
    expect(downWords).toHaveLength(2);
  });

  it("all-black grid produces no words", () => {
    // 3x3 all black
    const grid = buildGrid([
      [true, true, true],
      [true, true, true],
      [true, true, true],
    ]);
    const words = deriveWords(grid);
    expect(words).toHaveLength(0);
  });

  it("realistic crossword pattern produces correct words", () => {
    // 5x5 with a common crossword pattern:
    // W W B W W
    // W W B W W
    // B B B B B
    // W W B W W
    // W W B W W
    const grid = buildGrid([
      [false, false, true, false, false],
      [false, false, true, false, false],
      [true, true, true, true, true],
      [false, false, true, false, false],
      [false, false, true, false, false],
    ]);
    const words = deriveWords(grid);

    const acrossWords = words.filter((w) => w.direction === "across");
    const downWords = words.filter((w) => w.direction === "down");

    // Rows 0,1: two across words each (len2 at col0, len2 at col3)
    // Row 2: all black, no across words
    // Rows 3,4: two across words each (len2 at col0, len2 at col3)
    // Total: 4 rows × 2 = 8 across words
    expect(acrossWords).toHaveLength(8);

    // Cols 0,1: two down words each (len2 at row0, len2 at row3)
    // Col 2: all black
    // Cols 3,4: two down words each (len2 at row0, len2 at row3)
    // Total: 4 cols × 2 = 8 down words
    expect(downWords).toHaveLength(8);
  });

  it("sets number to 0 for all derived words (numbering is separate)", () => {
    const grid = createEmptyGrid(5);
    const words = deriveWords(grid);
    for (const word of words) {
      expect(word.number).toBe(0);
    }
  });
});

// ============================================================
// 3. assignNumbers
// ============================================================
describe("assignNumbers", () => {
  it("all-white grid: (0,0) gets number 1 as it starts both across and down", () => {
    const grid = createEmptyGrid(5);
    const words = deriveWords(grid);
    const numbers = assignNumbers(words);

    expect(numbers.get("0-0")).toBe(1);
  });

  it("cell starting both across and down gets ONE number", () => {
    // 3x3 all-white
    const grid = createEmptyGrid(3);
    const words = deriveWords(grid);
    const numbers = assignNumbers(words);

    // (0,0) starts both across and down → gets ONE number, which is 1
    expect(numbers.get("0-0")).toBe(1);
    // The number map should not have (0,0) mapped to two different numbers
    // It should appear exactly once
    let count = 0;
    for (const [key, num] of numbers) {
      if (key === "0-0") count++;
    }
    expect(count).toBe(1);
  });

  it("numbers are sequential", () => {
    // 5x5 all-white
    const grid = createEmptyGrid(5);
    const words = deriveWords(grid);
    const numbers = assignNumbers(words);

    const allNumbers = Array.from(numbers.values()).sort((a, b) => a - b);
    for (let i = 0; i < allNumbers.length; i++) {
      expect(allNumbers[i]).toBe(i + 1);
    }
  });

  it("returns a Map from row-col string to number", () => {
    const grid = createEmptyGrid(5);
    const words = deriveWords(grid);
    const numbers = assignNumbers(words);

    expect(numbers).toBeInstanceOf(Map);
    // Verify keys are in "row-col" format
    for (const key of numbers.keys()) {
      expect(key).toMatch(/^\d+-\d+$/);
    }
  });

  it("isolated cells get no number", () => {
    // W B W
    // B B B
    // W B W
    const grid = buildGrid([
      [false, true, false],
      [true, true, true],
      [false, true, false],
    ]);
    const words = deriveWords(grid);
    const numbers = assignNumbers(words);
    expect(numbers.size).toBe(0);
  });

  it("correct numbering for grid with mixed words", () => {
    // 3x3:
    // W W B
    // W W B
    // B B B
    const grid = buildGrid([
      [false, false, true],
      [false, false, true],
      [true, true, true],
    ]);
    const words = deriveWords(grid);
    const numbers = assignNumbers(words);

    // (0,0) starts across (length 2) and down (length 2) → number 1
    // (0,1) starts down (length 2) but NOT across (left is white) → number 2
    // (1,0) starts across (length 2) but NOT down (above is white) → number 3
    expect(numbers.get("0-0")).toBe(1);
    expect(numbers.get("0-1")).toBe(2);
    expect(numbers.get("1-0")).toBe(3);
    expect(numbers.size).toBe(3);
  });
});

// ============================================================
// 4. getWordsAtCell
// ============================================================
describe("getWordsAtCell", () => {
  it("cell at intersection returns both across and down words", () => {
    // 3x3 all-white grid: cell (1,1) is in an across and a down word
    const grid = createEmptyGrid(3);
    const derivedWords = deriveWords(grid);
    // Create Word objects with metadata for testing
    const words: Word[] = derivedWords.map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));
    const result = getWordsAtCell(words, 1, 1);
    expect(result).toHaveLength(2);
    const across = result.find((w) => w.direction === "across");
    const down = result.find((w) => w.direction === "down");
    expect(across).toBeDefined();
    expect(down).toBeDefined();
  });

  it("cell in only one word returns one word", () => {
    // Row 0: W W B
    // Row 1: B B B
    // Only across word at (0,0) length 2
    const grid = buildGrid([
      [false, false, true],
      [true, true, true],
      [true, true, true],
    ]);
    const derivedWords = deriveWords(grid);
    const words: Word[] = derivedWords.map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));
    // Cell (0,0) is in across word only (no vertical word from (0,0) since row 1 is black)
    const result = getWordsAtCell(words, 0, 0);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("across");
  });

  it("cell not in any word returns empty array", () => {
    // Single isolated cell
    const grid = buildGrid([
      [false, true],
      [true, true],
    ]);
    const derivedWords = deriveWords(grid);
    const words: Word[] = derivedWords.map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));
    const result = getWordsAtCell(words, 0, 0);
    // (0,0) is isolated - no word contains it
    expect(result).toHaveLength(0);
  });

  it("black cell returns empty array", () => {
    const grid = buildGrid([
      [true, false],
      [false, false],
    ]);
    const derivedWords = deriveWords(grid);
    const words: Word[] = derivedWords.map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));
    const result = getWordsAtCell(words, 0, 0);
    expect(result).toHaveLength(0);
  });
});

// ============================================================
// 5. getWordInDirection
// ============================================================
describe("getWordInDirection", () => {
  it("returns the across word for an across cell", () => {
    const grid = createEmptyGrid(3);
    const derivedWords = deriveWords(grid);
    const words: Word[] = derivedWords.map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));
    const result = getWordInDirection(words, 0, 0, "across");
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("across");
    expect(result!.startRow).toBe(0);
    expect(result!.startCol).toBe(0);
  });

  it("returns the down word for a cell in a down word", () => {
    const grid = createEmptyGrid(3);
    const derivedWords = deriveWords(grid);
    const words: Word[] = derivedWords.map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));
    const result = getWordInDirection(words, 1, 0, "down");
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("down");
    expect(result!.startRow).toBe(0);
    expect(result!.startCol).toBe(0);
  });

  it("returns null if cell is not in a word of that direction", () => {
    // W W (across word of length 2)
    // B B
    const grid = buildGrid([
      [false, false],
      [true, true],
    ]);
    const derivedWords = deriveWords(grid);
    const words: Word[] = derivedWords.map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));
    // Cell (0,0) is in an across word but not a down word
    const result = getWordInDirection(words, 0, 0, "down");
    expect(result).toBeNull();
  });

  it("returns null for a black cell", () => {
    const grid = buildGrid([
      [true, false],
      [false, false],
    ]);
    const derivedWords = deriveWords(grid);
    const words: Word[] = derivedWords.map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));
    const result = getWordInDirection(words, 0, 0, "across");
    expect(result).toBeNull();
  });
});

// ============================================================
// 6. advancePosition
// ============================================================
describe("advancePosition", () => {
  it("advances within a word (across)", () => {
    // W W W across word at row 0
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = advancePosition(grid, 0, 0, "across");
    expect(result).toEqual({ row: 0, col: 1 });
  });

  it("advances within a word (down)", () => {
    // Column of 3 white cells
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = advancePosition(grid, 0, 0, "down");
    expect(result).toEqual({ row: 1, col: 0 });
  });

  it("stays at last cell of word (no further advancement across)", () => {
    // W W W — advancing from last white cell stays put
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = advancePosition(grid, 0, 2, "across");
    expect(result).toEqual({ row: 0, col: 2 });
  });

  it("stays at last cell of word (no further advancement down)", () => {
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = advancePosition(grid, 2, 0, "down");
    expect(result).toEqual({ row: 2, col: 0 });
  });

  it("stops at black cell (across)", () => {
    // W B W — advancing from col 0 hits black at col 1
    const grid = buildGrid(
      [
        [false, true, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = advancePosition(grid, 0, 0, "across");
    expect(result).toEqual({ row: 0, col: 0 });
  });

  it("stops at black cell (down)", () => {
    // W
    // B
    // W
    const grid = buildGrid(
      [
        [false, false, false],
        [true, false, false],
        [false, false, false],
      ]
    );
    const result = advancePosition(grid, 0, 0, "down");
    expect(result).toEqual({ row: 0, col: 0 });
  });

  it("stops at grid boundary (across)", () => {
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    // At col 2, can't advance further right
    const result = advancePosition(grid, 0, 2, "across");
    expect(result).toEqual({ row: 0, col: 2 });
  });

  it("stops at grid boundary (down)", () => {
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    // At row 2, can't advance further down
    const result = advancePosition(grid, 2, 0, "down");
    expect(result).toEqual({ row: 2, col: 0 });
  });

  it("returns same position for black cell", () => {
    const grid = buildGrid(
      [
        [true, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = advancePosition(grid, 0, 0, "across");
    expect(result).toEqual({ row: 0, col: 0 });
  });
});

// ============================================================
// 7. retreatPosition
// ============================================================
describe("retreatPosition", () => {
  it("retreats within a word (across)", () => {
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = retreatPosition(grid, 0, 2, "across");
    expect(result).toEqual({ row: 0, col: 1 });
  });

  it("retreats within a word (down)", () => {
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = retreatPosition(grid, 2, 0, "down");
    expect(result).toEqual({ row: 1, col: 0 });
  });

  it("stays at first cell of word (across)", () => {
    // W W B — at col 0, can't retreat further left
    const grid = buildGrid(
      [
        [false, false, true],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = retreatPosition(grid, 0, 0, "across");
    expect(result).toEqual({ row: 0, col: 0 });
  });

  it("stays at first cell of word (down)", () => {
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [true, false, false],
      ]
    );
    const result = retreatPosition(grid, 0, 0, "down");
    expect(result).toEqual({ row: 0, col: 0 });
  });

  it("stops at black cell (across)", () => {
    // B W W — retreating from col 2: col 1 is white, but from col 1, col 0 is black
    const grid = buildGrid(
      [
        [true, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = retreatPosition(grid, 0, 1, "across");
    expect(result).toEqual({ row: 0, col: 1 });
  });

  it("stops at black cell (down)", () => {
    // B
    // W
    // W
    const grid = buildGrid(
      [
        [true, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = retreatPosition(grid, 1, 0, "down");
    expect(result).toEqual({ row: 1, col: 0 });
  });

  it("stops at grid boundary (across)", () => {
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = retreatPosition(grid, 0, 0, "across");
    expect(result).toEqual({ row: 0, col: 0 });
  });

  it("stops at grid boundary (down)", () => {
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = retreatPosition(grid, 0, 0, "down");
    expect(result).toEqual({ row: 0, col: 0 });
  });

  it("returns same position for black cell", () => {
    const grid = buildGrid(
      [
        [true, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    const result = retreatPosition(grid, 0, 0, "across");
    expect(result).toEqual({ row: 0, col: 0 });
  });
});

// ============================================================
// 8. movePosition
// ============================================================
describe("movePosition", () => {
  it("ArrowUp moves row-1", () => {
    const result = movePosition(createEmptyGrid(5), 2, 3, "down", "backward");
    expect(result).toEqual({ row: 1, col: 3 });
  });

  it("ArrowDown moves row+1", () => {
    const result = movePosition(createEmptyGrid(5), 2, 3, "down", "forward");
    expect(result).toEqual({ row: 3, col: 3 });
  });

  it("ArrowLeft moves col-1", () => {
    const result = movePosition(createEmptyGrid(5), 2, 3, "across", "backward");
    expect(result).toEqual({ row: 2, col: 2 });
  });

  it("ArrowRight moves col+1", () => {
    const result = movePosition(createEmptyGrid(5), 2, 3, "across", "forward");
    expect(result).toEqual({ row: 2, col: 4 });
  });

  it("does not go below 0 for ArrowUp", () => {
    const result = movePosition(createEmptyGrid(5), 0, 3, "down", "backward");
    expect(result).toEqual({ row: 0, col: 3 });
  });

  it("does not go below 0 for ArrowLeft", () => {
    const result = movePosition(createEmptyGrid(5), 2, 0, "across", "backward");
    expect(result).toEqual({ row: 2, col: 0 });
  });

  it("does not go above gridSize-1 for ArrowDown", () => {
    const result = movePosition(createEmptyGrid(5), 4, 3, "down", "forward");
    expect(result).toEqual({ row: 4, col: 3 });
  });

  it("does not go above gridSize-1 for ArrowRight", () => {
    const result = movePosition(createEmptyGrid(5), 2, 4, "across", "forward");
    expect(result).toEqual({ row: 2, col: 4 });
  });
});

// ============================================================
// 9. isSelectableCell
// ============================================================
describe("isSelectableCell", () => {
  it("white cell that is part of a word is selectable", () => {
    const grid = createEmptyGrid(5);
    // All cells in a 5x5 all-white grid are part of words
    expect(isSelectableCell(grid, 0, 0)).toBe(true);
    expect(isSelectableCell(grid, 2, 2)).toBe(true);
    expect(isSelectableCell(grid, 4, 4)).toBe(true);
  });

  it("black cell is not selectable", () => {
    const grid = buildGrid([
      [true, false],
      [false, false],
    ]);
    expect(isSelectableCell(grid, 0, 0)).toBe(false);
  });

  it("isolated single white cell is not selectable", () => {
    // W B W (each cell isolated)
    const grid = buildGrid([[false, true, false]]);
    // (0,0) is isolated - no adjacent white horizontal or vertical
    expect(isSelectableCell(grid, 0, 0)).toBe(false);
    expect(isSelectableCell(grid, 0, 2)).toBe(false);
  });

  it("out of bounds returns false", () => {
    const grid = createEmptyGrid(3);
    expect(isSelectableCell(grid, -1, 0)).toBe(false);
    expect(isSelectableCell(grid, 0, -1)).toBe(false);
    expect(isSelectableCell(grid, 3, 0)).toBe(false);
    expect(isSelectableCell(grid, 0, 3)).toBe(false);
  });

  it("cell part of across word only is selectable", () => {
    // W W (row), B B (row)
    // No vertical words (row 1 all black)
    const grid = buildGrid([
      [false, false],
      [true, true],
    ]);
    // (0,0) is part of across word only
    expect(isSelectableCell(grid, 0, 0)).toBe(true);
    expect(isSelectableCell(grid, 0, 1)).toBe(true);
  });

  it("cell part of down word only is selectable", () => {
    // W B
    // W B
    const grid = buildGrid([
      [false, true],
      [false, true],
    ]);
    // (0,0) and (1,0) are in a down word only
    expect(isSelectableCell(grid, 0, 0)).toBe(true);
    expect(isSelectableCell(grid, 1, 0)).toBe(true);
  });
});

// ============================================================
// 10. computeWordLength
// ============================================================
describe("computeWordLength", () => {
  it("correct length for a horizontal word", () => {
    // W W W B W
    const grid = buildGrid([[false, false, false, true, false]]);
    // Starting from (0,0) across: 3 white cells
    expect(computeWordLength(grid, 0, 0, "across", 5)).toBe(3);
    // Starting from (0,4) across: 1 white cell (isolated)
    expect(computeWordLength(grid, 0, 4, "across", 5)).toBe(1);
  });

  it("correct length for a vertical word", () => {
    // Column: W, W, W, B, W
    const grid = buildGrid([[false], [false], [false], [true], [false]]);
    // Starting from (0,0) down: 3 white cells
    expect(computeWordLength(grid, 0, 0, "down", 5)).toBe(3);
    // Starting from (4,0) down: 1 white cell
    expect(computeWordLength(grid, 4, 0, "down", 5)).toBe(1);
  });

  it("length 1 for isolated white cell", () => {
    // 3x3: W B B / B B B / B B B
    const grid = buildGrid([
      [false, true, true],
      [true, true, true],
      [true, true, true],
    ]);
    // (0,0) is isolated: no adjacent white cells in any direction
    expect(computeWordLength(grid, 0, 0, "across", 3)).toBe(1);
    expect(computeWordLength(grid, 0, 0, "down", 3)).toBe(1);
  });

  it("length 0 for black cell", () => {
    const grid = buildGrid([
      [true, false],
      [false, false],
    ]);
    expect(computeWordLength(grid, 0, 0, "across", 2)).toBe(0);
    expect(computeWordLength(grid, 0, 0, "down", 2)).toBe(0);
  });

  it("full row as one word (across)", () => {
    const grid = createEmptyGrid(5);
    // Entire row of 5 white cells
    expect(computeWordLength(grid, 0, 0, "across", 5)).toBe(5);
  });

  it("full column as one word (down)", () => {
    const grid = createEmptyGrid(5);
    // Entire column of 5 white cells
    expect(computeWordLength(grid, 0, 0, "down", 5)).toBe(5);
  });

  it("correct length starting from middle of word", () => {
    // W W W W W
    const grid = buildGrid([[false, false, false, false, false]]);
    // Starting from col 2, going across: 3 white cells (col 2, 3, 4)
    expect(computeWordLength(grid, 0, 2, "across", 5)).toBe(3);
  });
});

// ============================================================
// 11. getSingleWordLengthPattern
// ============================================================
describe("getSingleWordLengthPattern", () => {
  it("returns total length for a word with no markers", () => {
    // 5-letter across word, no markers
    const grid = createEmptyGrid(5);
    const word: Word = makeWord(0, 0, "across", 5, 1);
    expect(getSingleWordLengthPattern(grid, word, 5)).toBe("5");
  });

  it("returns total length for a down word with no markers", () => {
    const grid = createEmptyGrid(5);
    const word: Word = makeWord(0, 0, "down", 4, 1);
    expect(getSingleWordLengthPattern(grid, word, 5)).toBe("4");
  });

  it("returns segmented pattern with space markers (across)", () => {
    // 5-letter across word: AA BB C with spaceRight on col 1 and col 3
    const grid = createEmptyGrid(5);
    grid[0][1] = { ...grid[0][1], spaceRight: true };
    grid[0][3] = { ...grid[0][3], spaceRight: true };
    const word: Word = makeWord(0, 0, "across", 5, 1);
    expect(getSingleWordLengthPattern(grid, word, 5)).toBe("2, 2, 1");
  });

  it("returns segmented pattern with hyphen markers (across)", () => {
    // 5-letter across word: AA-BBB with hyphenRight on col 1
    const grid = createEmptyGrid(5);
    grid[0][1] = { ...grid[0][1], hyphenRight: true };
    const word: Word = makeWord(0, 0, "across", 5, 1);
    expect(getSingleWordLengthPattern(grid, word, 5)).toBe("2-3");
  });

  it("returns segmented pattern with space markers (down)", () => {
    // 4-letter down word: AA BB with spaceBottom on row 1
    const grid = createEmptyGrid(5);
    grid[1][0] = { ...grid[1][0], spaceBottom: true };
    const word: Word = makeWord(0, 0, "down", 4, 1);
    expect(getSingleWordLengthPattern(grid, word, 5)).toBe("2, 2");
  });

  it("returns segmented pattern with hyphen markers (down)", () => {
    const grid = createEmptyGrid(5);
    grid[1][0] = { ...grid[1][0], hyphenBottom: true };
    const word: Word = makeWord(0, 0, "down", 4, 1);
    expect(getSingleWordLengthPattern(grid, word, 5)).toBe("2-2");
  });

  it("handles mixed space and hyphen markers", () => {
    // 6-letter across word: AA-BB CC with hyphen on col 1, space on col 3
    const grid = createEmptyGrid(6);
    grid[0][1] = { ...grid[0][1], hyphenRight: true };
    grid[0][3] = { ...grid[0][3], spaceRight: true };
    const word: Word = makeWord(0, 0, "across", 6, 1);
    expect(getSingleWordLengthPattern(grid, word, 6)).toBe("2-2, 2");
  });
});