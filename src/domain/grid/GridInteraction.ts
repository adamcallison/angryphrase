import type { Grid } from './Grid';
import type { Row } from './Row';
import type { Col } from './Col';
import type { Cursor } from './Cursor';
import type { Direction } from '../word/Direction';
import type { Letter } from '../letter/Letter';
import type { WordKey } from '../word/WordKey';
import { GridOps } from './GridOps';
import { Cell } from './Cell';
import { Row as RowCtor } from './Row';
import { Col as ColCtor } from './Col';

export type SelectCellIntent = { kind: 'select-cell'; row: Row; col: Col };
export type MoveCursorIntent = { kind: 'move-cursor'; direction: Direction; sign: -1 | 1 };
export type TypeLetterIntent = { kind: 'type-letter'; letter: Letter };
export type BackspaceIntent = { kind: 'backspace' };
export type EscapeIntent = { kind: 'escape' };
export type ClickCluePanelWordIntent = { kind: 'click-clue-panel-word'; wordKey: WordKey };
export type GridInteractionIntent =
  | SelectCellIntent
  | MoveCursorIntent
  | TypeLetterIntent
  | BackspaceIntent
  | EscapeIntent
  | ClickCluePanelWordIntent;

export type LetterSlot = {
  read: (cell: Cell) => Letter | null;
  set: (cell: Cell, letter: Letter | null) => Cell;
};

export type WriteOutcome = { grid: Grid; cursor: Cursor };

const DELTA: Record<Direction, { dr: number; dc: number }> = {
  across: { dr: 0, dc: 1 },
  down: { dr: 1, dc: 0 },
};

function hasWhiteNeighbour(
  g: Grid,
  row: Row,
  col: Col,
  dr: number,
  dc: number,
): boolean {
  const r = Number(row) + dr;
  const c = Number(col) + dc;
  if (r < 0 || c < 0) {
    return false;
  }

  const neighbourRow = RowCtor.try(r);
  const neighbourCol = ColCtor.try(c);
  if (
    neighbourRow === null ||
    neighbourCol === null ||
    !GridOps.withinBounds(g, neighbourRow, neighbourCol)
  ) {
    return false;
  }

  return Cell.isWhite(GridOps.cellAt(g, neighbourRow, neighbourCol));
}

function partOfAcross(g: Grid, row: Row, col: Col): boolean {
  return hasWhiteNeighbour(g, row, col, 0, -1) || hasWhiteNeighbour(g, row, col, 0, 1);
}

function partOfDown(g: Grid, row: Row, col: Col): boolean {
  return hasWhiteNeighbour(g, row, col, -1, 0) || hasWhiteNeighbour(g, row, col, 1, 0);
}

export const GridInteraction: {
  select(grid: Grid, cursor: Cursor, row: Row, col: Col): Cursor | null;
  move(grid: Grid, cursor: Cursor, direction: Direction, sign: -1 | 1): Cursor;
  typeLetter(grid: Grid, cursor: Cursor, letter: Letter, slot: LetterSlot): WriteOutcome | null;
  backspace(grid: Grid, cursor: Cursor, slot: LetterSlot): WriteOutcome | null;
} = {
  select(grid: Grid, cursor: Cursor, row: Row, col: Col): Cursor | null {
    if (!GridOps.withinBounds(grid, row, col)) {
      return null;
    }

    if (!GridOps.isSelectable(grid, row, col)) {
      return null;
    }

    const inAcross = partOfAcross(grid, row, col);
    const inDown = partOfDown(grid, row, col);

    const sameCell =
      cursor !== null &&
      Number(cursor.row) === Number(row) &&
      Number(cursor.col) === Number(col);

    let direction: Direction;
    if (sameCell) {
      if (cursor === null) return null; // unreachable: sameCell implies cursor !== null
      if (inAcross && inDown) {
        direction = cursor.direction === 'across' ? 'down' : 'across';
      } else {
        return null;
      }
    } else {
      direction = inAcross && inDown ? 'across' : inAcross ? 'across' : 'down';
    }

    return { row, col, direction };
  },

  move(grid: Grid, cursor: Cursor, direction: Direction, sign: -1 | 1): Cursor {
    if (cursor === null) {
      return null;
    }

    const { dr, dc } = DELTA[direction];
    const signedDr = dr * sign;
    const signedDc = dc * sign;
    const newRow = RowCtor.try(Number(cursor.row) + signedDr);
    const newCol = ColCtor.try(Number(cursor.col) + signedDc);

    if (
      newRow !== null &&
      newCol !== null &&
      GridOps.withinBounds(grid, newRow, newCol) &&
      GridOps.isSelectable(grid, newRow, newCol)
    ) {
      return { row: newRow, col: newCol, direction };
    }

    return { ...cursor, direction };
  },

  typeLetter(
    grid: Grid,
    cursor: Cursor,
    letter: Letter,
    slot: LetterSlot,
  ): WriteOutcome | null {
    if (cursor === null) {
      return null;
    }

    const cell = GridOps.cellAt(grid, cursor.row, cursor.col);
    if (cell.black) {
      return null;
    }

    const newCell = slot.set(cell, letter);
    const newGrid = GridOps.setCell(grid, cursor.row, cursor.col, newCell);

    const { dr, dc } = DELTA[cursor.direction];
    const nextRow = RowCtor.of(Number(cursor.row) + dr);
    const nextCol = ColCtor.of(Number(cursor.col) + dc);
    let nextCursor: Cursor = cursor;
    if (
      GridOps.withinBounds(newGrid, nextRow, nextCol) &&
      GridOps.isSelectable(newGrid, nextRow, nextCol)
    ) {
      nextCursor = { row: nextRow, col: nextCol, direction: cursor.direction };
    }

    return { grid: newGrid, cursor: nextCursor };
  },

  backspace(grid: Grid, cursor: Cursor, slot: LetterSlot): WriteOutcome | null {
    if (cursor === null) {
      return null;
    }

    const cell = GridOps.cellAt(grid, cursor.row, cursor.col);
    if (cell.black) {
      return null;
    }

    if (slot.read(cell) !== null) {
      const newGrid = GridOps.setCell(
        grid,
        cursor.row,
        cursor.col,
        slot.set(cell, null),
      );
      return { grid: newGrid, cursor };
    }

    const { dr, dc } = DELTA[cursor.direction];
    const prevRow = RowCtor.try(Number(cursor.row) - dr);
    const prevCol = ColCtor.try(Number(cursor.col) - dc);

    if (
      prevRow === null ||
      prevCol === null ||
      !GridOps.withinBounds(grid, prevRow, prevCol)
    ) {
      return null;
    }

    if (!GridOps.isSelectable(grid, prevRow, prevCol)) {
      return null;
    }

    const prevCell = GridOps.cellAt(grid, prevRow, prevCol);
    const newGrid = GridOps.setCell(grid, prevRow, prevCol, slot.set(prevCell, null));
    return { grid: newGrid, cursor: { row: prevRow, col: prevCol, direction: cursor.direction } };
  },
};
