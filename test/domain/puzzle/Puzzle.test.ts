import { describe, it, expect } from 'vitest';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { Title } from '../../../src/domain/puzzle/Title';
import { Author } from '../../../src/domain/puzzle/Author';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { Cell } from '../../../src/domain/grid/Cell';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { Letter } from '../../../src/domain/letter/Letter';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import type { Direction } from '../../../src/domain/word/Direction';
import type { Word } from '../../../src/domain/word/Word';
import { WordDerivation } from '../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../src/domain/word/Numbering';
import { SeededRng } from '../../fakes/SeededRng';

function makeKey() {
  return PuzzleKey.generate(new SeededRng(42));
}

function makeWord(
  row: number,
  col: number,
  direction: Direction,
  clue: string,
  next: Word['key'] | null = null,
): Word {
  return {
    key: { startRow: Row.of(row), startCol: Col.of(col), direction },
    number: WordNumber.of(1),
    length: 2,
    clue,
    nextWord: next,
  };
}

describe('Puzzle', () => {
  it('blank produces empty grid with empty title/author and derived words', () => {
    const key = makeKey();
    const size = GridSize.of(5);
    const p = Puzzle.blank(size, key);

    expect(p.key).toBe(key);
    expect(p.gridSize).toBe(size);
    expect(GridOps.equals(p.grid, GridOps.blank(size))).toBe(true);
    const expected = Numbering.assign(p.grid, WordDerivation.derive(p.grid));
    expect(p.words).toStrictEqual(expected);
    expect(p.title).toBe(Title.try(''));
    expect(p.author).toBe(Author.try(''));
  });

  it('isBlank returns true for a freshly blank puzzle', () => {
    const p = Puzzle.blank(GridSize.of(5), makeKey());
    expect(Puzzle.isBlank(p)).toBe(true);
  });

  it('isBlank returns false when any answer letter is set', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const grid = p.grid;
    const cell = GridOps.cellAt(grid, Row.of(1), Col.of(1));
    const newGrid = GridOps.setCell(
      grid,
      Row.of(1),
      Col.of(1),
      Cell.setAnswerLetter(cell, Letter.try('A')),
    );
    const p2 = Puzzle.withGrid(p, newGrid);

    expect(Puzzle.isBlank(p2)).toBe(false);
  });

  it('isBlank returns false when any word has a non-empty clue (trim)', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const p2 = Puzzle.withWords(p, [makeWord(0, 0, 'across', 'hello')]);

    expect(Puzzle.isBlank(p2)).toBe(false);
  });

  it('isBlank returns false when any word has a non-null nextWord', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const target = makeWord(0, 2, 'across', '');
    const head = makeWord(0, 0, 'across', '', target.key);
    const p2 = Puzzle.withWords(p, [head, target]);

    expect(Puzzle.isBlank(p2)).toBe(false);
  });

  it('isBlank returns true when all clues are whitespace-only (trim treats them as empty)', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const p2 = Puzzle.withWords(p, [
      makeWord(0, 0, 'across', '   '),
      makeWord(0, 0, 'down', '\t\n'),
    ]);

    expect(Puzzle.isBlank(p2)).toBe(true);
  });

  it('withGrid returns a new Puzzle with the replaced grid', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const newGrid = GridOps.blank(GridSize.of(4));
    const p2 = Puzzle.withGrid(p, newGrid);

    expect(p2.grid).toBe(newGrid);
    expect(p2.gridSize).toBe(p.gridSize);
    expect(p2.words).toBe(p.words);
    expect(p2.title).toBe(p.title);
    expect(p2.author).toBe(p.author);
    expect(p2.key).toBe(p.key);
  });

  it('withWords returns a new Puzzle with the replaced words', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const words = [makeWord(0, 0, 'across', '')];
    const p2 = Puzzle.withWords(p, words);

    expect(p2.words).toBe(words);
    expect(p2.grid).toBe(p.grid);
    expect(p2.title).toBe(p.title);
    expect(p2.author).toBe(p.author);
  });

  it('withMetadata returns a new Puzzle with the replaced title and author', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const title = Title.try('My Title');
    const author = Author.try('My Author');
    const p2 = Puzzle.withMetadata(p, title, author);

    expect(p2.title).toBe(title);
    expect(p2.author).toBe(author);
    expect(p2.grid).toBe(p.grid);
    expect(p2.words).toBe(p.words);
  });

  it('with* does not mutate the original Puzzle', () => {
    const p = Puzzle.blank(GridSize.of(3), makeKey());
    const originalGrid = p.grid;
    const originalWords = p.words;
    const originalTitle = p.title;
    const originalAuthor = p.author;

    const newGrid = GridOps.blank(GridSize.of(4));
    const newWords = [makeWord(0, 0, 'across', '')];
    const newTitle = Title.try('T');
    const newAuthor = Author.try('A');

    Puzzle.withGrid(p, newGrid);
    Puzzle.withWords(p, newWords);
    Puzzle.withMetadata(p, newTitle, newAuthor);

    expect(p.grid).toBe(originalGrid);
    expect(p.words).toBe(originalWords);
    expect(p.title).toBe(originalTitle);
    expect(p.author).toBe(originalAuthor);
  });
});
