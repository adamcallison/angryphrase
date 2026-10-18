import type { Grid } from './Grid';
import type { Row } from './Row';
import type { Col } from './Col';
import type { GridSize } from './GridSize';
import type { Cell } from './Cell';
import type { Direction } from '../word/Direction';
import { Cell as CellCtor } from './Cell';
import { Row as RowCtor } from './Row';
import { Col as ColCtor } from './Col';
import { GridAccess } from './GridAccess';
import { WordTopology } from './WordTopology';

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
        GridAccess.withinBounds(g, candidateRow, candidateCol)
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
      !GridAccess.withinBounds(g, nextR, nextC)
    ) {
      return null;
    }
    return { row: nextR, col: nextC };
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
          cellA.marker.right !== cellB.marker.right ||
          cellA.marker.bottom !== cellB.marker.bottom
        ) {
          return false;
        }
      }
    }

    return true;
  },
};
