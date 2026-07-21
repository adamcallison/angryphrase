import { Chain } from '../../../src/domain/chain/Chain';
import { WordMap } from '../../../src/domain/word/WordMap';
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
  next: WordKeyType | null = null,
): Word {
  return {
    key: { startRow: Row.of(row), startCol: Col.of(col), direction },
    number: WordNumber.of(1),
    length: 2,
    clue: '',
    nextWord: next,
  };
}

function wordMap(words: Word[]) {
  return WordMap.fromWords(words);
}

describe('Chain', () => {
  it('Chain.fromHead returns head + members for a clean chain A→B→C', () => {
    const c = makeWord(0, 4, 'across');
    const b = makeWord(0, 2, 'across', c.key);
    const a = makeWord(0, 0, 'across', b.key);
    const words = wordMap([a, b, c]);

    const result = Chain.fromHead(words, a.key);
    expect(result.head).toBe(a.key);
    expect(result.members).toStrictEqual([a, b, c]);
  });

  it('Chain.fromHead throws on cycle', () => {
    const a = makeWord(0, 0, 'across');
    const b = makeWord(0, 2, 'across', a.key);
    const aa = { ...a, nextWord: b.key };
    const words = wordMap([aa, b]);

    expect(() => Chain.fromHead(words, aa.key)).toThrow('cycle detected in chain');
  });

  it('Chain.fromHead throws on dangling', () => {
    const missing: WordKeyType = { startRow: Row.of(9), startCol: Col.of(9), direction: 'down' as const };
    const a = makeWord(0, 0, 'across', missing);
    const words = wordMap([a]);

    expect(() => Chain.fromHead(words, a.key)).toThrow('dangling nextWord in chain');
  });

  it('Chain.fromHead on a single word with nextWord=null returns just that word', () => {
    const a = makeWord(0, 0, 'across');
    const words = wordMap([a]);

    const result = Chain.fromHead(words, a.key);
    expect(result.head).toBe(a.key);
    expect(result.members).toStrictEqual([a]);
  });

  it('Chain.isHead returns true when no word points at the given key', () => {
    const a = makeWord(0, 0, 'across');
    const b = makeWord(0, 2, 'across');
    const words = wordMap([a, b]);

    expect(Chain.isHead(words, a.key)).toBe(true);
    expect(Chain.isHead(words, b.key)).toBe(true);
  });

  it('Chain.isHead returns false when some word points at the given key', () => {
    const b = makeWord(0, 2, 'across');
    const a = makeWord(0, 0, 'across', b.key);
    const words = wordMap([a, b]);

    expect(Chain.isHead(words, a.key)).toBe(true);
    expect(Chain.isHead(words, b.key)).toBe(false);
  });

  it('Chain.isNonHead is the inverse of isHead', () => {
    const b = makeWord(0, 2, 'across');
    const a = makeWord(0, 0, 'across', b.key);
    const words = wordMap([a, b]);

    expect(Chain.isNonHead(words, a.key)).toBe(false);
    expect(Chain.isNonHead(words, b.key)).toBe(true);
  });

  it('Chain.membersOf returns the suffix from k onward', () => {
    const c = makeWord(0, 4, 'across');
    const b = makeWord(0, 2, 'across', c.key);
    const a = makeWord(0, 0, 'across', b.key);
    const words = wordMap([a, b, c]);

    expect(Chain.membersOf(words, b.key)).toStrictEqual([b, c]);
  });

  it('Chain.membersOf on a tail word returns just [tail]', () => {
    const b = makeWord(0, 2, 'across');
    const a = makeWord(0, 0, 'across', b.key);
    const words = wordMap([a, b]);

    expect(Chain.membersOf(words, b.key)).toStrictEqual([b]);
  });
});
