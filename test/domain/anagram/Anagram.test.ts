import { describe, expect, it } from 'vitest';
import { Anagram } from '../../../src/domain/anagram/Anagram';
import type { AnagramEntry } from '../../../src/domain/anagram/AnagramEntry';
import { Cell } from '../../../src/domain/grid/Cell';
import type { Cell as CellType } from '../../../src/domain/grid/Cell';
import { CellMarker } from '../../../src/domain/grid/CellMarker';
import type { CellMarkerFlag } from '../../../src/domain/grid/CellMarkerFlag';
import { Col } from '../../../src/domain/grid/Col';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Row } from '../../../src/domain/grid/Row';
import { Letter } from '../../../src/domain/letter/Letter';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import type { Word } from '../../../src/domain/word/Word';
import { SeededRng } from '../../fakes/SeededRng';

describe('Anagram', () => {
  function blankGrid(size: number): CellType[][] {
    return GridOps.blank(GridSize.of(size));
  }

  function setPlayerLetter(grid: CellType[][], row: number, col: number, ch: string): CellType[][] {
    const cell = GridOps.cellAt(grid, Row.of(row), Col.of(col));
    const letter = Letter.try(ch);
    if (letter === null) throw new Error(`Invalid letter: ${ch}`);
    return GridOps.setCell(grid, Row.of(row), Col.of(col), Cell.setPlayerLetter(cell, letter));
  }

  function setMarkerFlag(
    grid: CellType[][],
    row: number,
    col: number,
    flag: CellMarkerFlag
  ): CellType[][] {
    const cell = GridOps.cellAt(grid, Row.of(row), Col.of(col));
    return GridOps.setCell(
      grid,
      Row.of(row),
      Col.of(col),
      Cell.setMarker(cell, CellMarker.toggle(CellMarker.EMPTY, flag))
    );
  }

  function buildWord(overrides: Partial<Word> & Pick<Word, 'length'>): Word {
    const { length, ...rest } = overrides;
    return {
      key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const },
      number: WordNumber.of(1),
      length,
      clue: '',
      nextWord: null,
      ...rest,
    };
  }

  it('buildWordModel returns one entry per word cell with fixed=true where playerLetter present', () => {
    let grid = blankGrid(5);
    grid = setPlayerLetter(grid, 0, 0, 'A');
    grid = setPlayerLetter(grid, 0, 4, 'E');

    const word = buildWord({ length: 5 });
    const model = Anagram.buildWordModel(grid, word);

    expect(model.entries).toHaveLength(5);
    expect(model.entries[0]).toEqual({ position: 0, fixed: true, letter: Letter.try('A') });
    expect(model.entries[1]).toEqual({ position: 1, fixed: false, letter: null });
    expect(model.entries[2]).toEqual({ position: 2, fixed: false, letter: null });
    expect(model.entries[3]).toEqual({ position: 3, fixed: false, letter: null });
    expect(model.entries[4]).toEqual({ position: 4, fixed: true, letter: Letter.try('E') });
  });

  it('buildWordModel returns separators length = word.length - 1', () => {
    const grid = blankGrid(5);
    const word = buildWord({ length: 5 });
    const model = Anagram.buildWordModel(grid, word);
    expect(model.separators).toHaveLength(4);
    expect(model.separators.every((s) => s === 'none')).toBe(true);
  });

  it('buildWordModel across word reads spaceRight/hyphenRight markers', () => {
    let grid = blankGrid(5);
    grid = setMarkerFlag(grid, 0, 1, 'space-right');
    grid = setMarkerFlag(grid, 0, 3, 'hyphen-right');

    const word = buildWord({ length: 5 });
    const model = Anagram.buildWordModel(grid, word);

    expect(model.separators).toEqual(['none', 'space', 'none', 'hyphen']);
  });

  it('buildWordModel down word reads spaceBottom/hyphenBottom markers', () => {
    let grid = blankGrid(5);
    grid = setMarkerFlag(grid, 1, 0, 'space-bottom');
    grid = setMarkerFlag(grid, 3, 0, 'hyphen-bottom');

    const word = buildWord({
      key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'down' as const },
      length: 5,
    });
    const model = Anagram.buildWordModel(grid, word);

    expect(model.separators).toEqual(['none', 'space', 'none', 'hyphen']);
  });

  it('buildWordModel throws when a word cell is black', () => {
    let grid = blankGrid(5);
    grid = GridOps.setCell(grid, Row.of(0), Col.of(2), Cell.black());

    const word = buildWord({ length: 5 });
    expect(() => Anagram.buildWordModel(grid, word)).toThrow(
      'Anagram.buildWordModel: word cell is black'
    );
  });

  it('validateInput returns ok:true when input length matches and covers fixed letters', () => {
    const word = buildWord({ length: 5 });
    const entries: AnagramEntry[] = [
      { position: 0, fixed: true, letter: Letter.try('A') },
      { position: 1, fixed: false, letter: null },
      { position: 2, fixed: false, letter: null },
      { position: 3, fixed: false, letter: null },
      { position: 4, fixed: true, letter: Letter.try('E') },
    ];

    const result = Anagram.validateInput(word, entries, 'ABCDE');
    expect(result).toEqual({ ok: true });
  });

  it('validateInput returns ok:false when input length is wrong (too short)', () => {
    const word = buildWord({ length: 5 });
    const entries: AnagramEntry[] = Array.from({ length: 5 }, (_, i) => ({
      position: i,
      fixed: false,
      letter: null,
    }));

    const result = Anagram.validateInput(word, entries, 'ABC');
    expect(result).toEqual({ ok: false, reason: 'Input must be 5 letters (got 3).' });
  });

  it('validateInput returns ok:false when input length is wrong (too long)', () => {
    const word = buildWord({ length: 5 });
    const entries: AnagramEntry[] = Array.from({ length: 5 }, (_, i) => ({
      position: i,
      fixed: false,
      letter: null,
    }));

    const result = Anagram.validateInput(word, entries, 'ABCDEFG');
    expect(result).toEqual({ ok: false, reason: 'Input must be 5 letters (got 7).' });
  });

  it('validateInput returns ok:false when multiset does not cover fixed letters', () => {
    const word = buildWord({ length: 5 });
    const entries: AnagramEntry[] = [
      { position: 0, fixed: true, letter: Letter.try('A') },
      { position: 1, fixed: true, letter: Letter.try('A') },
      { position: 2, fixed: false, letter: null },
      { position: 3, fixed: false, letter: null },
      { position: 4, fixed: false, letter: null },
    ];

    const result = Anagram.validateInput(word, entries, 'ABCDE');
    expect(result).toEqual({
      ok: false,
      reason: 'Input letters do not cover the fixed-position letters.',
    });
  });

  it('validateInput filters non-AZ characters and uppercases before checking length', () => {
    const word = buildWord({ length: 5 });
    const entries: AnagramEntry[] = Array.from({ length: 5 }, (_, i) => ({
      position: i,
      fixed: false,
      letter: null,
    }));

    const result = Anagram.validateInput(word, entries, 'a-b1c2d3e');
    expect(result).toEqual({ ok: true });
  });

  it('scramble with all-fixed entries returns a deep copy with no shuffle', () => {
    const entries: AnagramEntry[] = [
      { position: 0, fixed: true, letter: Letter.try('A') },
      { position: 1, fixed: true, letter: Letter.try('B') },
      { position: 2, fixed: true, letter: Letter.try('C') },
    ];

    const rng = new SeededRng(12345);
    const result = Anagram.scramble(entries, 'ABC', rng);

    expect(result).not.toBe(entries);
    expect(result).toHaveLength(3);
    result.forEach((entry, i) => {
      expect(entry).not.toBe(entries[i]);
      expect(entry).toEqual(entries[i]);
    });
  });

  it('scramble places shuffled non-fixed letters using SeededRng deterministically', () => {
    const entries: AnagramEntry[] = [
      { position: 0, fixed: true, letter: Letter.try('A') },
      { position: 1, fixed: false, letter: null },
      { position: 2, fixed: false, letter: null },
      { position: 3, fixed: false, letter: null },
      { position: 4, fixed: true, letter: Letter.try('E') },
    ];

    const rng = new SeededRng(12345);
    const result = Anagram.scramble(entries, 'ABCDE', rng);

    expect(result[0]?.letter).toEqual(Letter.try('A'));
    expect(result[4]?.letter).toEqual(Letter.try('E'));

    const nonFixedLetters = [result[1]?.letter, result[2]?.letter, result[3]?.letter];
    expect(nonFixedLetters).toContain(Letter.try('B'));
    expect(nonFixedLetters).toContain(Letter.try('C'));
    expect(nonFixedLetters).toContain(Letter.try('D'));

    const rng2 = new SeededRng(12345);
    const result2 = Anagram.scramble(entries, 'ABCDE', rng2);
    expect(result2).toEqual(result);
  });

  it('scramble does not mutate input entries', () => {
    const entries: AnagramEntry[] = [
      { position: 0, fixed: true, letter: Letter.try('A') },
      { position: 1, fixed: false, letter: null },
      { position: 2, fixed: false, letter: null },
      { position: 3, fixed: false, letter: null },
      { position: 4, fixed: true, letter: Letter.try('E') },
    ];
    const original = entries.map((e) => ({ ...e }));

    Anagram.scramble(entries, 'ABCDE', new SeededRng(42));
    expect(entries).toEqual(original);
  });

  it('scramble with two SeededRng instances seeded identically produces identical output', () => {
    const entries: AnagramEntry[] = [
      { position: 0, fixed: false, letter: null },
      { position: 1, fixed: false, letter: null },
      { position: 2, fixed: false, letter: null },
      { position: 3, fixed: false, letter: null },
      { position: 4, fixed: false, letter: null },
    ];

    const resultA = Anagram.scramble(entries, 'HELLO', new SeededRng(42));
    const resultB = Anagram.scramble(entries, 'HELLO', new SeededRng(42));

    expect(resultA).toEqual(resultB);
  });

  it('scramble throws when input shorter than fixed-count', () => {
    const entries: AnagramEntry[] = [
      { position: 0, fixed: true, letter: Letter.try('A') },
      { position: 1, fixed: true, letter: Letter.try('B') },
      { position: 2, fixed: true, letter: Letter.try('C') },
      { position: 3, fixed: false, letter: null },
      { position: 4, fixed: false, letter: null },
    ];

    expect(() => Anagram.scramble(entries, 'AB', new SeededRng(1))).toThrow(
      'Anagram.scramble: insufficient letters for fixed positions'
    );
  });

  it('scramble throws when input longer than word.length', () => {
    const entries: AnagramEntry[] = Array.from({ length: 5 }, (_, i) => ({
      position: i,
      fixed: false,
      letter: null,
    }));

    expect(() => Anagram.scramble(entries, 'ABCDEFGHI', new SeededRng(1))).toThrow(
      'Anagram.scramble: input longer than word'
    );
  });
});
