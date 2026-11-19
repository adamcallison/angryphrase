import { brand } from '../brand';
import { Cell } from './Cell';
import type { CellCoord } from './CellCoord';
import { Row } from './Row';
import { Col } from './Col';
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
  tryCoord(g: Grid, r: number, c: number): CellCoord | null;
} = {
  blank(size: GridSize): Grid {
    const n = Number(size);
    return Array.from({ length: n }, () =>
      Array.from({ length: n }, () => Cell.white())
    );
  },

  // Check-by-read: the indexed read is the bounds check (noUncheckedIndexedAccess
  // makes the compiler read it); it also catches ragged rows, which a square-grid
  // length comparison would not.
  cellAt(g: Grid, row: Row, col: Col): Cell {
    const cells = g[Number(row)];
    const cell = cells?.[Number(col)];
    if (cell === undefined) {
      throw new RangeError(outOfBoundsMessage(g, row, col));
    }
    return cell;
  },

  setCell(g: Grid, row: Row, col: Col, c: Cell): Grid {
    const rowIndex = Number(row);
    const colIndex = Number(col);
    const source = g[rowIndex];
    // The col length check is load-bearing: an out-of-range write silently
    // extends a JS array, so no compiler or runtime error would surface it.
    if (source === undefined || colIndex >= source.length) {
      throw new RangeError(outOfBoundsMessage(g, row, col));
    }
    const newRow = [...source];
    newRow[colIndex] = c;
    const newGrid = [...g];
    newGrid[rowIndex] = newRow;
    return newGrid;
  },

  updateCells(g: Grid, updates: ReadonlyArray<{ row: Row; col: Col; cell: Cell }>): Grid {
    if (updates.length === 0) return g;
    const newGrid = [...g];
    const cloned = new Map<number, Cell[]>();
    for (const u of updates) {
      const r = Number(u.row);
      const c = Number(u.col);
      const source = g[r];
      if (source === undefined || c >= source.length) {
        throw new RangeError(outOfBoundsMessage(g, u.row, u.col));
      }
      let target = cloned.get(r);
      if (target === undefined) {
        target = [...source];
        cloned.set(r, target);
        newGrid[r] = target;
      }
      target[c] = u.cell;
    }
    return newGrid;
  },

  withinBounds(g: Grid, row: Row, col: Col): boolean {
    const r = Number(row);
    const c = Number(col);
    return r >= 0 && c >= 0 && r < g.length && c < g.length;
  },

  tryCoord(g: Grid, r: number, c: number): CellCoord | null {
    const row = Row.try(r);
    if (row === null) return null;
    const col = Col.try(c);
    if (col === null) return null;
    if (!Grid.withinBounds(g, row, col)) return null;
    return brand<'CellCoord', { row: Row; col: Col }>({ row, col });
  },
};
