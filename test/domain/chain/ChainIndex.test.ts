import { ChainIndex } from '../../../src/domain/chain/ChainIndex';
import { WordLength } from '../../../src/domain/word/WordLength';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { WordKey } from '../../../src/domain/word/WordKey';
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
    length: WordLength.of(2),
    clue: '',
    nextWord: next,
  };
}

describe('ChainIndex', () => {
  it('ChainIndex.build does not throw on a cyclic word list', () => {
    const a = makeWord(0, 0, 'across');
    const b = makeWord(0, 2, 'across', a.key);
    const aa = { ...a, nextWord: b.key };

    expect(() => ChainIndex.build([aa, b])).not.toThrow();
  });

  it('ChainIndex.isHead returns true when no word points at the given key', () => {
    const a = makeWord(0, 0, 'across');
    const b = makeWord(0, 2, 'across');
    const index = ChainIndex.build([a, b]);

    expect(index.isHead(a.key)).toBe(true);
    expect(index.isHead(b.key)).toBe(true);
  });

  it('ChainIndex.isHead returns false when some word points at the given key', () => {
    const b = makeWord(0, 2, 'across');
    const a = makeWord(0, 0, 'across', b.key);
    const index = ChainIndex.build([a, b]);

    expect(index.isHead(a.key)).toBe(true);
    expect(index.isHead(b.key)).toBe(false);
  });

  it('ChainIndex.isHead does not throw on a cyclic word list', () => {
    const a = makeWord(0, 0, 'across');
    const b = makeWord(0, 2, 'across', a.key);
    const aa = { ...a, nextWord: b.key };
    const index = ChainIndex.build([aa, b]);

    expect(() => index.isHead(aa.key)).not.toThrow();
    expect(() => index.isHead(b.key)).not.toThrow();
  });

  it('ChainIndex.headOf returns the head key for a head word', () => {
    const c = makeWord(0, 4, 'across');
    const b = makeWord(0, 2, 'across', c.key);
    const a = makeWord(0, 0, 'across', b.key);
    const index = ChainIndex.build([a, b, c]);

    expect(index.headOf(a.key)).toBe(a.key);
  });

  it('ChainIndex.headOf walks predecessors to the head for a mid-chain word', () => {
    const c = makeWord(0, 4, 'across');
    const b = makeWord(0, 2, 'across', c.key);
    const a = makeWord(0, 0, 'across', b.key);
    const index = ChainIndex.build([a, b, c]);

    expect(index.headOf(b.key)).toBe(a.key);
  });

  it('ChainIndex.headOf returns the word key for a tail word with a chain', () => {
    const c = makeWord(0, 4, 'across');
    const b = makeWord(0, 2, 'across', c.key);
    const a = makeWord(0, 0, 'across', b.key);
    const index = ChainIndex.build([a, b, c]);

    expect(index.headOf(c.key)).toBe(a.key);
  });

  it('ChainIndex.headOf throws dangling nextWord in chain at for an unknown key', () => {
    const missing: WordKeyType = { startRow: Row.of(9), startCol: Col.of(9), direction: 'down' as const };
    const a = makeWord(0, 0, 'across', missing);
    const index = ChainIndex.build([a]);

    expect(() => index.headOf(missing)).toThrow(
      `dangling nextWord in chain at: ${WordKey.toCanonical(missing)}`,
    );
  });

  it('ChainIndex.headOf throws cycle detected in chain at on a cycle', () => {
    const a = makeWord(0, 0, 'across');
    const b = makeWord(0, 2, 'across', a.key);
    const aa = { ...a, nextWord: b.key };
    const index = ChainIndex.build([aa, b]);

    expect(() => index.headOf(b.key)).toThrow(
      `cycle detected in chain at: ${WordKey.toCanonical(b.key)}`,
    );
  });

  it('ChainIndex.membersOf returns the suffix from k onward', () => {
    const c = makeWord(0, 4, 'across');
    const b = makeWord(0, 2, 'across', c.key);
    const a = makeWord(0, 0, 'across', b.key);
    const index = ChainIndex.build([a, b, c]);

    expect(index.membersOf(b.key)).toStrictEqual([b, c]);
  });

  it('ChainIndex.membersOf on a tail word returns just [tail]', () => {
    const b = makeWord(0, 2, 'across');
    const a = makeWord(0, 0, 'across', b.key);
    const index = ChainIndex.build([a, b]);

    expect(index.membersOf(b.key)).toStrictEqual([b]);
  });

  it('ChainIndex.fromHead returns head + members for a clean chain A→B→C', () => {
    const c = makeWord(0, 4, 'across');
    const b = makeWord(0, 2, 'across', c.key);
    const a = makeWord(0, 0, 'across', b.key);
    const index = ChainIndex.build([a, b, c]);

    const result = index.fromHead(a.key);
    expect(result.head).toBe(a.key);
    expect(result.members).toStrictEqual([a, b, c]);
  });

  it('ChainIndex.fromHead throws cycle detected in chain at', () => {
    const a = makeWord(0, 0, 'across');
    const b = makeWord(0, 2, 'across', a.key);
    const aa = { ...a, nextWord: b.key };
    const index = ChainIndex.build([aa, b]);

    expect(() => index.fromHead(aa.key)).toThrow(
      `cycle detected in chain at: ${WordKey.toCanonical(aa.key)}`,
    );
  });

  it('ChainIndex.fromHead throws dangling nextWord in chain at', () => {
    const missing: WordKeyType = { startRow: Row.of(9), startCol: Col.of(9), direction: 'down' as const };
    const a = makeWord(0, 0, 'across', missing);
    const index = ChainIndex.build([a]);

    expect(() => index.fromHead(a.key)).toThrow(
      `dangling nextWord in chain at: ${WordKey.toCanonical(missing)}`,
    );
  });

  it('ChainIndex.fromHead on a single word with nextWord=null returns just that word', () => {
    const a = makeWord(0, 0, 'across');
    const index = ChainIndex.build([a]);

    const result = index.fromHead(a.key);
    expect(result.head).toBe(a.key);
    expect(result.members).toStrictEqual([a]);
  });

  it('ChainIndex.word returns the word for a known key', () => {
    const a = makeWord(0, 0, 'across');
    const index = ChainIndex.build([a]);

    expect(index.word(a.key)).toBe(a);
  });

  it('ChainIndex.word returns undefined for an unknown key', () => {
    const a = makeWord(0, 0, 'across');
    const missing: WordKeyType = { startRow: Row.of(9), startCol: Col.of(9), direction: 'down' as const };
    const index = ChainIndex.build([a]);

    expect(index.word(missing)).toBeUndefined();
  });

  it('ChainIndex.has returns true for a known key and false for an unknown key', () => {
    const a = makeWord(0, 0, 'across');
    const missing: WordKeyType = { startRow: Row.of(9), startCol: Col.of(9), direction: 'down' as const };
    const index = ChainIndex.build([a]);

    expect(index.has(a.key)).toBe(true);
    expect(index.has(missing)).toBe(false);
  });
});
