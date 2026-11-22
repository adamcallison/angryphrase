import type { Puzzle } from './Puzzle';
import type { Word } from '../word/Word';
import type { WordNumber } from '../word/WordNumber';
import type { Direction } from '../word/Direction';
import { Row } from '../grid/Row';
import { Col } from '../grid/Col';
import { ChainIndex } from '../chain/ChainIndex';

export type CompletenessViolation =
  | { kind: 'missing-answer-letter'; row: Row; col: Col }
  | { kind: 'missing-clue'; wordNumber: WordNumber; direction: Direction }
  | { kind: 'non-head-clue'; wordNumber: WordNumber; direction: Direction };

export type CompletenessViolationKind = CompletenessViolation['kind'];

export const CompletenessCheck: {
  check(p: Puzzle): CompletenessViolation[];
  clueViolations(words: Word[]): CompletenessViolation[];
} = {
  check(p: Puzzle): CompletenessViolation[] {
    const violations: CompletenessViolation[] = [];

    for (const [r, row] of p.grid.entries()) {
      for (const [c, cell] of row.entries()) {
        if (!cell.black && cell.answerLetter === null) {
          violations.push({
            kind: 'missing-answer-letter',
            row: Row.of(r),
            col: Col.of(c),
          });
        }
      }
    }

    violations.push(...CompletenessCheck.clueViolations(p.words));

    return violations;
  },

  clueViolations(words: Word[]): CompletenessViolation[] {
    const violations: CompletenessViolation[] = [];
    const index = ChainIndex.build(words);

    for (const w of words) {
      const isHead = index.isHead(w.key);
      if (isHead && w.clue.trim() === '') {
        violations.push({
          kind: 'missing-clue',
          wordNumber: w.number,
          direction: w.key.direction,
        });
      } else if (!isHead && w.clue.trim() !== '') {
        violations.push({
          kind: 'non-head-clue',
          wordNumber: w.number,
          direction: w.key.direction,
        });
      }
    }

    return violations;
  },
};
