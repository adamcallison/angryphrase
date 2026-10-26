import { Cell } from './Cell';
import type { Row } from './Row';
import type { Col } from './Col';
import type { GridSize } from './GridSize';

export type Grid = Cell[][];

function outOfBoundsMessage(g: Grid, row: Row, col: Col): string {
  return `cellAt out of bounds: row=${row} col=${col} size=${g.length}`;
}

export const Grid: {
  blank(size: GridSize): Grid;
  cellAt(g: Grid, row: Row, col: Col): Cell;
  setCell(g: Grid, row: Row, col: Col, c: Cell): Grid;
  updateCells(g: Grid, updates: ReadonlyArray<{ row: Row; col: Col; cell: Cell }>): Grid;
  withinBounds(g: Grid, row: Row, col: Col): boolean;
} = {
  blank(size: GridSize): Grid {
    const n = Number(size);
    return Array.from({ length: n }, () =>
      Array.from({ length: n }, () => Cell.white())
    );
  },

  cellAt(g: Grid, row: Row, col: Col): Cell {
    if (!Grid.withinBounds(g, row, col)) {
      throw new RangeError(outOfBoundsMessage(g, row, col));
    }
    return g[Number(row)]![Number(col)]!;
  },

  setCell(g: Grid, row: Row, col: Col, c: Cell): Grid {
    if (!Grid.withinBounds(g, row, col)) {
      throw new RangeError(outOfBoundsMessage(g, row, col));
    }
    const rowIndex = Number(row);
    const colIndex = Number(col);
    const newRow = [...g[rowIndex]!];
    newRow[colIndex] = c;
    const newGrid = [...g];
    newGrid[rowIndex] = newRow;
    return newGrid;
  },

  updateCells(g: Grid, updates: ReadonlyArray<{ row: Row; col: Col; cell: Cell }>): Grid {
    if (updates.length === 0) return g;
    for (const u of updates) {
      if (!Grid.withinBounds(g, u.row, u.col)) {
        throw new RangeError(outOfBoundsMessage(g, u.row, u.col));
      }
    }
    const newGrid = [...g];
    const clonedRows = new Set<number>();
    for (const u of updates) {
      const r = Number(u.row);
      const c = Number(u.col);
      if (!clonedRows.has(r)) {
        newGrid[r] = [...g[r]!];
        clonedRows.add(r);
      }
      newGrid[r]![c] = u.cell;
    }
    return newGrid;
  },

  withinBounds(g: Grid, row: Row, col: Col): boolean {
    const r = Number(row);
    const c = Number(col);
    return r >= 0 && c >= 0 && r < g.length && c < g.length;
  },
};
