import type { Puzzle } from '../../domain/puzzle/Puzzle';
import type { Row } from '../../domain/grid/Row';
import type { Col } from '../../domain/grid/Col';
import type { Letter } from '../../domain/letter/Letter';
import type { WordKey } from '../../domain/word/WordKey';
import type { Cursor } from '../../domain/grid/Cursor';

export type CheckClassification =
  | 'complete-correct' | 'incomplete-correct'
  | 'complete-incorrect' | 'incomplete-incorrect';

export type CheckResult = {
  classification: CheckClassification;
  incorrectCells: { row: Row; col: Col }[];
  emptyCells:     { row: Row; col: Col }[];
};

export type AnagramModalState = {
  openedForWord: WordKey;
  input: string;
  scrambledArrangement: (Letter | null)[] | null;
};

export type PlayerState =
  | { phase: 'import'; lastImportError: string | null }
  | {
      phase: 'solving';
      puzzle: Puzzle;
      cursor: Cursor;
      checkResult: CheckResult | null;
      anagram: AnagramModalState | null;
    };

export const PlayerState: {
  importScreen(): PlayerState;
  loaded(p: Puzzle): PlayerState;
} = {
  importScreen(): PlayerState {
    return { phase: 'import', lastImportError: null };
  },

  loaded(p: Puzzle): PlayerState {
    return {
      phase: 'solving',
      puzzle: p,
      cursor: null,
      checkResult: null,
      anagram: null,
    };
  },
};
