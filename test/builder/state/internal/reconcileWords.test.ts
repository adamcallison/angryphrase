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
import { CellMarker } from '../../../../src/domain/grid/CellMarker';
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

function markerAt(grid: Grid, row: number, col: number): CellMarker {
  return GridOps.cellAt(grid, Row.of(row), Col.of(col)).marker;
}

function withMarker(grid: Grid, row: number, col: number, marker: CellMarker): Grid {
  return GridOps.setCell(grid, Row.of(row), Col.of(col), Cell.setMarker(GridOps.cellAt(grid, Row.of(row), Col.of(col)), marker));
}

function withRightFlag(grid: Grid, row: number, col: number, flag: 'space' | 'hyphen' | 'none'): Grid {
  const marker = markerAt(grid, row, col);
  const nextMarker =
    flag === 'space'
      ? { ...marker, spaceRight: true, hyphenRight: false }
      : flag === 'hyphen'
        ? { ...marker, spaceRight: false, hyphenRight: true }
        : { ...marker, spaceRight: false, hyphenRight: false };
  return withMarker(grid, row, col, nextMarker);
}

function withBottomFlag(grid: Grid, row: number, col: number, flag: 'space' | 'hyphen' | 'none'): Grid {
  const marker = markerAt(grid, row, col);
  const nextMarker =
    flag === 'space'
      ? { ...marker, spaceBottom: true, hyphenBottom: false }
      : flag === 'hyphen'
        ? { ...marker, spaceBottom: false, hyphenBottom: true }
        : { ...marker, spaceBottom: false, hyphenBottom: false };
  return withMarker(grid, row, col, nextMarker);
}

describe('reconcileWords', () => {
  it('no-op: identical old and new words returns same words with no events', () => {
    const grid = blank();
    const key = k(0, 0, 'across');
    const oldWords: Word[] = [w(key, 1, 5, 'A clue', null)];
    const newWords: DerivedWord[] = [derivedWord(key, 5, '', null)];

    const { words, displacedClues, events } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(words).toHaveLength(1);
    expect(words[0]!.clue).toBe('A clue');
    expect(words[0]!.nextWord).toBeNull();
    expect(events).toHaveLength(0);
    expect(displacedClues).toHaveLength(0);
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

    const { words, events } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(words).toHaveLength(2);
    const down = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(downKey));
    expect(down).toBeDefined();
    expect(down!.clue).toBe('');
    expect(down!.nextWord).toBeNull();
    expect(events).toHaveLength(0);
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

    const { words, displacedClues, events } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(words).toHaveLength(1);
    expect(words[0]!.key).toEqual(acrossKey);
    expect(displacedClues).toHaveLength(0);
    expect(events).toHaveLength(0);
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

    const { words, displacedClues } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(words).toHaveLength(1);
    expect(displacedClues).toHaveLength(1);
    expect(displacedClues[0]!.clue).toBe('Down clue');
    expect(displacedClues[0]!.direction).toBe('down');
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

    const { words, events } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const a = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
    const b = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(bKey));
    expect(a!.clue).toBe('A clue');
    expect(a!.nextWord).toEqual(bKey);
    expect(b!.clue).toBe('B clue');
    expect(b!.nextWord).toBeNull();
    expect(events).toHaveLength(0);
  });

  it('surviving word shortened: emits info toast with "shortened" and the new number', () => {
    const grid = withBlacks(blank(GridSize.of(3)), [[0, 2]]);
    const key = k(0, 0, 'across');
    const oldWords: Word[] = [w(key, 1, 3, 'A clue', null)];
    const newWords: DerivedWord[] = [derivedWord(key, 2, '', null)];

    const { words, events } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(words).toHaveLength(1);
    expect(words[0]!.length).toBe(2);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
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

    const { words, events } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(words).toHaveLength(1);
    expect(words[0]!.length).toBe(3);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
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

    const { words } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const a = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
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

    const { words } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const a = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
    const c = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(cKey));
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

    const { words } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const a = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
    const c = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(cKey));
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

    const { words, displacedClues } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const b = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(bKey));
    expect(b).toBeDefined();
    expect(b!.clue).toBe('');
    expect(b!.nextWord).toBeNull();
    expect(displacedClues).toHaveLength(1);
    expect(displacedClues[0]!.clue).toBe('A clue');
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

    const { words } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const a = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
    const tail = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(tailKey));
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

    const { events } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    const errorToasts = events.filter((event) => event.kind === 'toast' && event.toastKind === 'error');
    expect(errorToasts).toHaveLength(0);
  });

  it('Numbering.assign is run on the result (words have numbers assigned)', () => {
    const grid = blank();
    const aKey = k(0, 0, 'across');
    const oldWords: Word[] = [w(aKey, 99, 5, 'A clue', null)];
    const newWords: DerivedWord[] = [derivedWord(aKey, 5, '', null)];

    const { words } = reconcileWords(grid, oldWords, newWords, [], new SeededRng(1));

    expect(words).toHaveLength(1);
    expect(words[0]!.number).toBe(WordNumber.of(1));
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

  it('unchanged linked word keeps its boundary marker (space, hyphen, and none each preserved)', () => {
    const aKey = k(0, 0, 'across');
    const bKey = k(0, 4, 'across');
    const oldWords: Word[] = [w(aKey, 1, 3, 'A clue', bKey), w(bKey, 2, 2, 'B clue', null)];
    const newWords: DerivedWord[] = [derivedWord(aKey, 3, '', null), derivedWord(bKey, 2, '', null)];

    for (const kind of ['space', 'hyphen', 'none'] as const) {
      let marked = withBlacks(blank(GridSize.of(6)), [[0, 3]]);
      marked = withRightFlag(marked, 0, 2, kind);
      const { grid: reconciledGrid, words } = reconcileWords(marked, oldWords, newWords, [], new SeededRng(1));
      const marker = markerAt(reconciledGrid, 0, 2);
      expect(marker.spaceRight).toBe(kind === 'space');
      expect(marker.hyphenRight).toBe(kind === 'hyphen');
      const a = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
      expect(a!.nextWord).toEqual(bKey);
    }
  });

  it('lengthened linked word moves the boundary marker to the new last cell and clears the old cell', () => {
    const aKey = k(0, 0, 'across');
    const bKey = k(0, 4, 'across');
    const oldGrid = withRightFlag(
      withBlacks(blank(GridSize.of(6)), [
        [0, 2],
        [0, 3],
      ]),
      0,
      1,
      'space',
    );
    const oldWords: Word[] = [w(aKey, 1, 2, 'A clue', bKey), w(bKey, 2, 2, 'B clue', null)];
    const newGrid = GridOps.setCell(oldGrid, Row.of(0), Col.of(2), Cell.white());
    const newWords: DerivedWord[] = [derivedWord(aKey, 3, '', null), derivedWord(bKey, 2, '', null)];

    const { grid: reconciledGrid } = reconcileWords(newGrid, oldWords, newWords, [], new SeededRng(1));

    expect(markerAt(reconciledGrid, 0, 1).spaceRight).toBe(false);
    expect(markerAt(reconciledGrid, 0, 1).hyphenRight).toBe(false);
    expect(markerAt(reconciledGrid, 0, 2).spaceRight).toBe(true);
    expect(markerAt(reconciledGrid, 0, 2).hyphenRight).toBe(false);
  });

  it('end-shortened linked word defaults its boundary to space when the old end cell is destroyed', () => {
    const aKey = k(0, 0, 'across');
    const bKey = k(0, 4, 'across');
    const oldGrid = withRightFlag(withBlacks(blank(GridSize.of(6)), [[0, 3]]), 0, 2, 'hyphen');
    const oldWords: Word[] = [w(aKey, 1, 3, 'A clue', bKey), w(bKey, 2, 2, 'B clue', null)];
    const newGrid = withBlacks(oldGrid, [[0, 2]]);
    const newWords: DerivedWord[] = [derivedWord(aKey, 2, '', null), derivedWord(bKey, 2, '', null)];

    const { grid: reconciledGrid } = reconcileWords(newGrid, oldWords, newWords, [], new SeededRng(1));

    expect(GridOps.cellAt(reconciledGrid, Row.of(0), Col.of(2)).black).toBe(true);
    expect(markerAt(reconciledGrid, 0, 1).spaceRight).toBe(true);
    expect(markerAt(reconciledGrid, 0, 1).hyphenRight).toBe(false);
  });

  it('split linked word moves the boundary marker; surviving old end cell is cleared', () => {
    const aKey = k(0, 0, 'across');
    const bKey = k(0, 5, 'across');
    const oldGrid = withRightFlag(withBlacks(blank(GridSize.of(7)), [[0, 4]]), 0, 3, 'hyphen');
    const oldWords: Word[] = [w(aKey, 1, 4, 'A clue', bKey), w(bKey, 2, 2, 'B clue', null)];
    const newGrid = withBlacks(oldGrid, [[0, 2]]);
    const newWords: DerivedWord[] = [derivedWord(aKey, 2, '', null), derivedWord(bKey, 2, '', null)];

    const { grid: reconciledGrid } = reconcileWords(newGrid, oldWords, newWords, [], new SeededRng(1));

    expect(markerAt(reconciledGrid, 0, 3).spaceRight).toBe(false);
    expect(markerAt(reconciledGrid, 0, 3).hyphenRight).toBe(false);
    expect(markerAt(reconciledGrid, 0, 1).spaceRight).toBe(false);
    expect(markerAt(reconciledGrid, 0, 1).hyphenRight).toBe(true);
  });

  it('severed link (target destroyed) clears the source\'s boundary marker', () => {
    const aKey = k(0, 0, 'across');
    const bKey = k(0, 3, 'across');
    const oldGrid = withRightFlag(withBlacks(blank(GridSize.of(6)), [[0, 2]]), 0, 1, 'space');
    const oldWords: Word[] = [w(aKey, 1, 2, 'A clue', bKey), w(bKey, 2, 2, 'B clue', null)];
    const newGrid = withBlacks(oldGrid, [
      [0, 3],
      [0, 4],
    ]);
    const newWords: DerivedWord[] = [derivedWord(aKey, 2, '', null)];

    const { grid: reconciledGrid, words } = reconcileWords(newGrid, oldWords, newWords, [], new SeededRng(1));

    const a = words.find((word) => WordKey.toCanonical(word.key) === WordKey.toCanonical(aKey));
    expect(a!.nextWord).toBeNull();
    expect(markerAt(reconciledGrid, 0, 1).spaceRight).toBe(false);
    expect(markerAt(reconciledGrid, 0, 1).hyphenRight).toBe(false);
  });

  it('destroyed linked word clears its old end-cell marker', () => {
    const aKey = k(0, 0, 'across');
    const bKey = k(0, 4, 'across');
    const oldGrid = withRightFlag(withBlacks(blank(GridSize.of(6)), [[0, 3]]), 0, 2, 'hyphen');
    const oldWords: Word[] = [w(aKey, 1, 3, 'A clue', bKey), w(bKey, 2, 2, 'B clue', null)];
    const newGrid = withBlacks(oldGrid, [
      [0, 0],
      [0, 1],
    ]);
    const newWords: DerivedWord[] = [derivedWord(bKey, 2, '', null)];

    const { grid: reconciledGrid } = reconcileWords(newGrid, oldWords, newWords, [], new SeededRng(1));

    expect(GridOps.cellAt(reconciledGrid, Row.of(0), Col.of(2)).black).toBe(false);
    expect(markerAt(reconciledGrid, 0, 2).spaceRight).toBe(false);
    expect(markerAt(reconciledGrid, 0, 2).hyphenRight).toBe(false);
  });

  it('standalone words\' markers are untouched by reconciliation', () => {
    const aKey = k(0, 0, 'across');
    const cKey = k(1, 0, 'across');
    const oldGrid = withRightFlag(withBlacks(blank(GridSize.of(5)), [[0, 3]]), 0, 2, 'hyphen');
    const oldWords: Word[] = [
      w(aKey, 1, 3, 'A clue', null),
      w(cKey, 2, 3, 'C clue', null),
    ];
    const newGrid = withBlacks(oldGrid, [
      [0, 3],
      [1, 2],
    ]);
    const newWords: DerivedWord[] = [derivedWord(aKey, 3, '', null)];

    const { grid: reconciledGrid } = reconcileWords(newGrid, oldWords, newWords, [], new SeededRng(1));

    expect(markerAt(reconciledGrid, 0, 2).spaceRight).toBe(false);
    expect(markerAt(reconciledGrid, 0, 2).hyphenRight).toBe(true);
  });

  it('across and down linked words sharing a boundary cell update independent pairs', () => {
    const aKey = k(1, 0, 'across');
    const bKey = k(1, 3, 'across');
    const dKey = k(0, 1, 'down');
    const eKey = k(3, 1, 'down');
    const oldGrid = withBlacks(blank(GridSize.of(5)), [
      [0, 0],
      [0, 2],
      [0, 3],
      [0, 4],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4],
      [3, 0],
      [3, 2],
      [3, 3],
      [3, 4],
      [4, 0],
      [4, 2],
      [4, 3],
      [4, 4],
    ]);
    let marked = withRightFlag(oldGrid, 1, 1, 'space');
    marked = withBottomFlag(marked, 1, 1, 'hyphen');
    const oldWords: Word[] = [
      w(aKey, 1, 2, 'A clue', bKey),
      w(bKey, 2, 2, 'B clue', null),
      w(dKey, 3, 2, 'D clue', eKey),
      w(eKey, 4, 2, 'E clue', null),
    ];
    const newWords: DerivedWord[] = [
      derivedWord(aKey, 2, '', null),
      derivedWord(bKey, 2, '', null),
      derivedWord(dKey, 2, '', null),
      derivedWord(eKey, 2, '', null),
    ];

    const { grid: reconciledGrid } = reconcileWords(marked, oldWords, newWords, [], new SeededRng(1));

    const marker = markerAt(reconciledGrid, 1, 1);
    expect(marker.spaceRight).toBe(true);
    expect(marker.hyphenRight).toBe(false);
    expect(marker.spaceBottom).toBe(false);
    expect(marker.hyphenBottom).toBe(true);
  });
});
