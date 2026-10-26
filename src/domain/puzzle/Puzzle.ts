import type { PuzzleKey } from './PuzzleKey';
import { GridSize } from '../grid/GridSize';
import type { Grid } from '../grid/Grid';
import type { Word } from '../word/Word';
import { Title } from './Title';
import { Author } from './Author';
import { GridAccess } from '../grid/GridAccess';
import { WordDerivation } from '../word/WordDerivation';
import { Numbering } from '../word/Numbering';

export type Puzzle = {
  key: PuzzleKey;
  gridSize: GridSize;
  grid: Grid;
  words: Word[];
  title: Title;
  author: Author;
};

export const Puzzle: {
  blank(size: GridSize, key: PuzzleKey): Puzzle;
  isBlank(p: Puzzle): boolean;
  withGrid(p: Puzzle, g: Grid): Puzzle;
  withWords(p: Puzzle, ws: Word[]): Puzzle;
  withMetadata(p: Puzzle, title: Title, author: Author): Puzzle;
} = {
  blank(size: GridSize, key: PuzzleKey): Puzzle {
    const grid = GridAccess.blank(size);
    const words = Numbering.assign(grid, WordDerivation.derive(grid));
    return {
      key,
      gridSize: size,
      grid,
      words,
      title: Title.of(''),
      author: Author.of(''),
    };
  },

  isBlank(p: Puzzle): boolean {
    // blank = no answer letters, no non-empty clues, no chains
    const noAnswerLetters = p.grid.every((row) =>
      row.every((cell) => cell.answerLetter === null),
    );
    const noNonEmptyClues = p.words.every((w) => w.clue.trim() === '');
    const noChains = p.words.every((w) => w.nextWord === null);
    return noAnswerLetters && noNonEmptyClues && noChains;
  },

  withGrid(p: Puzzle, g: Grid): Puzzle {
    return { ...p, grid: g, gridSize: GridSize.of(g.length) };
  },

  withWords(p: Puzzle, ws: Word[]): Puzzle {
    return { ...p, words: ws };
  },

  withMetadata(p: Puzzle, title: Title, author: Author): Puzzle {
    return { ...p, title, author };
  },
};
