import { describe, expect, it } from 'vitest';
import {
  handleAnagramInput,
  handleAnagramScramble,
  handleCloseAnagramHelper,
  handleEscape,
  handleOpenAnagramHelper,
} from '../../../../src/player/state/internal/anagram';
import { PlayerState } from '../../../../src/player/state/state';
import type { PlayerState as PlayerStateType } from '../../../../src/player/state/state';
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
import { WordKey } from '../../../../src/domain/word/WordKey';
import { Anagram } from '../../../../src/domain/anagram/Anagram';
import { SeededRng } from '../../../fakes/SeededRng';
import type { Direction } from '../../../../src/domain/word/Direction';

type SolvingPlayerState = Extract<PlayerStateType, { phase: 'solving' }>;

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

function withAnagram(
  state: SolvingPlayerState,
  openedForWord: WordKey,
  input = '',
  scrambledArrangement: Letter[] | null = null,
): SolvingPlayerState {
  return {
    ...state,
    anagram: {
      openedForWord,
      input,
      scrambledArrangement,
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

function makeTwoWordChainState(): {
  state: SolvingPlayerState;
  headKey: WordKey;
  tailKey: WordKey;
} {
  const state = solvingState(5, [
    [0, 3],
    [0, 4],
    [1, 3],
    [1, 4],
  ]);
  const headKey = findWordKey(state, 0, 0, 'across');
  const tailKey = findWordKey(state, 1, 0, 'across');
  const words = state.puzzle.words.map((w) =>
    WordKey.equals(w.key, headKey) ? { ...w, nextWord: tailKey } : w,
  );
  return {
    state: { ...state, puzzle: Puzzle.withWords(state.puzzle, words) },
    headKey,
    tailKey,
  };
}

describe('handleOpenAnagramHelper', () => {
  it('open-anagram-helper: no-op when phase is import', () => {
    const state = importState();
    const result = handleOpenAnagramHelper(state);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('open-anagram-helper: no-op when cursor is null', () => {
    const state = solvingState(5);
    const result = handleOpenAnagramHelper(state);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('open-anagram-helper: no-op when cursor cell is not in any word', () => {
    const state = withCursor(
      solvingState(5, [
        [0, 1],
        [1, 0],
      ]),
      { row: 0, col: 0, direction: 'across' },
    );
    const result = handleOpenAnagramHelper(state);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('open-anagram-helper: opens modal with openedForWord set to the cursor-direction word containing the cell (FR-81)', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const result = handleOpenAnagramHelper(state);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    const expectedKey = findWordKey(state, 0, 0, 'across');
    expect(result.state.anagram).toEqual({
      openedForWord: expectedKey,
      input: '',
      scrambledArrangement: null,
    });
  });

  it('open-anagram-helper: input is empty string and scrambledArrangement is null on open', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const result = handleOpenAnagramHelper(state);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.input).toBe('');
    expect(result.state.anagram?.scrambledArrangement).toBe(null);
  });

  it('open-anagram-helper: preserves cursor, checkResult, puzzle unchanged', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    state = {
      ...state,
      checkResult: {
        classification: 'incomplete-correct',
        incorrectCells: [],
        emptyCells: [],
      },
    };
    const result = handleOpenAnagramHelper(state);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.cursor).toEqual(state.cursor);
    expect(result.state.checkResult).toEqual(state.checkResult);
    expect(result.state.puzzle).toBe(state.puzzle);
  });

  it('open-anagram-helper: when an anagram modal is already open, replaces it with a new openedForWord if cursor direction differs to a new word', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const acrossKey = findWordKey(state, 0, 0, 'across');
    const downKey = findWordKey(state, 0, 0, 'down');
    state = withAnagram(state, acrossKey);
    state = withCursor(state, { row: 0, col: 0, direction: 'down' });
    const result = handleOpenAnagramHelper(state);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.openedForWord).toEqual(downKey);
    expect(result.state.anagram?.input).toBe('');
    expect(result.state.anagram?.scrambledArrangement).toBe(null);
  });

  it('open-anagram-helper: stores chain head WordKey in openedForWord', () => {
    const { state: base, headKey, tailKey } = makeTwoWordChainState();
    let state = base;
    state = withCursor(state, { row: 1, col: 0, direction: 'across' });
    const result = handleOpenAnagramHelper(state);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(WordKey.equals(result.state.anagram!.openedForWord, headKey)).toBe(true);
    expect(WordKey.equals(result.state.anagram!.openedForWord, tailKey)).toBe(false);
  });
});

describe('handleAnagramInput', () => {
  it('anagram-input: no-op when phase is import', () => {
    const state = importState();
    const intent: PlayerIntent = { kind: 'anagram-input', input: 'ABC' };
    const result = handleAnagramInput(state, intent);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('anagram-input: no-op when anagram is null', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const intent: PlayerIntent = { kind: 'anagram-input', input: 'ABC' };
    const result = handleAnagramInput(state, intent);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('anagram-input: writes the filtered input (A-Z, uppercased) to anagram.input (FR-83)', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key);
    const intent: PlayerIntent = { kind: 'anagram-input', input: 'ABC' };
    const result = handleAnagramInput(state, intent);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.input).toBe('ABC');
  });

  it('anagram-input: clamps the input to the word length (FR-83)', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key);
    const intent: PlayerIntent = { kind: 'anagram-input', input: 'ABCDEFGHIJ' };
    const result = handleAnagramInput(state, intent);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.input).toHaveLength(5);
    expect(result.state.anagram?.input).toBe('ABCDE');
  });

  it('anagram-input: lowercase input is uppercased', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key);
    const intent: PlayerIntent = { kind: 'anagram-input', input: 'abc' };
    const result = handleAnagramInput(state, intent);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.input).toBe('ABC');
  });

  it('anagram-input: non-A-Z characters (digits, punctuation) stripped from input', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key);
    const intent: PlayerIntent = { kind: 'anagram-input', input: 'a1b!c@d#e' };
    const result = handleAnagramInput(state, intent);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.input).toBe('ABCDE');
  });

  it('anagram-input: resets scrambledArrangement to null when input changes (FR-87)', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key, 'ABCDE', [
      Letter.try('A')!,
      Letter.try('B')!,
      Letter.try('C')!,
      Letter.try('D')!,
      Letter.try('E')!,
    ]);
    const intent: PlayerIntent = { kind: 'anagram-input', input: 'XYZ' };
    const result = handleAnagramInput(state, intent);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.input).toBe('XYZ');
    expect(result.state.anagram?.scrambledArrangement).toBe(null);
  });

  it('anagram-input: empty input string sets anagram.input to "" and scrambledArrangement to null', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key, 'ABCDE', [
      Letter.try('A')!,
      Letter.try('B')!,
      Letter.try('C')!,
      Letter.try('D')!,
      Letter.try('E')!,
    ]);
    const intent: PlayerIntent = { kind: 'anagram-input', input: '' };
    const result = handleAnagramInput(state, intent);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.input).toBe('');
    expect(result.state.anagram?.scrambledArrangement).toBe(null);
  });

  it('anagram-input: clamps input to total chain length', () => {
    const { state: base, headKey } = makeTwoWordChainState();
    const state = withAnagram(base, headKey, 'ABCDEFG');
    const intent: PlayerIntent = { kind: 'anagram-input', input: 'ABCDEFG' };
    const result = handleAnagramInput(state, intent);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.input).toBe('ABCDEF');
  });
});

describe('handleAnagramScramble', () => {
  function scrambleState(input: string): SolvingPlayerState {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    state = withPlayerLetter(state, 0, 0, 'A');
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key, input);
    return state;
  }

  it('anagram-scramble: no-op when phase is import', () => {
    const state = importState();
    const rng = new SeededRng(1);
    const result = handleAnagramScramble(state, rng);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('anagram-scramble: no-op when anagram is null', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const rng = new SeededRng(1);
    const result = handleAnagramScramble(state, rng);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('anagram-scramble: sets scrambledArrangement from Anagram.scramble result (FR-86)', () => {
    const state = scrambleState('ABCDE');
    const expectedRng = new SeededRng(1);
    const resultRng = new SeededRng(1);
    const word = state.puzzle.words.find((w) =>
      WordKey.equals(w.key, state.anagram!.openedForWord),
    )!;
    const { entries } = Anagram.buildWordModel(state.puzzle.grid, word);
    const expected = Anagram.scramble(entries, 'ABCDE', expectedRng)
      .map((e) => e.letter)
      .filter((l): l is Letter => l !== null);

    const result = handleAnagramScramble(state, resultRng);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.scrambledArrangement).toEqual(expected);
  });

  it('anagram-scramble: uses rng (deterministic given seed)', () => {
    const state = scrambleState('ABCDE');
    const rngA = new SeededRng(1);
    const rngB = new SeededRng(1);
    const resultA = handleAnagramScramble(state, rngA);
    const resultB = handleAnagramScramble(state, rngB);
    if (resultA.state.phase !== 'solving' || resultB.state.phase !== 'solving') {
      throw new Error('expected solving');
    }
    expect(resultA.state.anagram?.scrambledArrangement).toEqual(
      resultB.state.anagram?.scrambledArrangement,
    );
  });

  it('anagram-scramble: with two different SeededRng seeds, produces different scrambledArrangement', () => {
    const state = scrambleState('ABCDE');
    const rng = new SeededRng(1);
    const resultA = handleAnagramScramble(state, rng);
    const resultB = handleAnagramScramble(state, new SeededRng(2));
    if (resultA.state.phase !== 'solving' || resultB.state.phase !== 'solving') {
      throw new Error('expected solving');
    }
    expect(resultA.state.anagram?.scrambledArrangement).not.toEqual(
      resultB.state.anagram?.scrambledArrangement,
    );
  });

  it('anagram-scramble: preserves input length and the scrambled arrangement has the correct entries (non-null letters)', () => {
    const state = scrambleState('ABCDE');
    const rng = new SeededRng(1);
    const result = handleAnagramScramble(state, rng);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram?.scrambledArrangement).toHaveLength(5);
    expect(result.state.anagram?.scrambledArrangement?.every((l) => l !== null)).toBe(true);
  });

  it('anagram-scramble: does not mutate the grid (FR-87 scratchpad only)', () => {
    const state = scrambleState('ABCDE');
    const rng = new SeededRng(1);
    const originalGrid = state.puzzle.grid;
    const result = handleAnagramScramble(state, rng);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.puzzle.grid).toBe(originalGrid);
    expect(GridOps.equals(result.state.puzzle.grid, originalGrid)).toBe(true);
  });

  it('anagram-scramble: does not modify cursor, checkResult, or puzzle', () => {
    let state = scrambleState('ABCDE');
    const rng = new SeededRng(1);
    state = {
      ...state,
      checkResult: {
        classification: 'incomplete-correct',
        incorrectCells: [],
        emptyCells: [],
      },
    };
    const result = handleAnagramScramble(state, rng);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.cursor).toEqual(state.cursor);
    expect(result.state.checkResult).toEqual(state.checkResult);
    expect(result.state.puzzle).toBe(state.puzzle);
  });

  it('anagram-scramble: scrambles across whole chain, fixed positions preserved', () => {
    const { state: base, headKey } = makeTwoWordChainState();
    let state = withPlayerLetter(base, 0, 0, 'A');
    state = withPlayerLetter(state, 1, 0, 'B');
    state = withAnagram(state, headKey, 'ABCDEF');
    const rng = new SeededRng(1);
    const result = handleAnagramScramble(state, rng);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    const arrangement = result.state.anagram?.scrambledArrangement;
    expect(arrangement).toHaveLength(6);
    expect(arrangement?.[0]).toEqual(Letter.try('A')!);
    expect(arrangement?.[3]).toEqual(Letter.try('B')!);
  });
});

describe('handleCloseAnagramHelper', () => {
  it('close-anagram-helper: no-op when phase is import', () => {
    const state = importState();
    const result = handleCloseAnagramHelper(state);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('close-anagram-helper: no-op when anagram is already null', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const result = handleCloseAnagramHelper(state);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('close-anagram-helper: sets anagram to null when open (FR-89)', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key);
    const result = handleCloseAnagramHelper(state);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram).toBe(null);
  });

  it('close-anagram-helper: preserves puzzle, cursor, checkResult unchanged', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key);
    state = {
      ...state,
      checkResult: {
        classification: 'incomplete-correct',
        incorrectCells: [],
        emptyCells: [],
      },
    };
    const result = handleCloseAnagramHelper(state);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.cursor).toEqual(state.cursor);
    expect(result.state.checkResult).toEqual(state.checkResult);
    expect(result.state.puzzle).toBe(state.puzzle);
  });
});

describe('handleEscape', () => {
  it('escape: no-op when phase is import', () => {
    const state = importState();
    const result = handleEscape(state);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('escape: no-op when anagram is already null in solving phase', () => {
    const state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const result = handleEscape(state);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('escape: closes anagram modal when open (FR-89)', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key);
    const result = handleEscape(state);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram).toBe(null);
  });

  it('escape: preserves cursor and puzzle unchanged when closing anagram', () => {
    let state = withCursor(solvingState(5), { row: 0, col: 0, direction: 'across' });
    const key = findWordKey(state, 0, 0, 'across');
    state = withAnagram(state, key);
    const result = handleEscape(state);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.cursor).toEqual(state.cursor);
    expect(result.state.puzzle).toBe(state.puzzle);
  });
});
