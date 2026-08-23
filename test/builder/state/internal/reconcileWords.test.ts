import { describe, it, expect } from 'vitest';
import { reconcileWords } from '../../../../src/builder/state/internal/reconcileWords';
import { SeededRng } from '../../../fakes/SeededRng';
import { GridOps } from '../../../../src/domain/grid/GridOps';
import { GridSize } from '../../../../src/domain/grid/GridSize';
import { Cell } from '../../../../src/domain/grid/Cell';
import { Row } from '../../../../src/domain/grid/Row';
import { Col } from '../../../../src/domain/grid/Col';
import { WordKey } from '../../../../src/domain/word/WordKey';
import { WordNumber } from '../../../../src/domain/word/WordNumber';
import { WordLength } from '../../../../src/domain/word/WordLength';
import type { Direction } from '../../../../src/domain/word/Direction';
import type { Word } from '../../../../src/domain/word/Word';
import type { DerivedWord } from '../../../../src/domain/word/DerivedWord';
import type { Grid } from '../../../../src/domain/grid/Grid';

function k(row: number, col: number, direction: Direction) {
  return { startRow: Row.of(row), startCol: Col.of(col), direction };
}

function w(
  key: ReturnType<typeof k>,
  number: number,
  length: number,
  clue: string,
  nextWord: ReturnType<typeof k> | null,
): Word {
  return { key, number: WordNumber.of(number), length: WordLength.of(length), clue, nextWord };
}

function derivedWord(
  key: ReturnType<typeof k>,
  length: number,
  clue: string,
  nextWord: ReturnType<typeof k> | null,
): DerivedWord {
  return { key, length: WordLength.of(length), clue, nextWord };
}

function blank(size = GridSize.DEFAULT): Grid {
  return GridOps.blank(size);
}

function withBlack(grid: Grid, row: number, col: number): Grid {
  return GridOps.setCell(grid, Row.of(row), Col.of(col), Cell.black());
}

function withBlacks(grid: Grid, cells: [number, number][]): Grid {
  let g = grid;
  for (const [row, col] of cells) {
    g = withBlack(g, row, col);
  }
  return g;
}

describe('reconcileWords', () => {
  it('no-op: identical old and new words returns same words with no events', () => {
    const grid = blank();
    const key = k(0, 0, 'across');
    const oldWords: Word[] = [w(key, 1, 5, 'A clue', null)];
    const newWords: DerivedWord[] = [derivedWord(key, 5, '', null)];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(result.words).toHaveLength(1);
    expect(result.words[0]!.clue).toBe('A clue');
    expect(result.words[0]!.nextWord).toBeNull();
    expect(result.events).toHaveLength(0);
    expect(result.displacedClues).toHaveLength(0);
  });

  it('newly-appearing word: empty clue, no nextWord', () => {
    const grid = blank();
    const acrossKey = k(0, 0, 'across');
    const downKey = k(0, 0, 'down');
    const oldWords: Word[] = [w(acrossKey, 1, 5, 'Across clue', null)];
    const newWords: DerivedWord[] = [
      derivedWord(acrossKey, 5, '', null),
      derivedWord(downKey, 5, '', null),
    ];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(result.words).toHaveLength(2);
    const down = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(downKey));
    expect(down).toBeDefined();
    expect(down!.clue).toBe('');
    expect(down!.nextWord).toBeNull();
    expect(result.events).toHaveLength(0);
  });

  it('destroyed word with empty clue: removed, no DisplacedClue added', () => {
    const grid = blank();
    const acrossKey = k(0, 0, 'across');
    const downKey = k(0, 0, 'down');
    const oldWords: Word[] = [
      w(acrossKey, 1, 5, 'Across clue', null),
      w(downKey, 1, 5, '', null),
    ];
    const newWords: DerivedWord[] = [derivedWord(acrossKey, 5, '', null)];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(result.words).toHaveLength(1);
    expect(result.words[0]!.key).toEqual(acrossKey);
    expect(result.displacedClues).toHaveLength(0);
    expect(result.events).toHaveLength(0);
  });

  it('destroyed word with non-empty clue: removed, DisplacedClue added with same clue and direction', () => {
    const grid = blank();
    const acrossKey = k(0, 0, 'across');
    const downKey = k(0, 0, 'down');
    const oldWords: Word[] = [
      w(acrossKey, 1, 5, 'Across clue', null),
      w(downKey, 1, 5, 'Down clue', null),
    ];
    const newWords: DerivedWord[] = [derivedWord(acrossKey, 5, '', null)];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(result.words).toHaveLength(1);
    expect(result.displacedClues).toHaveLength(1);
    expect(result.displacedClues[0]!.clue).toBe('Down clue');
    expect(result.displacedClues[0]!.direction).toBe('down');
  });

  it('surviving word retains clue and nextWord', () => {
    const grid = blank();
    const aKey = k(0, 0, 'across');
    const bKey = k(2, 0, 'across');
    const oldWords: Word[] = [
      w(aKey, 1, 5, 'A clue', bKey),
      w(bKey, 2, 5, 'B clue', null),
    ];
    const newWords: DerivedWord[] = [
      derivedWord(aKey, 5, '', null),
      derivedWord(bKey, 5, '', null),
    ];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const a = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
    const b = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(bKey));
    expect(a!.clue).toBe('A clue');
    expect(a!.nextWord).toEqual(bKey);
    expect(b!.clue).toBe('B clue');
    expect(b!.nextWord).toBeNull();
    expect(result.events).toHaveLength(0);
  });

  it('surviving word shortened: emits info toast with "shortened" and the new number', () => {
    const grid = withBlacks(blank(GridSize.of(3)), [[0, 2]]);
    const key = k(0, 0, 'across');
    const oldWords: Word[] = [w(key, 1, 3, 'A clue', null)];
    const newWords: DerivedWord[] = [derivedWord(key, 2, '', null)];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(result.words).toHaveLength(1);
    expect(result.words[0]!.length).toBe(2);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'info',
      message: 'Word 1 across was shortened.',
    });
  });

  it('surviving word lengthened: emits info toast with "lengthened" and the new number', () => {
    const grid = blank(GridSize.of(3));
    const key = k(0, 0, 'across');
    const oldWords: Word[] = [w(key, 1, 2, 'A clue', null)];
    const newWords: DerivedWord[] = [derivedWord(key, 3, '', null)];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(result.words).toHaveLength(1);
    expect(result.words[0]!.length).toBe(3);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'info',
      message: 'Word 1 across was lengthened.',
    });
  });

  it('chain cleanup: surviving word whose nextWord pointed to a destroyed word has nextWord cleared', () => {
    const grid = blank();
    const aKey = k(0, 0, 'across');
    const bKey = k(2, 0, 'across');
    const oldWords: Word[] = [
      w(aKey, 1, 5, 'A clue', bKey),
      w(bKey, 2, 5, '', null),
    ];
    const newWords: DerivedWord[] = [derivedWord(aKey, 5, '', null)];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const a = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
    expect(a!.nextWord).toBeNull();
  });

  it('chain cleanup: destroyed head A→B→C, B destroyed, A nextWord cleared, C clue cleared', () => {
    const grid = blank();
    const aKey = k(0, 0, 'across');
    const bKey = k(2, 0, 'across');
    const cKey = k(4, 0, 'across');
    const oldWords: Word[] = [
      w(aKey, 1, 5, 'A clue', bKey),
      w(bKey, 2, 5, '', cKey),
      w(cKey, 3, 5, '', null),
    ];
    const newWords: DerivedWord[] = [
      derivedWord(aKey, 5, '', null),
      derivedWord(cKey, 5, '', null),
    ];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const a = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
    const c = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(cKey));
    expect(a!.nextWord).toBeNull();
    expect(c!.clue).toBe('');
  });

  it('chain cleanup: destroyed mid-chain word B (A→B→C), A nextWord cleared, C clue cleared', () => {
    const grid = blank();
    const aKey = k(0, 0, 'across');
    const bKey = k(2, 0, 'across');
    const cKey = k(4, 0, 'across');
    const oldWords: Word[] = [
      w(aKey, 1, 5, 'A clue', bKey),
      w(bKey, 2, 5, '', cKey),
      w(cKey, 3, 5, '', null),
    ];
    const newWords: DerivedWord[] = [
      derivedWord(aKey, 5, '', null),
      derivedWord(cKey, 5, '', null),
    ];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const a = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
    const c = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(cKey));
    expect(a!.nextWord).toBeNull();
    expect(c!.clue).toBe('');
  });

  it('chain cleanup: destroyed head whose nextWord target survives: nextWord target becomes a head, retains nothing from predecessor', () => {
    const grid = blank();
    const aKey = k(0, 0, 'across');
    const bKey = k(2, 0, 'across');
    const oldWords: Word[] = [
      w(aKey, 1, 5, 'A clue', bKey),
      w(bKey, 2, 5, '', null),
    ];
    const newWords: DerivedWord[] = [derivedWord(bKey, 5, '', null)];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const b = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(bKey));
    expect(b).toBeDefined();
    expect(b!.clue).toBe('');
    expect(b!.nextWord).toBeNull();
    expect(result.displacedClues).toHaveLength(1);
    expect(result.displacedClues[0]!.clue).toBe('A clue');
  });

  it('multiple destroyed words in same chain cleanup', () => {
    const grid = blank();
    const aKey = k(0, 0, 'across');
    const bKey = k(2, 0, 'across');
    const cKey = k(4, 0, 'across');
    const tailKey = k(6, 0, 'across');
    const oldWords: Word[] = [
      w(aKey, 1, 5, 'A clue', bKey),
      w(bKey, 2, 5, '', cKey),
      w(cKey, 3, 5, '', tailKey),
      w(tailKey, 4, 5, '', null),
    ];
    const newWords: DerivedWord[] = [
      derivedWord(aKey, 5, '', null),
      derivedWord(tailKey, 5, '', null),
    ];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const a = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
    const tail = result.words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(tailKey));
    expect(a!.nextWord).toBeNull();
    expect(tail!.clue).toBe('');
  });

  it('safety-net: ChainValidation reports no violations after cleanup (no error toasts emitted)', () => {
    const grid = blank();
    const aKey = k(0, 0, 'across');
    const bKey = k(2, 0, 'across');
    const oldWords: Word[] = [
      w(aKey, 1, 5, 'A clue', bKey),
      w(bKey, 2, 5, '', null),
    ];
    const newWords: DerivedWord[] = [derivedWord(aKey, 5, '', null)];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const errorToasts = result.events.filter((event) => event.kind === 'toast' && event.toastKind === 'error');
    expect(errorToasts).toHaveLength(0);
  });

  it('Numbering.assign is run on the result (words have numbers assigned)', () => {
    const grid = blank();
    const aKey = k(0, 0, 'across');
    const oldWords: Word[] = [w(aKey, 99, 5, 'A clue', null)];
    const newWords: DerivedWord[] = [derivedWord(aKey, 5, '', null)];

    const result = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(result.words).toHaveLength(1);
    expect(result.words[0]!.number).toBe(WordNumber.of(1));
  });

  it('throws on post-reconciliation chain violation (cycle survives reconciliation)', () => {
    const grid = blank();
    const keyA = k(0, 0, 'across');
    const keyB = k(0, 2, 'across');
    const oldWords: Word[] = [
      w(keyA, 1, 3, 'A clue', keyB),
      w(keyB, 2, 3, 'B clue', keyA),
    ];
    const newWords: DerivedWord[] = [
      derivedWord(keyA, 3, '', null),
      derivedWord(keyB, 3, '', null),
    ];

    expect(() => reconcileWords(grid, oldWords, newWords, [], new SeededRng(1))).toThrow(
      'reconcileWords: post-reconciliation invariant violated',
    );
    expect(() => reconcileWords(grid, oldWords, newWords, [], new SeededRng(1))).toThrow('cycle');
  });
});
