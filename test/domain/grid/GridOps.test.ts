import { describe, expect, it } from 'vitest';
import { Cell } from '../../../src/domain/grid/Cell';
import type { Cell as CellType } from '../../../src/domain/grid/Cell';
import { CellMarker } from '../../../src/domain/grid/CellMarker';
import { Col } from '../../../src/domain/grid/Col';
import type { Grid } from '../../../src/domain/grid/Grid';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Row } from '../../../src/domain/grid/Row';
import type { Row as RowType } from '../../../src/domain/grid/Row';
import type { Col as ColType } from '../../../src/domain/grid/Col';

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

  it('GridOps.neighbours returns up-to-4 orthogonal in-bounds neighbours', () => {
    const grid = blankGrid(3);

    const corner = GridOps.neighbours(grid, Row.of(0), Col.of(0));
    expect(corner).toHaveLength(2);

    const edge = GridOps.neighbours(grid, Row.of(0), Col.of(1));
    expect(edge).toHaveLength(3);

    const center = GridOps.neighbours(grid, Row.of(1), Col.of(1));
    expect(center).toHaveLength(4);
  });

  it('GridOps.neighbours brands the returned coords as Row/Col', () => {
    const grid = blankGrid(3);
    const neighbours = GridOps.neighbours(grid, Row.of(1), Col.of(1));

    for (const n of neighbours) {
      const row: RowType = n.row;
      const col: ColType = n.col;
      expect(row).toBeDefined();
      expect(col).toBeDefined();
    }
  });

  it('GridOps.neighboursInDirection returns the next cell in across (right) and down (bottom)', () => {
    const grid = blankGrid(3);

    const across = GridOps.neighboursInDirection(grid, Row.of(1), Col.of(1), 'across');
    expect(across).toEqual({ row: Row.of(1), col: Col.of(2) });

    const down = GridOps.neighboursInDirection(grid, Row.of(1), Col.of(1), 'down');
    expect(down).toEqual({ row: Row.of(2), col: Col.of(1) });
  });

  it('GridOps.neighboursInDirection returns null at the right/bottom edge', () => {
    const grid = blankGrid(3);

    expect(GridOps.neighboursInDirection(grid, Row.of(1), Col.of(2), 'across')).toBeNull();
    expect(GridOps.neighboursInDirection(grid, Row.of(2), Col.of(1), 'down')).toBeNull();
  });

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

  it('GridOps.clone returns a deep-equal but fresh grid', () => {
    const grid = blankGrid(3);
    const cloned = GridOps.clone(grid);

    expect(GridOps.equals(grid, cloned)).toBe(true);
    expect(cloned).not.toBe(grid);
    expect(cloned[0]).not.toBe(grid[0]);
    expect(cloned[0]![0]).not.toBe(grid[0]![0]);
    expect(cloned[0]![0]!.marker).not.toBe(grid[0]![0]!.marker);
  });

  it('GridOps.clone preserves marker mutations independently', () => {
    const grid = blankGrid(3);
    const cloned = GridOps.clone(grid);

    const originalMarker = cloned[0]![0]!.marker;
    const mutatedMarker = CellMarker.write(originalMarker, 'right', 'space');
    const mutatedCell: CellType = { ...cloned[0]![0]!, marker: mutatedMarker };
    const mutatedGrid = GridOps.setCell(cloned, Row.of(0), Col.of(0), mutatedCell);

    expect(grid[0]![0]!.marker).toEqual(originalMarker);
    expect(grid[0]![0]!.marker.right).toBe('none');
    expect(mutatedGrid[0]![0]!.marker.right).toBe('space');
  });

  it('GridOps.equals returns true for two structurally equal grids, false for any field difference', () => {
    const a = blankGrid(3);
    const b = GridOps.clone(a);

    expect(GridOps.equals(a, b)).toBe(true);

    const withBlack = setBlack(a, 1, 1);
    expect(GridOps.equals(withBlack, b)).toBe(false);
  });

  it('GridOps.equals returns false for different dimensions', () => {
    const a = blankGrid(3);
    const b = blankGrid(4);

    expect(GridOps.equals(a, b)).toBe(false);
  });
});
