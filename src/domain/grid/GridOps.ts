import type { Grid } from './Grid';
import type { Row } from './Row';
import type { Col } from './Col';
import type { GridSize } from './GridSize';
import type { Cell } from './Cell';
import type { Direction } from '../word/Direction';
import { Cell as CellCtor } from './Cell';
import { Row as RowCtor } from './Row';
import { Col as ColCtor } from './Col';

function outOfBoundsMessage(g: Grid, row: Row, col: Col): string {
  return `cellAt out of bounds: row=${row} col=${col} size=${g.length}`;
}

export const GridOps: {
  blank(size: GridSize): Grid;
  cellAt(g: Grid, row: Row, col: Col): Cell;
  setCell(g: Grid, row: Row, col: Col, c: Cell): Grid;
  updateCells(g: Grid, updates: ReadonlyArray<{ row: Row; col: Col; cell: Cell }>): Grid;
  withinBounds(g: Grid, row: Row, col: Col): boolean;
  neighbours(g: Grid, row: Row, col: Col): { row: Row; col: Col }[];
  neighboursInDirection(g: Grid, row: Row, col: Col, d: Direction): { row: Row; col: Col } | null;
  isSelectable(g: Grid, row: Row, col: Col): boolean;
  clone(g: Grid): Grid;
  equals(a: Grid, b: Grid): boolean;
} = {
  blank(size: GridSize): Grid {
    const n = Number(size);
    return Array.from({ length: n }, () =>
      Array.from({ length: n }, () => CellCtor.white())
    );
  },

  cellAt(g: Grid, row: Row, col: Col): Cell {
    if (!GridOps.withinBounds(g, row, col)) {
      throw new RangeError(outOfBoundsMessage(g, row, col));
    }
    return g[Number(row)]![Number(col)]!;
  },

  setCell(g: Grid, row: Row, col: Col, c: Cell): Grid {
    if (!GridOps.withinBounds(g, row, col)) {
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
      if (!GridOps.withinBounds(g, u.row, u.col)) {
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
    return (
      r >= 0 &&
      c >= 0 &&
      r < g.length &&
      c < (g[r]?.length ?? -1)
    );
  },

  neighbours(g: Grid, row: Row, col: Col): { row: Row; col: Col }[] {
    const r = Number(row);
    const c = Number(col);
    const candidates: { row: number; col: number }[] = [
      { row: r - 1, col: c }, // top
      { row: r, col: c + 1 }, // right
      { row: r + 1, col: c }, // bottom
      { row: r, col: c - 1 }, // left
    ];

    const result: { row: Row; col: Col }[] = [];
    for (const candidate of candidates) {
      const candidateRow = RowCtor.try(candidate.row);
      const candidateCol = ColCtor.try(candidate.col);
      if (
        candidateRow !== null &&
        candidateCol !== null &&
        GridOps.withinBounds(g, candidateRow, candidateCol)
      ) {
        result.push({ row: candidateRow, col: candidateCol });
      }
    }
    return result;
  },

  neighboursInDirection(
    g: Grid,
    row: Row,
    col: Col,
    d: Direction
  ): { row: Row; col: Col } | null {
    const r = Number(row);
    const c = Number(col);
    const nextRow = d === 'down' ? r + 1 : r;
    const nextCol = d === 'across' ? c + 1 : c;

    const nextR = RowCtor.try(nextRow);
    const nextC = ColCtor.try(nextCol);
    if (
      nextR === null ||
      nextC === null ||
      !GridOps.withinBounds(g, nextR, nextC)
    ) {
      return null;
    }
    return { row: nextR, col: nextC };
  },

  isSelectable(g: Grid, row: Row, col: Col): boolean {
    if (!GridOps.withinBounds(g, row, col)) {
      return false;
    }
    const cell = GridOps.cellAt(g, row, col);
    if (!CellCtor.isWhite(cell)) {
      return false;
    }

    const r = Number(row);
    const c = Number(col);
    const size = g.length;

    // Count consecutive white cells to the left and right (across run).
    let left = 0;
    let j = c - 1;
    while (j >= 0 && CellCtor.isWhite(g[r]![j]!)) {
      left++;
      j--;
    }

    let right = 0;
    j = c + 1;
    while (j < size && CellCtor.isWhite(g[r]![j]!)) {
      right++;
      j++;
    }

    if (left + 1 + right >= 2) {
      return true;
    }

    // Count consecutive white cells upward and downward (down run).
    let up = 0;
    let i = r - 1;
    while (i >= 0 && CellCtor.isWhite(g[i]![c]!)) {
      up++;
      i--;
    }

    let down = 0;
    i = r + 1;
    while (i < size && CellCtor.isWhite(g[i]![c]!)) {
      down++;
      i++;
    }

    return up + 1 + down >= 2;
  },

  clone(g: Grid): Grid {
    return g.map((row) =>
      row.map((cell) => ({ ...cell, marker: { ...cell.marker } }))
    );
  },

  equals(a: Grid, b: Grid): boolean {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      const rowA = a[i]!;
      const rowB = b[i]!;
      if (rowA.length !== rowB.length) {
        return false;
      }

      for (let j = 0; j < rowA.length; j++) {
        const cellA = rowA[j]!;
        const cellB = rowB[j]!;
        if (
          cellA.black !== cellB.black ||
          cellA.answerLetter !== cellB.answerLetter ||
          cellA.playerLetter !== cellB.playerLetter ||
          cellA.marker.spaceRight !== cellB.marker.spaceRight ||
          cellA.marker.spaceBottom !== cellB.marker.spaceBottom ||
          cellA.marker.hyphenRight !== cellB.marker.hyphenRight ||
          cellA.marker.hyphenBottom !== cellB.marker.hyphenBottom
        ) {
          return false;
        }
      }
    }

    return true;
  },
};
