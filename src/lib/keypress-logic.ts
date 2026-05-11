import type { CellData, CellPosition, CursorResult, Direction, LetterSource, MoveDirection } from "./types";
import { enterLetter, deleteLetter, moveCursor } from "./cursor-logic";

/**
 * Maps an arrow key string to a MoveDirection.
 * Returns undefined for non-arrow keys.
 */
function arrowKeyToDirection(key: string): MoveDirection | undefined {
  const keyToDirection: Record<string, MoveDirection> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };
  return keyToDirection[key];
}

/**
 * Interprets a keyboard key string as a cursor operation and applies it.
 *
 * Given a key, grid, cursor position/direction, and letter source:
 * - Letter keys (A-Z) → enter the letter via `enterLetter`
 * - Backspace → delete via `deleteLetter`
 * - Arrow keys → move via `moveCursor`
 * - All other keys → returns null (unrecognized)
 *
 * This is a pure function — no DOM dependency. The caller (page component)
 * handles `event.preventDefault()` and UI guards.
 *
 * @returns The cursor result, or null if the key is not a recognized input key.
 */
export function handleKeyInput(
  key: string,
  grid: CellData[][],
  cell: CellPosition,
  direction: Direction,
  letterSource: LetterSource,
): CursorResult | null {
  // Letter keys (A-Z)
  if (/^[a-zA-Z]$/.test(key)) {
    return enterLetter(grid, cell, direction, key.toUpperCase(), letterSource);
  }

  // Backspace
  if (key === "Backspace") {
    return deleteLetter(grid, cell, direction, letterSource);
  }

  // Arrow keys
  const moveDirection = arrowKeyToDirection(key);
  if (moveDirection) {
    return moveCursor(grid, cell, moveDirection);
  }

  return null;
}