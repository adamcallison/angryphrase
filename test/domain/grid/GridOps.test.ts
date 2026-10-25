import { describe, expect, it } from 'vitest';
import { Cell } from '../../../src/domain/grid/Cell';
import type { Cell as CellType } from '../../../src/domain/grid/Cell';
import { Col } from '../../../src/domain/grid/Col';
import type { Grid } from '../../../src/domain/grid/Grid';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Row } from '../../../src/domain/grid/Row';

describe('GridOps', () => {
  function blankGrid(size: number): Grid {
    return GridOps.blank(GridSize.of(size));
  }

  function setCell(g: Grid, row: number, col: number, cell: CellType): Grid {
    return GridOps.setCell(g, Row.of(row), Col.of(col), cell);
  }

  function setBlack(g: Grid, row: number, col: number): Grid {
    return setCell(g, row, col, Cell.black());
  }

  it('GridOps.isSelectable returns false for a black cell', () => {
    const grid = setBlack(blankGrid(3), 1, 1);
    expect(GridOps.isSelectable(grid, Row.of(1), Col.of(1))).toBe(false);
  });

  it('GridOps.isSelectable returns false for an isolated white cell (no neighbours)', () => {
    // 3x3 grid with black border around the centre white cell.
    let grid = blankGrid(3);
    grid = setBlack(grid, 0, 0);
    grid = setBlack(grid, 0, 1);
    grid = setBlack(grid, 0, 2);
    grid = setBlack(grid, 1, 0);
    grid = setBlack(grid, 1, 2);
    grid = setBlack(grid, 2, 0);
    grid = setBlack(grid, 2, 1);
    grid = setBlack(grid, 2, 2);

    expect(Cell.isWhite(GridOps.cellAt(grid, Row.of(1), Col.of(1)))).toBe(true);
    expect(GridOps.isSelectable(grid, Row.of(1), Col.of(1))).toBe(false);
  });

  it('GridOps.isSelectable returns true for a white cell in a horizontal run of length 2', () => {
    let grid = blankGrid(3);
    grid = setBlack(grid, 1, 0);
    grid = setBlack(grid, 1, 2);

    expect(GridOps.isSelectable(grid, Row.of(1), Col.of(1))).toBe(true);
  });

  it('GridOps.isSelectable returns true for a white cell in a vertical run of length 2', () => {
    let grid = blankGrid(3);
    grid = setBlack(grid, 0, 1);
    grid = setBlack(grid, 2, 1);

    expect(GridOps.isSelectable(grid, Row.of(1), Col.of(1))).toBe(true);
  });

  it('GridOps.isSelectable returns false for a white cell only in a 1-length (singleton)', () => {
    // 3x3 grid with a white centre but all four orthogonal neighbours black.
    let grid = blankGrid(3);
    grid = setBlack(grid, 0, 1);
    grid = setBlack(grid, 1, 0);
    grid = setBlack(grid, 1, 2);
    grid = setBlack(grid, 2, 1);

    expect(Cell.isWhite(GridOps.cellAt(grid, Row.of(1), Col.of(1)))).toBe(true);
    expect(GridOps.isSelectable(grid, Row.of(1), Col.of(1))).toBe(false);
  });

  it('GridOps.isSelectable returns true for the end cell of a run (still part of a length-≥2 run)', () => {
    let grid = blankGrid(3);
    grid = setBlack(grid, 0, 0);
    grid = setBlack(grid, 0, 1);
    grid = setBlack(grid, 0, 2);
    grid = setBlack(grid, 1, 1);
    grid = setBlack(grid, 1, 2);
    grid = setBlack(grid, 2, 1);
    grid = setBlack(grid, 2, 2);

    // Row 1, Col 0 and Row 2, Col 0 form a vertical run of length 2.
    expect(GridOps.isSelectable(grid, Row.of(1), Col.of(0))).toBe(true);
    expect(GridOps.isSelectable(grid, Row.of(2), Col.of(0))).toBe(true);
  });
});
