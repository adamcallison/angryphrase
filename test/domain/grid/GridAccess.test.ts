import { describe, expect, it } from 'vitest';
import { Cell } from '../../../src/domain/grid/Cell';
import { Col } from '../../../src/domain/grid/Col';
import type { Grid } from '../../../src/domain/grid/Grid';
import { GridAccess } from '../../../src/domain/grid/GridAccess';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Row } from '../../../src/domain/grid/Row';

describe('GridAccess', () => {
  function blankGrid(size: number): Grid {
    return GridAccess.blank(GridSize.of(size));
  }

  it('GridAccess.blank(size) produces size×size grid of white cells', () => {
    const grid = GridAccess.blank(GridSize.of(5));
    expect(grid).toHaveLength(5);
    for (const row of grid) {
      expect(row).toHaveLength(5);
      for (const cell of row) {
        expect(Cell.isWhite(cell)).toBe(true);
      }
    }
  });

  it('GridAccess.blank(2) and blank(25) hit the bounds', () => {
    const small = GridAccess.blank(GridSize.of(2));
    expect(small).toHaveLength(2);
    expect(small[0]).toHaveLength(2);

    const large = GridAccess.blank(GridSize.of(25));
    expect(large).toHaveLength(25);
    expect(large[0]).toHaveLength(25);
  });

  it('GridAccess.cellAt returns the cell at (row, col)', () => {
    const grid = blankGrid(3);
    const cell = GridAccess.cellAt(grid, Row.of(1), Col.of(2));
    expect(Cell.isWhite(cell)).toBe(true);
  });

  it('GridAccess.cellAt throws RangeError on out-of-bounds', () => {
    const grid = blankGrid(3);
    expect(() => GridAccess.cellAt(grid, Row.of(-1), Col.of(0))).toThrow(RangeError);
    expect(() => GridAccess.cellAt(grid, Row.of(0), Col.of(-1))).toThrow(RangeError);
    expect(() => GridAccess.cellAt(grid, Row.of(3), Col.of(0))).toThrow(RangeError);
    expect(() => GridAccess.cellAt(grid, Row.of(0), Col.of(3))).toThrow(RangeError);
  });

  it('GridAccess.setCell returns a new grid with the cell replaced; original grid unchanged', () => {
    const grid = blankGrid(3);
    const black = Cell.black();
    const updated = GridAccess.setCell(grid, Row.of(1), Col.of(1), black);

    expect(updated).not.toBe(grid);
    expect(updated[1]).not.toBe(grid[1]);
    expect(updated[0]).toBe(grid[0]);
    expect(updated[2]).toBe(grid[2]);

    expect(Cell.isWhite(GridAccess.cellAt(grid, Row.of(1), Col.of(1)))).toBe(true);
    expect(GridAccess.cellAt(updated, Row.of(1), Col.of(1)).black).toBe(true);
  });

  it('GridAccess.setCell throws RangeError on out-of-bounds', () => {
    const grid = blankGrid(3);
    const black = Cell.black();
    expect(() => GridAccess.setCell(grid, Row.of(-1), Col.of(0), black)).toThrow(RangeError);
    expect(() => GridAccess.setCell(grid, Row.of(0), Col.of(-1), black)).toThrow(RangeError);
    expect(() => GridAccess.setCell(grid, Row.of(3), Col.of(0), black)).toThrow(RangeError);
    expect(() => GridAccess.setCell(grid, Row.of(0), Col.of(3), black)).toThrow(RangeError);
  });

  it('GridAccess.withinBounds returns true for in-bounds, false for out-of-bounds and negative', () => {
    const grid = blankGrid(3);
    expect(GridAccess.withinBounds(grid, Row.of(0), Col.of(0))).toBe(true);
    expect(GridAccess.withinBounds(grid, Row.of(2), Col.of(2))).toBe(true);
    expect(GridAccess.withinBounds(grid, Row.of(3), Col.of(0))).toBe(false);
    expect(GridAccess.withinBounds(grid, Row.of(0), Col.of(3))).toBe(false);
    // Defensive negative bounds: the public constructors reject negatives,
    // so we assert through the function using type casts.
    expect(GridAccess.withinBounds(grid, -1 as Row, Col.of(0))).toBe(false);
    expect(GridAccess.withinBounds(grid, Row.of(0), -1 as Col)).toBe(false);
  });

  it('GridAccess.updateCells returns the same grid reference when updates is empty', () => {
    const g = blankGrid(3);
    expect(GridAccess.updateCells(g, [])).toBe(g);
  });

  it('GridAccess.updateCells applies all updates and leaves other cells unchanged', () => {
    const g = blankGrid(3);
    const updates = [
      { row: Row.of(0), col: Col.of(0), cell: Cell.black() },
      { row: Row.of(1), col: Col.of(1), cell: Cell.black() },
      { row: Row.of(2), col: Col.of(2), cell: Cell.black() },
    ];
    const result = GridAccess.updateCells(g, updates);

    expect(GridAccess.cellAt(result, Row.of(0), Col.of(0)).black).toBe(true);
    expect(GridAccess.cellAt(result, Row.of(1), Col.of(1)).black).toBe(true);
    expect(GridAccess.cellAt(result, Row.of(2), Col.of(2)).black).toBe(true);

    expect(Cell.isWhite(GridAccess.cellAt(result, Row.of(0), Col.of(1)))).toBe(true);
    expect(Cell.isWhite(GridAccess.cellAt(result, Row.of(1), Col.of(0)))).toBe(true);
    expect(Cell.isWhite(GridAccess.cellAt(result, Row.of(1), Col.of(2)))).toBe(true);
  });

  it('GridAccess.updateCells clones each touched row once; untouched rows keep reference', () => {
    const g = blankGrid(3);
    const updates = [
      { row: Row.of(0), col: Col.of(0), cell: Cell.black() },
      { row: Row.of(2), col: Col.of(2), cell: Cell.black() },
    ];
    const result = GridAccess.updateCells(g, updates);

    expect(result[0]).not.toBe(g[0]);
    expect(result[2]).not.toBe(g[2]);
    expect(result[1]).toBe(g[1]);
  });

  it('GridAccess.updateCells clones the outer grid array once', () => {
    const g = blankGrid(3);
    const updates = [{ row: Row.of(0), col: Col.of(0), cell: Cell.black() }];
    const result = GridAccess.updateCells(g, updates);

    expect(result).not.toBe(g);
  });

  it('GridAccess.updateCells throws RangeError when any update is out-of-bounds', () => {
    const g = blankGrid(3);
    const updates = [
      { row: Row.of(0), col: Col.of(0), cell: Cell.black() },
      { row: Row.of(3), col: Col.of(0), cell: Cell.black() },
    ];

    expect(() => GridAccess.updateCells(g, updates)).toThrow(RangeError);
    expect(g[0]![0]!.black).toBe(false);
  });

  it('GridAccess.updateCells applies multiple updates to the same row in one pass', () => {
    const g = blankGrid(3);
    const updates = [
      { row: Row.of(0), col: Col.of(0), cell: Cell.black() },
      { row: Row.of(0), col: Col.of(2), cell: Cell.black() },
    ];
    const result = GridAccess.updateCells(g, updates);

    expect(GridAccess.cellAt(result, Row.of(0), Col.of(0)).black).toBe(true);
    expect(GridAccess.cellAt(result, Row.of(0), Col.of(2)).black).toBe(true);
    expect(Cell.isWhite(GridAccess.cellAt(result, Row.of(0), Col.of(1)))).toBe(true);
    expect(result[0]).not.toBe(g[0]);

    const extra = GridAccess.updateCells(result, [
      { row: Row.of(0), col: Col.of(1), cell: Cell.black() },
    ]);
    expect(extra[0]).not.toBe(result[0]);
  });
});
