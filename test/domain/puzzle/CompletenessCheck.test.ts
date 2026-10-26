import { describe, it, expect } from 'vitest';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { CompletenessCheck, type CompletenessViolation } from '../../../src/domain/puzzle/CompletenessCheck';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { GridAccess } from '../../../src/domain/grid/GridAccess';
import { Cell } from '../../../src/domain/grid/Cell';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { Letter } from '../../../src/domain/letter/Letter';
import { WordLength } from '../../../src/domain/word/WordLength';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import type { Direction } from '../../../src/domain/word/Direction';
import type { Word } from '../../../src/domain/word/Word';
import type { Grid } from '../../../src/domain/grid/Grid';
import { SeededRng } from '../../fakes/SeededRng';

function makeKey() {
  return PuzzleKey.generate(new SeededRng(42));
}

function makeWord(
  row: number,
  col: number,
  direction: Direction,
  number: number,
  clue: string,
  next: Word['key'] | null = null,
): Word {
  return {
    key: { startRow: Row.of(row), startCol: Col.of(col), direction },
    number: WordNumber.of(number),
    length: WordLength.of(2),
    clue,
    nextWord: next,
  };
}

function fillGrid(grid: Grid) {
  let g = grid;
  for (let r = 0; r < g.length; r++) {
    const row = g[r]!;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]!;
      if (!cell.black) {
        g = GridAccess.setCell(g, Row.of(r), Col.of(c), Cell.setAnswerLetter(cell, Letter.try('A')));
      }
    }
  }
  return g;
}

describe('CompletenessCheck', () => {
  it('check returns [] for a complete puzzle (all cells filled, all head clues non-empty)', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const grid = fillGrid(p.grid);
    const words = [makeWord(0, 0, 'across', 1, 'clue')];
    const complete = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(complete)).toStrictEqual([]);
  });

  it('check reports missing-answer-letter for each empty white cell, plus missing-clue for derived heads with empty clue', () => {
    const p = Puzzle.blank(GridSize.of(2), makeKey());
    const grid = GridAccess.setCell(
      p.grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(GridAccess.cellAt(p.grid, Row.of(0), Col.of(0)), Letter.try('A')),
    );
    const partial = Puzzle.withGrid(p, grid);

    expect(CompletenessCheck.check(partial)).toStrictEqual([
      { kind: 'missing-answer-letter', row: Row.of(0), col: Col.of(1) },
      { kind: 'missing-answer-letter', row: Row.of(1), col: Col.of(0) },
      { kind: 'missing-answer-letter', row: Row.of(1), col: Col.of(1) },
      { kind: 'missing-clue', wordNumber: WordNumber.of(1), direction: 'across' },
      { kind: 'missing-clue', wordNumber: WordNumber.of(1), direction: 'down' },
      { kind: 'missing-clue', wordNumber: WordNumber.of(2), direction: 'down' },
      { kind: 'missing-clue', wordNumber: WordNumber.of(3), direction: 'across' },
    ]);
  });

  it('check does not report black cells as missing', () => {
    const p = Puzzle.blank(GridSize.of(2), makeKey());
    let grid = GridAccess.setCell(p.grid, Row.of(0), Col.of(0), Cell.black());
    grid = GridAccess.setCell(grid, Row.of(0), Col.of(1), Cell.black());
    grid = GridAccess.setCell(grid, Row.of(1), Col.of(0), Cell.setAnswerLetter(GridAccess.cellAt(grid, Row.of(1), Col.of(0)), Letter.try('A')));
    grid = GridAccess.setCell(grid, Row.of(1), Col.of(1), Cell.setAnswerLetter(GridAccess.cellAt(grid, Row.of(1), Col.of(1)), Letter.try('B')));
    const words = [makeWord(1, 0, 'across', 1, 'clue')];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(puzzle)).toStrictEqual([]);
  });

  it('check reports missing-clue for chain heads with empty (whitespace-only) clue', () => {
    const p = Puzzle.blank(GridSize.of(2), makeKey());
    const grid = fillGrid(p.grid);
    const words = [makeWord(0, 0, 'across', 1, '   ')];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(puzzle)).toStrictEqual([
      { kind: 'missing-clue', wordNumber: WordNumber.of(1), direction: 'across' },
    ]);
  });

  it('check does not report missing-clue for non-head chain words (clues are intentionally empty)', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const grid = fillGrid(p.grid);
    const tail = makeWord(0, 2, 'across', 2, '');
    const head = makeWord(0, 0, 'across', 1, 'head clue', tail.key);
    const words = [head, tail];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(puzzle)).toStrictEqual([]);
  });

  it('check does not report missing-clue for heads with non-empty clue', () => {
    const p = Puzzle.blank(GridSize.of(2), makeKey());
    const grid = fillGrid(p.grid);
    const words = [makeWord(0, 0, 'across', 1, 'real clue')];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(puzzle)).toStrictEqual([]);
  });

  it('violations are ordered: missing-answer letters first (row-major), then missing-clue', () => {
    const p = Puzzle.blank(GridSize.of(2), makeKey());
    let grid = GridAccess.setCell(
      p.grid,
      Row.of(0),
      Col.of(1),
      Cell.setAnswerLetter(GridAccess.cellAt(p.grid, Row.of(0), Col.of(1)), Letter.try('A')),
    );
    grid = GridAccess.setCell(
      grid,
      Row.of(1),
      Col.of(0),
      Cell.setAnswerLetter(GridAccess.cellAt(grid, Row.of(1), Col.of(0)), Letter.try('B')),
    );
    grid = GridAccess.setCell(
      grid,
      Row.of(1),
      Col.of(1),
      Cell.setAnswerLetter(GridAccess.cellAt(grid, Row.of(1), Col.of(1)), Letter.try('C')),
    );
    const words = [makeWord(0, 0, 'across', 1, '')];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(puzzle)).toStrictEqual([
      { kind: 'missing-answer-letter', row: Row.of(0), col: Col.of(0) },
      { kind: 'missing-clue', wordNumber: WordNumber.of(1), direction: 'across' },
    ]);
  });

  it('check reports non-head-clue for a non-head chain word with a non-empty clue', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const grid = fillGrid(p.grid);
    const tail = makeWord(0, 2, 'across', 2, 'stowaway');
    const head = makeWord(0, 0, 'across', 1, 'head clue', tail.key);
    const words = [head, tail];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(puzzle)).toStrictEqual([
      { kind: 'non-head-clue', wordNumber: WordNumber.of(2), direction: 'across' },
    ]);
  });

  it('check does not report non-head-clue when the non-head clue is empty', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const grid = fillGrid(p.grid);
    const tail = makeWord(0, 2, 'across', 2, '');
    const head = makeWord(0, 0, 'across', 1, 'head clue', tail.key);
    const words = [head, tail];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(puzzle)).toStrictEqual([]);
  });

  it('check does not report non-head-clue for whitespace-only clue on a non-head word (trim)', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const grid = fillGrid(p.grid);
    const tail = makeWord(0, 2, 'across', 2, '   ');
    const head = makeWord(0, 0, 'across', 1, 'head clue', tail.key);
    const words = [head, tail];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(puzzle)).toStrictEqual([]);
  });

  it('check does not report non-head-clue for a head word with a non-empty clue', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const grid = fillGrid(p.grid);
    const words = [makeWord(0, 0, 'across', 1, 'real clue')];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(puzzle)).toStrictEqual([]);
  });

  it('clueViolations returns violations in word order', () => {
    const tail = makeWord(0, 2, 'across', 2, 'bad');
    const head = makeWord(0, 0, 'across', 1, '', tail.key);
    const words = [head, tail];

    expect(CompletenessCheck.clueViolations(words)).toStrictEqual([
      { kind: 'missing-clue', wordNumber: WordNumber.of(1), direction: 'across' },
      { kind: 'non-head-clue', wordNumber: WordNumber.of(2), direction: 'across' },
    ]);
  });

  it('message returns the exact user-facing string for each violation kind', () => {
    expect(
      CompletenessCheck.message({
        kind: 'missing-answer-letter',
        row: Row.of(5),
        col: Col.of(7),
      }),
    ).toBe('Missing answer letter at row 5, col 7.');

    expect(
      CompletenessCheck.message({
        kind: 'missing-clue',
        wordNumber: WordNumber.of(3),
        direction: 'across',
      }),
    ).toBe('Missing clue for word 3 across.');

    expect(
      CompletenessCheck.message({
        kind: 'non-head-clue',
        wordNumber: WordNumber.of(3),
        direction: 'across',
      }),
    ).toBe('Word 3 across is a non-head chain word with a non-empty clue.');
  });

  describe('groupByKind', () => {
    it('empty input returns zero for every kind', () => {
      expect(CompletenessCheck.groupByKind([])).toStrictEqual({
        'missing-answer-letter': 0,
        'missing-clue': 0,
        'non-head-clue': 0,
      });
    });

    it('counts each kind correctly', () => {
      const violations: CompletenessViolation[] = [
        { kind: 'missing-answer-letter', row: Row.of(0), col: Col.of(0) },
        { kind: 'missing-answer-letter', row: Row.of(0), col: Col.of(1) },
        { kind: 'missing-answer-letter', row: Row.of(1), col: Col.of(0) },
        { kind: 'missing-clue', wordNumber: WordNumber.of(1), direction: 'across' },
        { kind: 'missing-clue', wordNumber: WordNumber.of(2), direction: 'down' },
        { kind: 'non-head-clue', wordNumber: WordNumber.of(3), direction: 'across' },
      ];

      expect(CompletenessCheck.groupByKind(violations)).toStrictEqual({
        'missing-answer-letter': 3,
        'missing-clue': 2,
        'non-head-clue': 1,
      });
    });

    it('counts sum to input length', () => {
      const violations: CompletenessViolation[] = [
        { kind: 'missing-answer-letter', row: Row.of(0), col: Col.of(0) },
        { kind: 'missing-clue', wordNumber: WordNumber.of(1), direction: 'across' },
        { kind: 'non-head-clue', wordNumber: WordNumber.of(2), direction: 'down' },
        { kind: 'missing-answer-letter', row: Row.of(2), col: Col.of(2) },
        { kind: 'missing-clue', wordNumber: WordNumber.of(3), direction: 'across' },
      ];
      const counts = CompletenessCheck.groupByKind(violations);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);

      expect(total).toBe(violations.length);
    });

    it('returns the same shape for any input', () => {
      const empty = CompletenessCheck.groupByKind([]);
      const mixedViolations: CompletenessViolation[] = [
        { kind: 'missing-answer-letter', row: Row.of(0), col: Col.of(0) },
        { kind: 'missing-clue', wordNumber: WordNumber.of(1), direction: 'across' },
        { kind: 'non-head-clue', wordNumber: WordNumber.of(2), direction: 'down' },
      ];
      const mixed = CompletenessCheck.groupByKind(mixedViolations);

      expect(Object.keys(empty).sort()).toStrictEqual(Object.keys(mixed).sort());
    });
  });
});
