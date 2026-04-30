import type { CellData, CellPosition, CursorResult, Direction, LetterSource } from "./types";
import { advancePosition, retreatPosition, handleArrowKey } from "./grid-logic";

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

  const nextCell = advancePosition(newGrid, row, col, direction);
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
    const prev = retreatPosition(grid, row, col, direction);
    if (prev.row !== row || prev.col !== col) {
      newGrid[prev.row][prev.col] = setLetter(newGrid[prev.row][prev.col], letterSource, null);
      return { grid: newGrid, nextCell: prev, nextDirection: direction };
    }
    // Can't retreat — legitimate no-op (backspace at start of word)
    return { grid: newGrid, nextCell: cell, nextDirection: direction };
  }
}

/**
 * Moves the cursor in response to an arrow key.
 *
 * Returns the updated cell position and direction.
 * If the target cell is not selectable, stays in place but changes direction.
 *
 * Throws if the key is not a recognized arrow key.
 */
export function moveCursor(
  grid: CellData[][],
  cell: CellPosition,
  key: string,
): CursorResult {
  const result = handleArrowKey(key, grid, cell.row, cell.col);
  if (!result) {
    throw new Error(`moveCursor: unrecognized arrow key "${key}"`);
  }
  return {
    grid,
    nextCell: result.cell,
    nextDirection: result.direction,
  };
}