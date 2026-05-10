import { describe, it, expect } from "vitest";
import {
  createEmptyGrid,
  deriveWords,
  assignNumbers,
  getWordInDirection,
  
  computeWordLength,
  getSingleWordLengthPattern,
  getWordCells,
  
  deriveDisplayLetters,
  isGridBlank,
  splitWordsByDirection,
  toggleCellBlack,
  toggleMarker,
  applyPlayerProgress,
} from "./grid-logic";
import type { CellData, CellPosition, Word, DisplacedClue, PlayerProgress } from "./types";

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
    for (const [key, _] of numbers) {
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

// ============================================================
// isGridBlank
// ============================================================
describe("isGridBlank", () => {
  it("returns true for a truly blank grid (all white, no letters, no clues)", () => {
    const grid = createEmptyGrid(5);
    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 5, number: 1, clue: "", nextWord: null },
      { startRow: 0, startCol: 0, direction: "down", length: 5, number: 1, clue: "", nextWord: null },
    ];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(true);
  });

  it("returns false when a cell has a letter", () => {
    const grid = createEmptyGrid(5);
    grid[0][0].puzzleLetter = "A";

    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 5, number: 1, clue: "", nextWord: null },
    ];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(false);
  });

  it("returns false when a word has non-empty clue text", () => {
    const grid = createEmptyGrid(5);
    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 5, number: 1, clue: "Some clue", nextWord: null },
    ];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(false);
  });

  it("returns false when there are displaced clues", () => {
    const grid = createEmptyGrid(5);
    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 5, number: 1, clue: "", nextWord: null },
    ];
    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced", direction: "across" },
    ];

    expect(isGridBlank(grid, words, displacedClues)).toBe(false);
  });

  it("returns false when grid has a letter AND clues", () => {
    const grid = createEmptyGrid(5);
    grid[0][0].puzzleLetter = "A";
    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 5, number: 1, clue: "Clue text", nextWord: null },
    ];
    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced", direction: "down" },
    ];

    expect(isGridBlank(grid, words, displacedClues)).toBe(false);
  });

  it("returns true when grid is all black (no words)", () => {
    const grid = buildGrid([
      [true, true, true],
      [true, true, true],
      [true, true, true],
    ]);

    const words: Word[] = [];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(true);
  });

  it("returns true with no words and no displaced clues", () => {
    const grid = createEmptyGrid(5);
    const words: Word[] = [];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(true);
  });

  it("returns false when only one cell has a letter among many", () => {
    const grid = createEmptyGrid(10);
    grid[5][7].puzzleLetter = "Z";

    const words: Word[] = [];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(false);
  });

  it("returns true when words have empty clue strings", () => {
    const grid = createEmptyGrid(5);
    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 5, number: 1, clue: "", nextWord: null },
      { startRow: 0, startCol: 0, direction: "down", length: 5, number: 1, clue: "", nextWord: null },
    ];
    const displacedClues: DisplacedClue[] = [];

    expect(isGridBlank(grid, words, displacedClues)).toBe(true);
  });
});

// ============================================================
// splitWordsByDirection
// ============================================================
describe("splitWordsByDirection", () => {
  function makeWord(
    startRow: number,
    startCol: number,
    direction: "across" | "down",
    number: number,
  ): Word {
    return {
      startRow,
      startCol,
      direction,
      length: 3,
      number,
      clue: "",
      nextWord: null,
    };
  }

  it("returns empty arrays for empty input", () => {
    const result = splitWordsByDirection([]);
    expect(result.across).toEqual([]);
    expect(result.down).toEqual([]);
  });

  it("splits across and down words correctly", () => {
    const words = [
      makeWord(0, 0, "across", 1),
      makeWord(0, 0, "down", 1),
      makeWord(1, 0, "across", 2),
      makeWord(0, 2, "down", 2),
    ];

    const result = splitWordsByDirection(words);

    expect(result.across).toHaveLength(2);
    expect(result.down).toHaveLength(2);
    expect(result.across.map((w) => w.number)).toEqual([1, 2]);
    expect(result.down.map((w) => w.number)).toEqual([1, 2]);
  });

  it("sorts across words by number", () => {
    const words = [
      makeWord(2, 0, "across", 3),
      makeWord(0, 0, "across", 1),
      makeWord(1, 0, "across", 2),
    ];

    const result = splitWordsByDirection(words);

    expect(result.across.map((w) => w.number)).toEqual([1, 2, 3]);
    expect(result.down).toEqual([]);
  });

  it("sorts down words by number", () => {
    const words = [
      makeWord(0, 2, "down", 3),
      makeWord(0, 0, "down", 1),
      makeWord(0, 1, "down", 2),
    ];

    const result = splitWordsByDirection(words);

    expect(result.down.map((w) => w.number)).toEqual([1, 2, 3]);
    expect(result.across).toEqual([]);
  });

  it("handles mixed unsorted input", () => {
    const words = [
      makeWord(1, 1, "down", 5),
      makeWord(0, 0, "across", 1),
      makeWord(2, 2, "down", 3),
      makeWord(1, 0, "across", 4),
      makeWord(0, 1, "across", 2),
    ];

    const result = splitWordsByDirection(words);

    expect(result.across.map((w) => w.number)).toEqual([1, 2, 4]);
    expect(result.down.map((w) => w.number)).toEqual([3, 5]);
  });
});

// ============================================================
// toggleCellBlack
// ============================================================
describe("toggleCellBlack", () => {
  // Helper: build words with metadata from derived words
  function wordsFromGrid(grid: CellData[][]): Word[] {
    return deriveWords(grid).map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));
  }

  it("toggles a white cell to black", () => {
    const grid = createEmptyGrid(3);
    const words = wordsFromGrid(grid);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = toggleCellBlack(grid, cell, words, []);

    expect(result.grid[0][0].black).toBe(true);
    expect(result.grid[0][0].puzzleLetter).toBeNull();
    // Other cells untouched
    expect(result.grid[0][1].black).toBe(false);
    expect(result.grid[1][0].black).toBe(false);
  });

  it("toggles a black cell to white", () => {
    const grid = createEmptyGrid(3);
    grid[0][0].black = true;

    const words = wordsFromGrid(grid);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = toggleCellBlack(grid, cell, words, []);

    expect(result.grid[0][0].black).toBe(false);
    expect(result.grid[0][0].puzzleLetter).toBeNull();
    expect(result.grid[0][0].spaceRight).toBe(false);
    expect(result.grid[0][0].spaceBottom).toBe(false);
  });

  it("does not mutate the original grid", () => {
    const grid = createEmptyGrid(3);
    const originalCell = { ...grid[1][1] };

    const words = wordsFromGrid(grid);
    const cell: CellPosition = { row: 1, col: 1 };

    toggleCellBlack(grid, cell, words, []);

    // Original grid should not be modified
    expect(grid[1][1].black).toBe(originalCell.black);
    expect(grid[1][1].puzzleLetter).toBe(originalCell.puzzleLetter);
  });

  it("clears letter and markers when toggling white to black", () => {
    const grid = createEmptyGrid(3);
    grid[1][1] = {
      black: false,
      puzzleLetter: "A",
      playerLetter: "B",
      spaceRight: true,
      spaceBottom: true,
      hyphenRight: true,
      hyphenBottom: true,
    };

    const words = wordsFromGrid(grid);
    const cell: CellPosition = { row: 1, col: 1 };

    const result = toggleCellBlack(grid, cell, words, []);

    expect(result.grid[1][1].black).toBe(true);
    expect(result.grid[1][1].puzzleLetter).toBeNull();
    expect(result.grid[1][1].playerLetter).toBeNull();
    expect(result.grid[1][1].spaceRight).toBe(false);
    expect(result.grid[1][1].spaceBottom).toBe(false);
    expect(result.grid[1][1].hyphenRight).toBe(false);
    expect(result.grid[1][1].hyphenBottom).toBe(false);
  });

  it("clears letter and markers when toggling black to white", () => {
    const grid = createEmptyGrid(3);
    grid[1][1] = {
      black: true,
      puzzleLetter: "Z",
      playerLetter: "X",
      spaceRight: true,
      spaceBottom: true,
      hyphenRight: true,
      hyphenBottom: true,
    };

    const words = wordsFromGrid(grid);
    const cell: CellPosition = { row: 1, col: 1 };

    const result = toggleCellBlack(grid, cell, words, []);

    expect(result.grid[1][1].black).toBe(false);
    expect(result.grid[1][1].puzzleLetter).toBeNull();
    expect(result.grid[1][1].playerLetter).toBeNull();
    expect(result.grid[1][1].spaceRight).toBe(false);
    expect(result.grid[1][1].spaceBottom).toBe(false);
    expect(result.grid[1][1].hyphenRight).toBe(false);
    expect(result.grid[1][1].hyphenBottom).toBe(false);
  });

  it("returns updated words when toggling a cell to black (word shortened)", () => {
    // 5x5 all-white grid — toggling (0,4) shortens the across word at (0,0)
    // from length 5 to length 4
    const grid = createEmptyGrid(5);
    const words = wordsFromGrid(grid);
    const cell: CellPosition = { row: 0, col: 4 };

    const result = toggleCellBlack(grid, cell, words, []);

    // The result should have shortened words (the across word starting at (0,0))
    expect(result.result.shortenedWords.length).toBeGreaterThan(0);
    // The updated words should reflect the new grid
    expect(result.result.updatedWords.length).toBeGreaterThan(0);
  });

  it("preserves clue metadata for surviving words when toggling cell to black", () => {
    // 5x5 grid — toggle cell at (0,4) shortens the across word at (0,0)
    // from length 5 to length 4, but doesn't destroy it
    const grid = createEmptyGrid(5);
    const derivedWords = deriveWords(grid);
    const words: Word[] = derivedWords.map((dw) => ({
      ...dw,
      clue:
        dw.startRow === 0 && dw.startCol === 0 && dw.direction === "across"
          ? "Test clue"
          : "",
      nextWord: null,
    }));

    const cell: CellPosition = { row: 0, col: 4 };
    const result = toggleCellBlack(grid, cell, words, []);

    // The across word at (0,0) still exists but shorter — its clue should be preserved
    const survivingWord = result.result.updatedWords.find(
      (w) => w.startRow === 0 && w.startCol === 0 && w.direction === "across"
    );
    expect(survivingWord).toBeDefined();
    expect(survivingWord!.clue).toBe("Test clue");
    expect(survivingWord!.length).toBe(4);
  });

  it("creates displaced clues when a word with a clue is destroyed", () => {
    // 2x2 grid: toggle (1,0) to black destroys the down word starting at (0,0)
    const grid = createEmptyGrid(2);
    const derivedWords = deriveWords(grid);
    const words: Word[] = derivedWords.map((dw) => ({
      ...dw,
      clue: "",
      nextWord: null,
    }));

    // Give a clue to the down word starting at (0, 0)
    const downWord = words.find(
      (w) => w.startRow === 0 && w.startCol === 0 && w.direction === "down"
    );
    if (downWord) downWord.clue = "Down clue";

    // Toggle (1, 0) — this should destroy the down word
    const cell: CellPosition = { row: 1, col: 0 };
    const result = toggleCellBlack(grid, cell, words, []);

    // The destroyed down word should produce a displaced clue
    expect(result.result.displacedClues.length).toBeGreaterThanOrEqual(1);
    expect(result.result.displacedClues.some((dc) => dc.clue === "Down clue")).toBe(true);
  });

  it("passes through existing displaced clues", () => {
    const grid = createEmptyGrid(3);
    const words = wordsFromGrid(grid);
    const existingDisplaced: DisplacedClue[] = [
      { id: "existing-1", clue: "Old clue", direction: "across" },
    ];

    const cell: CellPosition = { row: 1, col: 1 };
    const result = toggleCellBlack(grid, cell, words, existingDisplaced);

    // Existing displaced clue should be preserved in the result
    expect(result.result.displacedClues).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "existing-1" })])
    );
  });

  it("round-trips: toggling black then white restores a white cell", () => {
    const grid = createEmptyGrid(3);
    const cell: CellPosition = { row: 0, col: 0 };

    // Toggle white → black
    const firstResult = toggleCellBlack(grid, cell, wordsFromGrid(grid), []);
    expect(firstResult.grid[0][0].black).toBe(true);

    // Toggle black → white
    const secondResult = toggleCellBlack(
      firstResult.grid,
      cell,
      wordsFromGrid(firstResult.grid),
      firstResult.result.displacedClues,
    );
    expect(secondResult.grid[0][0].black).toBe(false);
    expect(secondResult.grid[0][0].puzzleLetter).toBeNull();
  });
});

// ============================================================
// toggleMarker
// ============================================================
describe("toggleMarker", () => {
  it("toggles spaceRight on", () => {
    const grid = createEmptyGrid(3);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = toggleMarker(grid, cell, "spaceRight");
    expect(result).not.toBeNull();
    expect(result![0][0].spaceRight).toBe(true);
    expect(result![0][0].hyphenRight).toBe(false);
  });

  it("toggles spaceRight off", () => {
    const grid = createEmptyGrid(3);
    grid[0][0] = { ...grid[0][0], spaceRight: true };
    const cell: CellPosition = { row: 0, col: 0 };

    const result = toggleMarker(grid, cell, "spaceRight");
    expect(result).not.toBeNull();
    expect(result![0][0].spaceRight).toBe(false);
  });

  it("toggles hyphenRight on and clears spaceRight (mutual exclusion)", () => {
    const grid = createEmptyGrid(3);
    grid[0][0] = { ...grid[0][0], spaceRight: true };
    const cell: CellPosition = { row: 0, col: 0 };

    const result = toggleMarker(grid, cell, "hyphenRight");
    expect(result).not.toBeNull();
    expect(result![0][0].hyphenRight).toBe(true);
    expect(result![0][0].spaceRight).toBe(false);
  });

  it("toggles spaceRight on and clears hyphenRight (mutual exclusion)", () => {
    const grid = createEmptyGrid(3);
    grid[0][0] = { ...grid[0][0], hyphenRight: true };
    const cell: CellPosition = { row: 0, col: 0 };

    const result = toggleMarker(grid, cell, "spaceRight");
    expect(result).not.toBeNull();
    expect(result![0][0].spaceRight).toBe(true);
    expect(result![0][0].hyphenRight).toBe(false);
  });

  it("toggles spaceBottom on and clears hyphenBottom (mutual exclusion)", () => {
    const grid = createEmptyGrid(3);
    grid[0][0] = { ...grid[0][0], hyphenBottom: true };
    const cell: CellPosition = { row: 0, col: 0 };

    const result = toggleMarker(grid, cell, "spaceBottom");
    expect(result).not.toBeNull();
    expect(result![0][0].spaceBottom).toBe(true);
    expect(result![0][0].hyphenBottom).toBe(false);
  });

  it("toggles hyphenBottom on and clears spaceBottom (mutual exclusion)", () => {
    const grid = createEmptyGrid(3);
    grid[0][0] = { ...grid[0][0], spaceBottom: true };
    const cell: CellPosition = { row: 0, col: 0 };

    const result = toggleMarker(grid, cell, "hyphenBottom");
    expect(result).not.toBeNull();
    expect(result![0][0].hyphenBottom).toBe(true);
    expect(result![0][0].spaceBottom).toBe(false);
  });

  it("does not affect other markers when toggling spaceRight", () => {
    const grid = createEmptyGrid(3);
    grid[0][0] = { ...grid[0][0], spaceBottom: true, hyphenBottom: true };
    const cell: CellPosition = { row: 0, col: 0 };

    const result = toggleMarker(grid, cell, "spaceRight");
    expect(result).not.toBeNull();
    expect(result![0][0].spaceRight).toBe(true);
    expect(result![0][0].spaceBottom).toBe(true);
    expect(result![0][0].hyphenBottom).toBe(true);
  });

  it("does not affect horizontal markers when toggling spaceBottom", () => {
    const grid = createEmptyGrid(3);
    grid[0][0] = { ...grid[0][0], spaceRight: true, hyphenRight: true };
    const cell: CellPosition = { row: 0, col: 0 };

    const result = toggleMarker(grid, cell, "spaceBottom");
    expect(result).not.toBeNull();
    expect(result![0][0].spaceBottom).toBe(true);
    // The horizontal markers should be untouched (even though having both
    // spaceRight and hyphenRight true is an invalid state, that's not this
    // function's concern — it only enforces exclusion within its own toggle)
    expect(result![0][0].spaceRight).toBe(true);
    expect(result![0][0].hyphenRight).toBe(true);
  });

  it("returns null for a black cell", () => {
    const grid = createEmptyGrid(3);
    grid[0][0] = { ...grid[0][0], black: true };
    const cell: CellPosition = { row: 0, col: 0 };

    expect(toggleMarker(grid, cell, "spaceRight")).toBeNull();
  });

  it("returns null for out-of-bounds row", () => {
    const grid = createEmptyGrid(3);
    const cell: CellPosition = { row: -1, col: 0 };

    expect(toggleMarker(grid, cell, "spaceRight")).toBeNull();
  });

  it("returns null for out-of-bounds column", () => {
    const grid = createEmptyGrid(3);
    const cell: CellPosition = { row: 0, col: 5 };

    expect(toggleMarker(grid, cell, "spaceRight")).toBeNull();
  });

  it("does not mutate the original grid", () => {
    const grid = createEmptyGrid(3);
    const cell: CellPosition = { row: 1, col: 1 };

    const originalState = { ...grid[1][1] };
    toggleMarker(grid, cell, "spaceRight");

    expect(grid[1][1].spaceRight).toBe(originalState.spaceRight);
  });

  it("round-trips: toggling spaceRight on then off restores original state", () => {
    const grid = createEmptyGrid(3);
    const cell: CellPosition = { row: 1, col: 1 };

    const firstResult = toggleMarker(grid, cell, "spaceRight");
    expect(firstResult).not.toBeNull();
    expect(firstResult![1][1].spaceRight).toBe(true);

    const secondResult = toggleMarker(firstResult!, cell, "spaceRight");
    expect(secondResult).not.toBeNull();
    expect(secondResult![1][1].spaceRight).toBe(false);
  });

  it("works on any cell in the grid", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 3, col: 2 };

    const result = toggleMarker(grid, cell, "hyphenBottom");
    expect(result).not.toBeNull();
    expect(result![3][2].hyphenBottom).toBe(true);
  });
});

// ============================================================
// applyPlayerProgress
// ============================================================
describe("applyPlayerProgress", () => {
  it("overlays saved letters onto white cells", () => {
    const grid = createEmptyGrid(2);
    const progress: PlayerProgress = {
      key: "test",
      gridSize: 2,
      letters: [["A", "B"], [null, "D"]],
    };

    const result = applyPlayerProgress(grid, progress);

    expect(result[0][0].playerLetter).toBe("A");
    expect(result[0][1].playerLetter).toBe("B");
    expect(result[1][0].playerLetter).toBeNull();
    expect(result[1][1].playerLetter).toBe("D");
  });

  it("overlays playerLetter onto cells regardless of black status", () => {
    const grid = createEmptyGrid(2);
    grid[0][0] = { ...grid[0][0], black: true };
    const progress: PlayerProgress = {
      key: "test",
      gridSize: 2,
      letters: [["X", "B"], ["C", "D"]],
    };

    const result = applyPlayerProgress(grid, progress);

    // Black cells still get playerLetter overlaid if progress has one
    expect(result[0][0].black).toBe(true);
    expect(result[0][0].playerLetter).toBe("X");
    expect(result[0][1].playerLetter).toBe("B");
  });

  it("does not mutate the original grid", () => {
    const grid = createEmptyGrid(2);
    const progress: PlayerProgress = {
      key: "test",
      gridSize: 2,
      letters: [["A", null], [null, null]],
    };

    applyPlayerProgress(grid, progress);

    // Original grid should be unchanged
    expect(grid[0][0].playerLetter).toBeNull();
  });

  it("handles progress smaller than grid (truncates)", () => {
    const grid = createEmptyGrid(3);
    const progress: PlayerProgress = {
      key: "test",
      gridSize: 2,
      letters: [["A", "B"], ["C", "D"]],
    };

    const result = applyPlayerProgress(grid, progress);

    expect(result[0][0].playerLetter).toBe("A");
    expect(result[0][1].playerLetter).toBe("B");
    // Row/col beyond progress.gridSize are untouched
    expect(result[0][2].playerLetter).toBeNull();
    expect(result[2][2].playerLetter).toBeNull();
  });

  it("skips null and undefined entries in letters", () => {
    const grid = createEmptyGrid(3);
    const progress: PlayerProgress = {
      key: "test",
      gridSize: 3,
      letters: [["A", null, undefined as unknown as null], [null, "E", "F"], ["G", "H", "I"]],
    };

    const result = applyPlayerProgress(grid, progress);

    expect(result[0][0].playerLetter).toBe("A");
    expect(result[0][1].playerLetter).toBeNull();
    expect(result[0][2].playerLetter).toBeNull();
  });

  it("preserves other cell fields (puzzleLetter, markers)", () => {
    const grid = createEmptyGrid(2);
    grid[0][0] = {
      black: false,
      puzzleLetter: "A",
      playerLetter: null,
      spaceRight: true,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    };
    const progress: PlayerProgress = {
      key: "test",
      gridSize: 2,
      letters: [["Z", null], [null, null]],
    };

    const result = applyPlayerProgress(grid, progress);

    expect(result[0][0].playerLetter).toBe("Z");
    expect(result[0][0].puzzleLetter).toBe("A");
    expect(result[0][0].spaceRight).toBe(true);
  });

  it("round-trips with deriveDisplayLetters player mode", () => {
    // Set up a grid with some player letters
    const grid = createEmptyGrid(3);
    grid[0][1] = { ...grid[0][1], playerLetter: "B" };
    grid[1][0] = { ...grid[1][0], playerLetter: "C" };
    grid[2][2] = { ...grid[2][2], black: true, playerLetter: null };

    // Extract player letters
    const letters = deriveDisplayLetters(grid, "player");
    const progress: PlayerProgress = { key: "test", gridSize: 3, letters };

    // Apply to a fresh grid
    const freshGrid = createEmptyGrid(3);
    freshGrid[2][2] = { ...freshGrid[2][2], black: true };
    const restored = applyPlayerProgress(freshGrid, progress);

    // Only white cells should have their player letters restored
    expect(restored[0][0].playerLetter).toBeNull();
    expect(restored[0][1].playerLetter).toBe("B");
    expect(restored[1][0].playerLetter).toBe("C");
    expect(restored[2][2].playerLetter).toBeNull(); // black cell untouched
  });
});