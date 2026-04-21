import type {
  CellData,
  CellPosition,
  CheckResult,
  CheckResultType,
  PlayerLetters,
} from "./types";

/**
 * Check the player's answers against the correct answers.
 *
 * Iterates over all cells in the grid. For each white cell (black === false):
 * - If playerLetters[row][col] is null → the cell is empty
 * - If playerLetters[row][col] !== grid[row][col].letter → the cell is incorrect
 * - If playerLetters[row][col] === grid[row][col].letter → the cell is correct
 *
 * Black cells are ignored entirely.
 *
 * Classification:
 * - All white cells filled + all correct → "complete-correct"
 * - Some white cells empty + all filled cells correct → "incomplete-correct"
 * - All white cells filled + some incorrect → "complete-incorrect"
 * - Some white cells empty + some filled cells incorrect → "incomplete-incorrect"
 *
 * An all-black grid has no white cells, so vacuously all white cells are
 * filled correctly → "complete-correct".
 */
export function checkPuzzle(
  grid: CellData[][],
  playerLetters: PlayerLetters,
): CheckResult {
  const incorrectCells: CellPosition[] = [];
  const emptyCells: CellPosition[] = [];

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid.length; col++) {
      const cell = grid[row][col];

      // Skip black cells entirely
      if (cell.black) {
        continue;
      }

      const playerLetter = playerLetters[row][col];

      if (playerLetter === null) {
        // White cell with no player letter → empty
        emptyCells.push({ row, col });
      } else if (playerLetter !== cell.letter) {
        // White cell with wrong letter → incorrect
        incorrectCells.push({ row, col });
      }
      // else: correct letter, no action needed
    }
  }

  let type: CheckResultType;
  if (emptyCells.length === 0 && incorrectCells.length === 0) {
    type = "complete-correct";
  } else if (emptyCells.length > 0 && incorrectCells.length === 0) {
    type = "incomplete-correct";
  } else if (emptyCells.length === 0 && incorrectCells.length > 0) {
    type = "complete-incorrect";
  } else {
    type = "incomplete-incorrect";
  }

  return { type, incorrectCells, emptyCells };
}

/**
 * Clear incorrect letters from the player's grid.
 *
 * Returns a new PlayerLetters array (deep copy) where every cell listed in
 * checkResult.incorrectCells is set to null. Empty cells and correct cells
 * are untouched. The original playerLetters array is NOT mutated.
 */
export function clearErrors(
  playerLetters: PlayerLetters,
  checkResult: CheckResult,
): PlayerLetters {
  // Deep copy playerLetters
  const result: PlayerLetters = playerLetters.map((row) => [...row]);

  // Set each incorrect cell to null
  for (const { row, col } of checkResult.incorrectCells) {
    result[row][col] = null;
  }

  return result;
}