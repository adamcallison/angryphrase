import type {
  CellData,
  CompletePuzzle,
  CompletePuzzleJSON,
  DisplacedClue,
  IncompletePuzzle,
  IncompletePuzzleJSON,
  PuzzleMetadata,
  Word,
} from "./types";
import { CURRENT_VERSION } from "./constants";
import {
  validateCompletePuzzle,
  validateIncompletePuzzle,
} from "./validation";
import { isChainHead } from "./chain-logic";

// =============================================================================
// deriveWordAnswer
// =============================================================================

/**
 * Derives the answer string for a word by walking the grid cells
 * from the word's start position in the given direction for word.length cells.
 * Null letters contribute empty strings to the result.
 */
export function deriveWordAnswer(grid: CellData[][], word: Word): string {
  let answer = "";
  for (let i = 0; i < word.length; i++) {
    const row = word.direction === "down" ? word.startRow + i : word.startRow;
    const col = word.direction === "across" ? word.startCol + i : word.startCol;

    if (row >= 0 && row < grid.length && col >= 0 && col < grid[row].length) {
      const cell = grid[row][col];
      if (cell.letter !== null && cell.letter !== undefined) {
        answer += cell.letter;
      }
      // null letters contribute nothing (empty string)
    }
  }
  return answer;
}

// =============================================================================
// serializeIncompletePuzzle
// =============================================================================

/**
 * Serializes builder state into an IncompletePuzzleJSON object.
 * This format includes displacedClues and allows letter: null and empty clues.
 * Marker fields that are false are included as-is (all cell fields preserved).
 */
export function serializeIncompletePuzzle(
  grid: CellData[][],
  words: Word[],
  displacedClues: DisplacedClue[],
  metadata: PuzzleMetadata,
  key: string,
): IncompletePuzzleJSON {
  // Deep clone the grid to avoid mutations
  const gridCopy: CellData[][] = grid.map((row) =>
    row.map((cell) => ({ ...cell })),
  );

  // Deep clone words
  const wordsCopy: Word[] = words.map((w) => ({
    ...w,
    nextWord: w.nextWord ? { ...w.nextWord } : null,
  }));

  // Deep clone displaced clues
  const displacedCopy: DisplacedClue[] = displacedClues.map((dc) => ({ ...dc }));

  return {
    version: CURRENT_VERSION,
    type: "incomplete",
    key,
    gridSize: grid.length,
    grid: gridCopy,
    words: wordsCopy,
    title: metadata.title,
    author: metadata.author,
    displacedClues: displacedCopy,
  };
}

// =============================================================================
// serializeCompletePuzzle
// =============================================================================

/**
 * Serializes builder state into a CompletePuzzleJSON object, but only if
 * all white cells have letters and all chain-head words have non-empty clues.
 * Returns { error: string } if validation fails.
 *
 * Complete format has NO displacedClues field.
 */
export function serializeCompletePuzzle(
  grid: CellData[][],
  words: Word[],
  metadata: PuzzleMetadata,
  key: string,
): CompletePuzzleJSON | { error: string } {
  const gridSize = grid.length;

  // Validate export readiness
  const errors: string[] = [];

  // Check all white cells have letters
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (!cell.black) {
        if (cell.letter === null || cell.letter === undefined || cell.letter === "") {
          errors.push(`White cell at (${r}, ${c}) has no letter`);
        } else if (!/^[A-Z]$/.test(cell.letter)) {
          errors.push(`White cell at (${r}, ${c}) has invalid letter: "${cell.letter}"`);
        }
      }
    }
  }

  // Check chain-head words have non-empty clues
  for (const word of words) {
    if (isChainHead(words, word)) {
      if (!word.clue || word.clue.trim() === "") {
        errors.push(
          `Chain head word at (${word.startRow}, ${word.startCol}) ${word.direction} has empty clue`,
        );
      }
    }
  }

  if (errors.length > 0) {
    return { error: errors.join("; ") };
  }

  // Deep clone the grid
  const gridCopy: CellData[][] = grid.map((row) =>
    row.map((cell) => ({ ...cell })),
  );

  // Deep clone words
  const wordsCopy: Word[] = words.map((w) => ({
    ...w,
    nextWord: w.nextWord ? { ...w.nextWord } : null,
  }));

  return {
    version: CURRENT_VERSION,
    type: "complete",
    key,
    gridSize,
    grid: gridCopy,
    words: wordsCopy,
    title: metadata.title,
    author: metadata.author,
  };
}

// =============================================================================
// parsePuzzleJSON
// =============================================================================

/** Fills in default values for missing marker fields on grid cells. */
function normalizeCell(cell: Record<string, unknown>): CellData {
  return {
    black: Boolean(cell.black),
    letter: cell.letter === null || cell.letter === undefined ? null : String(cell.letter),
    spaceRight: cell.spaceRight === undefined ? false : Boolean(cell.spaceRight),
    spaceBottom: cell.spaceBottom === undefined ? false : Boolean(cell.spaceBottom),
    hyphenRight: cell.hyphenRight === undefined ? false : Boolean(cell.hyphenRight),
    hyphenBottom: cell.hyphenBottom === undefined ? false : Boolean(cell.hyphenBottom),
  };
}

/** Normalizes all cells in a grid, filling in default marker values. */
function normalizeGrid(rawGrid: unknown[][]): CellData[][] {
  return rawGrid.map((row) =>
    row.map((cell) => normalizeCell(cell as Record<string, unknown>)),
  );
}

/**
 * Parses and validates a JSON string as either an incomplete or complete puzzle.
 * Returns:
 *  - { type: "incomplete", data: IncompletePuzzle } for valid incomplete puzzles
 *  - { type: "complete", data: CompletePuzzle } for valid complete puzzles
 *  - { error: string } for any parsing or validation errors
 */
export function parsePuzzleJSON(
  jsonString: string,
):
  | { type: "incomplete"; data: IncompletePuzzle }
  | { type: "complete"; data: CompletePuzzle }
  | { error: string } {
  // Step 1: Parse JSON
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    return { error: "Invalid JSON: unable to parse the file." };
  }

  // Step 2: Check version
  if (parsed.version !== CURRENT_VERSION) {
    return { error: `Unrecognized version: expected ${CURRENT_VERSION}, got ${parsed.version ?? "missing"}.` };
  }

  // Step 3: Check type discriminator
  if (parsed.type !== "incomplete" && parsed.type !== "complete") {
    return { error: `Missing or unrecognized type field: "${String(parsed.type ?? "missing")}". Expected "incomplete" or "complete".` };
  }

  // Step 4: Normalize grid cells (fill in default marker values)
  const gridSize = parsed.gridSize;
  const rawGrid = parsed.grid;
  if (Array.isArray(rawGrid)) {
    parsed.grid = normalizeGrid(rawGrid as unknown[][]);
  }

  // Step 5: Validate based on type
  if (parsed.type === "incomplete") {
    const puzzle = parsed as unknown as IncompletePuzzleJSON;
    // Ensure displacedClues defaults to empty array if missing
    if (!puzzle.displacedClues) {
      puzzle.displacedClues = [];
    }

    const validation = validateIncompletePuzzle(puzzle);
    if (!validation.valid) {
      return { error: `Invalid incomplete puzzle: ${validation.errors.join("; ")}` };
    }

    // Return parsed data without version/type
    return {
      type: "incomplete",
      data: {
        key: puzzle.key,
        gridSize: puzzle.gridSize,
        grid: puzzle.grid,
        words: puzzle.words,
        title: puzzle.title,
        author: puzzle.author,
        displacedClues: puzzle.displacedClues,
      },
    };
  }

  if (parsed.type === "complete") {
    const puzzle = parsed as unknown as CompletePuzzleJSON;
    const validation = validateCompletePuzzle(puzzle);
    if (!validation.valid) {
      return { error: `Invalid complete puzzle: ${validation.errors.join("; ")}` };
    }

    // Return parsed data without version/type
    return {
      type: "complete",
      data: {
        key: puzzle.key,
        gridSize: puzzle.gridSize,
        grid: puzzle.grid,
        words: puzzle.words,
        title: puzzle.title,
        author: puzzle.author,
      },
    };
  }

  return { error: "Unrecognized puzzle type." };
}