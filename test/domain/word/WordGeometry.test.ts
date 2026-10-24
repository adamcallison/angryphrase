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

  it('contains returns true for a cell inside an across word', () => {
    const word = makeWord(2, 1, 'across', 3);

    expect(WordGeometry.contains(word, Row.of(2), Col.of(2))).toBe(true);
  });

  it('contains returns true for a cell inside a down word', () => {
    const word = makeWord(1, 4, 'down', 4);

    expect(WordGeometry.contains(word, Row.of(3), Col.of(4))).toBe(true);
  });

  it('contains returns false for the cell just before the word start', () => {
    const across = makeWord(2, 1, 'across', 3);
    const down = makeWord(1, 4, 'down', 4);

    expect(WordGeometry.contains(across, Row.of(2), Col.of(0))).toBe(false);
    expect(WordGeometry.contains(down, Row.of(0), Col.of(4))).toBe(false);
  });

  it('contains returns false for the cell just past the word end', () => {
    const across = makeWord(2, 1, 'across', 3);
    const down = makeWord(1, 4, 'down', 4);

    expect(WordGeometry.contains(across, Row.of(2), Col.of(4))).toBe(false);
    expect(WordGeometry.contains(down, Row.of(5), Col.of(4))).toBe(false);
  });

  it('contains returns false for a cell on the parallel axis of an across word', () => {
    const word = makeWord(2, 1, 'across', 3);

    expect(WordGeometry.contains(word, Row.of(1), Col.of(2))).toBe(false);
    expect(WordGeometry.contains(word, Row.of(3), Col.of(2))).toBe(false);
  });

  it('contains returns false for a cell on the parallel axis of a down word', () => {
    const word = makeWord(1, 4, 'down', 4);

    expect(WordGeometry.contains(word, Row.of(2), Col.of(3))).toBe(false);
    expect(WordGeometry.contains(word, Row.of(2), Col.of(5))).toBe(false);
  });

  it('contains agrees with cells: every cell emitted by cells(word) is contained, and the cells just outside are not', () => {
    const across = makeWord(2, 1, 'across', 3);
    const down = makeWord(1, 4, 'down', 4);

    for (const word of [across, down]) {
      for (const cell of WordGeometry.cells(word)) {
        expect(WordGeometry.contains(word, cell.row, cell.col)).toBe(true);
      }
    }

    expect(WordGeometry.contains(across, Row.of(2), Col.of(0))).toBe(false);
    expect(WordGeometry.contains(across, Row.of(2), Col.of(4))).toBe(false);
    expect(WordGeometry.contains(across, Row.of(1), Col.of(2))).toBe(false);
    expect(WordGeometry.contains(across, Row.of(3), Col.of(2))).toBe(false);

    expect(WordGeometry.contains(down, Row.of(0), Col.of(4))).toBe(false);
    expect(WordGeometry.contains(down, Row.of(5), Col.of(4))).toBe(false);
    expect(WordGeometry.contains(down, Row.of(2), Col.of(3))).toBe(false);
    expect(WordGeometry.contains(down, Row.of(2), Col.of(5))).toBe(false);
  });

  it('lastCell returns the final cell of an across word', () => {
    const word = makeWord(2, 1, 'across', 3);

    expect(WordGeometry.lastCell(word)).toEqual({
      row: Row.of(2),
      col: Col.of(3),
      offset: 2,
    });
  });

  it('lastCell returns the final cell of a down word', () => {
    const word = makeWord(1, 4, 'down', 4);

    expect(WordGeometry.lastCell(word)).toEqual({
      row: Row.of(4),
      col: Col.of(4),
      offset: 3,
    });
  });

  it('lastCell rejects an invalid start coordinate exactly as cells does (across)', () => {
    const malformed = {
      key: { startRow: -1 as unknown as Row, startCol: Col.of(0), direction: 'across' as Direction },
      number: WordNumber.of(1),
      length: WordLength.of(3),
      clue: '',
      nextWord: null,
    } as Word;

    expect(() => WordGeometry.cells(malformed)).toThrow(RangeError);
    expect(() => WordGeometry.lastCell(malformed)).toThrow(RangeError);
  });

  it('lastCell rejects an invalid start coordinate exactly as cells does (down)', () => {
    const malformed = {
      key: { startRow: Row.of(0), startCol: -1 as unknown as Col, direction: 'down' as Direction },
      number: WordNumber.of(1),
      length: WordLength.of(3),
      clue: '',
      nextWord: null,
    } as Word;

    expect(() => WordGeometry.cells(malformed)).toThrow(RangeError);
    expect(() => WordGeometry.lastCell(malformed)).toThrow(RangeError);
  });

  it('lastCell returns the same coordinate as the last cell of cells() for an across word', () => {
    const word = makeWord(2, 1, 'across', 3);
    const cells = WordGeometry.cells(word);

    expect(WordGeometry.lastCell(word)).toEqual(cells[cells.length - 1]);
  });

  it('lastCell returns the same coordinate as the last cell of cells() for a down word', () => {
    const word = makeWord(1, 4, 'down', 4);
    const cells = WordGeometry.cells(word);

    expect(WordGeometry.lastCell(word)).toEqual(cells[cells.length - 1]);
  });
});
