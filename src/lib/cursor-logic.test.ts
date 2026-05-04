import { describe, it, expect } from "vitest";
import { enterLetter, deleteLetter, moveCursor } from "./cursor-logic";
import type { CellData, CellPosition } from "./types";
import { createEmptyGrid } from "./grid-logic";

/** Helper: create a grid with a letter placed at a specific cell. */
function gridWithLetter(
  size: number,
  row: number,
  col: number,
  letter: string | null,
  source: "puzzle" | "player",
): CellData[][] {
  const grid = createEmptyGrid(size);
  if (letter !== null) {
    grid[row][col] = {
      ...grid[row][col],
      [source === "puzzle" ? "puzzleLetter" : "playerLetter"]: letter,
    };
  }
  return grid;
}

// ============================================================
// enterLetter
// ============================================================
describe("enterLetter", () => {
  const source = "puzzle" as const;

  it("enters a letter in a valid cell and returns updated grid", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = enterLetter(grid, cell, "across", "A", source);

    expect(result.grid[0][0].puzzleLetter).toBe("A");
  });

  it("advances the cursor to the next cell", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = enterLetter(grid, cell, "across", "A", source);

    expect(result.nextCell.row).toBe(0);
    expect(result.nextCell.col).toBe(1);
  });

  it("preserves the direction", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = enterLetter(grid, cell, "down", "A", source);

    expect(result.nextDirection).toBe("down");
  });

  it("throws for a black cell", () => {
    const grid = createEmptyGrid(5);
    grid[0][0].black = true;
    const cell: CellPosition = { row: 0, col: 0 };

    expect(() => enterLetter(grid, cell, "across", "A", source)).toThrow();
  });

  it("throws for out-of-bounds cell", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: -1, col: 0 };

    expect(() => enterLetter(grid, cell, "across", "A", source)).toThrow();
  });

  it("throws for cell beyond grid size", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 5, col: 0 };

    expect(() => enterLetter(grid, cell, "across", "A", source)).toThrow();
  });

  it("does not mutate the input grid", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    enterLetter(grid, cell, "across", "A", source);

    expect(grid[0][0].puzzleLetter).toBeNull();
  });

  it("works with playerLetter source", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = enterLetter(grid, cell, "across", "B", "player");

    expect(result.grid[0][0].playerLetter).toBe("B");
    expect(result.grid[0][0].puzzleLetter).toBeNull();
  });

  it("overwrites an existing letter", () => {
    const grid = gridWithLetter(5, 0, 0, "X", "puzzle");
    const cell: CellPosition = { row: 0, col: 0 };

    const result = enterLetter(grid, cell, "across", "Y", source);

    expect(result.grid[0][0].puzzleLetter).toBe("Y");
  });

  it("advances cursor in down direction", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = enterLetter(grid, cell, "down", "A", source);

    expect(result.nextCell.row).toBe(1);
    expect(result.nextCell.col).toBe(0);
  });
});

// ============================================================
// deleteLetter
// ============================================================
describe("deleteLetter", () => {
  const source = "puzzle" as const;

  it("deletes a letter at the current cell", () => {
    const grid = gridWithLetter(5, 0, 0, "A", "puzzle");
    const cell: CellPosition = { row: 0, col: 0 };

    const result = deleteLetter(grid, cell, "across", source);

    expect(result.grid[0][0].puzzleLetter).toBeNull();
    expect(result.nextCell.row).toBe(0);
    expect(result.nextCell.col).toBe(0);
  });

  it("retreats and deletes the previous cell's letter when current cell is empty", () => {
    const grid = createEmptyGrid(5);
    grid[0][0].puzzleLetter = "A";
    const cell: CellPosition = { row: 0, col: 1 };

    const result = deleteLetter(grid, cell, "across", source);

    expect(result.grid[0][0].puzzleLetter).toBeNull();
    expect(result.nextCell.row).toBe(0);
    expect(result.nextCell.col).toBe(0);
  });

  it("returns unchanged state when current cell is empty and cannot retreat", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = deleteLetter(grid, cell, "across", source);

    // Should return without error — legitimate no-op
    expect(result.grid[0][0].puzzleLetter).toBeNull();
    expect(result.nextCell.row).toBe(0);
    expect(result.nextCell.col).toBe(0);
  });

  it("throws for out-of-bounds cell", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: -1, col: 0 };

    expect(() => deleteLetter(grid, cell, "across", source)).toThrow();
  });

  it("throws for cell beyond grid size", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 5, col: 0 };

    expect(() => deleteLetter(grid, cell, "across", source)).toThrow();
  });

  it("does not mutate the input grid", () => {
    const grid = gridWithLetter(5, 0, 0, "A", "puzzle");
    const cell: CellPosition = { row: 0, col: 0 };

    deleteLetter(grid, cell, "across", source);

    expect(grid[0][0].puzzleLetter).toBe("A");
  });

  it("works with playerLetter source", () => {
    const grid = gridWithLetter(5, 0, 0, "Z", "player");
    const cell: CellPosition = { row: 0, col: 0 };

    const result = deleteLetter(grid, cell, "across", "player");

    expect(result.grid[0][0].playerLetter).toBeNull();
    expect(result.grid[0][0].puzzleLetter).toBeNull();
  });

  it("only affects the relevant letter field when deleting", () => {
    const grid = createEmptyGrid(5);
    grid[0][0].puzzleLetter = "A";
    grid[0][0].playerLetter = "B";
    const cell: CellPosition = { row: 0, col: 0 };

    const result = deleteLetter(grid, cell, "across", "puzzle");

    expect(result.grid[0][0].puzzleLetter).toBeNull();
    expect(result.grid[0][0].playerLetter).toBe("B");
  });

  it("retreats in down direction", () => {
    const grid = createEmptyGrid(5);
    grid[0][0].puzzleLetter = "A";
    const cell: CellPosition = { row: 1, col: 0 };

    const result = deleteLetter(grid, cell, "down", source);

    expect(result.grid[0][0].puzzleLetter).toBeNull();
    expect(result.nextCell.row).toBe(0);
    expect(result.nextCell.col).toBe(0);
    expect(result.nextDirection).toBe("down");
  });

  it("preserves direction after delete at current cell", () => {
    const grid = gridWithLetter(5, 0, 0, "A", "puzzle");
    const cell: CellPosition = { row: 0, col: 0 };

    const result = deleteLetter(grid, cell, "down", source);

    expect(result.nextDirection).toBe("down");
  });
});

// ============================================================
// moveCursor
// ============================================================
describe("moveCursor", () => {
  it("moves cursor right", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = moveCursor(grid, cell, "right");

    expect(result.nextCell.col).toBe(1);
    expect(result.nextCell.row).toBe(0);
    expect(result.nextDirection).toBe("across");
  });

  it("moves cursor down", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = moveCursor(grid, cell, "down");

    expect(result.nextCell.row).toBe(1);
    expect(result.nextCell.col).toBe(0);
    expect(result.nextDirection).toBe("down");
  });

  it("moves cursor left", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 2, col: 2 };

    const result = moveCursor(grid, cell, "left");

    expect(result.nextCell).toEqual({ row: 2, col: 1 });
    expect(result.nextDirection).toBe("across");
  });

  it("moves cursor up", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 2, col: 2 };

    const result = moveCursor(grid, cell, "up");

    expect(result.nextCell).toEqual({ row: 1, col: 2 });
    expect(result.nextDirection).toBe("down");
  });

  it("returns same grid (no mutation)", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = moveCursor(grid, cell, "right");

    expect(result.grid).toBe(grid);
  });

  it("stays in place but changes direction on up from top row", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    // up from (0,0) — can't go up, stays at (0,0) but switches to down direction
    const result = moveCursor(grid, cell, "up");

    expect(result.nextCell.row).toBe(0);
    expect(result.nextCell.col).toBe(0);
    expect(result.nextDirection).toBe("down");
  });

  it("stays in place but changes direction on left from leftmost column", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 0, col: 0 };

    const result = moveCursor(grid, cell, "left");

    expect(result.nextCell).toEqual({ row: 0, col: 0 });
    expect(result.nextDirection).toBe("across");
  });

  it("stays in place when target is a black cell", () => {
    const grid = createEmptyGrid(5);
    grid[1][2].black = true;
    const cell: CellPosition = { row: 2, col: 2 };

    // Moving up from (2,2) → target (1,2) is black
    const result = moveCursor(grid, cell, "up");

    expect(result.nextCell).toEqual({ row: 2, col: 2 }); // stays in place
    expect(result.nextDirection).toBe("down");
  });

  it("does not go past bottom edge", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 4, col: 2 };

    const result = moveCursor(grid, cell, "down");

    expect(result.nextCell).toEqual({ row: 4, col: 2 });
    expect(result.nextDirection).toBe("down");
  });

  it("does not go past right edge", () => {
    const grid = createEmptyGrid(5);
    const cell: CellPosition = { row: 2, col: 4 };

    const result = moveCursor(grid, cell, "right");

    expect(result.nextCell).toEqual({ row: 2, col: 4 });
    expect(result.nextDirection).toBe("across");
  });
});