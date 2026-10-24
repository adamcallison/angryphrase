import type { Puzzle } from './Puzzle';
import type { Word } from '../word/Word';
import type { WordNumber } from '../word/WordNumber';
import type { Direction } from '../word/Direction';
import { Row } from '../grid/Row';
import { Col } from '../grid/Col';
import { GridOps } from '../grid/GridOps';
import { ChainIndex } from '../chain/ChainIndex';

export type CompletenessViolation =
  | { kind: 'missing-answer-letter'; row: Row; col: Col }
  | { kind: 'missing-clue'; wordNumber: WordNumber; direction: Direction }
  | { kind: 'non-head-clue'; wordNumber: WordNumber; direction: Direction };

export type CompletenessViolationKind = CompletenessViolation['kind'];
export type CompletenessViolationCounts = Readonly<Record<CompletenessViolationKind, number>>;

export const CompletenessCheck: {
  check(p: Puzzle): CompletenessViolation[];
  isComplete(p: Puzzle): boolean;
  clueViolations(words: Word[]): CompletenessViolation[];
  message(v: CompletenessViolation): string;
  groupByKind(violations: CompletenessViolation[]): CompletenessViolationCounts;
} = {
  check(p: Puzzle): CompletenessViolation[] {
    const violations: CompletenessViolation[] = [];

    const size = p.grid.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = GridOps.cellAt(p.grid, Row.of(r), Col.of(c));
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

  isComplete(p: Puzzle): boolean {
    return CompletenessCheck.check(p).length === 0;
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

  message(v: CompletenessViolation): string {
    switch (v.kind) {
      case 'missing-answer-letter':
        return `Missing answer letter at row ${Number(v.row)}, col ${Number(v.col)}.`;
      case 'missing-clue':
        return `Missing clue for word ${Number(v.wordNumber)} ${v.direction}.`;
      case 'non-head-clue':
        return `Word ${Number(v.wordNumber)} ${v.direction} is a non-head chain word with a non-empty clue.`;
    }
  },

  groupByKind(violations: CompletenessViolation[]): CompletenessViolationCounts {
    const counts: Record<CompletenessViolationKind, number> = {
      'missing-answer-letter': 0,
      'missing-clue': 0,
      'non-head-clue': 0,
    };
    for (const v of violations) {
      counts[v.kind]++;
    }
    return counts;
  },
};
