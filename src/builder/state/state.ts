import type { GridSize } from '../../domain/grid/GridSize';
import { Puzzle } from '../../domain/puzzle/Puzzle';
import type { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import type { DisplacedClue } from '../../domain/builder/DisplacedClue';
import type { WordKey } from '../../domain/word/WordKey';
import type { Direction } from '../../domain/word/Direction';
import type { Row } from '../../domain/grid/Row';
import type { Col } from '../../domain/grid/Col';
import type { DisplacedClueId } from '../../domain/builder/DisplacedClueId';

export type Cursor = {
  row: Row;
  col: Col;
  direction: Direction;
} | null;

export type BuilderMode = 'design' | 'fill';

export type BuilderSubMode =
  | { kind: 'none' }
  | { kind: 'join'; source: WordKey }
  | { kind: 'reattach'; displacedClueId: DisplacedClueId };

export type BuilderState = {
  puzzle: Puzzle;
  displacedClues: DisplacedClue[];
  mode: BuilderMode;
  subMode: BuilderSubMode;
  cursor: Cursor;
};

export const BuilderState: {
  blank(size: GridSize, key: PuzzleKey): BuilderState;
  isBlank(s: BuilderState): boolean;
} = {
  blank(size, key) {
    return {
      puzzle: Puzzle.blank(size, key),
      displacedClues: [],
      mode: 'design',
      subMode: { kind: 'none' },
      cursor: null,
    };
  },

  isBlank(s) {
    return Puzzle.isBlank(s.puzzle) && s.displacedClues.length === 0;
  },
};
