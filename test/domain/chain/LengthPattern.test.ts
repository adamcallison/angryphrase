import { describe, it, expect } from 'vitest';
import { LengthPattern } from '../../../src/domain/chain/LengthPattern';
import { WordMap } from '../../../src/domain/word/WordMap';
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
import type { CellMarkerFlag } from '../../../src/domain/grid/CellMarkerFlag';

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

function wordMap(words: Word[]) {
  return WordMap.fromWords(words);
}

function applyMarker(grid: Grid, row: number, col: number, marker: CellMarker): Grid {
  const cell = GridOps.cellAt(grid, Row.of(row), Col.of(col));
  return GridOps.setCell(grid, Row.of(row), Col.of(col), Cell.setMarker(cell, marker));
}

function applyBoundaryMarker(grid: Grid, w: Word, flag: CellMarkerFlag): Grid {
  const end = Direction.advance(
    { row: w.key.startRow, col: w.key.startCol },
    w.key.direction,
    Number(w.length) - 1,
  );
  const cell = GridOps.cellAt(grid, end.row, end.col);
  return GridOps.setCell(grid, end.row, end.col, Cell.setMarker(cell, CellMarker.toggle(cell.marker, flag)));
}

describe('LengthPattern', () => {
  it('head word with nextWord null and no markers returns String(length)', () => {
    const grid = GridOps.blank(GridSize.of(5));
    const w = makeWord(0, 0, 'across', null, 5);
    const words = wordMap([w]);

    expect(LengthPattern.forWord(grid, words, w)).toBe('5');
  });

  it('head word with nextWord null, single space marker between cells 1-2 of 4 returns "2, 2"', () => {
    let grid = GridOps.blank(GridSize.of(5));
    grid = applyMarker(grid, 0, 1, CellMarker.toggle(CellMarker.EMPTY, 'space-right'));
    const w = makeWord(0, 0, 'across', null, 4);
    const words = wordMap([w]);

    expect(LengthPattern.forWord(grid, words, w)).toBe('2, 2');
  });

  it('head word with nextWord null, single hyphen marker between cells 1-2 of 4 returns "2-2"', () => {
    let grid = GridOps.blank(GridSize.of(5));
    grid = applyMarker(grid, 0, 1, CellMarker.toggle(CellMarker.EMPTY, 'hyphen-right'));
    const w = makeWord(0, 0, 'across', null, 4);
    const words = wordMap([w]);

    expect(LengthPattern.forWord(grid, words, w)).toBe('2-2');
  });

  it('head word with nextWord null, mixed space and hyphen markers returns "2, 2-2"', () => {
    let grid = GridOps.blank(GridSize.of(6));
    grid = applyMarker(grid, 0, 1, CellMarker.toggle(CellMarker.EMPTY, 'space-right'));
    grid = applyMarker(grid, 0, 3, CellMarker.toggle(CellMarker.EMPTY, 'hyphen-right'));
    const w = makeWord(0, 0, 'across', null, 6);
    const words = wordMap([w]);

    expect(LengthPattern.forWord(grid, words, w)).toBe('2, 2-2');
  });

  it('across word reads spaceRight / hyphenRight markers', () => {
    let grid = GridOps.blank(GridSize.of(5));
    const marker = CellMarker.toggle(
      CellMarker.toggle(CellMarker.EMPTY, 'space-right'),
      'space-bottom',
    );
    grid = applyMarker(grid, 0, 1, marker);
    const w = makeWord(0, 0, 'across', null, 4);
    const words = wordMap([w]);

    expect(LengthPattern.forWord(grid, words, w)).toBe('2, 2');
  });

  it('down word reads spaceBottom / hyphenBottom markers', () => {
    let grid = GridOps.blank(GridSize.of(5));
    const marker = CellMarker.toggle(
      CellMarker.toggle(CellMarker.EMPTY, 'space-right'),
      'space-bottom',
    );
    grid = applyMarker(grid, 1, 1, marker);
    const w = makeWord(0, 1, 'down', null, 4);
    const words = wordMap([w]);

    expect(LengthPattern.forWord(grid, words, w)).toBe('2, 2');
  });

  it('word with nextWord != null joins separator-aware member patterns with comma+space', () => {
    let grid = GridOps.blank(GridSize.of(7));
    const b = makeWord(1, 1, 'across', null, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    grid = applyBoundaryMarker(grid, a, 'space-right');
    const words = wordMap([a, b]);

    expect(LengthPattern.forWord(grid, words, a)).toBe('3, 4');
  });

  it('three-deep chain A->B->C returns "lenA, lenB, lenC"', () => {
    let grid = GridOps.blank(GridSize.of(7));
    const c = makeWord(2, 2, 'across', null, 5);
    const b = makeWord(1, 1, 'across', c.key, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    grid = applyBoundaryMarker(grid, a, 'space-right');
    grid = applyBoundaryMarker(grid, b, 'space-right');
    const words = wordMap([a, b, c]);

    expect(LengthPattern.forWord(grid, words, a)).toBe('3, 4, 5');
  });

  it('forActiveClueBanner returns forWord result when w is a chain head', () => {
    let grid = GridOps.blank(GridSize.of(7));
    const b = makeWord(1, 1, 'across', null, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    grid = applyBoundaryMarker(grid, a, 'space-right');
    const words = wordMap([a, b]);

    expect(LengthPattern.forActiveClueBanner(grid, words, a)).toBe('3, 4');
  });

  it('forActiveClueBanner returns null when w is a non-head', () => {
    let grid = GridOps.blank(GridSize.of(7));
    const b = makeWord(1, 1, 'across', null, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    grid = applyBoundaryMarker(grid, a, 'space-right');
    const words = wordMap([a, b]);

    expect(LengthPattern.forActiveClueBanner(grid, words, b)).toBeNull();
  });

  it('forActiveClueBanner returns forWord result for a single-word chain (head with nextWord null)', () => {
    const grid = GridOps.blank(GridSize.of(5));
    const w = makeWord(0, 0, 'across', null, 5);
    const words = wordMap([w]);

    expect(LengthPattern.forActiveClueBanner(grid, words, w)).toBe('5');
  });

  it('chain head enumeration splits a non-head member on its space marker', () => {
    let grid = GridOps.blank(GridSize.of(9));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyMarker(grid, 2, 1, CellMarker.toggle(CellMarker.EMPTY, 'space-right'));
    grid = applyBoundaryMarker(grid, head, 'space-right');
    grid = applyBoundaryMarker(grid, middle, 'space-right');
    const words = wordMap([head, middle, tail]);

    expect(LengthPattern.forWord(grid, words, head)).toBe('5, 9, 2, 5');
  });

  it('chain head enumeration splits a non-head member on its hyphen marker', () => {
    let grid = GridOps.blank(GridSize.of(9));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyMarker(grid, 2, 1, CellMarker.toggle(CellMarker.EMPTY, 'hyphen-right'));
    grid = applyBoundaryMarker(grid, head, 'space-right');
    grid = applyBoundaryMarker(grid, middle, 'space-right');
    const words = wordMap([head, middle, tail]);

    expect(LengthPattern.forWord(grid, words, head)).toBe('5, 9, 2-5');
  });

  it('chain head with markers in two members enumerates each separator-aware', () => {
    let grid = GridOps.blank(GridSize.of(9));
    const middle = makeWord(1, 0, 'across', null, 4);
    const head = makeWord(0, 0, 'across', middle.key, 4);
    grid = applyMarker(grid, 0, 1, CellMarker.toggle(CellMarker.EMPTY, 'space-right'));
    grid = applyMarker(grid, 1, 1, CellMarker.toggle(CellMarker.EMPTY, 'hyphen-right'));
    grid = applyBoundaryMarker(grid, head, 'space-right');
    const words = wordMap([head, middle]);

    expect(LengthPattern.forWord(grid, words, head)).toBe('2, 2, 2-2');
  });

  it('chain head with a marked head member and plain tail', () => {
    let grid = GridOps.blank(GridSize.of(9));
    const tail = makeWord(1, 0, 'across', null, 5);
    const head = makeWord(0, 0, 'across', tail.key, 4);
    grid = applyMarker(grid, 0, 1, CellMarker.toggle(CellMarker.EMPTY, 'space-right'));
    grid = applyBoundaryMarker(grid, head, 'space-right');
    const words = wordMap([head, tail]);

    expect(LengthPattern.forWord(grid, words, head)).toBe('2, 2, 5');
  });

  it('forActiveClueBanner returns separator-aware chain pattern for a head with a marked tail', () => {
    let grid = GridOps.blank(GridSize.of(9));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyMarker(grid, 2, 1, CellMarker.toggle(CellMarker.EMPTY, 'space-right'));
    grid = applyBoundaryMarker(grid, head, 'space-right');
    grid = applyBoundaryMarker(grid, middle, 'space-right');
    const words = wordMap([head, middle, tail]);

    expect(LengthPattern.forActiveClueBanner(grid, words, head)).toBe('5, 9, 2, 5');
  });

  it('chain with hyphen boundary markers renders 5-9-7', () => {
    let grid = GridOps.blank(GridSize.of(11));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyBoundaryMarker(grid, head, 'hyphen-right');
    grid = applyBoundaryMarker(grid, middle, 'hyphen-right');
    const words = wordMap([head, middle, tail]);

    expect(LengthPattern.forWord(grid, words, head)).toBe('5-9-7');
  });

  it('chain with empty boundary markers merges member lengths into 21', () => {
    const grid = GridOps.blank(GridSize.of(11));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    const words = wordMap([head, middle, tail]);

    expect(LengthPattern.forWord(grid, words, head)).toBe('21');
  });

  it('chain with mixed boundaries renders 5, 9-7', () => {
    let grid = GridOps.blank(GridSize.of(11));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyBoundaryMarker(grid, head, 'space-right');
    grid = applyBoundaryMarker(grid, middle, 'hyphen-right');
    const words = wordMap([head, middle, tail]);

    expect(LengthPattern.forWord(grid, words, head)).toBe('5, 9-7');
  });

  it('none boundary merges the run into the next member\'s internal space split (7, 7, 7)', () => {
    let grid = GridOps.blank(GridSize.of(11));
    const tail = makeWord(2, 0, 'across', null, 7);
    const middle = makeWord(1, 0, 'across', tail.key, 9);
    const head = makeWord(0, 0, 'across', middle.key, 5);
    grid = applyMarker(grid, 1, 1, CellMarker.toggle(CellMarker.EMPTY, 'space-right'));
    grid = applyBoundaryMarker(grid, middle, 'space-right');
    const words = wordMap([head, middle, tail]);

    expect(LengthPattern.forWord(grid, words, head)).toBe('7, 7, 7');
  });

  it('boundary marker on a down-word member reads the bottom pair', () => {
    let grid = GridOps.blank(GridSize.of(7));
    const tail = makeWord(0, 1, 'down', null, 5);
    const head = makeWord(0, 0, 'down', tail.key, 5);
    grid = applyBoundaryMarker(grid, head, 'space-bottom');
    const words = wordMap([head, tail]);

    expect(LengthPattern.forWord(grid, words, head)).toBe('5, 5');
  });
});
