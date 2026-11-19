import type { Row } from './Row';
import type { Col } from './Col';
import type { Direction } from '../word/Direction';
import { WordGeometry } from '../word/WordGeometry';
import { WordLength } from '../word/WordLength';
import { Grid } from './Grid';
import { cellKey } from './CellKey';
import { Cell as CellCtor } from './Cell';
import { Row as RowCtor } from './Row';
import { Col as ColCtor } from './Col';

export type WordRun = {
  startRow: Row;
  startCol: Col;
  length: number;
  direction: Direction;
};

function isRunStart(
  grid: Grid,
  row: Row,
  col: Col,
  direction: Direction
): boolean {
  if (!CellCtor.isWhite(Grid.cellAt(grid, row, col))) {
    return false;
  }

  const r = Number(row);
  const c = Number(col);

  if (direction === 'across') {
    if (c === 0) return true;
    const prevCol = ColCtor.of(c - 1);
    return !CellCtor.isWhite(Grid.cellAt(grid, row, prevCol));
  }

  if (r === 0) return true;
  const prevRow = RowCtor.of(r - 1);
  return !CellCtor.isWhite(Grid.cellAt(grid, prevRow, col));
}

function measureRun(
  grid: Grid,
  startRow: Row,
  startCol: Col,
  direction: Direction
): number {
  const size = grid.length;
  const sr = Number(startRow);
  const sc = Number(startCol);
  let length = 0;

  if (direction === 'across') {
    let c = sc;
    while (c < size) {
      const col = ColCtor.of(c);
      if (!CellCtor.isWhite(Grid.cellAt(grid, startRow, col))) break;
      length++;
      c++;
    }
  } else {
    let r = sr;
    while (r < size) {
      const row = RowCtor.of(r);
      if (!CellCtor.isWhite(Grid.cellAt(grid, row, startCol))) break;
      length++;
      r++;
    }
  }

  return length;
}

function whiteAt(g: Grid, row: Row | null, col: Col | null): boolean {
  if (row === null || col === null) return false;
  if (!Grid.withinBounds(g, row, col)) return false;
  return CellCtor.isWhite(Grid.cellAt(g, row, col));
}

export const WordTopology: {
  runs(grid: Grid, direction: Direction): readonly WordRun[];
  partOfRun(grid: Grid, row: Row, col: Col, direction: Direction): boolean;
  partOfRunCells(grid: Grid): Set<string>;
  isSelectable(grid: Grid, row: Row, col: Col): boolean;
} = {
  runs(grid: Grid, direction: Direction): readonly WordRun[] {
    const size = grid.length;
    const result: WordRun[] = [];

    for (let i = 0; i < size; i++) {
      let j = 0;
      while (j < size) {
        const r = direction === 'across' ? i : j;
        const c = direction === 'across' ? j : i;
        const row = RowCtor.of(r);
        const col = ColCtor.of(c);

        if (isRunStart(grid, row, col, direction)) {
          const length = measureRun(grid, row, col, direction);
          result.push({ startRow: row, startCol: col, length, direction });
          j += length;
        } else {
          j++;
        }
      }
    }

    return result;
  },

  partOfRun(grid: Grid, row: Row, col: Col, direction: Direction): boolean {
    if (!whiteAt(grid, row, col)) {
      return false;
    }

    if (direction === 'across') {
      const c = Number(col);
      const prev = ColCtor.try(c - 1);
      const next = ColCtor.try(c + 1);
      return whiteAt(grid, row, prev) || whiteAt(grid, row, next);
    }

    const r = Number(row);
    const prev = RowCtor.try(r - 1);
    const next = RowCtor.try(r + 1);
    return whiteAt(grid, prev, col) || whiteAt(grid, next, col);
  },

  partOfRunCells(grid: Grid): Set<string> {
    const cells = new Set<string>();

    for (const direction of ['across', 'down'] as const) {
      for (const run of WordTopology.runs(grid, direction)) {
        // WordLength.of throws below its minimum of 2, and runs enumerates
        // length-1 runs — the filter must run before the mint.
        if (run.length < 2) continue;
        for (const cell of WordGeometry.cells({
          key: run,
          length: WordLength.of(run.length),
        })) {
          cells.add(cellKey(cell.row, cell.col));
        }
      }
    }

    return cells;
  },

  isSelectable(grid: Grid, row: Row, col: Col): boolean {
    return (
      WordTopology.partOfRun(grid, row, col, 'across') ||
      WordTopology.partOfRun(grid, row, col, 'down')
    );
  },
};
