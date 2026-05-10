import type { CellData, CellMarker, CellPosition, DerivedWord, Direction, DisplacedClue, PlayerProgress, Word, WordChangeResult } from "./types";
import { reconcileWordsOnGridChange } from "./clue-logic";

/**
 * Creates an NxN grid of all-white cells with default values.
 * Each cell has: black=false, puzzleLetter=null, playerLetter=null, and all marker flags=false.
 */
export function createEmptyGrid(size: number): CellData[][] {
  const grid: CellData[][] = [];
  for (let r = 0; r < size; r++) {
    const row: CellData[] = [];
    for (let c = 0; c < size; c++) {
      row.push({
        black: false,
        puzzleLetter: null,
        playerLetter: null,
        spaceRight: false,
        spaceBottom: false,
        hyphenRight: false,
        hyphenBottom: false,
      });
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Derives a 2D array of display letters from the grid.
 * Black cells produce null; white cells produce the letter from the
 * specified source field ("puzzleLetter" or "playerLetter").
 */
export function deriveDisplayLetters(
  grid: CellData[][],
  letterSource: "puzzle" | "player",
): (string | null)[][] {
  const letters: (string | null)[][] = [];
  for (let r = 0; r < grid.length; r++) {
    const row: (string | null)[] = [];
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c].black) {
        row.push(null);
      } else {
        row.push(letterSource === "puzzle" ? grid[r][c].puzzleLetter : grid[r][c].playerLetter);
      }
    }
    letters.push(row);
  }
  return letters;
}

/**
 * Detects all words in the grid: maximal contiguous white-cell sequences
 * of length ≥ 2 in both the across and down directions.
 * Returns DerivedWord objects with number=0 (assignNumbers sets actual numbers).
 */
export function deriveWords(grid: CellData[][]): DerivedWord[] {
  const words: DerivedWord[] = [];

  const gridSize: number = grid.length;
  // Scan across words (horizontal, row by row)
  for (let r = 0; r < gridSize; r++) {
    let c = 0;
    while (c < gridSize) {
      // Skip black cells
      if (grid[r][c].black) {
        c++;
        continue;
      }
      // Found a white cell — find the length of contiguous white cells
      const startCol = c;
      while (c < gridSize && !grid[r][c].black) {
        c++;
      }
      const length = c - startCol;
      if (length >= 2) {
        words.push({
          startRow: r,
          startCol: startCol,
          direction: "across",
          length,
          number: 0,
        });
      }
    }
  }

  // Scan down words (vertical, column by column)
  for (let c = 0; c < gridSize; c++) {
    let r = 0;
    while (r < gridSize) {
      // Skip black cells
      if (grid[r][c].black) {
        r++;
        continue;
      }
      // Found a white cell — find the length of contiguous white cells
      const startRow = r;
      while (r < gridSize && !grid[r][c].black) {
        r++;
      }
      const length = r - startRow;
      if (length >= 2) {
        words.push({
          startRow: startRow,
          startCol: c,
          direction: "down",
          length,
          number: 0,
        });
      }
    }
  }

  return words;
}

/**
 * Assigns standard crossword numbering to cells that start words.
 * Scans cells left-to-right, top-to-bottom. A cell receives a number
 * if it starts an across word and/or a down word.
 * Returns a Map from "row-col" string to the assigned number.
 */
export function assignNumbers(words: DerivedWord[]): Map<string, number> {
  // Collect all unique starting positions that begin a word
  const startsAtCell = new Map<string, boolean>();

  for (const word of words) {
    const key = `${word.startRow}-${word.startCol}`;
    startsAtCell.set(key, true);
  }

  // Get all unique starting positions and sort by scan order (row, then col)
  const positions = Array.from(startsAtCell.keys()).sort((a, b) => {
    const [aRow, aCol] = a.split("-").map(Number);
    const [bRow, bCol] = b.split("-").map(Number);
    if (aRow !== bRow) return aRow - bRow;
    return aCol - bCol;
  });

  // Assign sequential numbers
  const numbers = new Map<string, number>();
  positions.forEach((key, index) => {
    numbers.set(key, index + 1);
  });

  return numbers;
}

/**
 * Returns all words that contain the cell at (row, col).
 * A word contains a cell if the cell is within the word's range
 * (from startRow/startCol to startRow + length - 1 for across,
 *  or startCol + length - 1 for down) and matches the direction.
 */
/**
 * Returns the word at (row, col) in the given direction, or null if
 * no word of that direction contains the cell.
 */
export function getWordInDirection(
  words: Word[],
  row: number,
  col: number,
  direction: Direction
): Word | null {
  const matching = words.filter((word) => {
    if (word.direction !== direction) return false;
    if (direction === "across") {
      return (
        row === word.startRow &&
        col >= word.startCol &&
        col < word.startCol + word.length
      );
    } else {
      return (
        col === word.startCol &&
        row >= word.startRow &&
        row < word.startRow + word.length
      );
    }
  });

  // A cell can only be in at most one word per direction
  return matching.length > 0 ? matching[0] : null;
}

/**
 * Returns the list of cell positions that a word occupies.
 * For an across word, cells go left-to-right in the same row.
 * For a down word, cells go top-to-bottom in the same column.
 */
export function getWordCells(word: Word): CellPosition[] {
  const cells: CellPosition[] = [];
  if (word.direction === "across") {
    for (let c = word.startCol; c < word.startCol + word.length; c++) {
      cells.push({ row: word.startRow, col: c });
    }
  } else {
    for (let r = word.startRow; r < word.startRow + word.length; r++) {
      cells.push({ row: r, col: word.startCol });
    }
  }
  return cells;
}




/**
 * Counts contiguous white cells starting from (startRow, startCol)
 * in the given direction. Returns 0 if the starting cell is black.
 * For "across", counts cells going right (increasing col).
 * For "down", counts cells going down (increasing row).
 */
export function computeWordLength(
  grid: CellData[][],
  startRow: number,
  startCol: number,
  direction: Direction,
): number {
  // If starting cell is black, length is 0
  if (grid[startRow][startCol].black) {
    return 0;
  }

  const gridSize = grid.length;

  let count = 0;
  let r = startRow;
  let c = startCol;

  while (r < gridSize && c < gridSize && !grid[r][c].black) {
    count++;
    if (direction === "across") {
      c++;
    } else {
      r++;
    }
  }

  return count;
}

/**
 * Computes the length pattern string for a single word based on its cell markers.
 *
 * - No markers: "8"
 * - Space markers: "4, 4" (comma-space)
 * - Hyphen markers: "4-4" (hyphen)
 * - Mixed: "2, 2-3" etc.
 */
export function getSingleWordLengthPattern(
  grid: CellData[][],
  word: Word,
): string {
  const gridSize = grid.length;
  const segments: number[] = [];
  const separators: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < word.length; i++) {
    const row = word.direction === "down" ? word.startRow + i : word.startRow;
    const col = word.direction === "across" ? word.startCol + i : word.startCol;

    if (row >= gridSize || col >= gridSize) break;
    const cell = grid[row]?.[col];
    if (!cell || cell.black) break;

    currentLength++;

    // Check for marker after this cell (not on the last cell of the word)
    if (i < word.length - 1) {
      const hasSpace =
        word.direction === "across" ? cell.spaceRight : cell.spaceBottom;
      const hasHyphen =
        word.direction === "across" ? cell.hyphenRight : cell.hyphenBottom;

      if (hasSpace) {
        segments.push(currentLength);
        separators.push(", ");
        currentLength = 0;
      } else if (hasHyphen) {
        segments.push(currentLength);
        separators.push("-");
        currentLength = 0;
      }
    }
  }

  // No markers — just return the total length
  if (segments.length === 0) {
    return word.length.toString();
  }

  // Push the final segment
  segments.push(currentLength);

  // Build pattern: seg0 + sep0 + seg1 + sep1 + ...
  let result = segments[0].toString();
  for (let j = 0; j < separators.length; j++) {
    result += separators[j] + segments[j + 1];
  }
  return result;
}

/**
 * Checks if the grid is blank: no letters in any cell,
 * no non-empty clue text in any word, and no displaced clues.
 *
 * Used to determine whether grid size can be changed.
 */
export function isGridBlank(
  grid: CellData[][],
  words: Word[],
  displacedClues: DisplacedClue[]
): boolean {
  // Check for displaced clues
  if (displacedClues.length > 0) {
    return false;
  }

  // Check for non-empty clue text
  for (const word of words) {
    if (word.clue !== "") {
      return false;
    }
  }

  // Check for any cell with a letter
  for (const row of grid) {
    for (const cell of row) {
      if (cell.puzzleLetter !== null) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Splits an array of words into across and down arrays, each sorted by number.
 * Returns an object with `across` and `down` properties.
 */
export function splitWordsByDirection(words: Word[]): {
  across: Word[];
  down: Word[];
} {
  const across = words
    .filter((w) => w.direction === "across")
    .sort((a, b) => a.number - b.number);

  const down = words
    .filter((w) => w.direction === "down")
    .sort((a, b) => a.number - b.number);

  return { across, down };
}

/**
 * Toggles a cell between black and white in design mode.
 *
 * If the cell was black, it becomes a default white cell (all markers off, no letter).
 * If the cell was white, it becomes a black cell (all fields cleared).
 *
 * Returns the new grid with the cell toggled and the reconciliation results
 * for word metadata updates.
 */
export function toggleCellBlack(
  grid: CellData[][],
  cell: CellPosition,
  currentWords: Word[],
  displacedClues: DisplacedClue[],
): { grid: CellData[][]; result: WordChangeResult } {
  const { row, col } = cell;
  const newGrid = grid.map((r) => r.map((c) => ({ ...c })));
  const wasBlack = newGrid[row][col].black;

  if (wasBlack) {
    // Toggling black → white: make it white with default values
    newGrid[row][col] = {
      black: false,
      puzzleLetter: null,
      playerLetter: null,
      spaceRight: false,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    };
  } else {
    // Toggling white → black: clear all cell data
    newGrid[row][col] = {
      black: true,
      puzzleLetter: null,
      playerLetter: null,
      spaceRight: false,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    };
  }

  const newDerived = deriveWords(newGrid);
  const result = reconcileWordsOnGridChange(currentWords, newDerived, displacedClues);

  return { grid: newGrid, result };
}

/**
 * Toggles a marker on a cell, enforcing mutual exclusion rules:
 * - spaceRight and hyphenRight are mutually exclusive
 * - spaceBottom and hyphenBottom are mutually exclusive
 *
 * Returns a new grid with the marker toggled, or null if the cell is black
 * or out of bounds. Does not mutate the input grid.
 */
export function toggleMarker(
  grid: CellData[][],
  cell: CellPosition,
  marker: CellMarker,
): CellData[][] | null {
  const { row, col } = cell;

  // Out of bounds check
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) {
    return null;
  }

  // Black cells cannot have markers
  if (grid[row][col].black) {
    return null;
  }

  const newGrid = grid.map((r) => r.map((c) => ({ ...c })));
  const cellData = newGrid[row][col];

  // Toggle the requested marker and enforce mutual exclusion
  switch (marker) {
    case "spaceRight":
      cellData.spaceRight = !cellData.spaceRight;
      if (cellData.spaceRight) cellData.hyphenRight = false;
      break;
    case "hyphenRight":
      cellData.hyphenRight = !cellData.hyphenRight;
      if (cellData.hyphenRight) cellData.spaceRight = false;
      break;
    case "spaceBottom":
      cellData.spaceBottom = !cellData.spaceBottom;
      if (cellData.spaceBottom) cellData.hyphenBottom = false;
      break;
    case "hyphenBottom":
      cellData.hyphenBottom = !cellData.hyphenBottom;
      if (cellData.hyphenBottom) cellData.spaceBottom = false;
      break;
  }

  return newGrid;
}

/**
 * Applies saved player progress to a grid by overlaying player letters
 * onto each cell's playerLetter field.
 *
 * Only overwrites playerLetter for cells that have a non-null, non-undefined
 * letter in the saved progress. Black cells and cells without saved data
 * retain their original playerLetter value.
 *
 * Pure function — does not mutate the input grid; returns a new grid.
 */
export function applyPlayerProgress(grid: CellData[][], progress: PlayerProgress): CellData[][] {
  const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));

  for (let r = 0; r < progress.gridSize; r++) {
    for (let c = 0; c < progress.gridSize; c++) {
      if (progress.letters[r] && progress.letters[r][c] !== undefined && progress.letters[r][c] !== null) {
        newGrid[r][c] = { ...newGrid[r][c], playerLetter: progress.letters[r][c] };
      }
    }
  }

  return newGrid;
}