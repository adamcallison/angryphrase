import type { Row } from './Row';
import type { Col } from './Col';
import type { Direction } from '../word/Direction';
import { Grid } from './Grid';
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
      if (!Grid.withinBounds(grid, startRow, col)) break;
      if (!CellCtor.isWhite(Grid.cellAt(grid, startRow, col))) break;
      length++;
      c++;
    }
  } else {
    let r = sr;
    while (r < size) {
      const row = RowCtor.of(r);
      if (!Grid.withinBounds(grid, row, startCol)) break;
      if (!CellCtor.isWhite(Grid.cellAt(grid, row, startCol))) break;
      length++;
      r++;
    }
  }

  return length;
}

export const WordTopology: {
  runs(grid: Grid, direction: Direction): readonly WordRun[];
  partOfRun(grid: Grid, row: Row, col: Col, direction: Direction): boolean;
  partOfRunMask(grid: Grid): boolean[][];
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
    if (!Grid.withinBounds(grid, row, col)) {
      return false;
    }
    if (!CellCtor.isWhite(Grid.cellAt(grid, row, col))) {
      return false;
    }

    const r = Number(row);
    const c = Number(col);
    const size = grid.length;

    let stepsBefore = 0;
    if (direction === 'across') {
      let scan = c - 1;
      while (scan >= 0) {
        const scanCol = ColCtor.try(scan);
        if (scanCol === null) break;
        if (!Grid.withinBounds(grid, row, scanCol)) break;
        if (!CellCtor.isWhite(Grid.cellAt(grid, row, scanCol))) break;
        stepsBefore++;
        scan--;
      }
    } else {
      let scan = r - 1;
      while (scan >= 0) {
        const scanRow = RowCtor.try(scan);
        if (scanRow === null) break;
        if (!Grid.withinBounds(grid, scanRow, col)) break;
        if (!CellCtor.isWhite(Grid.cellAt(grid, scanRow, col))) break;
        stepsBefore++;
        scan--;
      }
    }

    const startIndex =
      direction === 'across' ? c - stepsBefore : r - stepsBefore;
    let length = 0;

    if (direction === 'across') {
      let scan = startIndex;
      while (scan < size) {
        const scanCol = ColCtor.of(scan);
        if (!Grid.withinBounds(grid, row, scanCol)) break;
        if (!CellCtor.isWhite(Grid.cellAt(grid, row, scanCol))) break;
        length++;
        scan++;
      }
    } else {
      let scan = startIndex;
      while (scan < size) {
        const scanRow = RowCtor.of(scan);
        if (!Grid.withinBounds(grid, scanRow, col)) break;
        if (!CellCtor.isWhite(Grid.cellAt(grid, scanRow, col))) break;
        length++;
        scan++;
      }
    }

    return length >= 2;
  },

  partOfRunMask(grid: Grid): boolean[][] {
    const mask: boolean[][] = grid.map((row) => row.map(() => false));

    for (const direction of ['across', 'down'] as const) {
      for (const run of WordTopology.runs(grid, direction)) {
        if (run.length < 2) continue;
        const startRow = Number(run.startRow);
        const startCol = Number(run.startCol);
        for (let i = 0; i < run.length; i++) {
          const r = direction === 'across' ? startRow : startRow + i;
          const c = direction === 'across' ? startCol + i : startCol;
          const rowMask = mask[r];
          if (rowMask === undefined) continue;
          rowMask[c] = true;
        }
      }
    }

    return mask;
  },

  isSelectable(grid: Grid, row: Row, col: Col): boolean {
    return (
      WordTopology.partOfRun(grid, row, col, 'across') ||
      WordTopology.partOfRun(grid, row, col, 'down')
    );
  },
};
