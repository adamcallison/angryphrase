import { describe, expect, it } from 'vitest';
import { Cell } from '../../../src/domain/grid/Cell';
import { Col } from '../../../src/domain/grid/Col';
import type { Grid } from '../../../src/domain/grid/Grid';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Row } from '../../../src/domain/grid/Row';
import type { Direction } from '../../../src/domain/word/Direction';
import type { DerivedWord } from '../../../src/domain/word/DerivedWord';
import type { Word } from '../../../src/domain/word/Word';
import { Numbering } from '../../../src/domain/word/Numbering';

describe('Numbering', () => {
  function blank(size: number): Grid {
    return GridOps.blank(GridSize.of(size));
  }

  function blackAt(g: Grid, r: number, c: number): Grid {
    return GridOps.setCell(g, Row.of(r), Col.of(c), Cell.black());
  }

  function makeUnnumberedWord(
    row: number,
    col: number,
    direction: Direction,
    length: number
  ): DerivedWord {
    return {
      key: { startRow: Row.of(row), startCol: Col.of(col), direction },
      length,
      clue: '',
      nextWord: null,
    };
  }

  function wordNumberOf(w: Word): number {
    return Number(w.number);
  }

  it('Numbering.assign returns empty array for empty words', () => {
    const grid = blank(3);
    const result = Numbering.assign(grid, []);
    expect(result).toEqual([]);
  });

  it('Numbering.assign assigns 1 to the first word in row-major order', () => {
    const grid = blank(3);
    const words: DerivedWord[] = [
      makeUnnumberedWord(0, 1, 'down', 3),
      makeUnnumberedWord(0, 0, 'across', 3),
    ];

    const result = Numbering.assign(grid, words);

    expect(result).toHaveLength(2);
    expect(wordNumberOf(result[0]!)).toBe(1);
    expect(result[0]!.key.direction).toBe('across');
    expect(wordNumberOf(result[1]!)).toBe(2);
    expect(result[1]!.key.direction).toBe('down');
  });

  it('Numbering.assign assigns the same number to an across and down word sharing a start cell', () => {
    const grid = blank(3);
    const words: DerivedWord[] = [
      makeUnnumberedWord(0, 0, 'across', 3),
      makeUnnumberedWord(0, 0, 'down', 3),
      makeUnnumberedWord(0, 1, 'down', 3),
      makeUnnumberedWord(0, 2, 'down', 3),
      makeUnnumberedWord(1, 0, 'across', 3),
      makeUnnumberedWord(2, 0, 'across', 3),
    ];

    const result = Numbering.assign(grid, words);

    expect(result).toHaveLength(6);

    const across00 = result.find((w) => w.key.direction === 'across' && Number(w.key.startRow) === 0 && Number(w.key.startCol) === 0);
    const down00 = result.find((w) => w.key.direction === 'down' && Number(w.key.startRow) === 0 && Number(w.key.startCol) === 0);
    expect(across00).toBeDefined();
    expect(down00).toBeDefined();
    expect(wordNumberOf(across00!)).toBe(1);
    expect(wordNumberOf(down00!)).toBe(1);

    expect(wordNumberOf(result[0]!)).toBe(1);
    expect(wordNumberOf(result[1]!)).toBe(1);
    expect(wordNumberOf(result[2]!)).toBe(2);
    expect(wordNumberOf(result[3]!)).toBe(3);
    expect(wordNumberOf(result[4]!)).toBe(4);
    expect(wordNumberOf(result[5]!)).toBe(5);

    expect(result[0]!.key.direction).toBe('across');
    expect(result[1]!.key.direction).toBe('down');
  });

  it('Numbering.assign increments counter only at start cells, not at every white cell', () => {
    let grid = blank(5);
    grid = blackAt(grid, 2, 1);
    grid = blackAt(grid, 2, 2);
    grid = blackAt(grid, 0, 2);

    const words: DerivedWord[] = [
      makeUnnumberedWord(0, 0, 'across', 5),
      makeUnnumberedWord(2, 0, 'across', 3),
      makeUnnumberedWord(0, 2, 'down', 4),
    ];

    const result = Numbering.assign(grid, words);

    expect(result).toHaveLength(3);
    expect(wordNumberOf(result[0]!)).toBe(1);
    expect(result[0]!.key.direction).toBe('across');
    expect(wordNumberOf(result[1]!)).toBe(2);
    expect(result[1]!.key.direction).toBe('down');
    expect(wordNumberOf(result[2]!)).toBe(3);
    expect(result[2]!.key.direction).toBe('across');
  });

  it('Numbering.assign returns words sorted by (startRow, startCol, across-before-down)', () => {
    const grid = blank(3);
    const words: DerivedWord[] = [
      makeUnnumberedWord(2, 0, 'across', 3),
      makeUnnumberedWord(0, 0, 'down', 3),
      makeUnnumberedWord(0, 0, 'across', 3),
      makeUnnumberedWord(1, 0, 'down', 3),
    ];

    const result = Numbering.assign(grid, words);

    expect(result).toHaveLength(4);
    expect(result[0]!.key).toEqual({ startRow: Row.of(0), startCol: Col.of(0), direction: 'across' });
    expect(result[1]!.key).toEqual({ startRow: Row.of(0), startCol: Col.of(0), direction: 'down' });
    expect(result[2]!.key).toEqual({ startRow: Row.of(1), startCol: Col.of(0), direction: 'down' });
    expect(result[3]!.key).toEqual({ startRow: Row.of(2), startCol: Col.of(0), direction: 'across' });
  });

  it('Numbering.assign preserves other Word fields (length, clue, nextWord)', () => {
    const grid = blank(3);
    const nextKey = { startRow: Row.of(0), startCol: Col.of(1), direction: 'across' as Direction };
    const words: DerivedWord[] = [
      {
        key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
        length: 3,
        clue: 'sample clue',
        nextWord: nextKey,
      },
    ];

    const result = Numbering.assign(grid, words);

    expect(result).toHaveLength(1);
    expect(result[0]!.length).toBe(3);
    expect(result[0]!.clue).toBe('sample clue');
    expect(result[0]!.nextWord).toEqual(nextKey);
    expect(wordNumberOf(result[0]!)).toBe(1);
  });

  it('Numbering.assign overwrites any existing number with the re-derived value (FR-98a)', () => {
    const grid = blank(3);
    const words: DerivedWord[] = [
      makeUnnumberedWord(0, 0, 'across', 3),
      makeUnnumberedWord(0, 1, 'down', 3),
    ];

    const result = Numbering.assign(grid, words);

    expect(result).toHaveLength(2);
    expect(wordNumberOf(result[0]!)).toBe(1);
    expect(wordNumberOf(result[1]!)).toBe(2);
  });

  it('Numbering.assign handles a complex grid with many words', () => {
    let grid = blank(5);
    grid = blackAt(grid, 0, 3);
    grid = blackAt(grid, 1, 3);
    grid = blackAt(grid, 2, 1);
    grid = blackAt(grid, 3, 4);
    grid = blackAt(grid, 4, 2);

    const words: DerivedWord[] = [
      makeUnnumberedWord(0, 0, 'across', 3),
      makeUnnumberedWord(0, 0, 'down', 4),
      makeUnnumberedWord(0, 1, 'down', 5),
      makeUnnumberedWord(0, 2, 'down', 2),
      makeUnnumberedWord(0, 4, 'down', 5),
      makeUnnumberedWord(2, 0, 'across', 5),
      makeUnnumberedWord(3, 0, 'across', 4),
      makeUnnumberedWord(4, 0, 'across', 2),
    ];

    const result = Numbering.assign(grid, words);

    expect(result).toHaveLength(8);

    const numbers = result.map(wordNumberOf);
    expect(numbers).toEqual([1, 1, 2, 3, 4, 5, 6, 7]);

    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i]!;
      const b = result[i + 1]!;
      const aRow = Number(a.key.startRow);
      const aCol = Number(a.key.startCol);
      const bRow = Number(b.key.startRow);
      const bCol = Number(b.key.startCol);

      const cellOrder = aRow < bRow || (aRow === bRow && aCol < bCol);
      const sameCellAcrossBeforeDown =
        aRow === bRow &&
        aCol === bCol &&
        a.key.direction === 'across' &&
        b.key.direction === 'down';

      expect(cellOrder || sameCellAcrossBeforeDown || (aRow === bRow && aCol === bCol)).toBe(true);
      if (aRow === bRow && aCol === bCol) {
        expect(a.key.direction).toBe('across');
        expect(b.key.direction).toBe('down');
      }
    }
  });

});
