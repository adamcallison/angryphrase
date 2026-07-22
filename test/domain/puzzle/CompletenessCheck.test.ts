import { describe, it, expect } from 'vitest';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { CompletenessCheck } from '../../../src/domain/puzzle/CompletenessCheck';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { Cell } from '../../../src/domain/grid/Cell';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { Letter } from '../../../src/domain/letter/Letter';
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
    length: 2,
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
        g = GridOps.setCell(g, Row.of(r), Col.of(c), Cell.setAnswerLetter(cell, Letter.try('A')));
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
    const grid = GridOps.setCell(
      p.grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(GridOps.cellAt(p.grid, Row.of(0), Col.of(0)), Letter.try('A')),
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
    let grid = GridOps.setCell(p.grid, Row.of(0), Col.of(0), Cell.black());
    grid = GridOps.setCell(grid, Row.of(0), Col.of(1), Cell.black());
    grid = GridOps.setCell(grid, Row.of(1), Col.of(0), Cell.setAnswerLetter(GridOps.cellAt(grid, Row.of(1), Col.of(0)), Letter.try('A')));
    grid = GridOps.setCell(grid, Row.of(1), Col.of(1), Cell.setAnswerLetter(GridOps.cellAt(grid, Row.of(1), Col.of(1)), Letter.try('B')));
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
    let grid = GridOps.setCell(
      p.grid,
      Row.of(0),
      Col.of(1),
      Cell.setAnswerLetter(GridOps.cellAt(p.grid, Row.of(0), Col.of(1)), Letter.try('A')),
    );
    grid = GridOps.setCell(
      grid,
      Row.of(1),
      Col.of(0),
      Cell.setAnswerLetter(GridOps.cellAt(grid, Row.of(1), Col.of(0)), Letter.try('B')),
    );
    grid = GridOps.setCell(
      grid,
      Row.of(1),
      Col.of(1),
      Cell.setAnswerLetter(GridOps.cellAt(grid, Row.of(1), Col.of(1)), Letter.try('C')),
    );
    const words = [makeWord(0, 0, 'across', 1, '')];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.check(puzzle)).toStrictEqual([
      { kind: 'missing-answer-letter', row: Row.of(0), col: Col.of(0) },
      { kind: 'missing-clue', wordNumber: WordNumber.of(1), direction: 'across' },
    ]);
  });

  it('isComplete returns true when check returns []', () => {
    const p = Puzzle.blank(GridSize.of(2), makeKey());
    const grid = fillGrid(p.grid);
    const words = [makeWord(0, 0, 'across', 1, 'clue')];
    const puzzle = Puzzle.withWords(Puzzle.withGrid(p, grid), words);

    expect(CompletenessCheck.isComplete(puzzle)).toBe(true);
  });

  it('isComplete returns false when check returns any violations', () => {
    const p = Puzzle.blank(GridSize.of(2), makeKey());
    let grid = GridOps.setCell(
      p.grid,
      Row.of(0),
      Col.of(1),
      Cell.setAnswerLetter(GridOps.cellAt(p.grid, Row.of(0), Col.of(1)), Letter.try('A')),
    );
    grid = GridOps.setCell(
      grid,
      Row.of(1),
      Col.of(0),
      Cell.setAnswerLetter(GridOps.cellAt(grid, Row.of(1), Col.of(0)), Letter.try('B')),
    );
    grid = GridOps.setCell(
      grid,
      Row.of(1),
      Col.of(1),
      Cell.setAnswerLetter(GridOps.cellAt(grid, Row.of(1), Col.of(1)), Letter.try('C')),
    );
    const puzzle = Puzzle.withGrid(p, grid);

    expect(CompletenessCheck.isComplete(puzzle)).toBe(false);
  });
});
