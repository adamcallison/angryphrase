import type { Grid } from '../grid/Grid';
import type { Word } from '../word/Word';
import type { WordMap } from '../word/WordMap';
import { Row } from '../grid/Row';
import { Col } from '../grid/Col';
import { GridOps } from '../grid/GridOps';
import { Chain } from './Chain';

export type LengthPattern = string;

export const LengthPattern: {
  forWord(grid: Grid, words: WordMap, w: Word): LengthPattern;
  forActiveClueBanner(grid: Grid, words: WordMap, w: Word): LengthPattern | null;
} = {
  forWord(grid, words, w): LengthPattern {
    if (w.nextWord !== null) {
      return Chain.membersOf(words, w.key)
        .map((m) => String(m.length))
        .join(',');
    }

    let run = 1;
    const pieces: string[] = [];
    const { startRow, startCol, direction } = w.key;

    for (let i = 0; i < w.length - 1; i++) {
      const row = direction === 'down' ? Number(startRow) + i : Number(startRow);
      const col = direction === 'across' ? Number(startCol) + i : Number(startCol);
      const cell = GridOps.cellAt(grid, Row.of(row), Col.of(col));

      if (direction === 'across') {
        if (cell.marker.spaceRight) {
          pieces.push(String(run), ', ');
          run = 1;
        } else if (cell.marker.hyphenRight) {
          pieces.push(String(run), '-');
          run = 1;
        } else {
          run++;
        }
      } else {
        if (cell.marker.spaceBottom) {
          pieces.push(String(run), ', ');
          run = 1;
        } else if (cell.marker.hyphenBottom) {
          pieces.push(String(run), '-');
          run = 1;
        } else {
          run++;
        }
      }
    }

    pieces.push(String(run));
    return pieces.join('');
  },

  forActiveClueBanner(grid, words, w): LengthPattern | null {
    return Chain.isHead(words, w.key) ? LengthPattern.forWord(grid, words, w) : null;
  },
};
