import type { Grid } from './Grid';
import type { Row } from './Row';
import type { Col } from './Col';
import type { GridSize } from './GridSize';
import type { Cell } from './Cell';
import { Cell as CellCtor } from './Cell';
import { GridAccess } from './GridAccess';
import { WordTopology } from './WordTopology';

export const GridOps: {
  blank(size: GridSize): Grid;
  cellAt(g: Grid, row: Row, col: Col): Cell;
  setCell(g: Grid, row: Row, col: Col, c: Cell): Grid;
  updateCells(g: Grid, updates: ReadonlyArray<{ row: Row; col: Col; cell: Cell }>): Grid;
  withinBounds(g: Grid, row: Row, col: Col): boolean;
  isSelectable(g: Grid, row: Row, col: Col): boolean;
} = {
  blank(size: GridSize): Grid {
    return GridAccess.blank(size);
  },

  cellAt(g: Grid, row: Row, col: Col): Cell {
    return GridAccess.cellAt(g, row, col);
  },

  setCell(g: Grid, row: Row, col: Col, c: Cell): Grid {
    return GridAccess.setCell(g, row, col, c);
  },

  updateCells(g: Grid, updates: ReadonlyArray<{ row: Row; col: Col; cell: Cell }>): Grid {
    return GridAccess.updateCells(g, updates);
  },

  withinBounds(g: Grid, row: Row, col: Col): boolean {
    return GridAccess.withinBounds(g, row, col);
  },

  isSelectable(g: Grid, row: Row, col: Col): boolean {
    if (!GridAccess.withinBounds(g, row, col)) return false;
    const cell = GridAccess.cellAt(g, row, col);
    if (!CellCtor.isWhite(cell)) return false;
    return (
      WordTopology.partOfRun(g, row, col, 'across') ||
      WordTopology.partOfRun(g, row, col, 'down')
    );
  },
};
