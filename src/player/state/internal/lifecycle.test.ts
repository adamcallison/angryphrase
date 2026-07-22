import { describe, expect, it } from 'vitest';
import {
  handleApplyLoadedProgress,
  handleConfirmResetPlayer,
  handleImportNewPuzzle,
  handleImportPuzzle,
  handleRequestResetPlayer,
} from './lifecycle';
import { PlayerState } from '../state';
import { parsePuzzleV1 } from '../../../domain/format/v1';
import { GridOps } from '../../../domain/grid/GridOps';
import { Letter } from '../../../domain/letter/Letter';
import { GridSize } from '../../../domain/grid/GridSize';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import { Cell } from '../../../domain/grid/Cell';
import { SeededRng } from '../../../../test/fakes/SeededRng';
import { FakeClock } from '../../../../test/fakes/FakeClock';

const rng = new SeededRng(42);
const clock = new FakeClock(1000);
const deps = { rng, now: clock.now.bind(clock) };

const VALID_UUID = '00000000-0000-4000-8000-000000000000';

function makeCellJson(
  black: boolean,
  puzzleLetter: string | null = null,
): {
  black: boolean;
  puzzleLetter: string | null;
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
} {
  return {
    black,
    puzzleLetter,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
  };
}

function makeCompleteFixture(): string {
  return JSON.stringify({
    version: 1,
    type: 'complete',
    key: VALID_UUID,
    gridSize: 2,
    title: 'Title',
    author: 'Author',
    grid: [
      [makeCellJson(false, 'A'), makeCellJson(false, 'B')],
      [makeCellJson(true), makeCellJson(true)],
    ],
    words: [
      {
        startRow: 0,
        startCol: 0,
        direction: 'across',
        length: 2,
        number: 1,
        clue: 'Head clue',
        nextWord: null,
      },
    ],
  });
}

function parsedPuzzle() {
  const result = parsePuzzleV1(makeCompleteFixture());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('fixture parse failed');
  return result.puzzle;
}

describe('handleImportPuzzle', () => {
  it('import-puzzle: valid complete file → solving phase + load-player-progress event', () => {
    const result = handleImportPuzzle(
      PlayerState.importScreen(),
      { kind: 'import-puzzle', fileContent: makeCompleteFixture() },
      deps,
    );

    expect(result.state.phase).toBe('solving');
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({ kind: 'load-player-progress', key: parsedPuzzle().key });
  });

  it('import-puzzle: valid complete file → checkResult null, anagram null, cursor null', () => {
    const result = handleImportPuzzle(
      PlayerState.importScreen(),
      { kind: 'import-puzzle', fileContent: makeCompleteFixture() },
      deps,
    );

    expect(result.state.phase).toBe('solving');
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.checkResult).toBe(null);
    expect(result.state.anagram).toBe(null);
    expect(result.state.cursor).toBe(null);
  });

  it('import-puzzle: valid complete file → puzzle.key preserved from file', () => {
    const result = handleImportPuzzle(
      PlayerState.importScreen(),
      { kind: 'import-puzzle', fileContent: makeCompleteFixture() },
      deps,
    );

    expect(result.state.phase).toBe('solving');
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.puzzle.key).toBe(parsedPuzzle().key);
  });

  it('import-puzzle: parse failure → toast with joined failure messages, phase import', () => {
    const result = handleImportPuzzle(
      PlayerState.importScreen(),
      { kind: 'import-puzzle', fileContent: 'not json' },
      deps,
    );

    expect(result.state.phase).toBe('import');
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'File is not valid JSON.',
    });
  });

  it('import-puzzle: parse failure → state is phase=import with lastImportError set to joined messages', () => {
    const result = handleImportPuzzle(
      PlayerState.importScreen(),
      { kind: 'import-puzzle', fileContent: '{"version":2}' },
      deps,
    );

    expect(result.state.phase).toBe('import');
    if (result.state.phase !== 'import') throw new Error('expected import');
    expect(result.state.lastImportError).toContain('Unknown or missing version.');
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: result.state.lastImportError,
    });
  });

  it('import-puzzle: malformed JSON → toast with "File is not valid JSON."', () => {
    const result = handleImportPuzzle(
      PlayerState.importScreen(),
      { kind: 'import-puzzle', fileContent: '{ invalid' },
      deps,
    );

    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'File is not valid JSON.',
    });
  });

  it('import-puzzle: valid incomplete file (fileType=incomplete) → rejected with the specific message', () => {
    const incomplete = JSON.stringify({
      version: 1,
      type: 'incomplete',
      key: VALID_UUID,
      gridSize: 2,
      title: 'Title',
      author: 'Author',
      grid: [
        [makeCellJson(false), makeCellJson(false)],
        [makeCellJson(true), makeCellJson(true)],
      ],
      words: [
        {
          startRow: 0,
          startCol: 0,
          direction: 'across',
          length: 2,
          number: 1,
          clue: '',
          nextWord: null,
        },
      ],
      displacedClues: [],
    });

    const result = handleImportPuzzle(
      PlayerState.importScreen(),
      { kind: 'import-puzzle', fileContent: incomplete },
      deps,
    );

    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'Only complete puzzle files can be loaded into the Player.',
    });
  });

  it('import-puzzle: incomplete rejection → lastImportError is the specific message', () => {
    const incomplete = JSON.stringify({
      version: 1,
      type: 'incomplete',
      key: VALID_UUID,
      gridSize: 2,
      title: 'Title',
      author: 'Author',
      grid: [
        [makeCellJson(false), makeCellJson(false)],
        [makeCellJson(true), makeCellJson(true)],
      ],
      words: [
        {
          startRow: 0,
          startCol: 0,
          direction: 'across',
          length: 2,
          number: 1,
          clue: '',
          nextWord: null,
        },
      ],
      displacedClues: [],
    });

    const result = handleImportPuzzle(
      PlayerState.importScreen(),
      { kind: 'import-puzzle', fileContent: incomplete },
      deps,
    );

    expect(result.state.phase).toBe('import');
    if (result.state.phase !== 'import') throw new Error('expected import');
    expect(result.state.lastImportError).toBe(
      'Only complete puzzle files can be loaded into the Player.',
    );
  });

  it('import-puzzle: incomplete rejection → state phase is import (NOT solving)', () => {
    const incomplete = JSON.stringify({
      version: 1,
      type: 'incomplete',
      key: VALID_UUID,
      gridSize: 2,
      title: 'Title',
      author: 'Author',
      grid: [
        [makeCellJson(false), makeCellJson(false)],
        [makeCellJson(true), makeCellJson(true)],
      ],
      words: [
        {
          startRow: 0,
          startCol: 0,
          direction: 'across',
          length: 2,
          number: 1,
          clue: '',
          nextWord: null,
        },
      ],
      displacedClues: [],
    });

    const result = handleImportPuzzle(
      PlayerState.importScreen(),
      { kind: 'import-puzzle', fileContent: incomplete },
      deps,
    );

    expect(result.state.phase).toBe('import');
  });

  it('import-puzzle: success emits exactly one event (load-player-progress), no toast', () => {
    const result = handleImportPuzzle(
      PlayerState.importScreen(),
      { kind: 'import-puzzle', fileContent: makeCompleteFixture() },
      deps,
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.kind).toBe('load-player-progress');
  });

  it('import-puzzle: from a solving-phase state, success REPLACES state (does not merge)', () => {
    const previous = PlayerState.loaded(parsedPuzzle());
    const result = handleImportPuzzle(
      previous,
      { kind: 'import-puzzle', fileContent: makeCompleteFixture() },
      deps,
    );

    expect(result.state.phase).toBe('solving');
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.puzzle.key).toBe(parsedPuzzle().key);
    expect(result.state).not.toBe(previous);
  });
});

describe('handleApplyLoadedProgress', () => {
  function solving() {
    return PlayerState.loaded(parsedPuzzle());
  }

  function cellPlayerLetter(state: ReturnType<typeof solving>, row: number, col: number) {
    if (state.phase !== 'solving') throw new Error('expected solving');
    return GridOps.cellAt(state.puzzle.grid, Row.of(row), Col.of(col)).playerLetter;
  }

  it('apply-loaded-progress: no-op when state phase is import (not yet solving)', () => {
    const state = PlayerState.importScreen();
    const result = handleApplyLoadedProgress(
      state,
      {
        kind: 'apply-loaded-progress',
        playerLetters: [[Letter.try('A')]],
        savedGridSize: GridSize.of(2),
      },
      deps,
    );

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('apply-loaded-progress: applies saved non-null letters to white cells of matching gridSize (FR-80)', () => {
    const state = solving();
    const result = handleApplyLoadedProgress(
      state,
      {
        kind: 'apply-loaded-progress',
        playerLetters: [
          [Letter.try('X'), Letter.try('Y')],
          [Letter.try('Z'), Letter.try('W')],
        ],
        savedGridSize: GridSize.of(2),
      },
      deps,
    );

    expect(result.state.phase).toBe('solving');
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(cellPlayerLetter(result.state as ReturnType<typeof solving>, 0, 0)).toBe(Letter.try('X'));
    expect(cellPlayerLetter(result.state as ReturnType<typeof solving>, 0, 1)).toBe(Letter.try('Y'));
  });

  it('apply-loaded-progress: preserved null entries leave existing playerLetter untouched', () => {
    const state = solving();
    const withLetter = handleApplyLoadedProgress(
      state,
      {
        kind: 'apply-loaded-progress',
        playerLetters: [[Letter.try('X'), null]],
        savedGridSize: GridSize.of(2),
      },
      deps,
    );

    if (withLetter.state.phase !== 'solving') throw new Error('expected solving');
    const cleared = handleApplyLoadedProgress(
      withLetter.state,
      {
        kind: 'apply-loaded-progress',
        playerLetters: [[null, null]],
        savedGridSize: GridSize.of(2),
      },
      deps,
    );

    if (cleared.state.phase !== 'solving') throw new Error('expected solving');
    expect(cellPlayerLetter(cleared.state as ReturnType<typeof solving>, 0, 0)).toBe(Letter.try('X'));
    expect(cellPlayerLetter(cleared.state as ReturnType<typeof solving>, 0, 1)).toBe(null);
  });

  it('apply-loaded-progress: mismatched savedGridSize → no-op (state returned unchanged)', () => {
    const state = solving();
    const result = handleApplyLoadedProgress(
      state,
      {
        kind: 'apply-loaded-progress',
        playerLetters: [[Letter.try('X'), Letter.try('Y')]],
        savedGridSize: GridSize.of(13),
      },
      deps,
    );

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('apply-loaded-progress: silently drops saved letters for now-black cells (FR-80)', () => {
    const state = solving();
    const result = handleApplyLoadedProgress(
      state,
      {
        kind: 'apply-loaded-progress',
        playerLetters: [
          [Letter.try('X'), Letter.try('Y')],
          [Letter.try('Z'), Letter.try('W')],
        ],
        savedGridSize: GridSize.of(2),
      },
      deps,
    );

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(cellPlayerLetter(result.state as ReturnType<typeof solving>, 1, 0)).toBe(null);
    expect(cellPlayerLetter(result.state as ReturnType<typeof solving>, 1, 1)).toBe(null);
    expect(
      GridOps.cellAt(result.state.puzzle.grid, Row.of(1), Col.of(0)).black,
    ).toBe(true);
  });

  it('apply-loaded-progress: truncated saved arrays (fewer rows/cols than grid) → applies only the intersection', () => {
    const state = solving();
    const result = handleApplyLoadedProgress(
      state,
      {
        kind: 'apply-loaded-progress',
        playerLetters: [[Letter.try('X')]],
        savedGridSize: GridSize.of(2),
      },
      deps,
    );

    expect(cellPlayerLetter(result.state as ReturnType<typeof solving>, 0, 0)).toBe(Letter.try('X'));
    expect(cellPlayerLetter(result.state as ReturnType<typeof solving>, 0, 1)).toBe(null);
  });

  it('apply-loaded-progress: oversized saved arrays (more rows/cols than grid) → applies only the intersection', () => {
    const state = solving();
    const result = handleApplyLoadedProgress(
      state,
      {
        kind: 'apply-loaded-progress',
        playerLetters: [
          [Letter.try('A'), Letter.try('B'), Letter.try('C')],
          [Letter.try('D'), Letter.try('E'), Letter.try('F')],
          [Letter.try('G'), Letter.try('H'), Letter.try('I')],
        ],
        savedGridSize: GridSize.of(2),
      },
      deps,
    );

    expect(cellPlayerLetter(result.state as ReturnType<typeof solving>, 0, 0)).toBe(Letter.try('A'));
    expect(cellPlayerLetter(result.state as ReturnType<typeof solving>, 0, 1)).toBe(Letter.try('B'));
  });

  it('apply-loaded-progress: returns original state reference when nothing changed (all saved null or dropped)', () => {
    const state = solving();
    const result = handleApplyLoadedProgress(
      state,
      {
        kind: 'apply-loaded-progress',
        playerLetters: [
          [null, null],
          [null, null],
        ],
        savedGridSize: GridSize.of(2),
      },
      deps,
    );

    expect(result.state).toBe(state);
  });

  it('apply-loaded-progress: preserves puzzle.key, words, and other puzzle fields unchanged', () => {
    const state = solving();
    const result = handleApplyLoadedProgress(
      state,
      {
        kind: 'apply-loaded-progress',
        playerLetters: [[Letter.try('X'), Letter.try('Y')]],
        savedGridSize: GridSize.of(2),
      },
      deps,
    );

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    if (state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.puzzle.key).toBe(state.puzzle.key);
    expect(result.state.puzzle.words).toBe(state.puzzle.words);
    expect(result.state.puzzle.title).toBe(state.puzzle.title);
    expect(result.state.puzzle.author).toBe(state.puzzle.author);
    expect(result.state.puzzle.gridSize).toBe(state.puzzle.gridSize);
  });
});

type SolvingState = Extract<PlayerState, { phase: 'solving' }>;

function solving(): SolvingState {
  const state = PlayerState.loaded(parsedPuzzle());
  if (state.phase !== 'solving') throw new Error('expected solving');
  return state;
}

function withPlayerLetters(
  state: SolvingState,
  letters: [number, number, string | null][],
): SolvingState {
  if (state.phase !== 'solving') throw new Error('expected solving');

  let grid = state.puzzle.grid;
  for (const [r, c, letter] of letters) {
    const cell = GridOps.cellAt(grid, Row.of(r), Col.of(c));
    const newCell = letter == null ? Cell.setPlayerLetter(cell, null) : Cell.setPlayerLetter(cell, Letter.try(letter));
    grid = GridOps.setCell(grid, Row.of(r), Col.of(c), newCell);
  }

  return {
    ...state,
    puzzle: { ...state.puzzle, grid },
  };
}

function cellAnswerLetter(state: SolvingState, row: number, col: number) {
  return GridOps.cellAt(state.puzzle.grid, Row.of(row), Col.of(col)).answerLetter;
}

function cellPlayerLetter(state: SolvingState, row: number, col: number) {
  return GridOps.cellAt(state.puzzle.grid, Row.of(row), Col.of(col)).playerLetter;
}

function cellIsBlack(state: SolvingState, row: number, col: number) {
  return GridOps.cellAt(state.puzzle.grid, Row.of(row), Col.of(col)).black;
}

describe('handleImportNewPuzzle', () => {
  it('import-new-puzzle: from solving phase, returns to import screen (FR-78)', () => {
    const result = handleImportNewPuzzle(
      solving(),
      { kind: 'import-new-puzzle' },
      deps,
    );

    expect(result.state.phase).toBe('import');
    if (result.state.phase !== 'import') throw new Error('expected import');
    expect(result.state.lastImportError).toBe(null);
  });

  it('import-new-puzzle: from import phase, returns import screen with null lastImportError', () => {
    const state = PlayerState.importScreen();
    const result = handleImportNewPuzzle(state, { kind: 'import-new-puzzle' }, deps);

    expect(result.state.phase).toBe('import');
    if (result.state.phase !== 'import') throw new Error('expected import');
    expect(result.state.lastImportError).toBe(null);
  });

  it('import-new-puzzle: emits no events (FR-78 — autosave retained via key, no storage clear)', () => {
    const result = handleImportNewPuzzle(solving(), { kind: 'import-new-puzzle' }, deps);

    expect(result.events).toEqual([]);
  });

  it('import-new-puzzle: returned state is deep-equal to PlayerState.importScreen()', () => {
    const result = handleImportNewPuzzle(solving(), { kind: 'import-new-puzzle' }, deps);

    expect(result.state).toEqual(PlayerState.importScreen());
  });
});

describe('handleRequestResetPlayer', () => {
  it('request-reset-player: import phase is no-op', () => {
    const state = PlayerState.importScreen();
    const result = handleRequestResetPlayer(state, { kind: 'request-reset-player' }, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('request-reset-player: solving phase emits modal-request with confirmIntent confirm-reset-player', () => {
    const state = solving();
    const result = handleRequestResetPlayer(state, { kind: 'request-reset-player' }, deps);

    expect(result.events).toEqual([
      {
        kind: 'modal-request',
        modal: { kind: 'confirm-reset-player' },
        confirmIntent: { kind: 'confirm-reset-player' },
      },
    ]);
  });

  it('request-reset-player: solving phase emits no toast, no clear-player-storage event', () => {
    const state = solving();
    const result = handleRequestResetPlayer(state, { kind: 'request-reset-player' }, deps);

    expect(result.events.some((e) => e.kind === 'toast')).toBe(false);
    expect(result.events.some((e) => e.kind === 'clear-player-storage')).toBe(false);
  });

  it('request-reset-player: state is returned unchanged (modal fires after user confirms)', () => {
    const state = solving();
    const result = handleRequestResetPlayer(state, { kind: 'request-reset-player' }, deps);

    expect(result.state).toBe(state);
  });

  it('request-reset-player: returns modal { kind: "confirm-reset-player" }', () => {
    const state = solving();
    const result = handleRequestResetPlayer(state, { kind: 'request-reset-player' }, deps);

    expect(result.events[0]).toEqual({
      kind: 'modal-request',
      modal: { kind: 'confirm-reset-player' },
      confirmIntent: { kind: 'confirm-reset-player' },
    });
  });

  it('request-reset-player: solving phase with no player letters typed still emits modal (FR-77 unconditional confirmation)', () => {
    const state = solving();
    if (state.phase !== 'solving') throw new Error('expected solving');
    expect(GridOps.cellAt(state.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);

    const result = handleRequestResetPlayer(state, { kind: 'request-reset-player' }, deps);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'modal-request',
      modal: { kind: 'confirm-reset-player' },
      confirmIntent: { kind: 'confirm-reset-player' },
    });
  });
});

describe('handleConfirmResetPlayer', () => {
  it('confirm-reset-player: import phase is no-op (defensive)', () => {
    const state = PlayerState.importScreen();
    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('confirm-reset-player: solving phase clears all white cells playerLetter to null (FR-77)', () => {
    const state = withPlayerLetters(solving(), [
      [0, 0, 'X'],
      [0, 1, 'Y'],
    ]);
    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(cellPlayerLetter(result.state, 0, 0)).toBe(null);
    expect(cellPlayerLetter(result.state, 0, 1)).toBe(null);
  });

  it('confirm-reset-player: solving phase leaves black cells unchanged', () => {
    const state = solving();
    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(cellIsBlack(result.state, 1, 0)).toBe(true);
    expect(cellIsBlack(result.state, 1, 1)).toBe(true);
  });

  it('confirm-reset-player: solving phase leaves answerLetter intact (FR-77 "answer letters intact")', () => {
    const state = solving();
    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(cellAnswerLetter(result.state, 0, 0)).toBe(Letter.try('A'));
    expect(cellAnswerLetter(result.state, 0, 1)).toBe(Letter.try('B'));
  });

  it('confirm-reset-player: clears cursor to null', () => {
    const state = {
      ...withPlayerLetters(solving(), [[0, 0, 'X']]),
      cursor: {
        row: Row.of(0),
        col: Col.of(0),
        direction: 'across' as const,
      },
    };
    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    expect(result.state.phase).toBe('solving');
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.cursor).toBe(null);
  });

  it('confirm-reset-player: clears checkResult to null (§908 clear-on-change)', () => {
    const state = {
      ...withPlayerLetters(solving(), [[0, 0, 'X']]),
      checkResult: {
        classification: 'incomplete-correct' as const,
        incorrectCells: [],
        emptyCells: [],
      },
    };
    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.checkResult).toBe(null);
  });

  it('confirm-reset-player: clears anagram to null (modal dismissed implicitly)', () => {
    const state = {
      ...withPlayerLetters(solving(), [[0, 0, 'X']]),
      anagram: {
        openedForWord: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const },
        input: '',
        scrambledArrangement: null,
      },
    };
    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.anagram).toBe(null);
  });

  it('confirm-reset-player: emits a single clear-player-storage event with puzzle.key', () => {
    const state = solving();
    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({ kind: 'clear-player-storage', key: state.puzzle.key });
  });

  it('confirm-reset-player: no toast events', () => {
    const state = solving();
    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    expect(result.events.some((e) => e.kind === 'toast')).toBe(false);
  });

  it('confirm-reset-player: preserves puzzle.key, gridSize, words, and other puzzle fields', () => {
    const state = withPlayerLetters(solving(), [[0, 0, 'X']]);
    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    if (state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.puzzle.key).toBe(state.puzzle.key);
    expect(result.state.puzzle.gridSize).toBe(state.puzzle.gridSize);
    expect(result.state.puzzle.words).toBe(state.puzzle.words);
    expect(result.state.puzzle.title).toBe(state.puzzle.title);
    expect(result.state.puzzle.author).toBe(state.puzzle.author);
  });

  it('confirm-reset-player: when no playerLetters are set (already clean), still emits clear-player-storage event (storage should be cleared regardless)', () => {
    const state = solving();
    if (state.phase !== 'solving') throw new Error('expected solving');
    expect(cellPlayerLetter(state, 0, 0)).toBe(null);

    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    expect(result.events).toEqual([{ kind: 'clear-player-storage', key: state.puzzle.key }]);
    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.puzzle.grid).toBe(state.puzzle.grid);
  });

  it('confirm-reset-player: with mixed player letters (some set, some null), only modified cells change in grid', () => {
    const state = withPlayerLetters(solving(), [[0, 0, 'X']]);
    const originalCell1 = cellPlayerLetter(state, 0, 1);

    const result = handleConfirmResetPlayer(state, { kind: 'confirm-reset-player' }, deps);

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(cellPlayerLetter(result.state, 0, 0)).toBe(null);
    expect(cellPlayerLetter(result.state, 0, 1)).toBe(originalCell1);
  });
});
