import { describe, expect, it } from 'vitest';
import {
  handleSelectCell,
  handleMoveCursor,
  handleClickCluePanelWord,
  handleTypeLetter,
  handleBackspace,
  handleCheck,
  handleClearErrors,
} from '../../../../src/player/state/internal/solving';
import { PlayerState } from '../../../../src/player/state/state';
import type { PlayerIntent } from '../../../../src/player/state/intents';
import { GridSize } from '../../../../src/domain/grid/GridSize';
import { Row } from '../../../../src/domain/grid/Row';
import { Col } from '../../../../src/domain/grid/Col';
import { GridOps } from '../../../../src/domain/grid/GridOps';
import { Cell } from '../../../../src/domain/grid/Cell';
import { Letter } from '../../../../src/domain/letter/Letter';
import { Puzzle } from '../../../../src/domain/puzzle/Puzzle';
import { PuzzleKey } from '../../../../src/domain/puzzle/PuzzleKey';
import { WordDerivation } from '../../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../../src/domain/word/Numbering';
import { SeededRng } from '../../../fakes/SeededRng';
import type { Direction } from '../../../../src/domain/word/Direction';
import { WordKey } from '../../../../src/domain/word/WordKey';

const deps = { rng: new SeededRng(1), now: () => 0 };

type SolvingPlayerState = Extract<PlayerState, { phase: 'solving' }>;

function assertSolving(state: PlayerState): SolvingPlayerState {
  if (state.phase !== 'solving') throw new Error('expected solving');
  return state;
}

function makeGrid(size: number, blackCells: [number, number][]): ReturnType<typeof GridOps.blank> {
  let grid = GridOps.blank(GridSize.of(size));
  for (const [r, c] of blackCells) {
    grid = GridOps.setCell(grid, Row.of(r), Col.of(c), Cell.black());
  }
  return grid;
}

function makePuzzle(size: number, blackCells: [number, number][]): Puzzle {
  const grid = makeGrid(size, blackCells);
  const words = Numbering.assign(grid, WordDerivation.derive(grid));
  const key = PuzzleKey.generate(new SeededRng(1));
  return Puzzle.withWords(Puzzle.withGrid(Puzzle.blank(GridSize.of(size), key), grid), words);
}

function solvingState(size: number, blackCells: [number, number][] = []): SolvingPlayerState {
  return PlayerState.loaded(makePuzzle(size, blackCells)) as SolvingPlayerState;
}

function importState() {
  return PlayerState.importScreen();
}

function withCursor(
  state: SolvingPlayerState,
  cursor: { row: number; col: number; direction: Direction },
): SolvingPlayerState {
  return {
    ...state,
    cursor: { row: Row.of(cursor.row), col: Col.of(cursor.col), direction: cursor.direction },
  };
}

function withCheckResult(
  state: SolvingPlayerState,
  classification: 'complete-correct' | 'incomplete-correct' | 'complete-incorrect' | 'incomplete-incorrect' = 'incomplete-correct',
): SolvingPlayerState {
  return {
    ...state,
    checkResult: {
      classification,
      incorrectCells: [],
      emptyCells: [],
    },
  };
}

function withAnagram(
  state: SolvingPlayerState,
  openedForWord: WordKey,
  input = '',
): SolvingPlayerState {
  return {
    ...state,
    anagram: {
      openedForWord,
      input,
      scrambledArrangement: null,
    },
  };
}

function withPlayerLetter(
  state: SolvingPlayerState,
  row: number,
  col: number,
  letter: string,
): SolvingPlayerState {
  const g = state.puzzle.grid;
  const cell = GridOps.cellAt(g, Row.of(row), Col.of(col));
  const newG = GridOps.setCell(
    g,
    Row.of(row),
    Col.of(col),
    Cell.setPlayerLetter(cell, Letter.try(letter)!),
  );
  return { ...state, puzzle: Puzzle.withGrid(state.puzzle, newG) };
}

function withAnswerLetter(
  state: SolvingPlayerState,
  row: number,
  col: number,
  letter: string,
): SolvingPlayerState {
  const g = state.puzzle.grid;
  const cell = GridOps.cellAt(g, Row.of(row), Col.of(col));
  const newG = GridOps.setCell(
    g,
    Row.of(row),
    Col.of(col),
    Cell.setAnswerLetter(cell, Letter.try(letter)!),
  );
  return { ...state, puzzle: Puzzle.withGrid(state.puzzle, newG) };
}

function findWordKey(
  state: SolvingPlayerState,
  startRow: number,
  startCol: number,
  direction: Direction,
): WordKey {
  const key = state.puzzle.words.find((w) =>
    WordKey.equals(w.key, {
      startRow: Row.of(startRow),
      startCol: Col.of(startCol),
      direction,
    }),
  )?.key;
  if (key === undefined) {
    throw new Error(`word not found at ${startRow},${startCol} ${direction}`);
  }
  return key;
}

describe('handleSelectCell', () => {
  it('select-cell: no-op when phase is import', () => {
    const state = importState();
    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(0), col: Col.of(0) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('select-cell: no-op on out-of-bounds coords', () => {
    const state = solvingState(5);
    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(999), col: Col.of(0) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('select-cell: no-op on black cell (FR-9)', () => {
    const state = solvingState(5, [[0, 0]]);
    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(0), col: Col.of(0) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('select-cell: no-op on isolated white cell (not part of any word — isSelectable returns false)', () => {
    const state = solvingState(5, [
      [0, 1],
      [1, 0],
    ]);
    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(0), col: Col.of(0) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('select-cell: on selectable cell that is part of only across word → direction across (FR-10)', () => {
    const state = solvingState(5, [
      [1, 2],
      [3, 2],
    ]);
    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('select-cell: on selectable cell that is part of only down word → direction down (FR-10)', () => {
    const state = solvingState(5, [
      [2, 1],
      [2, 3],
    ]);
    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'down',
    });
    expect(result.events).toEqual([]);
  });

  it('select-cell: on selectable cell part of both words → direction defaults across (FR-10)', () => {
    const state = solvingState(5);
    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('select-cell: clicking already-selected cell that is in both words → toggles direction (FR-11)', () => {
    const state = withCursor(solvingState(5), { row: 2, col: 2, direction: 'across' });
    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'down',
    });
    expect(result.events).toEqual([]);
  });

  it('select-cell: clicking already-selected cell that is in only one word → cursor unchanged, but checkResult cleared (§908)', () => {
    let state = solvingState(5, [
      [1, 2],
      [3, 2],
    ]);
    state = withCursor(state, { row: 2, col: 2, direction: 'across' });
    state = withCheckResult(state);
    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'across',
    });
    expect(assertSolving(result.state).checkResult).toBe(null);
    expect(result.events).toEqual([]);
  });

  it('select-cell: clears checkResult (§908)', () => {
    let state = solvingState(5);
    state = withCheckResult(state);
    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(assertSolving(result.state).checkResult).toBe(null);
    expect(result.events).toEqual([]);
  });

  it('select-cell: closes anagram modal when cursor moves to a cell whose word differs (FR-88)', () => {
    const state = solvingState(5, [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ]);
    const acrossWord = state.puzzle.words.find((w) => w.key.direction === 'across');
    if (acrossWord === undefined) throw new Error('expected across word');
    const stateWithAnagram = withAnagram(state, acrossWord.key);

    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(0) };
    const result = handleSelectCell(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(0),
      direction: 'across',
    });
    expect(assertSolving(result.state).anagram).toBe(null);
  });

  it('select-cell: keeps anagram modal open when cursor moves to a cell in the same word (FR-88)', () => {
    const state = solvingState(5, [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ]);
    const acrossWord = state.puzzle.words.find((w) => w.key.direction === 'across');
    if (acrossWord === undefined) throw new Error('expected across word');
    const stateWithAnagram = withAnagram(state, acrossWord.key);

    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(0), col: Col.of(2) };
    const result = handleSelectCell(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(2),
      direction: 'across',
    });
    expect(assertSolving(result.state).anagram).toEqual(stateWithAnagram.anagram);
  });

  it('select-cell: anagram stays open when cursor moves to a cell in the same chain', () => {
    const state = solvingState(5);
    const aKey = findWordKey(state, 0, 0, 'across');
    const bKey = findWordKey(state, 1, 0, 'across');
    const chainedWords = state.puzzle.words.map((w) =>
      WordKey.equals(w.key, aKey) ? { ...w, nextWord: bKey } : w,
    );
    const chainedState = { ...state, puzzle: Puzzle.withWords(state.puzzle, chainedWords) };
    const stateWithAnagram = withAnagram(
      withCursor(chainedState, { row: 0, col: 0, direction: 'across' }),
      aKey,
    );

    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(1), col: Col.of(2) };
    const result = handleSelectCell(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(1),
      col: Col.of(2),
      direction: 'across',
    });
    expect(assertSolving(result.state).anagram).toEqual(stateWithAnagram.anagram);
  });

  it('select-cell: anagram closes when cursor moves to a cell in a different chain', () => {
    const state = solvingState(5);
    const aKey = findWordKey(state, 0, 0, 'across');
    const bKey = findWordKey(state, 1, 0, 'across');
    const chainedWords = state.puzzle.words.map((w) =>
      WordKey.equals(w.key, aKey) ? { ...w, nextWord: bKey } : w,
    );
    const chainedState = { ...state, puzzle: Puzzle.withWords(state.puzzle, chainedWords) };
    const stateWithAnagram = withAnagram(
      withCursor(chainedState, { row: 0, col: 0, direction: 'across' }),
      aKey,
    );

    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(0), col: Col.of(0) };
    const result = handleSelectCell(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'down',
    });
    expect(assertSolving(result.state).anagram).toBe(null);
  });

  it('select-cell: opens / no effect on anagram when cursor moves to a different word with no anagram currently open', () => {
    const state = solvingState(5, [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ]);

    const intent: PlayerIntent = { kind: 'select-cell', row: Row.of(0), col: Col.of(2) };
    const result = handleSelectCell(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(2),
      direction: 'across',
    });
    expect(assertSolving(result.state).anagram).toBe(null);
  });
});

describe('handleMoveCursor', () => {
  it('move-cursor: no-op when phase is import', () => {
    const state = importState();
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: 1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('move-cursor: no-op when cursor is null', () => {
    const state = solvingState(5);
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: 1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('move-cursor: target selectable → cursor moves and direction updates (FR-14)', () => {
    const state = withCursor(solvingState(5), { row: 2, col: 2, direction: 'down' });
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: 1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(3),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor: target not selectable (next cell black) → cursor stays but direction updates (FR-14)', () => {
    const state = withCursor(solvingState(5, [[2, 3]]), { row: 2, col: 2, direction: 'down' });
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: 1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor: target at grid boundary → cursor stays but direction updates', () => {
    const state = withCursor(solvingState(5), { row: 2, col: 4, direction: 'down' });
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: 1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(4),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor with sign: -1 moves cursor backward along the across axis (column decrements)', () => {
    const state = withCursor(solvingState(5), { row: 2, col: 2, direction: 'down' });
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: -1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(1),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor with sign: -1 along down axis (row decrements)', () => {
    const state = withCursor(solvingState(5), { row: 2, col: 2, direction: 'across' });
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'down', sign: -1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(1),
      col: Col.of(2),
      direction: 'down',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor with sign: -1 target not selectable (black cell behind) → cursor stays, direction updates', () => {
    const state = withCursor(solvingState(5, [[2, 1]]), { row: 2, col: 2, direction: 'down' });
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: -1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor with sign: -1 at grid boundary (column 0) → cursor stays, direction updates', () => {
    const state = withCursor(solvingState(5), { row: 2, col: 0, direction: 'down' });
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: -1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(0),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor: clears checkResult (§908)', () => {
    let state = solvingState(5);
    state = withCursor(state, { row: 2, col: 2, direction: 'across' });
    state = withCheckResult(state);
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: 1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(assertSolving(result.state).checkResult).toBe(null);
    expect(result.events).toEqual([]);
  });

  it('move-cursor: with direction "down", cursor moves +1 row when target selectable', () => {
    const state = withCursor(solvingState(5), { row: 2, col: 2, direction: 'across' });
    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'down', sign: 1 };

    const result = handleMoveCursor(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(3),
      col: Col.of(2),
      direction: 'down',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor: closes anagram modal when cursor moves to a word that differs (FR-88)', () => {
    const state = solvingState(5, [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ]);
    const acrossWord = state.puzzle.words.find((w) => w.key.direction === 'across');
    if (acrossWord === undefined) throw new Error('expected across word');
    let stateWithAnagram = withAnagram(state, acrossWord.key);
    stateWithAnagram = withCursor(stateWithAnagram, { row: 0, col: 0, direction: 'across' });

    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'down', sign: 1 };
    const result = handleMoveCursor(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'down',
    });
    expect(assertSolving(result.state).anagram).toBe(null);
  });

  it('move-cursor: keeps anagram modal open when cursor moves within the same word (FR-88)', () => {
    const state = solvingState(5, [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ]);
    const acrossWord = state.puzzle.words.find((w) => w.key.direction === 'across');
    if (acrossWord === undefined) throw new Error('expected across word');
    let stateWithAnagram = withAnagram(state, acrossWord.key);
    stateWithAnagram = withCursor(stateWithAnagram, { row: 0, col: 0, direction: 'across' });

    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: 1 };
    const result = handleMoveCursor(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(1),
      direction: 'across',
    });
    expect(assertSolving(result.state).anagram).toEqual(stateWithAnagram.anagram);
  });

  it('move-cursor: cursor staying in place but changing direction (FR-14 boundary case) keeps anagram modal open if cell is in same word', () => {
    const state = solvingState(3);
    const downWord = state.puzzle.words.find(
      (w) => w.key.direction === 'down' && Number(w.key.startRow) === 0 && Number(w.key.startCol) === 0,
    );
    if (downWord === undefined) throw new Error('expected down word');
    let stateWithAnagram = withAnagram(state, downWord.key);
    stateWithAnagram = withCursor(stateWithAnagram, { row: 2, col: 0, direction: 'across' });

    const intent: PlayerIntent = { kind: 'move-cursor', direction: 'down', sign: 1 };
    const result = handleMoveCursor(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(2),
      col: Col.of(0),
      direction: 'down',
    });
    expect(assertSolving(result.state).anagram).toEqual(stateWithAnagram.anagram);
  });

  it('move-cursor: anagram stays open within same chain, closes on chain change', () => {
    const state = solvingState(5);
    const aKey = findWordKey(state, 0, 0, 'across');
    const bKey = findWordKey(state, 0, 0, 'down');
    const chainedWords = state.puzzle.words.map((w) =>
      WordKey.equals(w.key, aKey) ? { ...w, nextWord: bKey } : w,
    );
    const chainedState = { ...state, puzzle: Puzzle.withWords(state.puzzle, chainedWords) };
    let stateWithAnagram = withAnagram(chainedState, aKey);
    stateWithAnagram = withCursor(stateWithAnagram, { row: 0, col: 0, direction: 'across' });

    const withinChain: PlayerIntent = { kind: 'move-cursor', direction: 'down', sign: 1 };
    const first = handleMoveCursor(stateWithAnagram, withinChain, deps);

    expect(assertSolving(first.state).cursor).toEqual({
      row: Row.of(1),
      col: Col.of(0),
      direction: 'down',
    });
    expect(assertSolving(first.state).anagram).toEqual(stateWithAnagram.anagram);

    const crossChain: PlayerIntent = { kind: 'move-cursor', direction: 'across', sign: 1 };
    const second = handleMoveCursor(first.state, crossChain, deps);

    expect(assertSolving(second.state).cursor).toEqual({
      row: Row.of(1),
      col: Col.of(1),
      direction: 'across',
    });
    expect(assertSolving(second.state).anagram).toBe(null);
  });
});

describe('handleClickCluePanelWord', () => {
  it('click-clue-panel-word: no-op when phase is import', () => {
    const state = importState();
    const intent: PlayerIntent = {
      kind: 'click-clue-panel-word',
      wordKey: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
    };

    const result = handleClickCluePanelWord(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('click-clue-panel-word: no-op when wordKey not found (defensive)', () => {
    const state = solvingState(5);
    const intent: PlayerIntent = {
      kind: 'click-clue-panel-word',
      wordKey: { startRow: Row.of(999), startCol: Col.of(0), direction: 'across' },
    };

    const result = handleClickCluePanelWord(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('click-clue-panel-word: cursor jumps to word start cell with word direction', () => {
    const state = solvingState(5);
    const word = state.puzzle.words[0];
    if (word === undefined) throw new Error('expected a word');
    const intent: PlayerIntent = { kind: 'click-clue-panel-word', wordKey: word.key };

    const result = handleClickCluePanelWord(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: word.key.startRow,
      col: word.key.startCol,
      direction: word.key.direction,
    });
    expect(result.events).toEqual([]);
  });

  it('click-clue-panel-word: clears checkResult (§908)', () => {
    let state = solvingState(5);
    state = withCheckResult(state);
    const word = state.puzzle.words[0];
    if (word === undefined) throw new Error('expected a word');
    const intent: PlayerIntent = { kind: 'click-clue-panel-word', wordKey: word.key };

    const result = handleClickCluePanelWord(state, intent, deps);

    expect(assertSolving(result.state).checkResult).toBe(null);
    expect(result.events).toEqual([]);
  });

  it('click-clue-panel-word: closes anagram modal if word differs from openedForWord (FR-88)', () => {
    const state = solvingState(5, [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ]);
    const acrossWord = state.puzzle.words.find((w) => w.key.direction === 'across');
    if (acrossWord === undefined) throw new Error('expected across word');
    const downWord = state.puzzle.words.find((w) => w.key.direction === 'down');
    if (downWord === undefined) throw new Error('expected down word');
    const stateWithAnagram = withAnagram(state, acrossWord.key);

    const intent: PlayerIntent = { kind: 'click-clue-panel-word', wordKey: downWord.key };
    const result = handleClickCluePanelWord(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: downWord.key.startRow,
      col: downWord.key.startCol,
      direction: downWord.key.direction,
    });
    expect(assertSolving(result.state).anagram).toBe(null);
  });

  it('click-clue-panel-word: keeps anagram modal open if word === openedForWord (cursor within same word)', () => {
    const state = solvingState(5, [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ]);
    const acrossWord = state.puzzle.words.find((w) => w.key.direction === 'across');
    if (acrossWord === undefined) throw new Error('expected across word');
    const stateWithAnagram = withAnagram(state, acrossWord.key);

    const intent: PlayerIntent = { kind: 'click-clue-panel-word', wordKey: acrossWord.key };
    const result = handleClickCluePanelWord(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: acrossWord.key.startRow,
      col: acrossWord.key.startCol,
      direction: acrossWord.key.direction,
    });
    expect(assertSolving(result.state).anagram).toEqual(stateWithAnagram.anagram);
  });

  it('click-clue-panel-word: anagram stays open if clicked word is in same chain', () => {
    const state = solvingState(5);
    const aKey = findWordKey(state, 0, 0, 'across');
    const bKey = findWordKey(state, 0, 0, 'down');
    const chainedWords = state.puzzle.words.map((w) =>
      WordKey.equals(w.key, aKey) ? { ...w, nextWord: bKey } : w,
    );
    const chainedState = { ...state, puzzle: Puzzle.withWords(state.puzzle, chainedWords) };
    const stateWithAnagram = withAnagram(
      withCursor(chainedState, { row: 0, col: 0, direction: 'across' }),
      aKey,
    );

    const intent: PlayerIntent = { kind: 'click-clue-panel-word', wordKey: bKey };
    const result = handleClickCluePanelWord(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: bKey.startRow,
      col: bKey.startCol,
      direction: bKey.direction,
    });
    expect(assertSolving(result.state).anagram).toEqual(stateWithAnagram.anagram);
  });

  it('click-clue-panel-word: cursor resulting cell is selectable (it is the word start)', () => {
    const state = solvingState(5);
    const word = state.puzzle.words[0];
    if (word === undefined) throw new Error('expected a word');
    const intent: PlayerIntent = { kind: 'click-clue-panel-word', wordKey: word.key };

    const result = handleClickCluePanelWord(state, intent, deps);

    expect(GridOps.isSelectable(assertSolving(result.state).puzzle.grid, word.key.startRow, word.key.startCol)).toBe(true);
  });
});

describe('handleTypeLetter', () => {
  it('type-letter: no-op when phase is import', () => {
    const state = importState();
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('type-letter: no-op when cursor is null', () => {
    const state = solvingState(5);
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('type-letter: writes playerLetter to selected cell (FR-12 / FR-50)', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(
      Letter.try('A'),
    );
    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(1),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('type-letter: overwrites existing playerLetter (FR-12)', () => {
    let state = withPlayerLetter(solvingState(5), 0, 0, 'X');
    state = withCursor(state, { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(
      Letter.try('A'),
    );
  });

  it('type-letter: does not modify answerLetter (FR-50 — Player writes player field only)', () => {
    let state = solvingState(5);
    const g = state.puzzle.grid;
    const cell = GridOps.cellAt(g, Row.of(0), Col.of(0));
    state = {
      ...state,
      puzzle: Puzzle.withGrid(
        state.puzzle,
        GridOps.setCell(g, Row.of(0), Col.of(0), Cell.setAnswerLetter(cell, Letter.try('Z')!)),
      ),
    };
    state = withCursor(state, { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toBe(
      Letter.try('Z'),
    );
    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(
      Letter.try('A'),
    );
  });

  it('type-letter: advances cursor to next selectable cell in current direction (FR-12)', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(1),
      direction: 'across',
    });
  });

  it('type-letter: stays on current cell when next is black (FR-12)', () => {
    const state = withCursor(solvingState(5, [[0, 1]]), { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'across',
    });
    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(
      Letter.try('A'),
    );
  });

  it('type-letter: stays on current cell at grid boundary (FR-12)', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 4, direction: 'across' });
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(4),
      direction: 'across',
    });
    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(4)).playerLetter).toBe(
      Letter.try('A'),
    );
  });

  it('type-letter: letter still written when cursor stays (FR-12)', () => {
    const state = withCursor(solvingState(5, [[0, 1]]), { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'across',
    });
    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(
      Letter.try('A'),
    );
  });

  it('type-letter: direction "down" advances +1 row', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'down' });
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(1),
      col: Col.of(0),
      direction: 'down',
    });
  });

  it('type-letter: no-op on black cursor cell (defensive)', () => {
    const state = withCursor(solvingState(5, [[0, 0]]), { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('type-letter: clears checkResult (§908 clear-on-change)', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    state = withCheckResult(state);
    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(assertSolving(result.state).checkResult).toBe(null);
  });

  it('type-letter: with anagram open, advance within same word → modal kept open', () => {
    const state = solvingState(5);
    const acrossWord = state.puzzle.words.find(
      (w) => w.key.direction === 'across' && Number(w.key.startRow) === 0 && Number(w.key.startCol) === 0,
    );
    if (acrossWord === undefined) throw new Error('expected across word');
    let stateWithAnagram = withAnagram(state, acrossWord.key);
    stateWithAnagram = withCursor(stateWithAnagram, { row: 0, col: 0, direction: 'across' });

    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };
    const result = handleTypeLetter(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(1),
      direction: 'across',
    });
    expect(assertSolving(result.state).anagram).toEqual(stateWithAnagram.anagram);
  });

  it('type-letter: with anagram open, advance that does not move cursor (next is black) → modal kept open (cursor unchanged)', () => {
    const state = solvingState(5, [[0, 3]]);
    const acrossWord = state.puzzle.words.find(
      (w) => w.key.direction === 'across' && Number(w.key.startRow) === 0 && Number(w.key.startCol) === 0,
    );
    if (acrossWord === undefined) throw new Error('expected across word');
    let stateWithAnagram = withAnagram(state, acrossWord.key);
    stateWithAnagram = withCursor(stateWithAnagram, { row: 0, col: 2, direction: 'across' });

    const intent: PlayerIntent = { kind: 'type-letter', letter: Letter.try('A')! };
    const result = handleTypeLetter(stateWithAnagram, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(2),
      direction: 'across',
    });
    expect(assertSolving(result.state).anagram).toEqual(stateWithAnagram.anagram);
  });
});

describe('handleBackspace', () => {
  it('backspace: no-op when phase is import', () => {
    const state = importState();
    const intent: PlayerIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('backspace: no-op when cursor is null', () => {
    const state = solvingState(5);
    const intent: PlayerIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('backspace: deletes playerLetter and keeps cursor when current cell has a letter (FR-13)', () => {
    let state = withPlayerLetter(solvingState(5), 0, 0, 'X');
    state = withCursor(state, { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);
    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('backspace: when current cell empty, retreats and deletes previous cell playerLetter (FR-13)', () => {
    let state = withPlayerLetter(solvingState(5), 0, 0, 'X');
    state = withCursor(state, { row: 0, col: 1, direction: 'across' });
    const intent: PlayerIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);
    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'across',
    });
  });

  it('backspace: when current cell empty and previous is at grid start, stays and nothing deleted (FR-13)', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'across',
    });
    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);
    expect(result.state).toEqual(state);
  });

  it('backspace: when current cell empty and previous is black, stays and nothing deleted (FR-13)', () => {
    const state = withCursor(solvingState(5, [[0, 1]]), { row: 0, col: 2, direction: 'across' });
    const intent: PlayerIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(2),
      direction: 'across',
    });
    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(2)).playerLetter).toBe(null);
    expect(result.state).toEqual(state);
  });

  it('backspace: direction "down" retreats -1 row', () => {
    let state = withPlayerLetter(solvingState(5), 0, 0, 'X');
    state = withCursor(state, { row: 1, col: 0, direction: 'down' });
    const intent: PlayerIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);
    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'down',
    });
  });

  it('backspace: does not modify answerLetter (FR-50)', () => {
    let state = solvingState(5);
    const g = state.puzzle.grid;
    const cell = GridOps.cellAt(g, Row.of(0), Col.of(0));
    state = {
      ...state,
      puzzle: Puzzle.withGrid(
        state.puzzle,
        GridOps.setCell(g, Row.of(0), Col.of(0), Cell.setAnswerLetter(cell, Letter.try('Z')!)),
      ),
    };
    state = withPlayerLetter(state, 0, 0, 'X');
    state = withCursor(state, { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toBe(
      Letter.try('Z'),
    );
    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);
  });

  it('backspace: clears checkResult (§908 clear-on-change)', () => {
    let state = withPlayerLetter(solvingState(5), 0, 0, 'X');
    state = withCursor(state, { row: 0, col: 0, direction: 'across' });
    state = withCheckResult(state);
    const intent: PlayerIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(assertSolving(result.state).checkResult).toBe(null);
  });

  it('backspace: with anagram open, retreat within same word → modal kept open', () => {
    const state = solvingState(5);
    const acrossWord = state.puzzle.words.find(
      (w) => w.key.direction === 'across' && Number(w.key.startRow) === 0 && Number(w.key.startCol) === 0,
    );
    if (acrossWord === undefined) throw new Error('expected across word');
    let stateWithAnagram = withAnagram(state, acrossWord.key);
    stateWithAnagram = withPlayerLetter(stateWithAnagram, 0, 0, 'X');
    stateWithAnagram = withCursor(stateWithAnagram, { row: 0, col: 1, direction: 'across' });

    const intent: PlayerIntent = { kind: 'backspace' };
    const result = handleBackspace(stateWithAnagram, intent, deps);

    expect(GridOps.cellAt(assertSolving(result.state).puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);
    expect(assertSolving(result.state).cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'across',
    });
    expect(assertSolving(result.state).anagram).toEqual(stateWithAnagram.anagram);
  });
});

describe('handleCheck', () => {
  it('check: no-op when phase is import', () => {
    const state = importState();
    const intent: PlayerIntent = { kind: 'check' };

    const result = handleCheck(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('check: complete-correct — all white cells filled and correct', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'A');
    state = withPlayerLetter(state, 0, 1, 'B');
    state = withPlayerLetter(state, 1, 0, 'C');
    state = withPlayerLetter(state, 1, 1, 'D');

    const result = handleCheck(state, { kind: 'check' }, deps);

    expect(assertSolving(result.state).checkResult).toEqual({
      classification: 'complete-correct',
      incorrectCells: [],
      emptyCells: [],
    });
    expect(result.events).toEqual([]);
  });

  it('check: incomplete-correct — some white empty, all filled correct', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'A');
    state = withPlayerLetter(state, 1, 1, 'D');

    const result = handleCheck(state, { kind: 'check' }, deps);

    expect(assertSolving(result.state).checkResult).toEqual({
      classification: 'incomplete-correct',
      incorrectCells: [],
      emptyCells: [
        { row: Row.of(0), col: Col.of(1) },
        { row: Row.of(1), col: Col.of(0) },
      ],
    });
  });

  it('check: complete-incorrect — all filled, some incorrect', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'A');
    state = withPlayerLetter(state, 0, 1, 'X');
    state = withPlayerLetter(state, 1, 0, 'C');
    state = withPlayerLetter(state, 1, 1, 'Y');

    const result = handleCheck(state, { kind: 'check' }, deps);

    expect(assertSolving(result.state).checkResult).toEqual({
      classification: 'complete-incorrect',
      incorrectCells: [
        { row: Row.of(0), col: Col.of(1) },
        { row: Row.of(1), col: Col.of(1) },
      ],
      emptyCells: [],
    });
  });

  it('check: incomplete-incorrect — some empty, some incorrect', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'A');
    state = withPlayerLetter(state, 0, 1, 'X');

    const result = handleCheck(state, { kind: 'check' }, deps);

    expect(assertSolving(result.state).checkResult).toEqual({
      classification: 'incomplete-incorrect',
      incorrectCells: [{ row: Row.of(0), col: Col.of(1) }],
      emptyCells: [
        { row: Row.of(1), col: Col.of(0) },
        { row: Row.of(1), col: Col.of(1) },
      ],
    });
  });

  it('check: ignores black cells (no black cell appears in incorrect or empty lists)', () => {
    let state = solvingState(3, [[1, 1]]);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 0, 2, 'C');
    state = withAnswerLetter(state, 1, 0, 'D');
    state = withAnswerLetter(state, 1, 2, 'E');
    state = withAnswerLetter(state, 2, 0, 'F');
    state = withAnswerLetter(state, 2, 1, 'G');
    state = withAnswerLetter(state, 2, 2, 'H');
    state = withPlayerLetter(state, 0, 0, 'A');
    state = withPlayerLetter(state, 0, 1, 'B');
    state = withPlayerLetter(state, 0, 2, 'C');
    state = withPlayerLetter(state, 1, 0, 'D');
    state = withPlayerLetter(state, 1, 2, 'E');
    state = withPlayerLetter(state, 2, 0, 'F');
    state = withPlayerLetter(state, 2, 1, 'G');
    state = withPlayerLetter(state, 2, 2, 'H');

    const result = handleCheck(state, { kind: 'check' }, deps);

    const checkResult = assertSolving(result.state).checkResult;
    expect(checkResult?.classification).toBe('complete-correct');
    expect(checkResult?.incorrectCells).toEqual([]);
    expect(checkResult?.emptyCells).toEqual([]);
    expect(
      checkResult?.incorrectCells.some((c) => c.row === Row.of(1) && c.col === Col.of(1)),
    ).toBe(false);
  });

  it('check: empty puzzle grid (all white empty) → incomplete-correct with emptyCells = all whites, incorrectCells = []', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');

    const result = handleCheck(state, { kind: 'check' }, deps);

    expect(assertSolving(result.state).checkResult).toEqual({
      classification: 'incomplete-correct',
      incorrectCells: [],
      emptyCells: [
        { row: Row.of(0), col: Col.of(0) },
        { row: Row.of(0), col: Col.of(1) },
        { row: Row.of(1), col: Col.of(0) },
        { row: Row.of(1), col: Col.of(1) },
      ],
    });
  });

  it('check: checkResult.incorrectCells contains (row, col) entries for incorrect cells only', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'A');
    state = withPlayerLetter(state, 0, 1, 'X');
    state = withPlayerLetter(state, 1, 0, 'C');
    state = withPlayerLetter(state, 1, 1, 'D');

    const result = handleCheck(state, { kind: 'check' }, deps);

    expect(assertSolving(result.state).checkResult?.incorrectCells).toEqual([
      { row: Row.of(0), col: Col.of(1) },
    ]);
  });

  it('check: checkResult.emptyCells contains (row, col) entries for empty white cells only', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'A');

    const result = handleCheck(state, { kind: 'check' }, deps);

    expect(assertSolving(result.state).checkResult?.emptyCells).toEqual([
      { row: Row.of(0), col: Col.of(1) },
      { row: Row.of(1), col: Col.of(0) },
      { row: Row.of(1), col: Col.of(1) },
    ]);
  });

  it('check: preserves puzzle, cursor, anagram unchanged (only sets checkResult)', () => {
    const state = solvingState(2);
    const stateWithCursor = withCursor(state, { row: 0, col: 0, direction: 'across' });
    const acrossWord = state.puzzle.words.find(
      (w) => w.key.direction === 'across' && Number(w.key.startRow) === 0 && Number(w.key.startCol) === 0,
    );
    if (acrossWord === undefined) throw new Error('expected across word');
    const stateWithAnagram = withAnagram(stateWithCursor, acrossWord.key);

    const result = handleCheck(stateWithAnagram, { kind: 'check' }, deps);

    const next = assertSolving(result.state);
    expect(next.puzzle).toBe(stateWithAnagram.puzzle);
    expect(next.cursor).toBe(stateWithAnagram.cursor);
    expect(next.anagram).toBe(stateWithAnagram.anagram);
    expect(next.checkResult).not.toBe(null);
  });

  it('check: re-running check with same state produces same checkResult (idempotent)', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'A');
    state = withPlayerLetter(state, 0, 1, 'X');

    const first = handleCheck(state, { kind: 'check' }, deps);
    const second = handleCheck(first.state, { kind: 'check' }, deps);

    expect(assertSolving(second.state).checkResult).toEqual(
      assertSolving(first.state).checkResult,
    );
  });

  it('check: degenerate case — white cell with answerLetter === null is classified as incorrect (defensive)', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'A');

    const result = handleCheck(state, { kind: 'check' }, deps);

    expect(assertSolving(result.state).checkResult?.incorrectCells).toContainEqual({
      row: Row.of(0),
      col: Col.of(0),
    });
  });
});

describe('handleClearErrors', () => {
  it('clear-errors: no-op when phase is import', () => {
    const state = importState();
    const intent: PlayerIntent = { kind: 'clear-errors' };

    const result = handleClearErrors(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('clear-errors: no-op when checkResult is null', () => {
    const state = solvingState(2);
    const intent: PlayerIntent = { kind: 'clear-errors' };

    const result = handleClearErrors(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('clear-errors: no-op when checkResult.incorrectCells is empty (FR-75 only-offered-if-incorrect)', () => {
    let state = solvingState(2);
    state = withCheckResult(state, 'complete-correct');

    const result = handleClearErrors(state, { kind: 'clear-errors' }, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('clear-errors: clears playerLetter to null on every incorrect cell (FR-75)', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'A');
    state = withPlayerLetter(state, 0, 1, 'X');
    state = withPlayerLetter(state, 1, 0, 'Y');
    state = withPlayerLetter(state, 1, 1, 'D');
    const checked = handleCheck(state, { kind: 'check' }, deps);

    const result = handleClearErrors(checked.state, { kind: 'clear-errors' }, deps);

    const next = assertSolving(result.state);
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(0), Col.of(1)).playerLetter).toBe(null);
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(1), Col.of(0)).playerLetter).toBe(null);
  });

  it('clear-errors: leaves correct cells untouched (playerLetter of correct cells preserved)', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'A');
    state = withPlayerLetter(state, 0, 1, 'X');
    state = withPlayerLetter(state, 1, 1, 'D');
    const checked = handleCheck(state, { kind: 'check' }, deps);

    const result = handleClearErrors(checked.state, { kind: 'clear-errors' }, deps);

    const next = assertSolving(result.state);
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(Letter.try('A'));
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(1), Col.of(1)).playerLetter).toBe(Letter.try('D'));
  });

  it('clear-errors: leaves empty cells untouched (playerLetter stays null)', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 1, 'X');
    const checked = handleCheck(state, { kind: 'check' }, deps);

    const result = handleClearErrors(checked.state, { kind: 'clear-errors' }, deps);

    const next = assertSolving(result.state);
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(1), Col.of(0)).playerLetter).toBe(null);
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(1), Col.of(1)).playerLetter).toBe(null);
  });

  it('clear-errors: leaves answerLetter intact on all cells', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 1, 'X');
    const checked = handleCheck(state, { kind: 'check' }, deps);

    const result = handleClearErrors(checked.state, { kind: 'clear-errors' }, deps);

    const next = assertSolving(result.state);
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toBe(Letter.try('A'));
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(0), Col.of(1)).answerLetter).toBe(Letter.try('B'));
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(1), Col.of(0)).answerLetter).toBe(Letter.try('C'));
    expect(GridOps.cellAt(next.puzzle.grid, Row.of(1), Col.of(1)).answerLetter).toBe(Letter.try('D'));
  });

  it('clear-errors: clears checkResult to null after clearing (§908 clear-on-change)', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withPlayerLetter(state, 0, 1, 'X');
    const checked = handleCheck(state, { kind: 'check' }, deps);
    expect(assertSolving(checked.state).checkResult).not.toBe(null);

    const result = handleClearErrors(checked.state, { kind: 'clear-errors' }, deps);

    expect(assertSolving(result.state).checkResult).toBe(null);
  });

  it('clear-errors: produces a new grid (does not mutate original)', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withPlayerLetter(state, 0, 1, 'X');
    const checked = handleCheck(state, { kind: 'check' }, deps);
    const originalGrid = assertSolving(checked.state).puzzle.grid;

    const result = handleClearErrors(checked.state, { kind: 'clear-errors' }, deps);

    const next = assertSolving(result.state);
    expect(next.puzzle.grid).not.toBe(originalGrid);
    expect(GridOps.cellAt(originalGrid, Row.of(0), Col.of(1)).playerLetter).toBe(Letter.try('X'));
  });

  it('clear-errors: preserves puzzle.key, gridSize, words, cursor, and anagram state unchanged', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withPlayerLetter(state, 0, 1, 'X');
    state = withCursor(state, { row: 0, col: 0, direction: 'across' });
    const acrossWord = state.puzzle.words.find(
      (w) => w.key.direction === 'across' && Number(w.key.startRow) === 0 && Number(w.key.startCol) === 0,
    );
    if (acrossWord === undefined) throw new Error('expected across word');
    state = withAnagram(state, acrossWord.key);
    const checked = handleCheck(state, { kind: 'check' }, deps);
    const previous = assertSolving(checked.state);

    const result = handleClearErrors(checked.state, { kind: 'clear-errors' }, deps);

    const next = assertSolving(result.state);
    expect(next.puzzle.key).toBe(previous.puzzle.key);
    expect(next.puzzle.gridSize).toBe(previous.puzzle.gridSize);
    expect(next.puzzle.words).toBe(previous.puzzle.words);
    expect(next.cursor).toBe(previous.cursor);
    expect(next.anagram).toBe(previous.anagram);
  });

  it('clear-errors: when all white cells were incorrect, grid is fully cleared of player letters', () => {
    let state = solvingState(2);
    state = withAnswerLetter(state, 0, 0, 'A');
    state = withAnswerLetter(state, 0, 1, 'B');
    state = withAnswerLetter(state, 1, 0, 'C');
    state = withAnswerLetter(state, 1, 1, 'D');
    state = withPlayerLetter(state, 0, 0, 'W');
    state = withPlayerLetter(state, 0, 1, 'X');
    state = withPlayerLetter(state, 1, 0, 'Y');
    state = withPlayerLetter(state, 1, 1, 'Z');
    const checked = handleCheck(state, { kind: 'check' }, deps);

    const result = handleClearErrors(checked.state, { kind: 'clear-errors' }, deps);

    const next = assertSolving(result.state);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        expect(GridOps.cellAt(next.puzzle.grid, Row.of(r), Col.of(c)).playerLetter).toBe(null);
      }
    }
  });
});
