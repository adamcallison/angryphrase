import { WordMap } from '../../../src/domain/word/WordMap';
import { WordLength } from '../../../src/domain/word/WordLength';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import type { Word } from '../../../src/domain/word/Word';
import type { WordKey } from '../../../src/domain/word/WordKey';
import type { Direction } from '../../../src/domain/word/Direction';
import { DisplayClue } from '../../../src/domain/chain/DisplayClue';

function makeWord(
  row: number,
  col: number,
  direction: Direction,
  number: number,
  clue: string,
  next: WordKey | null = null,
): Word {
  return {
    key: { startRow: Row.of(row), startCol: Col.of(col), direction },
    number: WordNumber.of(number),
    length: WordLength.of(2),
    clue,
    nextWord: next,
  };
}

function wordMap(words: Word[]) {
  return WordMap.fromWords(words);
}

describe('DisplayClue', () => {
  it('head word returns its own clue', () => {
    const head = makeWord(0, 0, 'across', 1, 'Head clue');
    const words = wordMap([head]);

    expect(DisplayClue.forWord(words, head)).toBe('Head clue');
  });

  it('non-head across word returns "See N Across" with head number and direction', () => {
    const tail = makeWord(0, 2, 'across', 5, 'Tail clue');
    const head = makeWord(0, 0, 'across', 3, 'Head clue', tail.key);
    const words = wordMap([head, tail]);

    expect(DisplayClue.forWord(words, tail)).toBe('See 3 Across');
  });

  it('non-head down word returns "See N Down" with head number and direction', () => {
    const tail = makeWord(2, 0, 'down', 9, 'Tail clue');
    const head = makeWord(0, 0, 'down', 7, 'Head clue', tail.key);
    const words = wordMap([head, tail]);

    expect(DisplayClue.forWord(words, tail)).toBe('See 7 Down');
  });

  it("three-deep chain A->B->C: C returns 'See A\'s number A\'s direction'", () => {
    const c = makeWord(0, 4, 'across', 6, 'C clue');
    const b = makeWord(0, 2, 'across', 5, 'B clue', c.key);
    const a = makeWord(0, 0, 'across', 4, 'A clue', b.key);
    const words = wordMap([a, b, c]);

    expect(DisplayClue.forWord(words, c)).toBe('See 4 Across');
  });

  it('non-head word with empty own clue still returns See N Direction', () => {
    const tail = makeWord(0, 2, 'across', 3, '');
    const head = makeWord(0, 0, 'across', 2, '', tail.key);
    const words = wordMap([head, tail]);

    expect(DisplayClue.forWord(words, tail)).toBe('See 2 Across');
  });

  it('head word with empty own clue returns empty string', () => {
    const head = makeWord(0, 0, 'across', 1, '');
    const words = wordMap([head]);

    expect(DisplayClue.forWord(words, head)).toBe('');
  });

  it('throws when a non-head word has no predecessor (unreachable state)', () => {
    const a = makeWord(0, 0, 'across', 1, 'A clue');
    const b = makeWord(0, 2, 'across', 2, 'B clue', a.key);
    const aa = { ...a, nextWord: b.key };
    const words = wordMap([aa, b]);

    expect(() => DisplayClue.forWord(words, b)).toThrow(
      'cycle detected in chain',
    );
  });

  it('throws on backwards cycle (unreachable state)', () => {
    const a = makeWord(0, 0, 'across', 1, 'A clue');
    const b = makeWord(0, 2, 'across', 2, 'B clue', a.key);
    const aa = { ...a, nextWord: b.key };
    const words = wordMap([aa, b]);

    expect(() => DisplayClue.forWord(words, b)).toThrow(
      'cycle detected in chain',
    );
  });
});
