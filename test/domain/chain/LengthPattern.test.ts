import { describe, it, expect } from 'vitest';
import { LengthPattern } from '../../../src/domain/chain/LengthPattern';
import { ChainIndex } from '../../../src/domain/chain/ChainIndex';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { Cell } from '../../../src/domain/grid/Cell';
import { CellMarker } from '../../../src/domain/grid/CellMarker';
import { WordLength } from '../../../src/domain/word/WordLength';
import { Direction } from '../../../src/domain/word/Direction';
import type { Grid } from '../../../src/domain/grid/Grid';
import type { Word } from '../../../src/domain/word/Word';
import type { WordKey } from '../../../src/domain/word/WordKey';
import type { Direction as DirectionType } from '../../../src/domain/word/Direction';

function makeWord(
  row: number,
  col: number,
  direction: DirectionType,
  next: WordKey | null = null,
  length = 2,
  clue = '',
): Word {
  return {
    key: {
      startRow: Row.of(row),
      startCol: Col.of(col),
      direction,
    },
    number: WordNumber.of(1),
    length: WordLength.of(length),
    clue,
    nextWord: next,
  };
}

function buildIndex(words: Word[]) {
  return ChainIndex.build(words);
}

function markerFlag(flag: 'space-right' | 'space-bottom' | 'hyphen-right' | 'hyphen-bottom'): CellMarker {
  const axis = flag.endsWith('right') ? 'right' : 'bottom';
  const separator = flag.startsWith('space') ? 'space' : 'hyphen';
  return CellMarker.write(CellMarker.EMPTY, axis, separator);
}

function applyMarker(grid: Grid, row: number, col: number, marker: CellMarker): Grid {
  const cell = GridOps.cellAt(grid, Row.of(row), Col.of(col));
  return GridOps.setCell(grid, Row.of(row), Col.of(col), Cell.setMarker(cell, marker));
}

function applyBoundaryMarker(grid: Grid, w: Word, flag: 'space-right' | 'space-bottom' | 'hyphen-right' | 'hyphen-bottom'): Grid {
  const end = Direction.advance(
    { row: w.key.startRow, col: w.key.startCol },
    w.key.direction,
    Number(w.length) - 1,
  );
  const cell = GridOps.cellAt(grid, end.row, end.col);
  return GridOps.setCell(grid, end.row, end.col, Cell.setMarker(cell, markerFlag(flag)));
}

describe('LengthPattern', () => {
  it('head word with nextWord null and no markers returns String(length)', () => {
    const grid = GridOps.blank(GridSize.of(5));
    const w = makeWord(0, 0, 'across', null, 5);
    const index = buildIndex([w]);

    expect(LengthPattern.forWord(grid, index, w)).toBe('5');
  });

  it('head word with nextWord null, single space marker between cells 1-2 of 4 returns "2, 2"', () => {
    let grid = GridOps.blank(GridSize.of(5));
    grid = applyMarker(grid, 0, 1, markerFlag('space-right'));
    const w = makeWord(0, 0, 'across', null, 4);
    const index = buildIndex([w]);

    expect(LengthPattern.forWord(grid, index, w)).toBe('2, 2');
  });

  it('head word with nextWord null, single hyphen marker between cells 1-2 of 4 returns "2-2"', () => {
    let grid = GridOps.blank(GridSize.of(5));
    grid = applyMarker(grid, 0, 1, markerFlag('hyphen-right'));
    const w = makeWord(0, 0, 'across', null, 4);
    const index = buildIndex([w]);

    expect(LengthPattern.forWord(grid, index, w)).toBe('2-2');
  });

  it('head word with nextWord null, mixed space and hyphen markers returns "2, 2-2"', () => {
    let grid = GridOps.blank(GridSize.of(6));
    grid = applyMarker(grid, 0, 1, markerFlag('space-right'));
    grid = applyMarker(grid, 0, 3, markerFlag('hyphen-right'));
    const w = makeWord(0, 0, 'across', null, 6);
    const index = buildIndex([w]);

    expect(LengthPattern.forWord(grid, index, w)).toBe('2, 2-2');
  });

  it('across word reads right-axis markers', () => {
    let grid = GridOps.blank(GridSize.of(5));
    const marker = CellMarker.write(
      CellMarker.write(CellMarker.EMPTY, 'right', 'space'),
      'bottom',
      'space',
    );
    grid = applyMarker(grid, 0, 1, marker);
    const w = makeWord(0, 0, 'across', null, 4);
    const index = buildIndex([w]);

    expect(LengthPattern.forWord(grid, index, w)).toBe('2, 2');
  });

  it('down word reads bottom-axis markers', () => {
    let grid = GridOps.blank(GridSize.of(5));
    const marker = CellMarker.write(
      CellMarker.write(CellMarker.EMPTY, 'right', 'space'),
      'bottom',
      'space',
    );
    grid = applyMarker(grid, 1, 1, marker);
    const w = makeWord(0, 1, 'down', null, 4);
    const index = buildIndex([w]);

    expect(LengthPattern.forWord(grid, index, w)).toBe('2, 2');
  });

  it('word with nextWord != null joins separator-aware member patterns with comma+space', () => {
    let grid = GridOps.blank(GridSize.of(7));
    const b = makeWord(1, 1, 'across', null, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    grid = applyBoundaryMarker(grid, a, 'space-right');
    const index = buildIndex([a, b]);

    expect(LengthPattern.forWord(grid, index, a)).toBe('3, 4');
  });

  it('three-deep chain A->B->C returns "lenA, lenB, lenC"', () => {
    let grid = GridOps.blank(GridSize.of(7));
    const c = makeWord(2, 2, 'across', null, 5);
    const b = makeWord(1, 1, 'across', c.key, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    grid = applyBoundaryMarker(grid, a, 'space-right');
    grid = applyBoundaryMarker(grid, b, 'space-right');
    const index = buildIndex([a, b, c]);

    expect(LengthPattern.forWord(grid, index, a)).toBe('3, 4, 5');
  });

  it('forActiveClueBanner returns forWord result when w is a chain head', () => {
    let grid = GridOps.blank(GridSize.of(7));
    const b = makeWord(1, 1, 'across', null, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    grid = applyBoundaryMarker(grid, a, 'space-right');
    const index = buildIndex([a, b]);

    expect(LengthPattern.forActiveClueBanner(grid, index, a)).toBe('3, 4');
  });

  it('forActiveClueBanner returns null when w is a non-head', () => {
    let grid = GridOps.blank(GridSize.of(7));
    const b = makeWord(1, 1, 'across', null, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    grid = applyBoundaryMarker(grid, a, 'space-right');
    const index = buildIndex([a, b]);

    expect(LengthPattern.forActiveClueBanner(grid, index, b)).toBeNull();
  });

  it('forActiveClueBanner returns forWord result for a single-word chain (head with nextWord null)', () => {
    const grid = GridOps.blank(GridSize.of(5));
    const w = makeWord(0, 0, 'across', null, 5);
    const index = buildIndex([w]);

    expect(LengthPattern.forActiveClueBanner(grid, index, w)).toBe('5');
  });

  it('chain head enumeration splits a non-head member on its space marker', () => {
    let grid = GridOps.blank(GridSize.of(9));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyMarker(grid, 2, 1, markerFlag('space-right'));
    grid = applyBoundaryMarker(grid, head, 'space-right');
    grid = applyBoundaryMarker(grid, middle, 'space-right');
    const index = buildIndex([head, middle, tail]);

    expect(LengthPattern.forWord(grid, index, head)).toBe('5, 9, 2, 5');
  });

  it('chain head enumeration splits a non-head member on its hyphen marker', () => {
    let grid = GridOps.blank(GridSize.of(9));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyMarker(grid, 2, 1, markerFlag('hyphen-right'));
    grid = applyBoundaryMarker(grid, head, 'space-right');
    grid = applyBoundaryMarker(grid, middle, 'space-right');
    const index = buildIndex([head, middle, tail]);

    expect(LengthPattern.forWord(grid, index, head)).toBe('5, 9, 2-5');
  });

  it('chain head with markers in two members enumerates each separator-aware', () => {
    let grid = GridOps.blank(GridSize.of(9));
    const middle = makeWord(1, 0, 'across', null, 4);
    const head = makeWord(0, 0, 'across', middle.key, 4);
    grid = applyMarker(grid, 0, 1, markerFlag('space-right'));
    grid = applyMarker(grid, 1, 1, markerFlag('hyphen-right'));
    grid = applyBoundaryMarker(grid, head, 'space-right');
    const index = buildIndex([head, middle]);

    expect(LengthPattern.forWord(grid, index, head)).toBe('2, 2, 2-2');
  });

  it('chain head with a marked head member and plain tail', () => {
    let grid = GridOps.blank(GridSize.of(9));
    const tail = makeWord(1, 0, 'across', null, 5);
    const head = makeWord(0, 0, 'across', tail.key, 4);
    grid = applyMarker(grid, 0, 1, markerFlag('space-right'));
    grid = applyBoundaryMarker(grid, head, 'space-right');
    const index = buildIndex([head, tail]);

    expect(LengthPattern.forWord(grid, index, head)).toBe('2, 2, 5');
  });

  it('forActiveClueBanner returns separator-aware chain pattern for a head with a marked tail', () => {
    let grid = GridOps.blank(GridSize.of(9));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyMarker(grid, 2, 1, markerFlag('space-right'));
    grid = applyBoundaryMarker(grid, head, 'space-right');
    grid = applyBoundaryMarker(grid, middle, 'space-right');
    const index = buildIndex([head, middle, tail]);

    expect(LengthPattern.forActiveClueBanner(grid, index, head)).toBe('5, 9, 2, 5');
  });

  it('chain with hyphen boundary markers renders 5-9-7', () => {
    let grid = GridOps.blank(GridSize.of(11));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyBoundaryMarker(grid, head, 'hyphen-right');
    grid = applyBoundaryMarker(grid, middle, 'hyphen-right');
    const index = buildIndex([head, middle, tail]);

    expect(LengthPattern.forWord(grid, index, head)).toBe('5-9-7');
  });

  it('chain with empty boundary markers merges member lengths into 21', () => {
    const grid = GridOps.blank(GridSize.of(11));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    const index = buildIndex([head, middle, tail]);

    expect(LengthPattern.forWord(grid, index, head)).toBe('21');
  });

  it('chain with mixed boundaries renders 5, 9-7', () => {
    let grid = GridOps.blank(GridSize.of(11));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyBoundaryMarker(grid, head, 'space-right');
    grid = applyBoundaryMarker(grid, middle, 'hyphen-right');
    const index = buildIndex([head, middle, tail]);

    expect(LengthPattern.forWord(grid, index, head)).toBe('5, 9-7');
  });

  it('none boundary merges the run into the next member\'s internal space split (7, 7, 7)', () => {
    let grid = GridOps.blank(GridSize.of(11));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyMarker(grid, 1, 1, markerFlag('space-right'));
    grid = applyBoundaryMarker(grid, middle, 'space-right');
    const index = buildIndex([head, middle, tail]);

    expect(LengthPattern.forWord(grid, index, head)).toBe('7, 7, 7');
  });

  it('boundary marker on a down-word member reads the bottom pair', () => {
    let grid = GridOps.blank(GridSize.of(7));
    const tail = makeWord(0, 1, 'down', null, 5);
    const head = makeWord(0, 0, 'down', tail.key, 5);
    grid = applyBoundaryMarker(grid, head, 'space-bottom');
    const index = buildIndex([head, tail]);

    expect(LengthPattern.forWord(grid, index, head)).toBe('5, 5');
  });
});
