import type { CellData, CompletePuzzle, DisplacedClue, IncompletePuzzle, WordMetadata } from "./types";
import { deriveWords } from "./grid-logic";
import { toWordId } from "./chain-logic";

/**
 * Snapshot of builder state produced by importing a puzzle.
 * UI state (interaction, selectedCell, selectedDirection) is not included —
 * the page handler decides those.
 */
export interface BuilderStateSnapshot {
  key: string;
  gridSize: number;
  grid: CellData[][];
  wordMetadata: Map<string, WordMetadata>;
  displacedClues: DisplacedClue[];
  title: string;
  author: string;
}

/**
 * Hydrates builder state from an imported puzzle.
 *
 * For complete puzzles, derives words from the grid and fills in metadata
 * for any derived words that aren't in the puzzle's word list.
 * For incomplete puzzles, uses the puzzle's words and displaced clues as-is.
 *
 * Pure function — does not mutate any input.
 */
export function hydrateBuilderStateFromImport(
  puzzleData: CompletePuzzle | IncompletePuzzle,
  isComplete: boolean,
): BuilderStateSnapshot {
  const wordMetadata = new Map<string, WordMetadata>();

  // Populate metadata from the puzzle's words
  for (const w of puzzleData.words) {
    const id = toWordId(w);
    wordMetadata.set(id, { clue: w.clue, nextWord: w.nextWord ?? null });
  }

  // For complete puzzles, fill in any derived words missing from metadata
  if (isComplete) {
    const dw = deriveWords(puzzleData.grid);
    for (const d of dw) {
      const id = toWordId(d);
      if (!wordMetadata.has(id)) {
        wordMetadata.set(id, { clue: "", nextWord: null });
      }
    }
  }

  const displacedClues: DisplacedClue[] = isComplete
    ? []
    : (puzzleData as IncompletePuzzle).displacedClues;

  return {
    key: puzzleData.key,
    gridSize: puzzleData.gridSize,
    grid: puzzleData.grid,
    wordMetadata,
    displacedClues,
    title: puzzleData.title,
    author: puzzleData.author,
  };
}