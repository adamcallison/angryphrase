import { describe, it, expect } from "vitest";
import { hydrateBuilderStateFromImport } from "./builder-state";
import type { CompletePuzzle, IncompletePuzzle, Word, DisplacedClue, CellData } from "./types";
import { createEmptyGrid } from "./grid-logic";

// Helper: create a minimal complete puzzle from a grid
function makeCompletePuzzle(
  grid: CellData[][],
  words: Word[],
  overrides?: Partial<Omit<CompletePuzzle, "grid" | "words">>,
): CompletePuzzle {
  return {
    key: "test-key",
    gridSize: grid.length,
    grid,
    words,
    title: "Test Puzzle",
    author: "Test Author",
    ...overrides,
  };
}

// Helper: create a minimal incomplete puzzle from a grid
function makeIncompletePuzzle(
  grid: CellData[][],
  words: Word[],
  displacedClues: DisplacedClue[] = [],
  overrides?: Partial<Omit<IncompletePuzzle, "grid" | "words" | "displacedClues">>,
): IncompletePuzzle {
  return {
    key: "test-key",
    gridSize: grid.length,
    grid,
    words,
    title: "Test Puzzle",
    author: "Test Author",
    displacedClues,
    ...overrides,
  };
}

// Helper: create a Word for testing
function makeWord(
  startRow: number,
  startCol: number,
  direction: "across" | "down",
  length: number,
  number: number,
  clue = "",
  nextWord: { startRow: number; startCol: number; direction: "across" | "down" } | null = null,
): Word {
  return { startRow, startCol, direction, length, number, clue, nextWord };
}

describe("hydrateBuilderStateFromImport", () => {
  it("hydrates state from a complete puzzle", () => {
    const grid = createEmptyGrid(3);
    const words: Word[] = [
      makeWord(0, 0, "across", 3, 1, "Test clue"),
      makeWord(0, 0, "down", 3, 1, "Another clue"),
    ];
    const puzzle = makeCompletePuzzle(grid, words);

    const snapshot = hydrateBuilderStateFromImport(puzzle, true);

    expect(snapshot.key).toBe("test-key");
    expect(snapshot.gridSize).toBe(3);
    expect(snapshot.grid).toBe(grid);
    expect(snapshot.title).toBe("Test Puzzle");
    expect(snapshot.author).toBe("Test Author");
    expect(snapshot.displacedClues).toEqual([]);
  });

  it("populates word metadata from puzzle words", () => {
    const grid = createEmptyGrid(3);
    const words: Word[] = [
      makeWord(0, 0, "across", 3, 1, "Across clue"),
      makeWord(0, 0, "down", 3, 1, "Down clue"),
    ];
    const puzzle = makeCompletePuzzle(grid, words);

    const snapshot = hydrateBuilderStateFromImport(puzzle, true);

    expect(snapshot.wordMetadata.get("0-0-across")).toEqual({
      clue: "Across clue",
      nextWord: null,
    });
    expect(snapshot.wordMetadata.get("0-0-down")).toEqual({
      clue: "Down clue",
      nextWord: null,
    });
  });

  it("preserves nextWord chain links in metadata", () => {
    const grid = createEmptyGrid(3);
    const words: Word[] = [
      makeWord(0, 0, "across", 3, 1, "Clue A", { startRow: 1, startCol: 0, direction: "down" }),
      makeWord(1, 0, "down", 2, 2, "See 1 Across"),
    ];
    const puzzle = makeCompletePuzzle(grid, words);

    const snapshot = hydrateBuilderStateFromImport(puzzle, true);

    expect(snapshot.wordMetadata.get("0-0-across")?.nextWord).toEqual({
      startRow: 1,
      startCol: 0,
      direction: "down",
    });
  });

  it("converts undefined nextWord to null in metadata", () => {
    const grid = createEmptyGrid(3);
    const words: Word[] = [
      { startRow: 0, startCol: 0, direction: "across", length: 3, number: 1, clue: "Test", nextWord: undefined as unknown as null },
    ];
    const puzzle = makeCompletePuzzle(grid, words);

    const snapshot = hydrateBuilderStateFromImport(puzzle, true);

    expect(snapshot.wordMetadata.get("0-0-across")?.nextWord).toBeNull();
  });

  it("fills in missing derived words for complete puzzles", () => {
    const grid = createEmptyGrid(3);
    // Only provide one word — the other derived word should be filled in
    const words: Word[] = [
      makeWord(0, 0, "across", 3, 1, "Across clue"),
    ];
    const puzzle = makeCompletePuzzle(grid, words);

    const snapshot = hydrateBuilderStateFromImport(puzzle, true);

    // The provided word should have its clue
    expect(snapshot.wordMetadata.get("0-0-across")).toEqual({
      clue: "Across clue",
      nextWord: null,
    });
    // The derived down word should be filled with empty metadata
    expect(snapshot.wordMetadata.get("0-0-down")).toEqual({
      clue: "",
      nextWord: null,
    });
  });

  it("does not fill in derived words for incomplete puzzles", () => {
    const grid = createEmptyGrid(3);
    const words: Word[] = [
      makeWord(0, 0, "across", 3, 1, "Across clue"),
    ];
    const puzzle = makeIncompletePuzzle(grid, words);

    const snapshot = hydrateBuilderStateFromImport(puzzle, false);

    // Only the provided word should have metadata
    expect(snapshot.wordMetadata.has("0-0-across")).toBe(true);
    // The down word should NOT be filled in
    expect(snapshot.wordMetadata.has("0-0-down")).toBe(false);
  });

  it("preserves displaced clues for incomplete puzzles", () => {
    const grid = createEmptyGrid(3);
    const words: Word[] = [
      makeWord(0, 0, "across", 3, 1, "Clue"),
    ];
    const displacedClues: DisplacedClue[] = [
      { id: "dc-1", clue: "Displaced clue", direction: "across" },
    ];
    const puzzle = makeIncompletePuzzle(grid, words, displacedClues);

    const snapshot = hydrateBuilderStateFromImport(puzzle, false);

    expect(snapshot.displacedClues).toEqual(displacedClues);
  });

  it("clears displaced clues for complete puzzles", () => {
    const grid = createEmptyGrid(3);
    const words: Word[] = [
      makeWord(0, 0, "across", 3, 1, "Clue"),
    ];
    const puzzle = makeCompletePuzzle(grid, words);

    const snapshot = hydrateBuilderStateFromImport(puzzle, true);

    expect(snapshot.displacedClues).toEqual([]);
  });

  it("does not mutate the input puzzle data", () => {
    const grid = createEmptyGrid(3);
    const words: Word[] = [
      makeWord(0, 0, "across", 3, 1, "Original clue"),
    ];
    const puzzle = makeCompletePuzzle(grid, words);
    const originalClue = puzzle.words[0].clue;

    hydrateBuilderStateFromImport(puzzle, true);

    expect(puzzle.words[0].clue).toBe(originalClue);
  });

  it("returns title and author from the puzzle", () => {
    const grid = createEmptyGrid(3);
    const words: Word[] = [
      makeWord(0, 0, "across", 3, 1, "Clue"),
    ];
    const puzzle = makeCompletePuzzle(grid, words, { title: "My Puzzle", author: "Me" });

    const snapshot = hydrateBuilderStateFromImport(puzzle, true);

    expect(snapshot.title).toBe("My Puzzle");
    expect(snapshot.author).toBe("Me");
  });
});