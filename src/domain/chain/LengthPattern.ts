import type { Grid } from '../grid/Grid';
import type { Word } from '../word/Word';
import type { WordMap } from '../word/WordMap';
import { GridOps } from '../grid/GridOps';
import { CellMarker } from '../grid/CellMarker';
import type { CellSeparator } from '../grid/CellSeparator';
import { WordGeometry } from '../word/WordGeometry';
import { Chain } from './Chain';

export type LengthPattern = string;

function separatorAt(grid: Grid, w: Word, offset: number): CellSeparator {
  const cells = WordGeometry.cells(w);
  const cell = cells[offset];
  if (cell === undefined) {
    throw new Error('LengthPattern.separatorAt: offset out of range');
  }
  const axis = w.key.direction === 'across' ? 'right' : 'bottom';
  return CellMarker.read(GridOps.cellAt(grid, cell.row, cell.col).marker, axis);
}

function appendSeparator(pieces: string[], run: number, separator: CellSeparator): number {
  if (separator === 'space') {
    pieces.push(String(run), ', ');
    return 1;
  }
  if (separator === 'hyphen') {
    pieces.push(String(run), '-');
    return 1;
  }
  return run + 1;
}

function singleWordPattern(grid: Grid, w: Word): LengthPattern {
  let run = 1;
  const pieces: string[] = [];

  for (let i = 0; i < w.length - 1; i++) {
    run = appendSeparator(pieces, run, separatorAt(grid, w, i));
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
    const lastIndex = Number(w.length) - 1;

    for (let i = 0; i < lastIndex; i++) {
      run = appendSeparator(pieces, run, separatorAt(grid, w, i));
    }

    if (memberIndex < members.length - 1) {
      run = appendSeparator(pieces, run, separatorAt(grid, w, lastIndex));
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
