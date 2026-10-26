import type { Grid } from './Grid';
import type { Row } from './Row';
import type { Col } from './Col';
import type { Cursor } from './Cursor';
import type { Direction } from '../word/Direction';
import type { Letter } from '../letter/Letter';
import type { WordKey } from '../word/WordKey';
import { GridAccess } from './GridAccess';
import { WordTopology } from './WordTopology';
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

export const GridInteraction: {
  select(grid: Grid, cursor: Cursor, row: Row, col: Col): Cursor | null;
  move(grid: Grid, cursor: Cursor, direction: Direction, sign: -1 | 1): Cursor;
  typeLetter(grid: Grid, cursor: Cursor, letter: Letter, slot: LetterSlot): WriteOutcome | null;
  backspace(grid: Grid, cursor: Cursor, slot: LetterSlot): WriteOutcome | null;
} = {
  select(grid: Grid, cursor: Cursor, row: Row, col: Col): Cursor | null {
    const inAcross = WordTopology.partOfRun(grid, row, col, 'across');
    const inDown = WordTopology.partOfRun(grid, row, col, 'down');

    if (!inAcross && !inDown) {
      return null;
    }

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
      GridAccess.withinBounds(grid, newRow, newCol) &&
      WordTopology.isSelectable(grid, newRow, newCol)
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

    const cell = GridAccess.cellAt(grid, cursor.row, cursor.col);
    if (cell.black) {
      return null;
    }

    const newCell = slot.set(cell, letter);
    const newGrid = GridAccess.setCell(grid, cursor.row, cursor.col, newCell);

    const { dr, dc } = DELTA[cursor.direction];
    const nextRow = RowCtor.of(Number(cursor.row) + dr);
    const nextCol = ColCtor.of(Number(cursor.col) + dc);
    let nextCursor: Cursor = cursor;
    if (
      GridAccess.withinBounds(newGrid, nextRow, nextCol) &&
      WordTopology.isSelectable(newGrid, nextRow, nextCol)
    ) {
      nextCursor = { row: nextRow, col: nextCol, direction: cursor.direction };
    }

    return { grid: newGrid, cursor: nextCursor };
  },

  backspace(grid: Grid, cursor: Cursor, slot: LetterSlot): WriteOutcome | null {
    if (cursor === null) {
      return null;
    }

    const cell = GridAccess.cellAt(grid, cursor.row, cursor.col);
    if (cell.black) {
      return null;
    }

    if (slot.read(cell) !== null) {
      const newGrid = GridAccess.setCell(
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
      !GridAccess.withinBounds(grid, prevRow, prevCol)
    ) {
      return null;
    }

    if (!WordTopology.isSelectable(grid, prevRow, prevCol)) {
      return null;
    }

    const prevCell = GridAccess.cellAt(grid, prevRow, prevCol);
    const newGrid = GridAccess.setCell(grid, prevRow, prevCol, slot.set(prevCell, null));
    return { grid: newGrid, cursor: { row: prevRow, col: prevCol, direction: cursor.direction } };
  },
};
