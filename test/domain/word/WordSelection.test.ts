import { WordSelection } from '../../../src/domain/word/WordSelection';
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

describe('WordSelection', () => {
  it('returns the across word whose run contains the cursor', () => {
    const word = makeWord(0, 0, 'across', 3);
    const cursor = { row: Row.of(0), col: Col.of(1), direction: 'across' as Direction };

    expect(WordSelection.findContainingWord([word], cursor)).toBe(word);
  });

  it('returns the down word whose run contains the cursor', () => {
    const word = makeWord(0, 0, 'down', 4);
    const cursor = { row: Row.of(2), col: Col.of(0), direction: 'down' as Direction };

    expect(WordSelection.findContainingWord([word], cursor)).toBe(word);
  });

  it('returns null when no word matches cursor direction', () => {
    const word = makeWord(0, 0, 'across', 3);
    const cursor = { row: Row.of(0), col: Col.of(1), direction: 'down' as Direction };

    expect(WordSelection.findContainingWord([word], cursor)).toBeNull();
  });

  it('returns null when direction matches but cursor cell is outside the run', () => {
    const word = makeWord(0, 0, 'across', 3);
    const cursor = { row: Row.of(0), col: Col.of(4), direction: 'across' as Direction };

    expect(WordSelection.findContainingWord([word], cursor)).toBeNull();
  });

  it('returns null for an empty word list', () => {
    const cursor = { row: Row.of(0), col: Col.of(0), direction: 'across' as Direction };

    expect(WordSelection.findContainingWord([], cursor)).toBeNull();
  });

  it('returns null when cursor is null', () => {
    expect(WordSelection.findContainingWord([makeWord(0, 0, 'across', 3)], null)).toBeNull();
  });

  it('ignores words of the other direction at the same cursor cell', () => {
    const across = makeWord(0, 0, 'across', 3);
    const down = makeWord(0, 0, 'down', 3);
    const cursor = { row: Row.of(0), col: Col.of(0), direction: 'across' as Direction };

    expect(WordSelection.findContainingWord([across, down], cursor)).toBe(across);
  });

  it('cursor at the last cell of a run returns the word; cursor one past the run end returns null', () => {
    const word = makeWord(0, 0, 'across', 3);
    const lastCellCursor = { row: Row.of(0), col: Col.of(2), direction: 'across' as Direction };
    const pastEndCursor = { row: Row.of(0), col: Col.of(3), direction: 'across' as Direction };

    expect(WordSelection.findContainingWord([word], lastCellCursor)).toBe(word);
    expect(WordSelection.findContainingWord([word], pastEndCursor)).toBeNull();
  });

  it('returns the first matching word when two same-direction runs overlap the cursor', () => {
    const first = makeWord(0, 0, 'across', 3);
    const second = makeWord(0, 1, 'across', 3);
    const cursor = { row: Row.of(0), col: Col.of(1), direction: 'across' as Direction };

    expect(WordSelection.findContainingWord([first, second], cursor)).toBe(first);
  });
});
