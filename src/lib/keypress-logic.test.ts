import { describe, it, expect } from "vitest";
import { handleKeyInput } from "./keypress-logic";
import type { CellPosition } from "./types";
import { createEmptyGrid } from "./grid-logic";

describe("handleKeyInput", () => {
  const cell: CellPosition = { row: 0, col: 0 };

  // --- Letter keys ---

  it("enters a letter for uppercase key with puzzle source", () => {
    const grid = createEmptyGrid(5);
    const result = handleKeyInput("A", grid, cell, "across", "puzzle");

    expect(result).not.toBeNull();
    expect(result!.grid[0][0].puzzleLetter).toBe("A");
    expect(result!.nextCell).toEqual({ row: 0, col: 1 });
    expect(result!.nextDirection).toBe("across");
  });

  it("enters a letter for lowercase key and uppercases it", () => {
    const grid = createEmptyGrid(5);
    const result = handleKeyInput("b", grid, cell, "across", "player");

    expect(result).not.toBeNull();
    expect(result!.grid[0][0].playerLetter).toBe("B");
  });

  it("enters a letter with player source", () => {
    const grid = createEmptyGrid(5);
    const result = handleKeyInput("Z", grid, cell, "down", "player");

    expect(result).not.toBeNull();
    expect(result!.grid[0][0].playerLetter).toBe("Z");
    expect(result!.nextDirection).toBe("down");
  });

  // --- Backspace ---

  it("deletes a letter on Backspace with puzzle source", () => {
    const grid = createEmptyGrid(5);
    grid[0][0] = { ...grid[0][0], puzzleLetter: "A" };
    const result = handleKeyInput("Backspace", grid, cell, "across", "puzzle");

    expect(result).not.toBeNull();
    expect(result!.grid[0][0].puzzleLetter).toBeNull();
    expect(result!.nextCell).toEqual(cell);
  });

  it("deletes a letter on Backspace with player source", () => {
    const grid = createEmptyGrid(5);
    grid[0][0] = { ...grid[0][0], playerLetter: "X" };
    const result = handleKeyInput("Backspace", grid, cell, "across", "player");

    expect(result).not.toBeNull();
    expect(result!.grid[0][0].playerLetter).toBeNull();
  });

  // --- Arrow keys ---

  it("moves cursor up on ArrowUp", () => {
    const grid = createEmptyGrid(5);
    const startCell: CellPosition = { row: 2, col: 2 };
    const result = handleKeyInput("ArrowUp", grid, startCell, "across", "puzzle");

    expect(result).not.toBeNull();
    expect(result!.nextCell.row).toBe(1);
    expect(result!.nextCell.col).toBe(2);
    expect(result!.nextDirection).toBe("down");
  });

  it("moves cursor down on ArrowDown", () => {
    const grid = createEmptyGrid(5);
    const startCell: CellPosition = { row: 2, col: 2 };
    const result = handleKeyInput("ArrowDown", grid, startCell, "across", "puzzle");

    expect(result).not.toBeNull();
    expect(result!.nextCell.row).toBe(3);
    expect(result!.nextDirection).toBe("down");
  });

  it("moves cursor left on ArrowLeft", () => {
    const grid = createEmptyGrid(5);
    const startCell: CellPosition = { row: 2, col: 2 };
    const result = handleKeyInput("ArrowLeft", grid, startCell, "across", "puzzle");

    expect(result).not.toBeNull();
    expect(result!.nextCell.col).toBe(1);
    expect(result!.nextDirection).toBe("across");
  });

  it("moves cursor right on ArrowRight", () => {
    const grid = createEmptyGrid(5);
    const startCell: CellPosition = { row: 2, col: 2 };
    const result = handleKeyInput("ArrowRight", grid, startCell, "across", "puzzle");

    expect(result).not.toBeNull();
    expect(result!.nextCell.col).toBe(3);
    expect(result!.nextDirection).toBe("across");
  });

  // --- Unrecognized keys ---

  it("returns null for Enter key", () => {
    const grid = createEmptyGrid(5);
    const result = handleKeyInput("Enter", grid, cell, "across", "puzzle");
    expect(result).toBeNull();
  });

  it("returns null for Tab key", () => {
    const grid = createEmptyGrid(5);
    const result = handleKeyInput("Tab", grid, cell, "across", "puzzle");
    expect(result).toBeNull();
  });

  it("returns null for Shift key", () => {
    const grid = createEmptyGrid(5);
    const result = handleKeyInput("Shift", grid, cell, "across", "puzzle");
    expect(result).toBeNull();
  });

  it("returns null for Escape key", () => {
    const grid = createEmptyGrid(5);
    const result = handleKeyInput("Escape", grid, cell, "across", "puzzle");
    expect(result).toBeNull();
  });

  it("returns null for Space key", () => {
    const grid = createEmptyGrid(5);
    const result = handleKeyInput(" ", grid, cell, "across", "puzzle");
    expect(result).toBeNull();
  });
});