import { describe, it, expect } from "vitest";
import {
  serializeIncompletePuzzle,
  serializeCompletePuzzle,
  parsePuzzleJSON,
  deriveWordAnswer,
} from "./import-export";
import type {
  CellData,
  Word,
  DisplacedClue,
  PuzzleMetadata,
  WordPosition,
} from "./types";
import { CURRENT_VERSION } from "./constants";

// ============================================================
// Helpers
// ============================================================

function makeCell(overrides: Partial<CellData> = {}): CellData {
  return {
    black: false,
    letter: null,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
    ...overrides,
  };
}

function makeBlackCell(): CellData {
  return makeCell({ black: true, letter: null });
}

function makeWhiteCell(letter: string): CellData {
  return makeCell({ black: false, letter });
}

/**
 * Create a simple 3×3 grid with a cross pattern:
 * A B C
 * D # E
 * F G H
 */
function makeCrossGrid(): CellData[][] {
  return [
    [makeWhiteCell("A"), makeWhiteCell("B"), makeWhiteCell("C")],
    [makeWhiteCell("D"), makeBlackCell(), makeWhiteCell("E")],
    [makeWhiteCell("F"), makeWhiteCell("G"), makeWhiteCell("H")],
  ];
}

/**
 * Same as makeCrossGrid but with null letters (incomplete puzzle).
 */
function makeEmptyCrossGrid(): CellData[][] {
  return [
    [makeCell(), makeCell(), makeCell()],
    [makeCell(), makeBlackCell(), makeCell()],
    [makeCell(), makeCell(), makeCell()],
  ];
}

/**
 * Words for the 3×3 cross grid:
 * 1-Across: (0,0)→(0,2) length 3
 * 1-Down: (0,0)→(2,0) length 3
 * 3-Across: (2,0)→(2,2) length 3
 * 2-Down: (0,2)→(2,2) length 3
 */
function makeCrossWords(): Word[] {
  return [
    { startRow: 0, startCol: 0, direction: "across", length: 3, number: 1, clue: "Clue 1A", nextWord: null },
    { startRow: 0, startCol: 0, direction: "down", length: 3, number: 1, clue: "Clue 1D", nextWord: null },
    { startRow: 2, startCol: 0, direction: "across", length: 3, number: 3, clue: "Clue 3A", nextWord: null },
    { startRow: 0, startCol: 2, direction: "down", length: 3, number: 2, clue: "Clue 2D", nextWord: null },
  ];
}

const defaultMetadata: PuzzleMetadata = {
  title: "Test Puzzle",
  author: "Test Author",
};

// ============================================================
// 1. serializeIncompletePuzzle
// ============================================================
describe("serializeIncompletePuzzle", () => {
  it("serializes a simple puzzle correctly", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords();
    const displacedClues: DisplacedClue[] = [];

    const result = serializeIncompletePuzzle(grid, words, displacedClues, defaultMetadata, "test-key");

    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.type).toBe("incomplete");
    expect(result.key).toBe("test-key");
    expect(result.gridSize).toBe(3);
    expect(result.title).toBe("Test Puzzle");
    expect(result.author).toBe("Test Author");
  });

  it("includes gridSize derived from grid dimensions", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords();

    const result = serializeIncompletePuzzle(grid, words, [], defaultMetadata, "k1");

    expect(result.gridSize).toBe(3);
  });

  it("includes grid with all cell fields", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords();

    const result = serializeIncompletePuzzle(grid, words, [], defaultMetadata, "k1");

    expect(result.grid).toHaveLength(3);
    expect(result.grid[0]).toHaveLength(3);
    // Check a white cell
    const cell = result.grid[0][0];
    expect(cell.black).toBe(false);
    expect(cell.letter).toBeNull();
    expect(cell.spaceRight).toBe(false);
    expect(cell.spaceBottom).toBe(false);
    expect(cell.hyphenRight).toBe(false);
    expect(cell.hyphenBottom).toBe(false);
  });

  it("preserves letter: null cells in JSON", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords();

    const result = serializeIncompletePuzzle(grid, words, [], defaultMetadata, "k1");

    // White cells should have letter: null
    expect(result.grid[0][0].letter).toBeNull();
    // Black cell should also have letter: null
    expect(result.grid[1][1].letter).toBeNull();
  });

  it("includes words with startRow, startCol, direction, clue, nextWord", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords();

    const result = serializeIncompletePuzzle(grid, words, [], defaultMetadata, "k1");

    expect(result.words).toHaveLength(4);
    const word = result.words[0];
    expect(word.startRow).toBe(0);
    expect(word.startCol).toBe(0);
    expect(word.direction).toBe("across");
    expect(word.clue).toBe("Clue 1A");
    expect(word.nextWord).toBeNull();
  });

  it("includes empty displacedClues array", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords();

    const result = serializeIncompletePuzzle(grid, words, [], defaultMetadata, "k1");

    expect(result.displacedClues).toEqual([]);
  });

  it("includes displacedClues when provided", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords();
    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Orphan clue", direction: "across" },
    ];

    const result = serializeIncompletePuzzle(grid, words, displacedClues, defaultMetadata, "k1");

    expect(result.displacedClues).toHaveLength(1);
    expect(result.displacedClues[0].clue).toBe("Orphan clue");
    expect(result.displacedClues[0].direction).toBe("across");
  });

  it("includes nextWord references in words", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords();
    // Chain: word 0 (across at 0,0) → word 2 (across at 2,0)
    const nextRef: WordPosition = { startRow: 2, startCol: 0, direction: "across" };
    words[0].nextWord = nextRef;

    const result = serializeIncompletePuzzle(grid, words, [], defaultMetadata, "k1");

    expect(result.words[0].nextWord).toEqual(nextRef);
    expect(result.words[2].nextWord).toBeNull();
  });

  it("preserves cells with markers set to true", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords();
    grid[0][0].spaceRight = true;
    grid[0][0].hyphenBottom = true;

    const result = serializeIncompletePuzzle(grid, words, [], defaultMetadata, "k1");

    expect(result.grid[0][0].spaceRight).toBe(true);
    expect(result.grid[0][0].hyphenBottom).toBe(true);
    expect(result.grid[0][0].spaceBottom).toBe(false);
    expect(result.grid[0][0].hyphenRight).toBe(false);
  });

  it("can round-trip: serialize → parse → serialize produces equivalent data", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords();
    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Old clue", direction: "down" },
    ];

    const serialized = serializeIncompletePuzzle(grid, words, displacedClues, defaultMetadata, "round-trip-key");
    const jsonString = JSON.stringify(serialized);

    const parsed = parsePuzzleJSON(jsonString);
    expect(parsed).not.toHaveProperty("error");
    if ("data" in parsed && parsed.type === "incomplete") {
      const reSerialized = serializeIncompletePuzzle(
        parsed.data.grid,
        parsed.data.words,
        parsed.data.displacedClues,
        { title: parsed.data.title, author: parsed.data.author },
        parsed.data.key,
      );

      expect(reSerialized.version).toBe(serialized.version);
      expect(reSerialized.type).toBe(serialized.type);
      expect(reSerialized.key).toBe(serialized.key);
      expect(reSerialized.gridSize).toBe(serialized.gridSize);
      expect(reSerialized.title).toBe(serialized.title);
      expect(reSerialized.author).toBe(serialized.author);
      expect(reSerialized.displacedClues).toEqual(serialized.displacedClues);
      expect(reSerialized.words).toEqual(serialized.words);
    }
  });
});

// ============================================================
// 2. serializeCompletePuzzle
// ============================================================
describe("serializeCompletePuzzle", () => {
  it("serializes a valid complete puzzle correctly", () => {
    const grid = makeCrossGrid(); // All white cells have letters
    const words = makeCrossWords();

    const result = serializeCompletePuzzle(grid, words, defaultMetadata, "complete-key");

    if ("error" in result) {
      // Should not happen
      expect.unreachable(`Expected valid result, got error: ${result.error}`);
    } else {
      expect(result.version).toBe(CURRENT_VERSION);
      expect(result.type).toBe("complete");
      expect(result.key).toBe("complete-key");
      expect(result.gridSize).toBe(3);
      expect(result.title).toBe("Test Puzzle");
      expect(result.author).toBe("Test Author");
    }
  });

  it("returns error if any white cell has no letter", () => {
    const grid = makeCrossGrid();
    grid[0][0].letter = null; // Missing letter in a white cell
    const words = makeCrossWords();

    const result = serializeCompletePuzzle(grid, words, defaultMetadata, "k1");

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error).toBeTruthy();
    }
  });

  it("returns error if any chain-head word has empty clue", () => {
    const grid = makeCrossGrid();
    const words = makeCrossWords();
    words[0].clue = ""; // Chain head with empty clue

    const result = serializeCompletePuzzle(grid, words, defaultMetadata, "k1");

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error).toBeTruthy();
    }
  });

  it("complete format has type: complete", () => {
    const grid = makeCrossGrid();
    const words = makeCrossWords();

    const result = serializeCompletePuzzle(grid, words, defaultMetadata, "k1");

    if (!("error" in result)) {
      expect(result.type).toBe("complete");
    }
  });

  it("complete format has NO displacedClues field", () => {
    const grid = makeCrossGrid();
    const words = makeCrossWords();

    const result = serializeCompletePuzzle(grid, words, defaultMetadata, "k1");

    if (!("error" in result)) {
      expect(result).not.toHaveProperty("displacedClues");
    }
  });

  it("includes gridSize derived from grid dimensions", () => {
    const grid = makeCrossGrid();
    const words = makeCrossWords();

    const result = serializeCompletePuzzle(grid, words, defaultMetadata, "k1");

    if (!("error" in result)) {
      expect(result.gridSize).toBe(3);
    }
  });

  it("includes words with clues and nextWord references", () => {
    const grid = makeCrossGrid();
    const words = makeCrossWords();
    const nextRef: WordPosition = { startRow: 2, startCol: 0, direction: "across" };
    words[0].nextWord = nextRef;
    // Word 2 (across at 2,0) becomes non-head — its clue can be empty
    words[2].clue = "";

    const result = serializeCompletePuzzle(grid, words, defaultMetadata, "k1");

    if (!("error" in result)) {
      expect(result.words[0].nextWord).toEqual(nextRef);
      expect(result.words[2].clue).toBe("");
    }
  });

  it("succeeds when non-head chain word has empty clue", () => {
    const grid = makeCrossGrid();
    const words = makeCrossWords();
    // Chain: word 0 → word 2
    const nextRef: WordPosition = { startRow: 2, startCol: 0, direction: "across" };
    words[0].nextWord = nextRef;
    words[2].clue = ""; // Non-head, empty clue is OK

    const result = serializeCompletePuzzle(grid, words, defaultMetadata, "k1");

    expect(result).not.toHaveProperty("error");
  });

  it("includes grid letters from cell data (answers are not stored separately)", () => {
    const grid = makeCrossGrid();
    const words = makeCrossWords();

    const result = serializeCompletePuzzle(grid, words, defaultMetadata, "k1");

    if (!("error" in result)) {
      expect(result.grid[0][0].letter).toBe("A");
      expect(result.grid[0][1].letter).toBe("B");
      expect(result.grid[0][2].letter).toBe("C");
    }
  });
});

// ============================================================
// 3. parsePuzzleJSON
// ============================================================
describe("parsePuzzleJSON", () => {
  it("parses valid incomplete puzzle JSON", () => {
    const grid = makeEmptyCrossGrid();
    const words = makeCrossWords().map(w => ({ ...w, clue: "" }));
    const puzzle = {
      version: CURRENT_VERSION,
      type: "incomplete" as const,
      key: "test-key",
      gridSize: 3,
      grid,
      words,
      title: "Test Title",
      author: "Test Author",
      displacedClues: [] as DisplacedClue[],
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    expect(result).not.toHaveProperty("error");
    if ("type" in result) {
      expect(result.type).toBe("incomplete");
      if (result.type === "incomplete") {
        expect(result.data.key).toBe("test-key");
        expect(result.data.gridSize).toBe(3);
        expect(result.data.title).toBe("Test Title");
        expect(result.data.author).toBe("Test Author");
        expect(result.data.displacedClues).toEqual([]);
      }
    }
  });

  it("parses valid complete puzzle JSON", () => {
    const grid = makeCrossGrid();
    const words = makeCrossWords();
    const puzzle = {
      version: CURRENT_VERSION,
      type: "complete" as const,
      key: "complete-key",
      gridSize: 3,
      grid,
      words,
      title: "Complete Title",
      author: "Complete Author",
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    expect(result).not.toHaveProperty("error");
    if ("type" in result) {
      expect(result.type).toBe("complete");
      if (result.type === "complete") {
        expect(result.data.key).toBe("complete-key");
        expect(result.data.gridSize).toBe(3);
        expect(result.data.title).toBe("Complete Title");
        expect(result.data.author).toBe("Complete Author");
      }
    }
  });

  it("returns error for invalid JSON (malformed string)", () => {
    const result = parsePuzzleJSON("{ not valid json }}}");

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error).toBeTruthy();
    }
  });

  it("returns error for unrecognized version", () => {
    const puzzle = {
      version: 99,
      type: "incomplete",
      key: "k",
      gridSize: 3,
      grid: makeEmptyCrossGrid(),
      words: [],
      title: "",
      author: "",
      displacedClues: [],
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error.toLowerCase()).toContain("version");
    }
  });

  it("returns error for missing type field", () => {
    const puzzle = {
      version: CURRENT_VERSION,
      // type field is missing
      key: "k",
      gridSize: 3,
      grid: makeEmptyCrossGrid(),
      words: [],
      title: "",
      author: "",
      displacedClues: [],
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error.toLowerCase()).toContain("type");
    }
  });

  it("returns error for unrecognized type", () => {
    const puzzle = {
      version: CURRENT_VERSION,
      type: "unknown",
      key: "k",
      gridSize: 3,
      grid: makeEmptyCrossGrid(),
      words: [],
      title: "",
      author: "",
      displacedClues: [],
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    expect(result).toHaveProperty("error");
  });

  it("returns error for invalid complete puzzle (empty clues on head words)", () => {
    const grid = makeCrossGrid();
    // All clues are empty — should fail complete validation
    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 3, number: 1, clue: "", nextWord: null },
      { startRow: 0, startCol: 0, direction: "down", length: 3, number: 1, clue: "", nextWord: null },
      { startRow: 2, startCol: 0, direction: "across", length: 3, number: 3, clue: "", nextWord: null },
      { startRow: 0, startCol: 2, direction: "down", length: 3, number: 2, clue: "", nextWord: null },
    ];
    const puzzle = {
      version: CURRENT_VERSION,
      type: "complete",
      key: "bad-key",
      gridSize: 3,
      grid,
      words,
      title: "",
      author: "",
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    expect(result).toHaveProperty("error");
  });

  it("returns error for invalid incomplete puzzle (wrong grid dimensions)", () => {
    const grid = makeEmptyCrossGrid();
    const puzzle = {
      version: CURRENT_VERSION,
      type: "incomplete",
      key: "k",
      gridSize: 5, // Mismatch: grid is 3×3 but says 5
      grid,
      words: [],
      title: "",
      author: "",
      displacedClues: [],
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    expect(result).toHaveProperty("error");
  });

  it("creates proper grid with default marker values for incomplete puzzle", () => {
    // Create a grid where some marker fields are missing
    const cells = [
      [{ black: false, letter: null }, { black: false, letter: null, spaceRight: true }, { black: false, letter: null }],
      [{ black: false, letter: null }, { black: true, letter: null }, { black: false, letter: null }],
      [{ black: false, letter: null }, { black: false, letter: null }, { black: false, letter: null }],
    ];
    const puzzle = {
      version: CURRENT_VERSION,
      type: "incomplete",
      key: "k",
      gridSize: 3,
      grid: cells,
      words: [] as Word[],
      title: "",
      author: "",
      displacedClues: [],
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    expect(result).not.toHaveProperty("error");
    if ("type" in result && result.type === "incomplete") {
      // Missing marker fields should default to false
      // Cell (0,0) had no marker fields — should default all to false
      expect(result.data.grid[0][0].spaceRight).toBe(false);
      expect(result.data.grid[0][0].spaceBottom).toBe(false);
      expect(result.data.grid[0][0].hyphenRight).toBe(false);
      expect(result.data.grid[0][0].hyphenBottom).toBe(false);
      // Cell (0,1) had spaceRight=true — should be preserved
      expect(result.data.grid[0][1].spaceRight).toBe(true);
      expect(result.data.grid[0][1].spaceBottom).toBe(false);
      expect(result.data.grid[0][1].hyphenRight).toBe(false);
      expect(result.data.grid[0][1].hyphenBottom).toBe(false);
    }
  });

  it("defaults marker fields to false when absent in complete puzzle JSON", () => {
    const cells = [
      [
        { black: false, letter: "A" },
        { black: false, letter: "B", spaceRight: true },
        { black: false, letter: "C" },
      ],
      [
        { black: false, letter: "D" },
        { black: true, letter: null },
        { black: false, letter: "E" },
      ],
      [
        { black: false, letter: "F" },
        { black: false, letter: "G" },
        { black: false, letter: "H" },
      ],
    ];
    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 3, number: 1, clue: "Clue 1A", nextWord: null },
      { startRow: 0, startCol: 0, direction: "down", length: 3, number: 1, clue: "Clue 1D", nextWord: null },
      { startRow: 2, startCol: 0, direction: "across", length: 3, number: 3, clue: "Clue 3A", nextWord: null },
      { startRow: 0, startCol: 2, direction: "down", length: 3, number: 2, clue: "Clue 2D", nextWord: null },
    ];
    const puzzle = {
      version: CURRENT_VERSION,
      type: "complete",
      key: "k",
      gridSize: 3,
      grid: cells,
      words,
      title: "Test",
      author: "Tester",
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    expect(result).not.toHaveProperty("error");
    if ("type" in result && result.type === "complete") {
      // Missing marker fields should default to false
      expect(result.data.grid[0][0].spaceRight).toBe(false);
      expect(result.data.grid[0][0].spaceBottom).toBe(false);
      // Explicitly set marker should be preserved
      expect(result.data.grid[0][1].spaceRight).toBe(true);
      expect(result.data.grid[0][1].spaceBottom).toBe(false);
    }
  });

  it("type discriminator works correctly — incomplete returns 'incomplete'", () => {
    const puzzle = {
      version: CURRENT_VERSION,
      type: "incomplete",
      key: "k",
      gridSize: 3,
      grid: makeEmptyCrossGrid(),
      words: [] as Word[],
      title: "",
      author: "",
      displacedClues: [],
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    if ("type" in result) {
      expect(result.type).toBe("incomplete");
    }
  });

  it("type discriminator works correctly — complete returns 'complete'", () => {
    const grid = makeCrossGrid();
    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 3, number: 1, clue: "Clue 1A", nextWord: null },
      { startRow: 0, startCol: 0, direction: "down", length: 3, number: 1, clue: "Clue 1D", nextWord: null },
      { startRow: 2, startCol: 0, direction: "across", length: 3, number: 3, clue: "Clue 3A", nextWord: null },
      { startRow: 0, startCol: 2, direction: "down", length: 3, number: 2, clue: "Clue 2D", nextWord: null },
    ];
    const puzzle = {
      version: CURRENT_VERSION,
      type: "complete",
      key: "k",
      gridSize: 3,
      grid,
      words,
      title: "Test",
      author: "Tester",
    };
    const jsonString = JSON.stringify(puzzle);

    const result = parsePuzzleJSON(jsonString);

    if ("type" in result) {
      expect(result.type).toBe("complete");
    }
  });
});

// ============================================================
// 4. deriveWordAnswer
// ============================================================
describe("deriveWordAnswer", () => {
  it("derives answer string from grid cells for an across word", () => {
    const grid = makeCrossGrid();
    // 1-Across: A B C at (0,0) across, length 3
    const word: Word = {
      startRow: 0,
      startCol: 0,
      direction: "across",
      length: 3,
      number: 1,
      clue: "",
      nextWord: null,
    };

    const answer = deriveWordAnswer(grid, word);

    expect(answer).toBe("ABC");
  });

  it("derives answer string from grid cells for a down word", () => {
    const grid = makeCrossGrid();
    // 1-Down: A D F at (0,0) down, length 3
    const word: Word = {
      startRow: 0,
      startCol: 0,
      direction: "down",
      length: 3,
      number: 1,
      clue: "",
      nextWord: null,
    };

    const answer = deriveWordAnswer(grid, word);

    expect(answer).toBe("ADF");
  });

  it("derives correct answer for word starting at offset position", () => {
    const grid = makeCrossGrid();
    // 3-Across: F G H at (2,0) across, length 3
    const word: Word = {
      startRow: 2,
      startCol: 0,
      direction: "across",
      length: 3,
      number: 3,
      clue: "",
      nextWord: null,
    };

    const answer = deriveWordAnswer(grid, word);

    expect(answer).toBe("FGH");
  });

  it("handles null letter cells by skipping them in the answer", () => {
    const grid = makeCrossGrid();
    // Set cell (0,1) to null
    grid[0][1].letter = null;

    const word: Word = {
      startRow: 0,
      startCol: 0,
      direction: "across",
      length: 3,
      number: 1,
      clue: "",
      nextWord: null,
    };

    const answer = deriveWordAnswer(grid, word);

    // Null cells contribute empty string
    expect(answer).toBe("AC");
  });

  it("derives correct answer for down word in middle of grid", () => {
    const grid = makeCrossGrid();
    // 2-Down: C E H at (0,2) down, length 3
    const word: Word = {
      startRow: 0,
      startCol: 2,
      direction: "down",
      length: 3,
      number: 2,
      clue: "",
      nextWord: null,
    };

    const answer = deriveWordAnswer(grid, word);

    expect(answer).toBe("CEH");
  });

  it("works with a 5×5 grid", () => {
    // Build a 5×5 grid:
    // A B C D E
    // F G H I J
    // K L M N O
    // P Q R S T
    // U V W X Y
    const grid: CellData[][] = [];
    let letter = "A".charCodeAt(0);
    for (let r = 0; r < 5; r++) {
      const row: CellData[] = [];
      for (let c = 0; c < 5; c++) {
        row.push(makeWhiteCell(String.fromCharCode(letter)));
        letter++;
      }
      grid.push(row);
    }

    // Word: across at (2, 0), length 5 → "KLMNO"
    const word: Word = {
      startRow: 2,
      startCol: 0,
      direction: "across",
      length: 5,
      number: 1,
      clue: "",
      nextWord: null,
    };

    const answer = deriveWordAnswer(grid, word);
    expect(answer).toBe("KLMNO");

    // Word: down at (0, 3), length 5 → "DINSX"
    const word2: Word = {
      startRow: 0,
      startCol: 3,
      direction: "down",
      length: 5,
      number: 2,
      clue: "",
      nextWord: null,
    };

    const answer2 = deriveWordAnswer(grid, word2);
    expect(answer2).toBe("DINSX");
  });
});

// ============================================================
// 5. Edge cases and integration
// ============================================================
describe("integration: serialize then parse round-trip", () => {
  it("incomplete puzzle survives round-trip", () => {
    const grid = makeEmptyCrossGrid();
    grid[0][1].letter = "X";
    grid[0][1].spaceRight = true;
    grid[1][0].hyphenBottom = true;

    const words: Word[] = makeCrossWords().map(w => ({ ...w, clue: "" }));
    words[0].nextWord = { startRow: 2, startCol: 0, direction: "across" };

    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Lost clue", direction: "down" },
    ];

    const serialized = serializeIncompletePuzzle(
      grid,
      words,
      displacedClues,
      { title: "Round Trip", author: "Tester" },
      "rt-key",
    );

    const jsonString = JSON.stringify(serialized);
    const parsed = parsePuzzleJSON(jsonString);

    expect(parsed).not.toHaveProperty("error");
    if ("type" in parsed && parsed.type === "incomplete") {
      expect(parsed.data.key).toBe("rt-key");
      expect(parsed.data.title).toBe("Round Trip");
      expect(parsed.data.author).toBe("Tester");
      expect(parsed.data.gridSize).toBe(3);
      expect(parsed.data.grid[0][1].letter).toBe("X");
      expect(parsed.data.grid[0][1].spaceRight).toBe(true);
      expect(parsed.data.grid[1][0].hyphenBottom).toBe(true);
      expect(parsed.data.displacedClues).toHaveLength(1);
      expect(parsed.data.displacedClues[0].clue).toBe("Lost clue");
      expect(parsed.data.words[0].nextWord).toEqual({ startRow: 2, startCol: 0, direction: "across" });
    }
  });

  it("complete puzzle survives round-trip", () => {
    const grid = makeCrossGrid();
    const words = makeCrossWords();

    const serialized = serializeCompletePuzzle(
      grid,
      words,
      { title: "Complete Round Trip", author: "Tester" },
      "crt-key",
    );

    if ("error" in serialized) {
      expect.unreachable(`Serialization failed: ${serialized.error}`);
    }

    const jsonString = JSON.stringify(serialized);
    const parsed = parsePuzzleJSON(jsonString);

    expect(parsed).not.toHaveProperty("error");
    if ("type" in parsed && parsed.type === "complete") {
      expect(parsed.data.key).toBe("crt-key");
      expect(parsed.data.title).toBe("Complete Round Trip");
      expect(parsed.data.grid[0][0].letter).toBe("A");
      expect(parsed.data.grid[0][1].letter).toBe("B");
    }
  });
});