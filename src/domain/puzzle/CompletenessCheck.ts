import type { Puzzle } from './Puzzle';
import type { WordNumber } from '../word/WordNumber';
import type { Direction } from '../word/Direction';
import { Row } from '../grid/Row';
import { Col } from '../grid/Col';
import { WordMap } from '../word/WordMap';
import { Chain } from '../chain/Chain';

export type CompletenessViolation =
  | { kind: 'missing-answer-letter'; row: Row; col: Col }
  | { kind: 'invalid-answer-letter'; row: Row; col: Col; value: string }
  | { kind: 'missing-clue'; wordNumber: WordNumber; direction: Direction };

export const CompletenessCheck: {
  check(p: Puzzle): CompletenessViolation[];
  isComplete(p: Puzzle): boolean;
} = {
  check(p: Puzzle): CompletenessViolation[] {
    const violations: CompletenessViolation[] = [];

    for (let r = 0; r < p.grid.length; r++) {
      const row = p.grid[r]!;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c]!;
        if (!cell.black && cell.answerLetter === null) {
          violations.push({
            kind: 'missing-answer-letter',
            row: Row.of(r),
            col: Col.of(c),
          });
        }
      }
    }

    const wordMap = WordMap.fromWords(p.words);
    for (const w of p.words) {
      if (Chain.isHead(wordMap, w.key) && w.clue.trim() === '') {
        violations.push({
          kind: 'missing-clue',
          wordNumber: w.number,
          direction: w.key.direction,
        });
      }
    }

    return violations;
  },

  isComplete(p: Puzzle): boolean {
    return CompletenessCheck.check(p).length === 0;
  },
};
