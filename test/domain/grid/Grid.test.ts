import { describe, expect, it } from 'vitest';
import { Cell } from '../../../src/domain/grid/Cell';
import { Col } from '../../../src/domain/grid/Col';
import { Grid } from '../../../src/domain/grid/Grid';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Row } from '../../../src/domain/grid/Row';

describe('Grid', () => {
  function blankGrid(size: number): Grid {
    return Grid.blank(GridSize.of(size));
  }

  it('Grid.blank(size) produces size×size grid of white cells', () => {
    const grid = Grid.blank(GridSize.of(5));
    expect(grid).toHaveLength(5);
    for (const row of grid) {
      expect(row).toHaveLength(5);
      for (const cell of row) {
        expect(Cell.isWhite(cell)).toBe(true);
      }
    }
  });

  it('Grid.blank(2) and blank(25) hit the bounds', () => {
    const small = Grid.blank(GridSize.of(2));
    expect(small).toHaveLength(2);
    expect(small[0]).toHaveLength(2);

    const large = Grid.blank(GridSize.of(25));
    expect(large).toHaveLength(25);
    expect(large[0]).toHaveLength(25);
  });

  it('Grid.cellAt returns the cell at (row, col)', () => {
    const grid = blankGrid(3);
    const cell = Grid.cellAt(grid, Row.of(1), Col.of(2));
    expect(Cell.isWhite(cell)).toBe(true);
  });

  it('Grid.cellAt throws RangeError on out-of-bounds', () => {
    const grid = blankGrid(3);
    expect(() => Grid.cellAt(grid, Row.of(-1), Col.of(0))).toThrow(RangeError);
    expect(() => Grid.cellAt(grid, Row.of(0), Col.of(-1))).toThrow(RangeError);
    expect(() => Grid.cellAt(grid, Row.of(3), Col.of(0))).toThrow(RangeError);
    expect(() => Grid.cellAt(grid, Row.of(0), Col.of(3))).toThrow(RangeError);
  });

  it('Grid.setCell returns a new grid with the cell replaced; original grid unchanged', () => {
    const grid = blankGrid(3);
    const black = Cell.black();
    const updated = Grid.setCell(grid, Row.of(1), Col.of(1), black);

    expect(updated).not.toBe(grid);
    expect(updated[1]).not.toBe(grid[1]);
    expect(updated[0]).toBe(grid[0]);
    expect(updated[2]).toBe(grid[2]);

    expect(Cell.isWhite(Grid.cellAt(grid, Row.of(1), Col.of(1)))).toBe(true);
    expect(Grid.cellAt(updated, Row.of(1), Col.of(1)).black).toBe(true);
  });

  it('Grid.setCell throws RangeError on out-of-bounds', () => {
    const grid = blankGrid(3);
    const black = Cell.black();
    expect(() => Grid.setCell(grid, Row.of(-1), Col.of(0), black)).toThrow(RangeError);
    expect(() => Grid.setCell(grid, Row.of(0), Col.of(-1), black)).toThrow(RangeError);
    expect(() => Grid.setCell(grid, Row.of(3), Col.of(0), black)).toThrow(RangeError);
    expect(() => Grid.setCell(grid, Row.of(0), Col.of(3), black)).toThrow(RangeError);
  });

  it('Grid.withinBounds returns true for in-bounds, false for out-of-bounds and negative', () => {
    const grid = blankGrid(3);
    expect(Grid.withinBounds(grid, Row.of(0), Col.of(0))).toBe(true);
    expect(Grid.withinBounds(grid, Row.of(2), Col.of(2))).toBe(true);
    expect(Grid.withinBounds(grid, Row.of(3), Col.of(0))).toBe(false);
    expect(Grid.withinBounds(grid, Row.of(0), Col.of(3))).toBe(false);
    // Defensive negative bounds: the public constructors reject negatives,
    // so we assert through the function using type casts.
    expect(Grid.withinBounds(grid, -1 as Row, Col.of(0))).toBe(false);
    expect(Grid.withinBounds(grid, Row.of(0), -1 as Col)).toBe(false);
  });

  it('Grid.updateCells returns the same grid reference when updates is empty', () => {
    const g = blankGrid(3);
    expect(Grid.updateCells(g, [])).toBe(g);
  });

  it('Grid.updateCells applies all updates and leaves other cells unchanged', () => {
    const g = blankGrid(3);
    const updates = [
      { row: Row.of(0), col: Col.of(0), cell: Cell.black() },
      { row: Row.of(1), col: Col.of(1), cell: Cell.black() },
      { row: Row.of(2), col: Col.of(2), cell: Cell.black() },
    ];
    const result = Grid.updateCells(g, updates);

    expect(Grid.cellAt(result, Row.of(0), Col.of(0)).black).toBe(true);
    expect(Grid.cellAt(result, Row.of(1), Col.of(1)).black).toBe(true);
    expect(Grid.cellAt(result, Row.of(2), Col.of(2)).black).toBe(true);

    expect(Cell.isWhite(Grid.cellAt(result, Row.of(0), Col.of(1)))).toBe(true);
    expect(Cell.isWhite(Grid.cellAt(result, Row.of(1), Col.of(0)))).toBe(true);
    expect(Cell.isWhite(Grid.cellAt(result, Row.of(1), Col.of(2)))).toBe(true);
  });

  it('Grid.updateCells clones each touched row once; untouched rows keep reference', () => {
    const g = blankGrid(3);
    const updates = [
      { row: Row.of(0), col: Col.of(0), cell: Cell.black() },
      { row: Row.of(2), col: Col.of(2), cell: Cell.black() },
    ];
    const result = Grid.updateCells(g, updates);

    expect(result[0]).not.toBe(g[0]);
    expect(result[2]).not.toBe(g[2]);
    expect(result[1]).toBe(g[1]);
  });

  it('Grid.updateCells clones the outer grid array once', () => {
    const g = blankGrid(3);
    const updates = [{ row: Row.of(0), col: Col.of(0), cell: Cell.black() }];
    const result = Grid.updateCells(g, updates);

    expect(result).not.toBe(g);
  });

  it('Grid.updateCells throws RangeError when any update is out-of-bounds', () => {
    const g = blankGrid(3);
    const updates = [
      { row: Row.of(0), col: Col.of(0), cell: Cell.black() },
      { row: Row.of(3), col: Col.of(0), cell: Cell.black() },
    ];

    expect(() => Grid.updateCells(g, updates)).toThrow(RangeError);
    expect(g[0]![0]!.black).toBe(false);
  });

  it('Grid.updateCells applies multiple updates to the same row in one pass', () => {
    const g = blankGrid(3);
    const updates = [
      { row: Row.of(0), col: Col.of(0), cell: Cell.black() },
      { row: Row.of(0), col: Col.of(2), cell: Cell.black() },
    ];
    const result = Grid.updateCells(g, updates);

    expect(Grid.cellAt(result, Row.of(0), Col.of(0)).black).toBe(true);
    expect(Grid.cellAt(result, Row.of(0), Col.of(2)).black).toBe(true);
    expect(Cell.isWhite(Grid.cellAt(result, Row.of(0), Col.of(1)))).toBe(true);
    expect(result[0]).not.toBe(g[0]);

    const extra = Grid.updateCells(result, [
      { row: Row.of(0), col: Col.of(1), cell: Cell.black() },
    ]);
    expect(extra[0]).not.toBe(result[0]);
  });
});
