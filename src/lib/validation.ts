import type {
  CellData,
  CompletePuzzleJSON,
  IncompletePuzzleJSON,
  Word,
  ValidationResult,
} from "./types";
import { CURRENT_VERSION } from "./constants";
import { validateChains, toWordId, isChainHead } from "./chain-logic";

/**
 * Supplementary cycle detection for chain structures.
 * validateChains detects branching, dangling refs, and self-references,
 * but can miss cycles when the cycle doesn't include any chain head
 * (i.e., every word in the cycle is pointed to by another word in the cycle,
 * and there are other non-cycle words that are heads).
 * This function detects cycles by checking that every word reachable via
 * nextWord links can be reached from a chain head.
 */
function hasUnreachableChains(words: Word[]): boolean {
  if (words.length === 0) return false;

  // Identify chain heads: words not pointed to by any other word
  const pointedToBy = new Set<string>();
  for (const w of words) {
    if (w.nextWord !== null) {
      pointedToBy.add(toWordId(w.nextWord));
    }
  }

  const heads = words.filter((w) => !pointedToBy.has(toWordId(w)));

  // Traverse from all heads, collecting reachable word IDs
  const reachable = new Set<string>();
  for (const head of heads) {
    let current: Word | undefined = head;
    const visited = new Set<string>();
    while (current) {
      const currentId = toWordId(current);
      if (visited.has(currentId)) {
        // Cycle from a head — already caught by validateChains
        break;
      }
      visited.add(currentId);
      reachable.add(currentId);
      if (current.nextWord === null) break;
      current = words.find((w) => toWordId(w) === toWordId(current!.nextWord!));
    }
  }

  // Any word with a nextWord that is NOT reachable from a head
  // is either in a cycle or part of an unreachable chain
  for (const w of words) {
    const wId = toWordId(w);
    // Words that are not heads and not reachable from any head
    // are in a cycle or an orphaned chain
    if (!reachable.has(wId)) {
      return true; // unreachable word detected
    }
  }

  return false;
}

// =============================================================================
// validateCompletePuzzle
// =============================================================================

/**
 * Validates a complete puzzle JSON for Player import.
 * Per FR-42, checks:
 *  - version field must be 1
 *  - type field must be "complete"
 *  - Required fields: key, gridSize, grid, words, title, author
 *  - Grid dimensions match gridSize
 *  - All white cells have a single A-Z letter
 *  - All first-in-chain (head) words have non-empty clue text
 *  - Word validity: positions within bounds, direction valid, length >= 2
 *  - Structural consistency: each white cell in at most one across and one down word
 *  - nextWord references: must point to valid words, forming valid chains (no cycles, no branching)
 *  - Cell marker fields: if present, must be booleans
 *  - Letter values: must be single A-Z characters (null not allowed for white cells)
 */
export function validateCompletePuzzle(
  puzzle: CompletePuzzleJSON
): ValidationResult {
  const errors: string[] = [];

  // --- Version ---
  if (puzzle.version !== CURRENT_VERSION) {
    errors.push(`Invalid version: expected ${CURRENT_VERSION}, got ${puzzle.version}`);
  }

  // --- Type ---
  if (puzzle.type !== "complete") {
    errors.push(`Invalid type: expected "complete", got "${puzzle.type}"`);
  }

  // --- Required fields ---
  const requiredFields: (keyof CompletePuzzleJSON)[] = [
    "key",
    "gridSize",
    "grid",
    "words",
    "title",
    "author",
  ];
  for (const field of requiredFields) {
    if (puzzle[field] === undefined || puzzle[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // --- Grid dimensions ---
  if (Array.isArray(puzzle.grid) && typeof puzzle.gridSize === "number") {
    if (puzzle.grid.length !== puzzle.gridSize) {
      errors.push(
        `Grid row count (${puzzle.grid.length}) does not match gridSize (${puzzle.gridSize})`
      );
    }
    for (let r = 0; r < puzzle.grid.length; r++) {
      if (!Array.isArray(puzzle.grid[r])) {
        errors.push(`Grid row ${r} is not an array`);
      } else if (puzzle.grid[r].length !== puzzle.gridSize) {
        errors.push(
          `Grid row ${r} has ${puzzle.grid[r].length} columns, expected ${puzzle.gridSize}`
        );
      }
    }
  }

  // --- Cell validation (letters, markers) ---
  if (Array.isArray(puzzle.grid)) {
    for (let r = 0; r < puzzle.grid.length; r++) {
      const row = puzzle.grid[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell || typeof cell !== "object") {
          errors.push(`Cell at (${r}, ${c}) is not a valid object`);
          continue;
        }

        // White cells must have a single A-Z letter
        if (!cell.black) {
          if (cell.letter === null || cell.letter === undefined) {
            errors.push(`White cell at (${r}, ${c}) has no letter`);
          } else if (
            typeof cell.letter !== "string" ||
            cell.letter.length !== 1 ||
            !/^[A-Z]$/.test(cell.letter)
          ) {
            errors.push(
              `White cell at (${r}, ${c}) has invalid letter: "${cell.letter}"`
            );
          }
        }

        // Marker fields must be booleans if present
        const markerFields: (keyof CellData)[] = [
          "spaceRight",
          "spaceBottom",
          "hyphenRight",
          "hyphenBottom",
        ];
        for (const marker of markerFields) {
          const val = cell[marker];
          if (val !== undefined && typeof val !== "boolean") {
            errors.push(
              `Cell at (${r}, ${c}) has non-boolean marker field "${marker}": ${typeof val}`
            );
          }
        }
      }
    }
  }

  // --- Word validation ---
  if (Array.isArray(puzzle.words) && typeof puzzle.gridSize === "number") {
    for (let i = 0; i < puzzle.words.length; i++) {
      const word = puzzle.words[i];

      // Direction must be "across" or "down"
      if (word.direction !== "across" && word.direction !== "down") {
        errors.push(
          `Word ${i} has invalid direction: "${word.direction}"`
        );
      }

      // Start position must be within bounds
      if (
        typeof word.startRow !== "number" ||
        word.startRow < 0 ||
        word.startRow >= puzzle.gridSize
      ) {
        errors.push(
          `Word ${i} has startRow out of bounds: ${word.startRow}`
        );
      }
      if (
        typeof word.startCol !== "number" ||
        word.startCol < 0 ||
        word.startCol >= puzzle.gridSize
      ) {
        errors.push(
          `Word ${i} has startCol out of bounds: ${word.startCol}`
        );
      }

      // Word length must be >= 2
      if (typeof word.length === "number" && word.length < 2) {
        errors.push(`Word ${i} has length < 2: ${word.length}`);
      }
    }

    // --- Structural consistency: each white cell in at most one across and one down word ---
    const size = puzzle.gridSize;
    // Track which words cover each cell, by direction
    const acrossCells: Set<string> = new Set();
    const downCells: Set<string> = new Set();

    for (const word of puzzle.words) {
      if (word.direction !== "across" && word.direction !== "down") continue;
      if (
        typeof word.startRow !== "number" ||
        typeof word.startCol !== "number" ||
        typeof word.length !== "number"
      )
        continue;

      for (let offset = 0; offset < word.length; offset++) {
        const r =
          word.direction === "across" ? word.startRow : word.startRow + offset;
        const c =
          word.direction === "across" ? word.startCol + offset : word.startCol;

        // Skip out-of-bounds cells (already reported as word position errors)
        if (r < 0 || r >= size || c < 0 || c >= size) continue;

        const key = `${r},${c}`;

        if (word.direction === "across") {
          if (acrossCells.has(key)) {
            errors.push(
              `Structural error: cell (${r}, ${c}) is part of more than one across word`
            );
          }
          acrossCells.add(key);
        } else {
          if (downCells.has(key)) {
            errors.push(
              `Structural error: cell (${r}, ${c}) is part of more than one down word`
            );
          }
          downCells.add(key);
        }
      }
    }

    // --- nextWord reference validity ---
    const wordIds = new Set(puzzle.words.map((w) => toWordId(w)));

    for (let i = 0; i < puzzle.words.length; i++) {
      const word = puzzle.words[i];
      if (word.nextWord !== null && word.nextWord !== undefined) {
        const targetId = toWordId(word.nextWord);
        if (!wordIds.has(targetId)) {
          errors.push(
            `Word ${i} nextWord references non-existent word at (${word.nextWord.startRow}, ${word.nextWord.startCol}, ${word.nextWord.direction})`
          );
        }
      }
    }

    // --- Chain validity (no cycles, no branching) ---
    if (!validateChains(puzzle.words as Word[]) || hasUnreachableChains(puzzle.words as Word[])) {
      errors.push("Invalid chain structure: cycles or branching detected");
    }

    // --- Clue validation for chain head words ---
    for (const word of puzzle.words as Word[]) {
      if (isChainHead(puzzle.words as Word[], word)) {
        if (!word.clue || word.clue.trim() === "") {
          errors.push(
            `Chain head word at (${word.startRow}, ${word.startCol}) ${word.direction} has empty clue`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// validateIncompletePuzzle
// =============================================================================

/**
 * Validates an incomplete puzzle JSON for Builder import.
 * More lenient than complete validation: allows empty cells and empty clues.
 * Still checks structural consistency: grid dimensions, word positions, chain validity, marker types.
 */
export function validateIncompletePuzzle(
  puzzle: IncompletePuzzleJSON
): ValidationResult {
  const errors: string[] = [];

  // --- Version ---
  if (puzzle.version !== CURRENT_VERSION) {
    errors.push(`Invalid version: expected ${CURRENT_VERSION}, got ${puzzle.version}`);
  }

  // --- Type ---
  if (puzzle.type !== "incomplete") {
    errors.push(`Invalid type: expected "incomplete", got "${puzzle.type}"`);
  }

  // --- Required fields ---
  const requiredFields: (keyof IncompletePuzzleJSON)[] = [
    "key",
    "gridSize",
    "grid",
    "words",
    "title",
    "author",
  ];
  for (const field of requiredFields) {
    if (puzzle[field] === undefined || puzzle[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // --- Grid dimensions ---
  if (Array.isArray(puzzle.grid) && typeof puzzle.gridSize === "number") {
    if (puzzle.grid.length !== puzzle.gridSize) {
      errors.push(
        `Grid row count (${puzzle.grid.length}) does not match gridSize (${puzzle.gridSize})`
      );
    }
    for (let r = 0; r < puzzle.grid.length; r++) {
      if (!Array.isArray(puzzle.grid[r])) {
        errors.push(`Grid row ${r} is not an array`);
      } else if (puzzle.grid[r].length !== puzzle.gridSize) {
        errors.push(
          `Grid row ${r} has ${puzzle.grid[r].length} columns, expected ${puzzle.gridSize}`
        );
      }
    }
  }

  // --- Cell marker validation (letters are NOT required for incomplete) ---
  if (Array.isArray(puzzle.grid)) {
    for (let r = 0; r < puzzle.grid.length; r++) {
      const row = puzzle.grid[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell || typeof cell !== "object") continue;

        // Marker fields must be booleans if present
        const markerFields: (keyof CellData)[] = [
          "spaceRight",
          "spaceBottom",
          "hyphenRight",
          "hyphenBottom",
        ];
        for (const marker of markerFields) {
          const val = cell[marker];
          if (val !== undefined && typeof val !== "boolean") {
            errors.push(
              `Cell at (${r}, ${c}) has non-boolean marker field "${marker}": ${typeof val}`
            );
          }
        }
      }
    }
  }

  // --- Word validation ---
  if (Array.isArray(puzzle.words) && typeof puzzle.gridSize === "number") {
    for (let i = 0; i < puzzle.words.length; i++) {
      const word = puzzle.words[i];

      // Direction must be "across" or "down"
      if (word.direction !== "across" && word.direction !== "down") {
        errors.push(`Word ${i} has invalid direction: "${word.direction}"`);
      }

      // Start position must be within bounds
      if (
        typeof word.startRow !== "number" ||
        word.startRow < 0 ||
        word.startRow >= puzzle.gridSize
      ) {
        errors.push(
          `Word ${i} has startRow out of bounds: ${word.startRow}`
        );
      }
      if (
        typeof word.startCol !== "number" ||
        word.startCol < 0 ||
        word.startCol >= puzzle.gridSize
      ) {
        errors.push(
          `Word ${i} has startCol out of bounds: ${word.startCol}`
        );
      }

      // Word length must be >= 2
      if (typeof word.length === "number" && word.length < 2) {
        errors.push(`Word ${i} has length < 2: ${word.length}`);
      }
    }

    // --- nextWord reference validity ---
    const wordIds = new Set(puzzle.words.map((w) => toWordId(w)));

    for (let i = 0; i < puzzle.words.length; i++) {
      const word = puzzle.words[i];
      if (word.nextWord !== null && word.nextWord !== undefined) {
        const targetId = toWordId(word.nextWord);
        if (!wordIds.has(targetId)) {
          errors.push(
            `Word ${i} nextWord references non-existent word at (${word.nextWord.startRow}, ${word.nextWord.startCol}, ${word.nextWord.direction})`
          );
        }
      }
    }

    // --- Chain validity ---
    if (!validateChains(puzzle.words as Word[]) || hasUnreachableChains(puzzle.words as Word[])) {
      errors.push("Invalid chain structure: cycles or branching detected");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// canExportAsComplete
// =============================================================================

/**
 * Checks if a puzzle is ready for complete export.
 * Requirements:
 *  - All white cells have letters (single A-Z)
 *  - All words that are chain heads have non-empty clues
 *  - Non-head chain words don't need their own clues
 */
export function canExportAsComplete(
  grid: CellData[][],
  words: Word[],
): { canExport: boolean; errors: string[] } {
  const errors: string[] = [];

  // --- Check all white cells have letters ---
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (!cell.black) {
        if (
          cell.letter === null ||
          cell.letter === undefined ||
          cell.letter === ""
        ) {
          errors.push(`White cell at (${r}, ${c}) has no letter`);
        } else if (
          typeof cell.letter !== "string" ||
          cell.letter.length !== 1 ||
          !/^[A-Z]$/.test(cell.letter)
        ) {
          errors.push(`White cell at (${r}, ${c}) has invalid letter: "${cell.letter}"`);
        }
      }
    }
  }

  // --- Check clues for chain head words ---
  for (const word of words) {
    if (isChainHead(words, word)) {
      if (!word.clue || word.clue.trim() === "") {
        const wordLabel = `${word.number} ${word.direction}`;
        errors.push(`Word ${wordLabel} at (${word.startRow}, ${word.startCol}) has empty clue`);
      }
    }
  }

  return {
    canExport: errors.length === 0,
    errors,
  };
}