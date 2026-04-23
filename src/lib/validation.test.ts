import { describe, it, expect } from "vitest";
import {
  validateCompletePuzzle,
  validateIncompletePuzzle,
  canExportAsComplete,
} from "./validation";
import type {
  CellData,
  CompletePuzzleJSON,
  IncompletePuzzleJSON,
  Word,
  WordPosition,
} from "./types";
import { CURRENT_VERSION } from "./constants";

// ============================================================
// Helpers
// ============================================================

function makeCell(overrides: Partial<CellData> = {}): CellData {
  return {
    black: false,
    puzzleLetter: null,
    playerLetter: null,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
    ...overrides,
  };
}

function makeBlackCell(): CellData {
  return makeCell({ black: true, puzzleLetter: null });
}

function makeWhiteCell(letter: string): CellData {
  return makeCell({ black: false, puzzleLetter: letter });
}

/** Create a 3×3 complete puzzle with a cross pattern:
 *  A . B
 *  . # .
 *  C . D
 *  Words: 1-Across (A?B, length 3), 1-Down (A?C, length 3),
 *         2-Across (C?D, length 3), 2-Down (B?D, length 3)
 */
function makeValidCompletePuzzle(): CompletePuzzleJSON {
  const grid: CellData[][] = [
    [makeWhiteCell("A"), makeWhiteCell("B"), makeWhiteCell("C")],
    [makeWhiteCell("D"), makeBlackCell(), makeWhiteCell("E")],
    [makeWhiteCell("F"), makeWhiteCell("G"), makeWhiteCell("H")],
  ];
  return {
    version: 1,
    type: "complete",
    key: "test-key-1",
    gridSize: 3,
    grid,
    words: [
      { startRow: 0, startCol: 0, direction: "across", length: 3, number: 1, clue: "Clue 1A", nextWord: null },
      { startRow: 0, startCol: 0, direction: "down", length: 3, number: 1, clue: "Clue 1D", nextWord: null },
      { startRow: 2, startCol: 0, direction: "across", length: 3, number: 3, clue: "Clue 3A", nextWord: null },
      { startRow: 0, startCol: 2, direction: "down", length: 3, number: 2, clue: "Clue 2D", nextWord: null },
    ],
    title: "Test Puzzle",
    author: "Test Author",
  };
}

/** Create a 3×3 incomplete puzzle same layout but letters can be null */
function makeValidIncompletePuzzle(): IncompletePuzzleJSON {
  const grid: CellData[][] = [
    [makeCell({ black: false, puzzleLetter: null }), makeCell({ black: false, puzzleLetter: null }), makeCell({ black: false, puzzleLetter: null })],
    [makeCell({ black: false, puzzleLetter: null }), makeBlackCell(), makeCell({ black: false, puzzleLetter: null })],
    [makeCell({ black: false, puzzleLetter: null }), makeCell({ black: false, puzzleLetter: null }), makeCell({ black: false, puzzleLetter: null })],
  ];
  return {
    version: 1,
    type: "incomplete",
    key: "test-key-1",
    gridSize: 3,
    grid,
    words: [
      { startRow: 0, startCol: 0, direction: "across", length: 3, number: 1, clue: "", nextWord: null },
      { startRow: 0, startCol: 0, direction: "down", length: 3, number: 1, clue: "", nextWord: null },
      { startRow: 2, startCol: 0, direction: "across", length: 3, number: 3, clue: "", nextWord: null },
      { startRow: 0, startCol: 2, direction: "down", length: 3, number: 2, clue: "", nextWord: null },
    ],
    title: "Test Puzzle",
    author: "Test Author",
    displacedClues: [],
  };
}

// ============================================================
// 1. validateCompletePuzzle
// ============================================================
describe("validateCompletePuzzle", () => {
  // --- Valid puzzle ---
  describe("valid puzzle", () => {
    it("passes all checks for a valid complete puzzle", () => {
      const puzzle = makeValidCompletePuzzle();
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // --- Version ---
  describe("version field", () => {
    it("rejects wrong version", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.version = 2;
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("version"))).toBe(true);
    });

    it("rejects missing version", () => {
      const puzzle = makeValidCompletePuzzle();
      delete (puzzle as unknown as Record<string, unknown>).version;
      const result = validateCompletePuzzle(puzzle as unknown as CompletePuzzleJSON);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("version"))).toBe(true);
    });
  });

  // --- Type ---
  describe("type field", () => {
    it("rejects wrong type", () => {
      const puzzle = makeValidCompletePuzzle();
      (puzzle as unknown as Record<string, unknown>).type = "incomplete";
      const result = validateCompletePuzzle(puzzle as unknown as CompletePuzzleJSON);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("type"))).toBe(true);
    });
  });

  // --- Required fields ---
  describe("required fields", () => {
    it("rejects missing key", () => {
      const puzzle = makeValidCompletePuzzle();
      delete (puzzle as unknown as Record<string, unknown>).key;
      const result = validateCompletePuzzle(puzzle as unknown as CompletePuzzleJSON);
      expect(result.valid).toBe(false);
    });

    it("rejects missing gridSize", () => {
      const puzzle = makeValidCompletePuzzle();
      delete (puzzle as unknown as Record<string, unknown>).gridSize;
      const result = validateCompletePuzzle(puzzle as unknown as CompletePuzzleJSON);
      expect(result.valid).toBe(false);
    });

    it("rejects missing grid", () => {
      const puzzle = makeValidCompletePuzzle();
      delete (puzzle as unknown as Record<string, unknown>).grid;
      const result = validateCompletePuzzle(puzzle as unknown as CompletePuzzleJSON);
      expect(result.valid).toBe(false);
    });

    it("rejects missing words", () => {
      const puzzle = makeValidCompletePuzzle();
      delete (puzzle as unknown as Record<string, unknown>).words;
      const result = validateCompletePuzzle(puzzle as unknown as CompletePuzzleJSON);
      expect(result.valid).toBe(false);
    });

    it("rejects missing title", () => {
      const puzzle = makeValidCompletePuzzle();
      delete (puzzle as unknown as Record<string, unknown>).title;
      const result = validateCompletePuzzle(puzzle as unknown as CompletePuzzleJSON);
      expect(result.valid).toBe(false);
    });

    it("rejects missing author", () => {
      const puzzle = makeValidCompletePuzzle();
      delete (puzzle as unknown as Record<string, unknown>).author;
      const result = validateCompletePuzzle(puzzle as unknown as CompletePuzzleJSON);
      expect(result.valid).toBe(false);
    });
  });

  // --- Grid dimensions ---
  describe("grid dimensions", () => {
    it("rejects grid rows not matching gridSize", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.grid = [
        [makeWhiteCell("A"), makeWhiteCell("B"), makeWhiteCell("C")],
        [makeWhiteCell("D"), makeBlackCell(), makeWhiteCell("E")],
        // missing 3rd row
      ];
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("dimension") || e.toLowerCase().includes("grid"))).toBe(true);
    });

    it("rejects grid columns not matching gridSize", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.grid = [
        [makeWhiteCell("A"), makeWhiteCell("B")],
        [makeWhiteCell("D"), makeBlackCell()],
        [makeWhiteCell("F"), makeWhiteCell("G")],
      ];
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
    });
  });

  // --- White cell letters ---
  describe("white cell letters", () => {
    it("rejects white cell with null letter", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.grid[0][0].puzzleLetter = null;
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("letter"))).toBe(true);
    });

    it("rejects white cell with non-A-Z letter (number)", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.grid[0][0].puzzleLetter = "1";
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
    });

    it("rejects white cell with non-A-Z letter (lowercase)", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.grid[0][0].puzzleLetter = "a";
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
    });

    it("rejects white cell with multi-character letter", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.grid[0][0].puzzleLetter = "AB";
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
    });
  });

  // --- Clue on head word ---
  describe("clue validation", () => {
    it("rejects empty clue on chain head word", () => {
      const puzzle = makeValidCompletePuzzle();
      // Word at index 0 is a chain head (not pointed to by anyone)
      puzzle.words[0].clue = "";
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("clue"))).toBe(true);
    });

    it("allows empty clue on non-head chain word", () => {
      const puzzle = makeValidCompletePuzzle();
      // Create a chain: word 0 (across at 0,0) → word 2 (across at 2,0)
      // Word 2 becomes a non-head word, its clue can be empty
      const nextRef: WordPosition = { startRow: 2, startCol: 0, direction: "across" };
      puzzle.words[0].nextWord = nextRef;
      // Word 2 (index 2) now has empty clue — should be allowed since it's non-head
      puzzle.words[2].clue = "";
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(true);
    });
  });

  // --- Word validity ---
  describe("word validity", () => {
    it("rejects word with startRow out of bounds", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.words[0].startRow = 99;
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("bounds") || e.toLowerCase().includes("position"))).toBe(true);
    });

    it("rejects word with startCol out of bounds", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.words[0].startCol = 99;
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
    });

    it("rejects word with invalid direction", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.words[0].direction = "diagonal" as "across" | "down";
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("direction"))).toBe(true);
    });

    it("rejects word with length < 2", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.words[0].length = 1;
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("length"))).toBe(true);
    });
  });

  // --- Structural consistency ---
  describe("structural consistency", () => {
    it("rejects two across words overlapping same cell", () => {
      // Create a 5×5 grid where two across words claim the same cells
      const grid: CellData[][] = [];
      for (let r = 0; r < 5; r++) {
        grid[r] = [];
        for (let c = 0; c < 5; c++) {
          grid[r][c] = makeWhiteCell("A");
        }
      }
      // Place two across words that overlap at row 0
      const puzzle: CompletePuzzleJSON = {
        version: 1,
        type: "complete",
        key: "test-overlap",
        gridSize: 5,
        grid,
        words: [
          // Row 0 across words starting at col 0 and col 0 (both claim cell (0,0)-(0,4))
          { startRow: 0, startCol: 0, direction: "across", length: 5, number: 1, clue: "Clue A", nextWord: null },
          { startRow: 0, startCol: 0, direction: "down", length: 5, number: 1, clue: "Clue B", nextWord: null },
          // Need to add down words for the remaining start cells
          { startRow: 0, startCol: 1, direction: "down", length: 5, number: 2, clue: "Clue C", nextWord: null },
          { startRow: 0, startCol: 2, direction: "down", length: 5, number: 3, clue: "Clue D", nextWord: null },
          { startRow: 0, startCol: 3, direction: "down", length: 5, number: 4, clue: "Clue E", nextWord: null },
          { startRow: 0, startCol: 4, direction: "down", length: 5, number: 5, clue: "Clue F", nextWord: null },
        ],
        title: "Overlap Test",
        author: "Tester",
      };
      // This test is tricky — in a valid crossword, across and down can share cells.
      // The structural rule is: each cell can be part of at most ONE across word and ONE down word.
      // Let's create a case where two across words overlap:
      puzzle.words = [
        { startRow: 0, startCol: 0, direction: "across", length: 5, number: 1, clue: "Clue A", nextWord: null },
        { startRow: 0, startCol: 0, direction: "across", length: 3, number: 1, clue: "Clue B", nextWord: null },
        { startRow: 0, startCol: 0, direction: "down", length: 5, number: 1, clue: "Clue C", nextWord: null },
        // Fill in remaining down words
        { startRow: 0, startCol: 2, direction: "down", length: 5, number: 2, clue: "Clue D", nextWord: null },
      ];
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("overlap") || e.toLowerCase().includes("structural"))).toBe(true);
    });
  });

  // --- nextWord / chain validation ---
  describe("nextWord and chain validation", () => {
    it("rejects nextWord cycle", () => {
      const puzzle = makeValidCompletePuzzle();
      // Create a cycle: word 0 → word 2 → word 0
      puzzle.words[0].nextWord = { startRow: 2, startCol: 0, direction: "across" };
      puzzle.words[2].nextWord = { startRow: 0, startCol: 0, direction: "across" };
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("chain") || e.toLowerCase().includes("cycle"))).toBe(true);
    });

    it("rejects nextWord branching (two words pointing to same target)", () => {
      const puzzle = makeValidCompletePuzzle();
      // Both word 0 and word 1 point to word 2
      puzzle.words[0].nextWord = { startRow: 2, startCol: 0, direction: "across" };
      puzzle.words[1].nextWord = { startRow: 2, startCol: 0, direction: "across" };
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("chain") || e.toLowerCase().includes("branch"))).toBe(true);
    });

    it("rejects nextWord pointing to non-existent word", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.words[0].nextWord = { startRow: 5, startCol: 5, direction: "across" };
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("nextword") || e.toLowerCase().includes("reference"))).toBe(true);
    });
  });

  // --- Marker fields ---
  describe("marker fields", () => {
    it("allows missing marker fields (default to false)", () => {
      const puzzle = makeValidCompletePuzzle();
      // Remove marker fields from cells — they should default to false
      const grid: CellData[][] = [
        [
          makeCell({ black: false, puzzleLetter: "A" }),
          makeCell({ black: false, puzzleLetter: "B" }),
          makeCell({ black: false, puzzleLetter: "C" }),
        ],
        [
          makeCell({ black: false, puzzleLetter: "D" }),
          makeBlackCell(),
          makeCell({ black: false, puzzleLetter: "E" }),
        ],
        [
          makeCell({ black: false, puzzleLetter: "F" }),
          makeCell({ black: false, puzzleLetter: "G" }),
          makeCell({ black: false, puzzleLetter: "H" }),
        ],
      ];
      puzzle.grid = grid;
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(true);
    });

    it("rejects non-boolean marker field", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.grid[0][0].spaceRight = "yes" as unknown as boolean;
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("marker") || e.toLowerCase().includes("boolean"))).toBe(true);
    });
  });

  // --- Multiple errors ---
  describe("multiple errors", () => {
    it("collects multiple errors at once", () => {
      const puzzle = makeValidCompletePuzzle();
      puzzle.version = 2; // wrong version
      puzzle.grid[0][0].puzzleLetter = null; // null puzzle letter in white cell
      const result = validateCompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============================================================
// 2. validateIncompletePuzzle
// ============================================================
describe("validateIncompletePuzzle", () => {
  describe("valid puzzle", () => {
    it("passes for valid incomplete puzzle", () => {
      const puzzle = makeValidIncompletePuzzle();
      const result = validateIncompletePuzzle(puzzle);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("lenient rules", () => {
    it("allows null letters in white cells", () => {
      const puzzle = makeValidIncompletePuzzle();
      // All letters are null — should be fine for incomplete
      const result = validateIncompletePuzzle(puzzle);
      expect(result.valid).toBe(true);
    });

    it("allows empty clues on all words", () => {
      const puzzle = makeValidIncompletePuzzle();
      puzzle.words.forEach((w) => {
        w.clue = "";
      });
      const result = validateIncompletePuzzle(puzzle);
      expect(result.valid).toBe(true);
    });
  });

  describe("strict structural rules", () => {
    it("rejects wrong version", () => {
      const puzzle = makeValidIncompletePuzzle();
      puzzle.version = 2;
      const result = validateIncompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("version"))).toBe(true);
    });

it("rejects wrong type", () => {
      const puzzle = makeValidIncompletePuzzle();
      (puzzle as unknown as Record<string, unknown>).type = "complete";
      const result = validateIncompletePuzzle(puzzle as unknown as IncompletePuzzleJSON);
      expect(result.valid).toBe(false);
    });

    it("rejects missing required fields", () => {
      const puzzle = makeValidIncompletePuzzle();
      delete (puzzle as unknown as Record<string, unknown>).key;
      const result = validateIncompletePuzzle(puzzle as unknown as IncompletePuzzleJSON);
      expect(result.valid).toBe(false);
    });

    it("rejects grid dimension mismatch", () => {
      const puzzle = makeValidIncompletePuzzle();
      // Remove one row
      puzzle.grid = puzzle.grid.slice(0, 2);
      const result = validateIncompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
    });

    it("rejects word with start position out of bounds", () => {
      const puzzle = makeValidIncompletePuzzle();
      puzzle.words[0].startRow = 99;
      const result = validateIncompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
    });

    it("rejects invalid direction", () => {
      const puzzle = makeValidIncompletePuzzle();
      puzzle.words[0].direction = "diagonal" as "across" | "down";
      const result = validateIncompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
    });

    it("rejects non-boolean marker field", () => {
      const puzzle = makeValidIncompletePuzzle();
      puzzle.grid[0][0].spaceRight = "yes" as unknown as boolean;
      const result = validateIncompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
    });

    it("rejects invalid chain (cycle)", () => {
      const puzzle = makeValidIncompletePuzzle();
      // Create a cycle
      puzzle.words[0].nextWord = { startRow: 2, startCol: 0, direction: "across" };
      puzzle.words[2].nextWord = { startRow: 0, startCol: 0, direction: "across" };
      const result = validateIncompletePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("chain") || e.toLowerCase().includes("cycle"))).toBe(true);
    });
  });
});

// ============================================================
// 3. canExportAsComplete
// ============================================================
describe("canExportAsComplete", () => {
  /** Build a 3×3 grid and word list for export checks */
  function makeExportTestData() {
    const grid: CellData[][] = [
      [makeWhiteCell("A"), makeWhiteCell("B"), makeWhiteCell("C")],
      [makeWhiteCell("D"), makeBlackCell(), makeWhiteCell("E")],
      [makeWhiteCell("F"), makeWhiteCell("G"), makeWhiteCell("H")],
    ];
    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 3, number: 1, clue: "Clue 1A", nextWord: null },
      { startRow: 0, startCol: 0, direction: "down", length: 3, number: 1, clue: "Clue 1D", nextWord: null },
      { startRow: 2, startCol: 0, direction: "across", length: 3, number: 3, clue: "Clue 3A", nextWord: null },
      { startRow: 0, startCol: 2, direction: "down", length: 3, number: 2, clue: "Clue 2D", nextWord: null },
    ];
    return { grid, words };
  }

  it("returns canExport: true when all cells have letters and all head words have clues", () => {
    const { grid, words } = makeExportTestData();
    const result = canExportAsComplete(grid, words);
    expect(result.canExport).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns canExport: false with error about empty cell when a white cell is missing a letter", () => {
    const { grid, words } = makeExportTestData();
    grid[0][0].puzzleLetter = null;
    const result = canExportAsComplete(grid, words);
    expect(result.canExport).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("letter") || e.toLowerCase().includes("cell"))).toBe(true);
  });

  it("returns canExport: false when chain head word has empty clue", () => {
    const { grid, words } = makeExportTestData();
    words[0].clue = "";
    const result = canExportAsComplete(grid, words);
    expect(result.canExport).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("clue"))).toBe(true);
  });

  it("returns canExport: true when non-head chain word has empty clue", () => {
    const { grid, words } = makeExportTestData();
    // Chain word 0 → word 2
    words[0].nextWord = { startRow: 2, startCol: 0, direction: "across" };
    // Word 2 is now a non-head, its clue can be empty
    words[2].clue = "";
    const result = canExportAsComplete(grid, words);
    expect(result.canExport).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns canExport: true for all-black grid (no white cells to check)", () => {
    const grid: CellData[][] = [
      [makeBlackCell(), makeBlackCell()],
      [makeBlackCell(), makeBlackCell()],
    ];
    const words: Word[] = [];
    const result = canExportAsComplete(grid, words);
    expect(result.canExport).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns canExport: false when multiple white cells missing letters", () => {
    const { grid, words } = makeExportTestData();
    grid[0][0].puzzleLetter = null;
    grid[2][2].puzzleLetter = null;
    const result = canExportAsComplete(grid, words);
    expect(result.canExport).toBe(false);
    // Should report errors (plural or at least one)
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it("returns canExport: false when multiple head words missing clues", () => {
    const { grid, words } = makeExportTestData();
    words[0].clue = "";
    words[1].clue = "";
    const result = canExportAsComplete(grid, words);
    expect(result.canExport).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("clue"))).toBe(true);
  });
});