import type { Grid } from '../grid/Grid';
import type { Word } from '../word/Word';
import type { WordMap } from '../word/WordMap';
import { Row } from '../grid/Row';
import { Col } from '../grid/Col';
import { GridOps } from '../grid/GridOps';
import { Chain } from './Chain';

export type LengthPattern = string;

function singleWordPattern(grid: Grid, w: Word): LengthPattern {
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
}

function chainPattern(grid: Grid, members: Word[]): LengthPattern {
  let run = 1;
  const pieces: string[] = [];

  for (let memberIndex = 0; memberIndex < members.length; memberIndex++) {
    const w = members[memberIndex];
    if (w === undefined) continue;
    const { startRow, startCol, direction } = w.key;
    const lastIndex = Number(w.length) - 1;

    for (let i = 0; i < lastIndex; i++) {
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

    if (memberIndex < members.length - 1) {
      const lastRow = direction === 'down' ? Number(startRow) + lastIndex : Number(startRow);
      const lastCol = direction === 'across' ? Number(startCol) + lastIndex : Number(startCol);
      const cell = GridOps.cellAt(grid, Row.of(lastRow), Col.of(lastCol));

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
  }

  pieces.push(String(run));
  return pieces.join('');
}

export const LengthPattern: {
  forWord(grid: Grid, words: WordMap, w: Word): LengthPattern;
  forActiveClueBanner(grid: Grid, words: WordMap, w: Word): LengthPattern | null;
} = {
  forWord(grid, words, w): LengthPattern {
    if (w.nextWord !== null) {
      return chainPattern(grid, Chain.membersOf(words, w.key));
    }
    return singleWordPattern(grid, w);
  },

  forActiveClueBanner(grid, words, w): LengthPattern | null {
    return Chain.isHead(words, w.key) ? LengthPattern.forWord(grid, words, w) : null;
  },
};
