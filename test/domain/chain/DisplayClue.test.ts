import { WordLength } from '../../../src/domain/word/WordLength';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import type { Word } from '../../../src/domain/word/Word';
import type { WordKey } from '../../../src/domain/word/WordKey';
import type { Direction } from '../../../src/domain/word/Direction';
import { DisplayClue } from '../../../src/domain/chain/DisplayClue';
import { ChainIndex } from '../../../src/domain/chain/ChainIndex';

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

function buildIndex(words: Word[]) {
  return ChainIndex.build(words);
}

describe('DisplayClue', () => {
  it('head word returns a head fact carrying its own clue', () => {
    const head = makeWord(0, 0, 'across', 1, 'Head clue');
    const index = buildIndex([head]);

    expect(DisplayClue.forWord(index, head)).toEqual({ kind: 'head', clue: 'Head clue' });
  });

  it('non-head across word returns a reference fact with the head number and direction', () => {
    const tail = makeWord(0, 2, 'across', 5, 'Tail clue');
    const head = makeWord(0, 0, 'across', 3, 'Head clue', tail.key);
    const index = buildIndex([head, tail]);

    expect(DisplayClue.forWord(index, tail)).toEqual({
      kind: 'reference',
      headNumber: 3,
      headDirection: 'across',
    });
  });

  it('non-head down word returns a reference fact with the head number and direction', () => {
    const tail = makeWord(2, 0, 'down', 9, 'Tail clue');
    const head = makeWord(0, 0, 'down', 7, 'Head clue', tail.key);
    const index = buildIndex([head, tail]);

    expect(DisplayClue.forWord(index, tail)).toEqual({
      kind: 'reference',
      headNumber: 7,
      headDirection: 'down',
    });
  });

  it("three-deep chain A->B->C: C returns a reference fact with A's number and direction", () => {
    const c = makeWord(0, 4, 'across', 6, 'C clue');
    const b = makeWord(0, 2, 'across', 5, 'B clue', c.key);
    const a = makeWord(0, 0, 'across', 4, 'A clue', b.key);
    const index = buildIndex([a, b, c]);

    expect(DisplayClue.forWord(index, c)).toEqual({
      kind: 'reference',
      headNumber: 4,
      headDirection: 'across',
    });
  });

  it('non-head word with empty own clue still returns a reference fact', () => {
    const tail = makeWord(0, 2, 'across', 3, '');
    const head = makeWord(0, 0, 'across', 2, '', tail.key);
    const index = buildIndex([head, tail]);

    expect(DisplayClue.forWord(index, tail)).toEqual({
      kind: 'reference',
      headNumber: 2,
      headDirection: 'across',
    });
  });

  it('head word with empty own clue returns a head fact with an empty clue', () => {
    const head = makeWord(0, 0, 'across', 1, '');
    const index = buildIndex([head]);

    expect(DisplayClue.forWord(index, head)).toEqual({ kind: 'head', clue: '' });
  });

  it('throws when a non-head word has no predecessor (unreachable state)', () => {
    const a = makeWord(0, 0, 'across', 1, 'A clue');
    const b = makeWord(0, 2, 'across', 2, 'B clue', a.key);
    const aa = { ...a, nextWord: b.key };
    const index = buildIndex([aa, b]);

    expect(() => DisplayClue.forWord(index, b)).toThrow(
      'cycle detected in chain',
    );
  });

  it('throws on backwards cycle (unreachable state)', () => {
    const a = makeWord(0, 0, 'across', 1, 'A clue');
    const b = makeWord(0, 2, 'across', 2, 'B clue', a.key);
    const aa = { ...a, nextWord: b.key };
    const index = buildIndex([aa, b]);

    expect(() => DisplayClue.forWord(index, b)).toThrow(
      'cycle detected in chain',
    );
  });
});
