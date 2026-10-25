import { describe, expect, it } from 'vitest';
import { Cell } from '../../../src/domain/grid/Cell';
import type { Cell as CellType } from '../../../src/domain/grid/Cell';
import { Col } from '../../../src/domain/grid/Col';
import type { Cursor } from '../../../src/domain/grid/Cursor';
import { GridInteraction, type LetterSlot } from '../../../src/domain/grid/GridInteraction';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Letter } from '../../../src/domain/letter/Letter';
import { Row } from '../../../src/domain/grid/Row';
import type { Grid } from '../../../src/domain/grid/Grid';

describe('GridInteraction', () => {
  function blankGrid(size: number): Grid {
    return GridOps.blank(GridSize.of(size));
  }

  function setCell(g: Grid, row: number, col: number, cell: CellType): Grid {
    return GridOps.setCell(g, Row.of(row), Col.of(col), cell);
  }

  function setBlack(g: Grid, row: number, col: number): Grid {
    return setCell(g, row, col, Cell.black());
  }

  const cursorAt = (row: number, col: number, direction: 'across' | 'down'): Cursor => ({
    row: Row.of(row),
    col: Col.of(col),
    direction,
  });

  const answerSlot: LetterSlot = {
    read: (c) => c.answerLetter,
    set: (c, l) => Cell.setAnswerLetter(c, l),
  };

  const playerSlot: LetterSlot = {
    read: (c) => c.playerLetter,
    set: (c, l) => Cell.setPlayerLetter(c, l),
  };

  const slots = [
    { label: 'answerLetter', slot: answerSlot },
    { label: 'playerLetter', slot: playerSlot },
  ] as const;

  describe('select', () => {
    it('returns null when target is out of bounds', () => {
      const grid = blankGrid(3);
      const cursor = cursorAt(0, 0, 'across');
      expect(GridInteraction.select(grid, cursor, Row.of(5), Col.of(0))).toBeNull();
    });

    it('returns null when target is black', () => {
      const grid = setBlack(blankGrid(3), 1, 1);
      const cursor = cursorAt(0, 0, 'across');
      expect(GridInteraction.select(grid, cursor, Row.of(1), Col.of(1))).toBeNull();
    });

    it('returns null when target is white but unselectable', () => {
      // 3x3 grid: centre white, all four neighbours black (isolated singleton).
      let grid = blankGrid(3);
      grid = setBlack(grid, 0, 1);
      grid = setBlack(grid, 1, 0);
      grid = setBlack(grid, 1, 2);
      grid = setBlack(grid, 2, 1);
      const cursor = cursorAt(0, 0, 'across');
      expect(GridInteraction.select(grid, cursor, Row.of(1), Col.of(1))).toBeNull();
    });

    it('selects across when new cell is part of both directions', () => {
      const grid = blankGrid(3);
      const cursor = cursorAt(0, 0, 'across');
      const next = GridInteraction.select(grid, cursor, Row.of(1), Col.of(1));
      expect(next).toEqual({ row: Row.of(1), col: Col.of(1), direction: 'across' });
    });

    it('selects across when new cell is across-only', () => {
      let grid = blankGrid(3);
      grid = setBlack(grid, 0, 1);
      grid = setBlack(grid, 2, 1);
      const cursor = cursorAt(0, 0, 'down');
      const next = GridInteraction.select(grid, cursor, Row.of(1), Col.of(1));
      expect(next).toEqual({ row: Row.of(1), col: Col.of(1), direction: 'across' });
    });

    it('selects down when new cell is down-only', () => {
      let grid = blankGrid(3);
      grid = setBlack(grid, 1, 0);
      grid = setBlack(grid, 1, 2);
      const cursor = cursorAt(0, 0, 'across');
      const next = GridInteraction.select(grid, cursor, Row.of(1), Col.of(1));
      expect(next).toEqual({ row: Row.of(1), col: Col.of(1), direction: 'down' });
    });

    it('toggles direction on same-cell reselect when both directions available', () => {
      const grid = blankGrid(3);
      const cursor = cursorAt(1, 1, 'across');
      const first = GridInteraction.select(grid, cursor, Row.of(1), Col.of(1));
      expect(first).toEqual({ row: Row.of(1), col: Col.of(1), direction: 'down' });

      const second = GridInteraction.select(grid, first, Row.of(1), Col.of(1));
      expect(second).toEqual({ row: Row.of(1), col: Col.of(1), direction: 'across' });
    });

    it('returns null on same-cell reselect when only one direction is available', () => {
      let grid = blankGrid(3);
      grid = setBlack(grid, 0, 1);
      grid = setBlack(grid, 2, 1);
      const cursor = cursorAt(1, 1, 'across');
      expect(GridInteraction.select(grid, cursor, Row.of(1), Col.of(1))).toBeNull();
    });

    it('does not mutate the input cursor', () => {
      const grid = blankGrid(3);
      const cursor = cursorAt(1, 1, 'across');
      const original = { ...cursor };
      GridInteraction.select(grid, cursor, Row.of(2), Col.of(2));
      expect(cursor).toEqual(original);
    });
  });

  describe('move', () => {
    it('advances cursor in-bounds to a selectable cell', () => {
      const grid = blankGrid(5);
      const cursor = cursorAt(1, 1, 'across');
      const next = GridInteraction.move(grid, cursor, 'across', 1);
      expect(next).toEqual({ row: Row.of(1), col: Col.of(2), direction: 'across' });
    });

    it('advances cursor down to a selectable cell', () => {
      const grid = blankGrid(5);
      const cursor = cursorAt(1, 1, 'down');
      const next = GridInteraction.move(grid, cursor, 'down', 1);
      expect(next).toEqual({ row: Row.of(2), col: Col.of(1), direction: 'down' });
    });

    it('clamps at the edge by changing only direction', () => {
      const grid = blankGrid(5);
      const cursor = cursorAt(0, 0, 'across');
      const next = GridInteraction.move(grid, cursor, 'across', -1);
      expect(next).toEqual({ row: Row.of(0), col: Col.of(0), direction: 'across' });
      expect(next).not.toBe(cursor);
    });

    it('returns null when input cursor is null', () => {
      const grid = blankGrid(5);
      expect(GridInteraction.move(grid, null, 'across', 1)).toBeNull();
    });

    it('does not mutate the input cursor', () => {
      const grid = blankGrid(5);
      const cursor = cursorAt(0, 0, 'across');
      const original = { ...cursor };
      GridInteraction.move(grid, cursor, 'across', -1);
      expect(cursor).toEqual(original);
    });
  });

  for (const { label, slot } of slots) {
    describe(`typeLetter (${label})`, () => {
      it('writes the letter via the slot and advances the cursor', () => {
        const grid = blankGrid(5);
        const cursor = cursorAt(0, 0, 'across');
        const letter = Letter.try('A')!;
        const outcome = GridInteraction.typeLetter(grid, cursor, letter, slot);

        expect(outcome).not.toBeNull();
        expect(slot.read(GridOps.cellAt(outcome!.grid, Row.of(0), Col.of(0)))).toBe(letter);
        expect(outcome!.cursor).toEqual({ row: Row.of(0), col: Col.of(1), direction: 'across' });
      });

      it('keeps cursor unchanged when advance is blocked at the edge', () => {
        const grid = blankGrid(5);
        const cursor = cursorAt(0, 4, 'across');
        const letter = Letter.try('Z')!;
        const outcome = GridInteraction.typeLetter(grid, cursor, letter, slot);

        expect(outcome).not.toBeNull();
        expect(slot.read(GridOps.cellAt(outcome!.grid, Row.of(0), Col.of(4)))).toBe(letter);
        expect(outcome!.cursor).toBe(cursor);
      });

      it('returns null when the current cell is black', () => {
        const grid = setBlack(blankGrid(5), 1, 1);
        const cursor = cursorAt(1, 1, 'across');
        const letter = Letter.try('A')!;
        expect(GridInteraction.typeLetter(grid, cursor, letter, slot)).toBeNull();
      });

      it('returns null when input cursor is null', () => {
        const grid = blankGrid(5);
        const letter = Letter.try('A')!;
        expect(GridInteraction.typeLetter(grid, null, letter, slot)).toBeNull();
      });

      it('does not mutate the input grid or cursor', () => {
        const grid = blankGrid(5);
        const cursor = cursorAt(0, 0, 'across');
        const letter = Letter.try('A')!;
        const gridBefore = structuredClone(grid);
        const cursorBefore = { ...cursor };
        const outcome = GridInteraction.typeLetter(grid, cursor, letter, slot);

        expect(grid).toEqual(gridBefore);
        expect(grid).not.toBe(outcome!.grid);
        expect(cursor).toEqual(cursorBefore);
      });
    });

    describe(`backspace (${label})`, () => {
      it('clears the current cell letter and leaves cursor unchanged', () => {
        let grid = blankGrid(5);
        const letter = Letter.try('B')!;
        grid = setCell(grid, 1, 1, slot.set(GridOps.cellAt(grid, Row.of(1), Col.of(1)), letter));
        const cursor = cursorAt(1, 1, 'across');
        const outcome = GridInteraction.backspace(grid, cursor, slot);

        expect(outcome).not.toBeNull();
        expect(slot.read(GridOps.cellAt(outcome!.grid, Row.of(1), Col.of(1)))).toBeNull();
        expect(outcome!.cursor).toBe(cursor);
      });

      it('retreats and clears the previous cell when current cell is empty', () => {
        let grid = blankGrid(5);
        const letter = Letter.try('C')!;
        grid = setCell(grid, 1, 0, slot.set(GridOps.cellAt(grid, Row.of(1), Col.of(0)), letter));
        const cursor = cursorAt(1, 1, 'across');
        const outcome = GridInteraction.backspace(grid, cursor, slot);

        expect(outcome).not.toBeNull();
        expect(slot.read(GridOps.cellAt(outcome!.grid, Row.of(1), Col.of(0)))).toBeNull();
        expect(outcome!.cursor).toEqual({ row: Row.of(1), col: Col.of(0), direction: 'across' });
      });

      it('returns null when retreat is blocked at the edge', () => {
        const grid = blankGrid(5);
        const cursor = cursorAt(0, 0, 'across');
        expect(GridInteraction.backspace(grid, cursor, slot)).toBeNull();
      });

      it('returns null when retreat target is black', () => {
        let grid = blankGrid(5);
        grid = setBlack(grid, 1, 0);
        const cursor = cursorAt(1, 1, 'across');
        expect(GridInteraction.backspace(grid, cursor, slot)).toBeNull();
      });

      it('returns null when the current cell is black', () => {
        const grid = setBlack(blankGrid(5), 1, 1);
        const cursor = cursorAt(1, 1, 'across');
        expect(GridInteraction.backspace(grid, cursor, slot)).toBeNull();
      });

      it('returns null when input cursor is null', () => {
        const grid = blankGrid(5);
        expect(GridInteraction.backspace(grid, null, slot)).toBeNull();
      });

      it('does not mutate the input grid or cursor', () => {
        let grid = blankGrid(5);
        const letter = Letter.try('D')!;
        grid = setCell(grid, 1, 1, slot.set(GridOps.cellAt(grid, Row.of(1), Col.of(1)), letter));
        const cursor = cursorAt(1, 1, 'across');
        const gridBefore = structuredClone(grid);
        const cursorBefore = { ...cursor };
        const outcome = GridInteraction.backspace(grid, cursor, slot);

        expect(grid).toEqual(gridBefore);
        expect(grid).not.toBe(outcome!.grid);
        expect(cursor).toEqual(cursorBefore);
      });
    });
  }
});
