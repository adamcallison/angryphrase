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
import type { Grid } from '../../../src/domain/grid/Grid';
import type { Word } from '../../../src/domain/word/Word';
import type { WordKey } from '../../../src/domain/word/WordKey';
import type { Direction } from '../../../src/domain/word/Direction';

function makeWord(
  row: number,
  col: number,
  direction: Direction,
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

  it('word with nextWord != null returns comma-joined chain lengths, no space', () => {
    const grid = GridOps.blank(GridSize.of(7));
    const b = makeWord(1, 1, 'across', null, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    const words = wordMap([a, b]);

    expect(LengthPattern.forWord(grid, words, a)).toBe('3,4');
  });

  it('three-deep chain A->B->C returns "lenA,lenB,lenC"', () => {
    const grid = GridOps.blank(GridSize.of(7));
    const c = makeWord(2, 2, 'across', null, 5);
    const b = makeWord(1, 1, 'across', c.key, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    const words = wordMap([a, b, c]);

    expect(LengthPattern.forWord(grid, words, a)).toBe('3,4,5');
  });

  it('forActiveClueBanner returns forWord result when w is a chain head', () => {
    const grid = GridOps.blank(GridSize.of(7));
    const b = makeWord(1, 1, 'across', null, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    const words = wordMap([a, b]);

    expect(LengthPattern.forActiveClueBanner(grid, words, a)).toBe('3,4');
  });

  it('forActiveClueBanner returns null when w is a non-head', () => {
    const grid = GridOps.blank(GridSize.of(7));
    const b = makeWord(1, 1, 'across', null, 4);
    const a = makeWord(0, 0, 'across', b.key, 3);
    const words = wordMap([a, b]);

    expect(LengthPattern.forActiveClueBanner(grid, words, b)).toBeNull();
  });

  it('forActiveClueBanner returns forWord result for a single-word chain (head with nextWord null)', () => {
    const grid = GridOps.blank(GridSize.of(5));
    const w = makeWord(0, 0, 'across', null, 5);
    const words = wordMap([w]);

    expect(LengthPattern.forActiveClueBanner(grid, words, w)).toBe('5');
  });
});
