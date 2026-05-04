import type { CellData, CellPosition, DerivedWord, Direction, DisplacedClue, Word } from "./types";

/**
 * Returns true if the cell at (row, col) is a valid selection target.
 * A cell is selectable if it is white and part of a word (length ≥ 2)
 * in either the across or down direction.
 */
export function isSelectableCell(
  grid: CellData[][],
  cellPosition: CellPosition,
): boolean {
  const gridSize = grid.length;
  const row = cellPosition.row
  const col = cellPosition.col

  // Out of bounds
  if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
    return false;
  }

  // Black cell
  if (grid[row][col].black) {
    return false;
  }

  // Check if part of an across word (at least one horizontal white neighbor)
  const hasLeftNeighbor = col > 0 && !grid[row][col - 1].black;
  const hasRightNeighbor = col < gridSize - 1 && !grid[row][col + 1].black;
  const partOfAcrossWord = hasLeftNeighbor || hasRightNeighbor;

  // Check if part of a down word (at least one vertical white neighbor)
  const hasTopNeighbor = row > 0 && !grid[row - 1][col].black;
  const hasBottomNeighbor = row < gridSize - 1 && !grid[row + 1][col].black;
  const partOfDownWord = hasTopNeighbor || hasBottomNeighbor;

  return partOfAcrossWord || partOfDownWord;
}

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
export function getWordsAtCell(
  words: Word[],
  row: number,
  col: number
): Word[] {
  return words.filter((word) => {
    if (word.direction === "across") {
      // Word spans: (startRow, startCol) to (startRow, startCol + length - 1)
      return (
        row === word.startRow &&
        col >= word.startCol &&
        col < word.startCol + word.length
      );
    } else {
      // Word spans: (startRow, startCol) to (startRow + length - 1, startCol)
      return (
        col === word.startCol &&
        row >= word.startRow &&
        row < word.startRow + word.length
      );
    }
  });
}

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
 * Advances the cursor position one cell in the given direction.
 * If the next cell is out of bounds, black, or the current cell is black,
 * returns the current position unchanged.
 */
export function advancePosition(
  grid: CellData[][],
  row: number,
  col: number,
  direction: Direction,
): CellPosition {
  const gridSize: number = grid.length;

  // If current cell is black, can't advance
  if (row < 0 || row >= gridSize || col < 0 || col >= gridSize || grid[row][col].black) {
    return { row, col };
  }

  let nextRow = row;
  let nextCol = col;

  if (direction === "across") {
    nextCol = col + 1;
  } else {
    nextRow = row + 1;
  }

  // Check bounds
  if (nextRow < 0 || nextRow >= gridSize || nextCol < 0 || nextCol >= gridSize) {
    return { row, col };
  }

  // Check if next cell is white
  if (grid[nextRow][nextCol].black) {
    return { row, col };
  }

  return { row: nextRow, col: nextCol };
}

/**
 * Retreats the cursor position one cell in the opposite direction.
 * If the previous cell is out of bounds, black, or the current cell is black,
 * returns the current position unchanged.
 */
export function retreatPosition(
  grid: CellData[][],
  row: number,
  col: number,
  direction: Direction,
): CellPosition {
  const gridSize: number = grid.length;

  // If current cell is black, can't retreat
  if (row < 0 || row >= gridSize || col < 0 || col >= gridSize || grid[row][col].black) {
    return { row, col };
  }

  let prevRow = row;
  let prevCol = col;

  if (direction === "across") {
    prevCol = col - 1;
  } else {
    prevRow = row - 1;
  }

  // Check bounds
  if (prevRow < 0 || prevRow >= gridSize || prevCol < 0 || prevCol >= gridSize) {
    return { row, col };
  }

  // Check if previous cell is white
  if (grid[prevRow][prevCol].black) {
    return { row, col };
  }

  return { row: prevRow, col: prevCol };
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


export function computeSelectionChangeForCellClick(
  grid: CellData[][],
  currentCell: CellPosition | null,
  currentDirection: Direction,
  words: Word[],
  cellPosition: CellPosition,
): { selectedCell: CellPosition | null; selectedDirection: Direction } {
  if (!isSelectableCell(grid, cellPosition)) {
    return { selectedCell: currentCell, selectedDirection: currentDirection };
  };

  const wordsAtCell = getWordsAtCell(words, cellPosition.row, cellPosition.col);

  if (currentCell && currentCell.row === cellPosition.row && currentCell.col === cellPosition.col) {
    // Clicking the already-selected cell
    if (wordsAtCell.length > 1) {
      const otherWord = wordsAtCell.find((w) => w.direction !== currentDirection);
      if (otherWord) {
        return { selectedCell: currentCell, selectedDirection: otherWord.direction };
      }
    }
    return { selectedCell: currentCell, selectedDirection: currentDirection };
  } else {
    // Selecting a new cell
    let newDirection: Direction = currentDirection;
    if (wordsAtCell.length === 1) {
      newDirection = wordsAtCell[0].direction;
    } else if (wordsAtCell.length > 1) {
      const hasAcross = wordsAtCell.some((w) => w.direction === "across");
      newDirection = hasAcross ? "across" : "down";
    }
    return { selectedCell: cellPosition, selectedDirection: newDirection };
  }
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