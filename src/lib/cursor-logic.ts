import type { CellData, CellPosition, CursorResult, Direction, LetterSource, MoveDirection, Word } from "./types";

/**
 * Returns true if the cell at (row, col) is a valid selection target.
 * A cell is selectable if it is white and part of a word (length ≥ 2)
 * in either the across or down direction.
 */
function isSelectableCell(
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
 * Returns the words that contain the cell at (row, col).
 */
function getWordsAtCell(words: Word[], row: number, col: number): Word[] {
  return words.filter((word) => {
    if (word.direction === "across") {
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
}

/** Read the letter from a cell based on the source. */
function getLetter(cell: CellData, source: LetterSource): string | null {
  return source === "puzzle" ? cell.puzzleLetter : cell.playerLetter;
}

/** Create a copy of the cell with the letter field set. */
function setLetter(cell: CellData, source: LetterSource, value: string | null): CellData {
  return source === "puzzle"
    ? { ...cell, puzzleLetter: value }
    : { ...cell, playerLetter: value };
}

/**
 * Shifts the cursor position one cell in the given direction.
 * Positive step advances, negative step retreats.
 * If the target cell is out of bounds or not selectable, returns the
 * current position unchanged.
 */
function shiftPosition(
  grid: CellData[][],
  row: number,
  col: number,
  direction: Direction,
  step: number,
): CellPosition {
  let targetRow = row;
  let targetCol = col;

  if (direction === "across") {
    targetCol += step;
  } else {
    targetRow += step;
  }

  if (isSelectableCell(grid, { row: targetRow, col: targetCol })) {
    return { row: targetRow, col: targetCol };
  }
  return { row, col };
}

/**
 * Enters a letter at the given cell position and advances the cursor.
 *
 * Throws if the cell is out of bounds or black (should never happen
 * in normal operation — the caller guards against this).
 */
export function enterLetter(
  grid: CellData[][],
  cell: CellPosition,
  direction: Direction,
  letter: string,
  letterSource: LetterSource,
): CursorResult {
  const { row, col } = cell;
  const size = grid.length;

  if (row < 0 || row >= size || col < 0 || col >= size) {
    throw new Error(`enterLetter: cell out of bounds (${row}, ${col})`);
  }
  if (grid[row][col].black) {
    throw new Error(`enterLetter: cannot enter letter in black cell (${row}, ${col})`);
  }

  const newGrid = grid.map((r) => r.map((c) => ({ ...c })));
  newGrid[row][col] = setLetter(newGrid[row][col], letterSource, letter);

  const nextCell = shiftPosition(newGrid, row, col, direction, 1);
  return { grid: newGrid, nextCell, nextDirection: direction };
}

/**
 * Deletes a letter at or near the given cell position.
 *
 * If the cell has a letter, deletes it (cursor stays, direction unchanged).
 * If the cell is empty, retreats and deletes the previous cell's letter
 * (cursor moves to the previous position, direction unchanged).
 * If the cell is empty and retreat is not possible, returns unchanged state.
 *
 * Throws if the cell is out of bounds.
 */
export function deleteLetter(
  grid: CellData[][],
  cell: CellPosition,
  direction: Direction,
  letterSource: LetterSource,
): CursorResult {
  const { row, col } = cell;
  const size = grid.length;

  if (row < 0 || row >= size || col < 0 || col >= size) {
    throw new Error(`deleteLetter: cell out of bounds (${row}, ${col})`);
  }

  const newGrid = grid.map((r) => r.map((c) => ({ ...c })));

  if (getLetter(grid[row][col], letterSource)) {
    newGrid[row][col] = setLetter(newGrid[row][col], letterSource, null);
    return { grid: newGrid, nextCell: cell, nextDirection: direction };
  } else {
    const prev = shiftPosition(grid, row, col, direction, -1);
    if (prev.row !== row || prev.col !== col) {
      newGrid[prev.row][prev.col] = setLetter(newGrid[prev.row][prev.col], letterSource, null);
      return { grid: newGrid, nextCell: prev, nextDirection: direction };
    }
    // Can't retreat — legitimate no-op (backspace at start of word)
    return { grid: newGrid, nextCell: cell, nextDirection: direction };
  }
}

/**
 * Moves the cursor one cell in the given direction.
 *
 * Returns the updated cell position and direction.
 * If the target cell is not selectable, stays in place but changes direction.
 */
export function moveCursor(
  grid: CellData[][],
  cell: CellPosition,
  moveDirection: MoveDirection,
): CursorResult {
  const directionMap: Record<MoveDirection, { direction: Direction; step: number }> = {
    up:    { direction: "down",    step: -1 },
    down:  { direction: "down",    step: 1 },
    left:  { direction: "across",   step: -1 },
    right: { direction: "across",   step: 1 },
  };
  const { direction, step } = directionMap[moveDirection];
  const nextCell = shiftPosition(grid, cell.row, cell.col, direction, step);
  return { grid, nextCell, nextDirection: direction };
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
