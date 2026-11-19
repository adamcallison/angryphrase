import type { Word } from '../word/Word';
import { Grid } from '../grid/Grid';
import { CellMarker } from '../grid/CellMarker';
import type { CellSeparator } from '../grid/CellSeparator';
import { WordGeometry } from '../word/WordGeometry';
import type { WordCell } from '../word/WordGeometry';
import { Direction } from '../word/Direction';
import { ChainMarker } from './ChainMarker';
import type { ChainIndex } from './ChainIndex';

export type LengthPattern = string;

function separatorAt(grid: Grid, w: Word, cell: WordCell): CellSeparator {
  const axis = Direction.markerAxis(w.key.direction);
  return CellMarker.read(Grid.cellAt(grid, cell.row, cell.col).marker, axis);
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
  const cells = WordGeometry.cells(w);

  for (const cell of cells.slice(0, cells.length - 1)) {
    run = appendSeparator(pieces, run, separatorAt(grid, w, cell));
  }

  pieces.push(String(run));
  return pieces.join('');
}

function chainPattern(grid: Grid, members: Word[]): LengthPattern {
  let run = 1;
  const pieces: string[] = [];

  for (const [memberIndex, w] of members.entries()) {
    const cells = WordGeometry.cells(w);

    for (const cell of cells.slice(0, cells.length - 1)) {
      run = appendSeparator(pieces, run, separatorAt(grid, w, cell));
    }

    if (memberIndex < members.length - 1) {
      run = appendSeparator(pieces, run, ChainMarker.boundarySeparatorAt(grid, w) ?? 'none');
    }
  }

  pieces.push(String(run));
  return pieces.join('');
}

export const LengthPattern: {
  forWord(grid: Grid, index: ChainIndex, w: Word): LengthPattern;
} = {
  forWord(grid, index, w): LengthPattern {
    if (w.nextWord !== null) {
      return chainPattern(grid, index.membersOf(w.key));
    }
    return singleWordPattern(grid, w);
  },
};
