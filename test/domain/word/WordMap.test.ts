import { WordMap } from '../../../src/domain/word/WordMap';
import { WordLength } from '../../../src/domain/word/WordLength';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
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

describe('WordMap', () => {
  it('WordMap.fromWords builds a map keyed by WordKey.toCanonical', () => {
    const w1 = makeWord(0, 0, 'across', 3);
    const w2 = makeWord(0, 0, 'down', 4);
    const w3 = makeWord(1, 2, 'across', 5);
    const map = WordMap.fromWords([w1, w2, w3]);

    expect(map.size).toBe(3);
    expect(WordMap.get(map, w1.key)).toBe(w1);
    expect(WordMap.get(map, w2.key)).toBe(w2);
    expect(WordMap.get(map, w3.key)).toBe(w3);
  });

  it('WordMap.get returns the word for a key, undefined for a missing key', () => {
    const w1 = makeWord(0, 0, 'across', 3);
    const map = WordMap.fromWords([w1]);
    const missing = makeWord(1, 1, 'down', 2).key;

    expect(WordMap.get(map, w1.key)).toBe(w1);
    expect(WordMap.get(map, missing)).toBeUndefined();
  });

  it('WordMap.has returns true for present, false for missing', () => {
    const w1 = makeWord(0, 0, 'across', 3);
    const map = WordMap.fromWords([w1]);
    const missing = makeWord(1, 1, 'down', 2).key;

    expect(WordMap.has(map, w1.key)).toBe(true);
    expect(WordMap.has(map, missing)).toBe(false);
  });

});
