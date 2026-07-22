import { describe, it, expect } from 'vitest';
import { deriveAnagramModalVM } from './anagramVM';
import { GridOps } from '../../../domain/grid/GridOps';
import { GridSize } from '../../../domain/grid/GridSize';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import { Cell } from '../../../domain/grid/Cell';
import { CellMarker } from '../../../domain/grid/CellMarker';
import { Letter } from '../../../domain/letter/Letter';
import { WordNumber } from '../../../domain/word/WordNumber';
import type { Grid } from '../../../domain/grid/Grid';
import type { Word } from '../../../domain/word/Word';
import type { CellMarkerFlag } from '../../../domain/grid/CellMarkerFlag';
import type { AnagramModalState } from '../../../player/state/state';

const CLOSED_BASELINE = {
  open: false,
  wordLength: 0,
  tiles: [],
  separators: [],
  input: '',
  inputLength: 0,
  expectedUniqueLetterCounts: [],
  inputValid: false,
  scrambleEnabled: false,
  errorMessage: null,
};

function grid3x3(): Grid {
  return GridOps.blank(GridSize.of(3));
}

function grid4x4(): Grid {
  return GridOps.blank(GridSize.of(4));
}

function word3Across(): Word {
  return {
    key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
    number: WordNumber.of(1),
    length: 3,
    clue: 'Test clue',
    nextWord: null,
  };
}

function word4Across(): Word {
  return {
    key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
    number: WordNumber.of(1),
    length: 4,
    clue: 'Test clue',
    nextWord: null,
  };
}

function setAnswer(grid: Grid, row: number, col: number, letter: string): Grid {
  const r = Row.of(row);
  const c = Col.of(col);
  const cell = GridOps.cellAt(grid, r, c);
  const l = Letter.try(letter);
  expect(l).not.toBeNull();
  return GridOps.setCell(grid, r, c, Cell.setAnswerLetter(cell, l!));
}

function setMarker(grid: Grid, row: number, col: number, flag: CellMarkerFlag): Grid {
  const r = Row.of(row);
  const c = Col.of(col);
  const cell = GridOps.cellAt(grid, r, c);
  return GridOps.setCell(grid, r, c, Cell.setMarker(cell, CellMarker.toggle(cell.marker, flag)));
}

function makeLetters(s: string): Letter[] {
  return Array.from(s).map((ch) => {
    const l = Letter.try(ch);
    expect(l).not.toBeNull();
    return l!;
  });
}

function makeAnagramModal(
  input: string,
  scrambledArrangement: string | null,
  openedForWord: Word['key'] = { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
): AnagramModalState {
  return {
    openedForWord,
    input,
    scrambledArrangement: scrambledArrangement === null ? null : makeLetters(scrambledArrangement),
  };
}

describe('deriveAnagramModalVM', () => {
  it('deriveAnagramModalVM: null anagramModal → closed baseline (open: false, wordLength: 0, all defaults)', () => {
    const result = deriveAnagramModalVM({ anagramModal: null, grid: grid3x3(), words: [] });
    expect(result).toEqual(CLOSED_BASELINE);
  });

  it('deriveAnagramModalVM: openedForWord not found in words → closed baseline', () => {
    const modal = makeAnagramModal('ABC', null);
    const result = deriveAnagramModalVM({ anagramModal: modal, grid: grid3x3(), words: [] });
    expect(result).toEqual(CLOSED_BASELINE);
  });

  it('deriveAnagramModalVM: open modal — tiles count matches word length; fixed positions show their grid letter', () => {
    let grid = grid3x3();
    grid = setAnswer(grid, 0, 0, 'A');
    grid = setAnswer(grid, 0, 2, 'C');
    const word = word3Across();
    const modal = makeAnagramModal('', null);
    const result = deriveAnagramModalVM({ anagramModal: modal, grid, words: [word] });
    expect(result.open).toBe(true);
    expect(result.wordLength).toBe(3);
    expect(result.tiles).toHaveLength(3);
    expect(result.tiles[0]).toEqual({ position: 0, fixed: true, letter: 'A' });
    expect(result.tiles[1]).toEqual({ position: 1, fixed: false, letter: null });
    expect(result.tiles[2]).toEqual({ position: 2, fixed: true, letter: 'C' });
  });

  it('deriveAnagramModalVM: non-fixed positions get null when scrambledArrangement is null', () => {
    let grid = grid3x3();
    grid = setAnswer(grid, 0, 0, 'A');
    grid = setAnswer(grid, 0, 2, 'C');
    const word = word3Across();
    const modal = makeAnagramModal('ABC', null);
    const result = deriveAnagramModalVM({ anagramModal: modal, grid, words: [word] });
    const nonFixed = result.tiles.filter((t) => !t.fixed);
    expect(nonFixed.length).toBeGreaterThan(0);
    for (const tile of nonFixed) {
      expect(tile.letter).toBeNull();
    }
  });

  it('deriveAnagramModalVM: non-fixed positions show scrambledArrangement letters positionally (when present)', () => {
    let grid = grid3x3();
    grid = setAnswer(grid, 0, 0, 'A');
    grid = setAnswer(grid, 0, 2, 'C');
    const word = word3Across();
    const modal = makeAnagramModal('ABC', 'ABC');
    const result = deriveAnagramModalVM({ anagramModal: modal, grid, words: [word] });
    expect(result.tiles[0]).toEqual({ position: 0, fixed: true, letter: 'A' });
    expect(result.tiles[1]).toEqual({ position: 1, fixed: false, letter: 'B' });
    expect(result.tiles[2]).toEqual({ position: 2, fixed: true, letter: 'C' });
  });

  it('deriveAnagramModalVM: separators echo from Anagram.buildWordModel', () => {
    let grid = grid3x3();
    grid = setAnswer(grid, 0, 0, 'A');
    grid = setAnswer(grid, 0, 1, 'B');
    grid = setAnswer(grid, 0, 2, 'C');
    grid = setMarker(grid, 0, 0, 'space-right');
    grid = setMarker(grid, 0, 1, 'hyphen-right');
    const word = word3Across();
    const modal = makeAnagramModal('ABC', null);
    const result = deriveAnagramModalVM({ anagramModal: modal, grid, words: [word] });
    expect(result.separators).toEqual(['space', 'hyphen']);
  });

  it('deriveAnagramModalVM: input echoed unchanged; inputLength = input.length', () => {
    let grid = grid3x3();
    grid = setAnswer(grid, 0, 0, 'A');
    grid = setAnswer(grid, 0, 2, 'C');
    const word = word3Across();
    const modal = makeAnagramModal('XYZ', null);
    const result = deriveAnagramModalVM({ anagramModal: modal, grid, words: [word] });
    expect(result.input).toBe('XYZ');
    expect(result.inputLength).toBe(3);
  });

  it('deriveAnagramModalVM: inputValid = Anagram.validateInput result; errorMessage = reason on invalid', () => {
    let grid = grid3x3();
    grid = setAnswer(grid, 0, 0, 'A');
    grid = setAnswer(grid, 0, 2, 'C');
    const word = word3Across();

    const shortResult = deriveAnagramModalVM({
      anagramModal: makeAnagramModal('AB', null),
      grid,
      words: [word],
    });
    expect(shortResult.inputValid).toBe(false);
    expect(shortResult.errorMessage).toBe('Input must be 3 letters (got 2).');

    const missingResult = deriveAnagramModalVM({
      anagramModal: makeAnagramModal('ZZZ', null),
      grid,
      words: [word],
    });
    expect(missingResult.inputValid).toBe(false);
    expect(missingResult.errorMessage).toBe('Input letters do not cover the fixed-position letters.');

    const validResult = deriveAnagramModalVM({
      anagramModal: makeAnagramModal('ABC', null),
      grid,
      words: [word],
    });
    expect(validResult.inputValid).toBe(true);
    expect(validResult.errorMessage).toBeNull();
  });

  it('deriveAnagramModalVM: expectedUniqueLetterCounts counts only fixed letters, sorted by count desc then letter asc', () => {
    let grid = grid3x3();
    grid = setAnswer(grid, 0, 0, 'A');
    grid = setAnswer(grid, 0, 1, 'A');
    grid = setAnswer(grid, 0, 2, 'B');
    const word = word3Across();
    const result = deriveAnagramModalVM({
      anagramModal: makeAnagramModal('AAB', null),
      grid,
      words: [word],
    });
    expect(result.expectedUniqueLetterCounts).toEqual([
      { letter: 'A', count: 2 },
      { letter: 'B', count: 1 },
    ]);

    let grid4 = grid4x4();
    grid4 = setAnswer(grid4, 0, 0, 'B');
    grid4 = setAnswer(grid4, 0, 1, 'A');
    grid4 = setAnswer(grid4, 0, 2, 'B');
    grid4 = setAnswer(grid4, 0, 3, 'A');
    const result4 = deriveAnagramModalVM({
      anagramModal: makeAnagramModal('ABBA', null, word4Across().key),
      grid: grid4,
      words: [word4Across()],
    });
    expect(result4.expectedUniqueLetterCounts).toEqual([
      { letter: 'A', count: 2 },
      { letter: 'B', count: 2 },
    ]);
  });

  it('deriveAnagramModalVM: scrambleEnabled true iff inputValid AND ≥1 non-fixed tile', () => {
    let grid = grid3x3();
    grid = setAnswer(grid, 0, 0, 'A');
    grid = setAnswer(grid, 0, 2, 'C');
    const word = word3Across();
    const modal = makeAnagramModal('ABC', null);
    const result = deriveAnagramModalVM({ anagramModal: modal, grid, words: [word] });
    expect(result.inputValid).toBe(true);
    expect(result.scrambleEnabled).toBe(true);
  });

  it('deriveAnagramModalVM: scrambleEnabled false when input is invalid', () => {
    let grid = grid3x3();
    grid = setAnswer(grid, 0, 0, 'A');
    grid = setAnswer(grid, 0, 2, 'C');
    const word = word3Across();
    const modal = makeAnagramModal('AB', null);
    const result = deriveAnagramModalVM({ anagramModal: modal, grid, words: [word] });
    expect(result.inputValid).toBe(false);
    expect(result.scrambleEnabled).toBe(false);
  });

  it('deriveAnagramModalVM: all-fixed word → scrambleEnabled false even if input valid', () => {
    let grid = grid3x3();
    grid = setAnswer(grid, 0, 0, 'A');
    grid = setAnswer(grid, 0, 1, 'B');
    grid = setAnswer(grid, 0, 2, 'C');
    const word = word3Across();
    const modal = makeAnagramModal('ABC', null);
    const result = deriveAnagramModalVM({ anagramModal: modal, grid, words: [word] });
    expect(result.inputValid).toBe(true);
    expect(result.scrambleEnabled).toBe(false);
  });

  it('deriveAnagramModalVM: wordLength = word.length', () => {
    const grid = grid3x3();
    const word = word3Across();
    const modal = makeAnagramModal('', null);
    const result = deriveAnagramModalVM({ anagramModal: modal, grid, words: [word] });
    expect(result.wordLength).toBe(word.length);
  });
});
