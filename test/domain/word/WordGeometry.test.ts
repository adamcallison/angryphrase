import { WordGeometry } from '../../../src/domain/word/WordGeometry';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { WordLength } from '../../../src/domain/word/WordLength';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import type { Word } from '../../../src/domain/word/Word';
import type { WordKey as WordKeyType } from '../../../src/domain/word/WordKey';
import type { Direction } from '../../../src/domain/word/Direction';

function makeWord(
  row: number,
  col: number,
  direction: Direction,
  length: number,
  clue = '',
  next: WordKeyType | null = null,
): Word {
  return {
    key: { startRow: Row.of(row), startCol: Col.of(col), direction },
    number: WordNumber.of(1),
    length: WordLength.of(length),
    clue,
    nextWord: next,
  };
}

describe('WordGeometry', () => {
  it('cells(across word of length 3 starting at (2,1)): three cells', () => {
    const word = makeWord(2, 1, 'across', 3);

    expect(WordGeometry.cells(word)).toEqual([
      { row: Row.of(2), col: Col.of(1), offset: 0 },
      { row: Row.of(2), col: Col.of(2), offset: 1 },
      { row: Row.of(2), col: Col.of(3), offset: 2 },
    ]);
  });

  it('cells(down word of length 4 starting at (1,4)): four cells', () => {
    const word = makeWord(1, 4, 'down', 4);

    expect(WordGeometry.cells(word)).toEqual([
      { row: Row.of(1), col: Col.of(4), offset: 0 },
      { row: Row.of(2), col: Col.of(4), offset: 1 },
      { row: Row.of(3), col: Col.of(4), offset: 2 },
      { row: Row.of(4), col: Col.of(4), offset: 3 },
    ]);
  });

  it('cells of a length-2 across word: returns exactly 2 cells', () => {
    const word = makeWord(0, 0, 'across', 2);

    expect(WordGeometry.cells(word)).toHaveLength(2);
  });

  it('cells of a length-2 down word: returns exactly 2 cells', () => {
    const word = makeWord(0, 0, 'down', 2);

    expect(WordGeometry.cells(word)).toHaveLength(2);
  });

  it('each cell is a different array reference (fresh row/col/branded values) — verify equality only via deep compare, not identity', () => {
    const cells = WordGeometry.cells(makeWord(2, 1, 'across', 3));

    expect(cells).toHaveLength(3);
    cells.forEach((cell, index) => {
      expect(cell).toEqual({
        row: Row.of(2),
        col: Col.of(1 + index),
        offset: index,
      });
    });
    expect(cells[0]).not.toBe(cells[1]);
    expect(cells[1]).not.toBe(cells[2]);
    expect(cells[0]).not.toBe(cells[2]);
  });

  it('does not mutate the input Word', () => {
    const word = makeWord(0, 0, 'across', 3);
    const before = word;

    WordGeometry.cells(word);

    expect(word).toBe(before);
    expect(word.key).toBe(before.key);
  });

  it.each([2, 3, 5])(
    'the array returned has length === Number(word.length) for length %i',
    (length) => {
      const word = makeWord(0, 0, 'across', length);

      expect(WordGeometry.cells(word)).toHaveLength(Number(word.length));
    },
  );

  it('offsets are sequential 0..length-1, in order, no gaps or repeats', () => {
    const cells = WordGeometry.cells(makeWord(0, 0, 'down', 5));

    expect(cells.map((cell) => cell.offset)).toEqual([0, 1, 2, 3, 4]);
    cells.forEach((cell, index) => {
      expect(cell.offset).toBe(index);
    });
  });
});
