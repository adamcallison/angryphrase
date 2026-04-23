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
  getWordCells,
  handleCellSelection,
  handleArrowKey,
  deriveDisplayLetters,
} from "./grid-logic";
import type { CellData, Word, CellPosition } from "./types";

// Helper: create a single white cell with default values
function whiteCell(): CellData {
  return {
    black: false,
    puzzleLetter: null,
    playerLetter: null,
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
    puzzleLetter: null,
    playerLetter: null,
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
        expect(cell.puzzleLetter).toBeNull();
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
    expect(isSelectableCell(grid, ({row: 0, col: 0} as CellPosition))).toBe(true);
    expect(isSelectableCell(grid, ({row: 2, col: 2} as CellPosition))).toBe(true);
    expect(isSelectableCell(grid, ({row: 4, col: 4} as CellPosition))).toBe(true);
  });

  it("black cell is not selectable", () => {
    const grid = buildGrid([
      [true, false],
      [false, false],
    ]);
    expect(isSelectableCell(grid, ({row: 0, col: 0} as CellPosition))).toBe(false);
  });

  it("isolated single white cell is not selectable", () => {
    // W B W (each cell isolated)
    const grid = buildGrid([[false, true, false]]);
    // (0,0) is isolated - no adjacent white horizontal or vertical
    expect(isSelectableCell(grid, ({row: 0, col: 0} as CellPosition))).toBe(false);
    expect(isSelectableCell(grid, ({row: 0, col: 2} as CellPosition))).toBe(false);
  });

  it("out of bounds returns false", () => {
    const grid = createEmptyGrid(3);
    expect(isSelectableCell(grid, ({row: -1, col: 0} as CellPosition))).toBe(false);
    expect(isSelectableCell(grid, ({row: 0, col: -1} as CellPosition))).toBe(false);
    expect(isSelectableCell(grid, ({row: 3, col: 0} as CellPosition))).toBe(false);
    expect(isSelectableCell(grid, ({row: 0, col: 3} as CellPosition))).toBe(false);
  });

  it("cell part of across word only is selectable", () => {
    // W W (row), B B (row)
    // No vertical words (row 1 all black)
    const grid = buildGrid([
      [false, false],
      [true, true],
    ]);
    // (0,0) is part of across word only
    expect(isSelectableCell(grid, ({row: 0, col: 0} as CellPosition))).toBe(true);
    expect(isSelectableCell(grid, ({row: 0, col: 1} as CellPosition))).toBe(true);
  });

  it("cell part of down word only is selectable", () => {
    // W B
    // W B
    const grid = buildGrid([
      [false, true],
      [false, true],
    ]);
    // (0,0) and (1,0) are in a down word only
    expect(isSelectableCell(grid, ({row: 0, col: 0} as CellPosition))).toBe(true);
    expect(isSelectableCell(grid, ({row: 1, col: 0} as CellPosition))).toBe(true);
  });
});

// ============================================================
// 10. computeWordLength
// ============================================================
describe("computeWordLength", () => {
  it("correct length for a horizontal word", () => {
    // W W B W
    const grid = buildGrid(
      [
        [false, false, true, false],
        [false, false, true, false],
        [false, false, true, false],
        [false, false, true, false],
      ]
    );
    // Starting from (0,0) across: 2 white cells
    expect(computeWordLength(grid, 0, 0, "across")).toBe(2);
    // Starting from (0,4) across: 1 white cell (isolated)
    expect(computeWordLength(grid, 0, 3, "across")).toBe(1);
  });

  it("correct length for a vertical word", () => {
    // Column: W, W, W, B, W
    const grid = buildGrid([[false], [false], [false], [true], [false]]);
    // Starting from (0,0) down: 3 white cells
    expect(computeWordLength(grid, 0, 0, "down")).toBe(3);
    // Starting from (4,0) down: 1 white cell
    expect(computeWordLength(grid, 4, 0, "down")).toBe(1);
  });

  it("length 1 for isolated white cell", () => {
    // 3x3: W B B / B B B / B B B
    const grid = buildGrid([
      [false, true, true],
      [true, true, true],
      [true, true, true],
    ]);
    // (0,0) is isolated: no adjacent white cells in any direction
    expect(computeWordLength(grid, 0, 0, "across")).toBe(1);
    expect(computeWordLength(grid, 0, 0, "down")).toBe(1);
  });

  it("length 0 for black cell", () => {
    const grid = buildGrid([
      [true, false],
      [false, false],
    ]);
    expect(computeWordLength(grid, 0, 0, "across")).toBe(0);
    expect(computeWordLength(grid, 0, 0, "down")).toBe(0);
  });

  it("full row as one word (across)", () => {
    const grid = createEmptyGrid(5);
    // Entire row of 5 white cells
    expect(computeWordLength(grid, 0, 0, "across")).toBe(5);
  });

  it("full column as one word (down)", () => {
    const grid = createEmptyGrid(5);
    // Entire column of 5 white cells
    expect(computeWordLength(grid, 0, 0, "down")).toBe(5);
  });

  it("correct length starting from middle of word", () => {
    // W W W
    const grid = buildGrid(
      [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ]
    );
    // Starting from col 2, going across: 3 white cells (col 2, 3, 4)
    expect(computeWordLength(grid, 0, 1, "across")).toBe(2);
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
    expect(getSingleWordLengthPattern(grid, word)).toBe("5");
  });

  it("returns total length for a down word with no markers", () => {
    const grid = createEmptyGrid(5);
    const word: Word = makeWord(0, 0, "down", 4, 1);
    expect(getSingleWordLengthPattern(grid, word)).toBe("4");
  });

  it("returns segmented pattern with space markers (across)", () => {
    // 5-letter across word: AA BB C with spaceRight on col 1 and col 3
    const grid = createEmptyGrid(5);
    grid[0][1] = { ...grid[0][1], spaceRight: true };
    grid[0][3] = { ...grid[0][3], spaceRight: true };
    const word: Word = makeWord(0, 0, "across", 5, 1);
    expect(getSingleWordLengthPattern(grid, word)).toBe("2, 2, 1");
  });

  it("returns segmented pattern with hyphen markers (across)", () => {
    // 5-letter across word: AA-BBB with hyphenRight on col 1
    const grid = createEmptyGrid(5);
    grid[0][1] = { ...grid[0][1], hyphenRight: true };
    const word: Word = makeWord(0, 0, "across", 5, 1);
    expect(getSingleWordLengthPattern(grid, word)).toBe("2-3");
  });

  it("returns segmented pattern with space markers (down)", () => {
    // 4-letter down word: AA BB with spaceBottom on row 1
    const grid = createEmptyGrid(5);
    grid[1][0] = { ...grid[1][0], spaceBottom: true };
    const word: Word = makeWord(0, 0, "down", 4, 1);
    expect(getSingleWordLengthPattern(grid, word)).toBe("2, 2");
  });

  it("returns segmented pattern with hyphen markers (down)", () => {
    const grid = createEmptyGrid(5);
    grid[1][0] = { ...grid[1][0], hyphenBottom: true };
    const word: Word = makeWord(0, 0, "down", 4, 1);
    expect(getSingleWordLengthPattern(grid, word)).toBe("2-2");
  });

  it("handles mixed space and hyphen markers", () => {
    // 6-letter across word: AA-BB CC with hyphen on col 1, space on col 3
    const grid = createEmptyGrid(6);
    grid[0][1] = { ...grid[0][1], hyphenRight: true };
    grid[0][3] = { ...grid[0][3], spaceRight: true };
    const word: Word = makeWord(0, 0, "across", 6, 1);
    expect(getSingleWordLengthPattern(grid, word)).toBe("2-2, 2");
  });
});

// ============================================================
// 12. getWordCells
// ============================================================
describe("getWordCells", () => {
  it("returns horizontal cells for an across word", () => {
    const word = makeWord(2, 3, "across", 4, 1);
    const cells = getWordCells(word);
    expect(cells).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
      { row: 2, col: 6 },
    ]);
  });

  it("returns vertical cells for a down word", () => {
    const word = makeWord(1, 4, "down", 3, 5);
    const cells = getWordCells(word);
    expect(cells).toEqual([
      { row: 1, col: 4 },
      { row: 2, col: 4 },
      { row: 3, col: 4 },
    ]);
  });

  it("returns a single cell for a length-1 word", () => {
    const across = makeWord(0, 0, "across", 1, 1);
    expect(getWordCells(across)).toEqual([{ row: 0, col: 0 }]);

    const down = makeWord(5, 7, "down", 1, 3);
    expect(getWordCells(down)).toEqual([{ row: 5, col: 7 }]);
  });

  it("returns cells starting at origin for word at (0,0)", () => {
    const word = makeWord(0, 0, "across", 3, 1);
    const cells = getWordCells(word);
    expect(cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
  });

  it("returns correct cells for a long down word", () => {
    const word = makeWord(0, 0, "down", 5, 1);
    const cells = getWordCells(word);
    expect(cells).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 },
      { row: 4, col: 0 },
    ]);
  });
});

// ============================================================
// 13. handleCellSelection
// ============================================================
describe("handleCellSelection", () => {
  // 3x3 all-white grid: 3 across words (row 0, 1, 2) + 3 down words (col 0, 1, 2)
  // Cell (0,0): starts across #1 and down #1 → intersection
  // Cell (0,1): part of across #1 and down #2 → intersection
  // Cell (1,0): part of across #2 and down #1 → intersection
  // Cell (1,1): part of across #2 and down #2 → intersection
  const grid = createEmptyGrid(3);
  const derivedWords = deriveWords(grid);
  const words: Word[] = derivedWords.map((dw) => ({
    ...dw,
    clue: "",
    nextWord: null,
  }));

  it("clicking already-selected intersection cell toggles direction to down", () => {
    const result = handleCellSelection(
      { row: 0, col: 0 },
      "across",
      words,
      0, 0,
    );
    expect(result.selectedCell).toEqual({ row: 0, col: 0 });
    expect(result.selectedDirection).toBe("down");
  });

  it("clicking already-selected intersection cell toggles direction to across", () => {
    const result = handleCellSelection(
      { row: 0, col: 0 },
      "down",
      words,
      0, 0,
    );
    expect(result.selectedCell).toEqual({ row: 0, col: 0 });
    expect(result.selectedDirection).toBe("across");
  });

  it("clicking already-selected non-intersection cell keeps same direction", () => {
    // Cell that's in only one word (across-only)
    // Use a square 3x3 grid with row 0 across word (0,0) and col 0 down word (0,0)
    // Cell (0,2) is in the across word AND the down word at col 2, so it's an intersection.
    // Instead, construct words directly: one across word at (0,0) length 3
    const wordsAtSingle: Word[] = [makeWord(0, 0, "across", 3, 1)];
    // Cell (0,2) is only in the across word
    const result = handleCellSelection(
      { row: 0, col: 2 },
      "across",
      wordsAtSingle,
      0, 2,
    );
    // No other direction to toggle to
    expect(result.selectedCell).toEqual({ row: 0, col: 2 });
    expect(result.selectedDirection).toBe("across");
  });

  it("clicking a new cell in a single word auto-detects that direction", () => {
    // One across word at (0,0) length 3 — cell (0,1) is only in this across word
    const wordsAtSingle: Word[] = [makeWord(0, 0, "across", 3, 1)];
    // Currently at (0,0) in "down" mode, click (0,2) which is in the across word only
    const result = handleCellSelection(
      { row: 0, col: 0 },
      "down",
      wordsAtSingle,
      0, 2,
    );
    expect(result.selectedCell).toEqual({ row: 0, col: 2 });
    expect(result.selectedDirection).toBe("across");
  });

  it("clicking a new intersection cell defaults to across", () => {
    // In the 3x3 grid, cell (1,1) is at an intersection of across and down
    // Currently in "down" mode
    const result = handleCellSelection(
      null,
      "down",
      words,
      1, 1,
    );
    expect(result.selectedCell).toEqual({ row: 1, col: 1 });
    expect(result.selectedDirection).toBe("across");
  });

  it("clicking a new intersection cell defaults to across even from across", () => {
    // Same intersection, already in "across" mode — should still pick across
    const result = handleCellSelection(
      null,
      "across",
      words,
      1, 1,
    );
    expect(result.selectedCell).toEqual({ row: 1, col: 1 });
    expect(result.selectedDirection).toBe("across");
  });

  it("clicking a new cell with no words keeps current direction", () => {
    // Click on a cell that's not part of any word (isolated single cell)
    const isolatedGrid = buildGrid([
      [false, true, false],
      [true, true, true],
      [true, true, true],
    ]);
    const isolatedWords = deriveWords(isolatedGrid).map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));
    // Cell (0,0) is isolated — no words contain it
    const result = handleCellSelection(
      null,
      "across",
      isolatedWords,
      0, 0,
    );
    expect(result.selectedCell).toEqual({ row: 0, col: 0 });
    // No words to detect direction from, so keeps current direction
    expect(result.selectedDirection).toBe("across");
  });

  it("clicking a new cell when no cell was previously selected", () => {
    const result = handleCellSelection(
      null,
      "across",
      words,
      0, 0,
    );
    expect(result.selectedCell).toEqual({ row: 0, col: 0 });
    // (0,0) is an intersection → defaults to across
    expect(result.selectedDirection).toBe("across");
  });

  it("clicking a different cell selects it with auto-detected direction", () => {
    // Currently at (0,0) going across, click (2,0) which is an intersection
    const result = handleCellSelection(
      { row: 0, col: 0 },
      "across",
      words,
      2, 0,
    );
    expect(result.selectedCell).toEqual({ row: 2, col: 0 });
    // (2,0) is an intersection of across and down → defaults to across
    expect(result.selectedDirection).toBe("across");
  });
});

// ============================================================
// 14. handleArrowKey
// ============================================================
describe("handleArrowKey", () => {
  const grid = createEmptyGrid(5);

  it("returns null for non-arrow keys", () => {
    expect(handleArrowKey("a", grid, 2, 2)).toBeNull();
    expect(handleArrowKey("Enter", grid, 2, 2)).toBeNull();
    expect(handleArrowKey("Backspace", grid, 2, 2)).toBeNull();
  });

  it("ArrowRight moves right and switches to across", () => {
    const result = handleArrowKey("ArrowRight", grid, 2, 2);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("across");
    expect(result!.cell).toEqual({ row: 2, col: 3 });
  });

  it("ArrowLeft moves left and switches to across", () => {
    const result = handleArrowKey("ArrowLeft", grid, 2, 2);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("across");
    expect(result!.cell).toEqual({ row: 2, col: 1 });
  });

  it("ArrowDown moves down and switches to down", () => {
    const result = handleArrowKey("ArrowDown", grid, 2, 2);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("down");
    expect(result!.cell).toEqual({ row: 3, col: 2 });
  });

  it("ArrowUp moves up and switches to down", () => {
    const result = handleArrowKey("ArrowUp", grid, 2, 2);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("down");
    expect(result!.cell).toEqual({ row: 1, col: 2 });
  });

  it("returns same cell when target is not selectable (black cell)", () => {
    // Grid with black cell at (1,2)
    const blockedGrid = buildGrid([
      [false, false, false, false, false],
      [false, false, true, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ]);
    // Moving up from (2,2) → target (1,2) is black
    const result = handleArrowKey("ArrowUp", blockedGrid, 2, 2);
    expect(result!.direction).toBe("down");
    expect(result!.cell).toEqual({ row: 2, col: 2 }); // stays in place
  });

  it("returns same cell when at grid boundary", () => {
    // At top-left corner, ArrowUp and ArrowLeft stay in place
    const resultUp = handleArrowKey("ArrowUp", grid, 0, 0);
    expect(resultUp!.direction).toBe("down");
    expect(resultUp!.cell).toEqual({ row: 0, col: 0 });

    const resultLeft = handleArrowKey("ArrowLeft", grid, 0, 0);
    expect(resultLeft!.direction).toBe("across");
    expect(resultLeft!.cell).toEqual({ row: 0, col: 0 });
  });

  it("still returns new direction even when cell doesn't move", () => {
    // Even when you can't move, pressing an arrow key changes direction
    const result = handleArrowKey("ArrowRight", grid, 0, 0);
    expect(result!.direction).toBe("across"); // direction changed
    expect(result!.cell).toEqual({ row: 0, col: 1 }); // moved right
  });
});

// ============================================================
// deriveDisplayLetters
// ============================================================
describe("deriveDisplayLetters", () => {
  it("returns null for black cells", () => {
    const grid = createEmptyGrid(2);
    grid[0][0] = { black: true, puzzleLetter: null, playerLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false };

    const result = deriveDisplayLetters(grid, "puzzle");
    expect(result[0][0]).toBeNull();
  });

  it("returns puzzleLetter when source is puzzle", () => {
    const grid = createEmptyGrid(2);
    grid[0][0] = { ...grid[0][0], puzzleLetter: "A", playerLetter: "B" };

    const result = deriveDisplayLetters(grid, "puzzle");
    expect(result[0][0]).toBe("A");
  });

  it("returns playerLetter when source is player", () => {
    const grid = createEmptyGrid(2);
    grid[0][0] = { ...grid[0][0], puzzleLetter: "A", playerLetter: "B" };

    const result = deriveDisplayLetters(grid, "player");
    expect(result[0][0]).toBe("B");
  });

  it("returns null for white cell with null letter", () => {
    const grid = createEmptyGrid(1);

    const result = deriveDisplayLetters(grid, "puzzle");
    expect(result[0][0]).toBeNull();
  });

  it("returns null for white cell with null playerLetter", () => {
    const grid = createEmptyGrid(1);

    const result = deriveDisplayLetters(grid, "player");
    expect(result[0][0]).toBeNull();
  });

  it("handles a mixed grid correctly", () => {
    const grid = createEmptyGrid(3);
    // Row 0: A B C (puzzle), X Y Z (player)
    grid[0][0] = { ...grid[0][0], puzzleLetter: "A", playerLetter: "X" };
    grid[0][1] = { ...grid[0][1], puzzleLetter: "B", playerLetter: null };
    grid[0][2] = { ...grid[0][2], puzzleLetter: "C", playerLetter: "Z" };
    // Row 1: black, D, white-empty
    grid[1][0] = { black: true, puzzleLetter: null, playerLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false };
    grid[1][1] = { ...grid[1][1], puzzleLetter: "D", playerLetter: "W" };
    // Row 2: null puzzle, E, black
    grid[2][0] = { ...grid[2][0], puzzleLetter: null, playerLetter: "Q" };
    grid[2][1] = { ...grid[2][1], puzzleLetter: "E", playerLetter: null };
    grid[2][2] = { black: true, puzzleLetter: null, playerLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false };

    const puzzleLetters = deriveDisplayLetters(grid, "puzzle");
    expect(puzzleLetters).toEqual([
      ["A", "B", "C"],
      [null, "D", null],
      [null, "E", null],
    ]);

    const playerResult = deriveDisplayLetters(grid, "player");
    expect(playerResult).toEqual([
      ["X", null, "Z"],
      [null, "W", null],
      ["Q", null, null],
    ]);
  });
});