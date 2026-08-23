import { describe, it, expect } from 'vitest';
import { reduceApp } from '../../../src/app/state/reducer';
import { AppState } from '../../../src/app/state/state';
import { PlayerState } from '../../../src/player/state/state';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { Title } from '../../../src/domain/puzzle/Title';
import { Toast } from '../../../src/domain/notifications/Toast';
import { SeededRng } from '../../fakes/SeededRng';
import { FakeClock } from '../../fakes/FakeClock';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { Cell } from '../../../src/domain/grid/Cell';
import { Letter } from '../../../src/domain/letter/Letter';

describe('reduceApp', () => {
  function makeState() {
    return AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(1)));
  }

  function makeDeps() {
    return { rng: new SeededRng(2), now: () => new FakeClock(1000).now() };
  }

  it('navigate sets route and returns no events', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(state, { kind: 'navigate', route: 'build' }, deps);
    expect(result.state.route).toBe('build');
    expect(result.events.length).toBe(0);
  });

  it('cancel-modal clears modal and pendingConfirmIntent', () => {
    const state = {
      ...makeState(),
      modal: { kind: 'confirm-reset-builder' as const },
      pendingConfirmIntent: { kind: 'confirm-reset-builder' as const },
    };
    const deps = makeDeps();
    const result = reduceApp(state, { kind: 'cancel-modal' }, deps);
    expect(result.state.modal).toBeNull();
    expect(result.state.pendingConfirmIntent).toBeNull();
    expect(result.events.length).toBe(0);
  });

  it('dismiss-toast removes the toast with matching id', () => {
    const state = makeState();
    const rng1 = new SeededRng(10);
    const rng2 = new SeededRng(20);
    const clock = new FakeClock(5000);
    const toast1 = Toast.create(rng1, 'info', 'a', () => clock.now());
    clock.advance(1);
    const toast2 = Toast.create(rng2, 'info', 'b', () => clock.now());
    const stateWithToasts = { ...state, toasts: [toast1, toast2] };
    const deps = makeDeps();
    const result = reduceApp(stateWithToasts, { kind: 'dismiss-toast', id: toast1.id }, deps);
    expect(result.state.toasts).toHaveLength(1);
    expect(result.state.toasts[0]).toBe(toast2);
    expect(result.events.length).toBe(0);
  });

  it('reduceApp: report-download-failure emits an error toast event, state unchanged', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(state, { kind: 'report-download-failure' }, deps);
    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'Download failed. Please try again.',
    });
  });

  it('switch-to-fill (a BuilderIntent) dispatches to reduceBuilder and folds result', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(state, { kind: 'switch-to-fill' }, deps);
    expect(result.state.builder.mode).toBe('fill');
    expect(result.events.length).toBe(0);
  });

  it('edit-title dispatches to reduceBuilder and updates builder.puzzle.title', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(state, { kind: 'edit-title', title: Title.try('My Puzzle') }, deps);
    expect(result.state.builder.puzzle.title).toEqual(Title.try('My Puzzle'));
    expect(result.events.length).toBe(0);
  });

  it('import-new-puzzle (a PlayerIntent) dispatches to reducePlayer and returns PlayerState.phase=import', () => {
    const state = makeState();
    const puzzle = Puzzle.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(5)));
    const stateWithPlayer = { ...state, player: PlayerState.loaded(puzzle) };
    const deps = makeDeps();
    const result = reduceApp(stateWithPlayer, { kind: 'import-new-puzzle' }, deps);
    expect(result.state.player.phase).toBe('import');
    expect(result.events.length).toBe(0);
  });

  it('unknown intent kind throws', () => {
    const state = makeState();
    const deps = makeDeps();
    const badIntent = { kind: 'not-a-real-kind' } as unknown as Parameters<typeof reduceApp>[1];
    expect(() => reduceApp(state, badIntent, deps)).toThrow(/^reduceApp: unknown intent kind:/);
  });

  it('passthrough: a BuilderIntent that emits a download event returns that event in leftoverEvents', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(state, { kind: 'export-incomplete' }, deps);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.kind).toBe('download');
    const download = result.events[0]!;
    if (download.kind === 'download') {
      expect(download.filename).toMatch(/^puzzle-[0-9a-f]{8}-incomplete\.json$/);
      expect(typeof download.content).toBe('string');
      expect(download.content.length).toBeGreaterThan(0);
    }
    expect(result.state).toEqual(state);
  });

  it('reduceApp: confirm-switch-to-design clears modal and pendingConfirmIntent', () => {
    const state = makeState();
    const deps = makeDeps();
    const appState = {
      ...state,
      builder: { ...state.builder, mode: 'fill' as const },
      modal: { kind: 'confirm-design-switch' as const },
      pendingConfirmIntent: { kind: 'confirm-switch-to-design' as const },
    };
    const result = reduceApp(appState, { kind: 'confirm-switch-to-design' }, deps);
    expect(result.state.modal).toBeNull();
    expect(result.state.pendingConfirmIntent).toBeNull();
    expect(result.state.builder.mode).toBe('design');
  });

  it('reduceApp: confirm-import-puzzle clears modal and pendingConfirmIntent', () => {
    const state = makeState();
    const deps = makeDeps();
    const base = state.builder;
    const letter = Letter.try('A')!;
    const grid = GridOps.setCell(base.puzzle.grid, Row.of(0), Col.of(0), Cell.setAnswerLetter(Cell.white(), letter));
    const json = JSON.stringify({
      version: 1,
      type: 'incomplete',
      key: '00000000-0000-4000-8000-000000000000',
      gridSize: 2,
      title: 'Title',
      author: 'Author',
      grid: [
        [
          { black: false, puzzleLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
          { black: false, puzzleLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
        ],
        [
          { black: true, puzzleLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
          { black: true, puzzleLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
        ],
      ],
      words: [{ startRow: 0, startCol: 0, direction: 'across', length: 2, clue: '', nextWord: null }],
      displacedClues: [],
    });
    const appState = {
      ...state,
      builder: {
        ...base,
        mode: 'fill' as const,
        puzzle: Puzzle.withGrid(base.puzzle, grid),
      },
      modal: { kind: 'confirm-import-puzzle' as const },
      pendingConfirmIntent: { kind: 'confirm-import-puzzle', fileContent: json } as const,
    };
    const result = reduceApp(appState, { kind: 'confirm-import-puzzle', fileContent: json }, deps);
    expect(result.state.modal).toBeNull();
    expect(result.state.pendingConfirmIntent).toBeNull();
    expect(result.state.builder.puzzle.key).toEqual(PuzzleKey.try('00000000-0000-4000-8000-000000000000'));
  });

  it('reduceApp: confirm-reset-builder clears modal and pendingConfirmIntent; builder reset executes (storage clear event still passes through)', () => {
    const state = makeState();
    const deps = makeDeps();
    const base = state.builder;
    const letter = Letter.try('A')!;
    const grid = GridOps.setCell(base.puzzle.grid, Row.of(0), Col.of(0), Cell.setAnswerLetter(Cell.white(), letter));
    const appState = {
      ...state,
      builder: {
        ...base,
        mode: 'fill' as const,
        puzzle: Puzzle.withGrid(base.puzzle, grid),
      },
      modal: { kind: 'confirm-reset-builder' as const },
      pendingConfirmIntent: { kind: 'confirm-reset-builder' as const },
    };
    const result = reduceApp(appState, { kind: 'confirm-reset-builder' }, deps);
    expect(result.state.modal).toBeNull();
    expect(result.state.pendingConfirmIntent).toBeNull();
    expect(result.events).toEqual([{ kind: 'clear-builder-storage' }]);
  });

  it('reduceApp: confirm-reset-player clears modal and pendingConfirmIntent; player reset executes', () => {
    const state = makeState();
    const deps = makeDeps();
    const puzzle = Puzzle.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(1)));
    const grid = GridOps.setCell(
      puzzle.grid,
      Row.of(0),
      Col.of(0),
      Cell.setPlayerLetter(GridOps.cellAt(puzzle.grid, Row.of(0), Col.of(0)), Letter.try('X')!),
    );
    const player = PlayerState.loaded({ ...puzzle, grid });
    const appState = {
      ...state,
      player,
      modal: { kind: 'confirm-reset-player' as const },
      pendingConfirmIntent: { kind: 'confirm-reset-player' as const },
    };
    const result = reduceApp(appState, { kind: 'confirm-reset-player' }, deps);
    expect(result.state.modal).toBeNull();
    expect(result.state.pendingConfirmIntent).toBeNull();
    expect(result.state.player.phase).toBe('solving');
    if (result.state.player.phase !== 'solving') throw new Error('expected solving');
    expect(GridOps.cellAt(result.state.player.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);
    expect(result.state.player.cursor).toBe(null);
    expect(result.events).toEqual([{ kind: 'clear-player-storage', key: puzzle.key }]);
  });

  it('reduceApp: ambiguous kind (select-cell) routes to Player when state.route="play" — verify state.player.cursor changes', () => {
    const state = makeState();
    const deps = makeDeps();
    const puzzle = Puzzle.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(5)));
    const playState = { ...state, route: 'play' as const, player: PlayerState.loaded(puzzle) };
    const result = reduceApp(playState, { kind: 'select-cell', row: Row.of(0), col: Col.of(0) }, deps);
    expect(result.state.player.phase).toBe('solving');
    if (result.state.player.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.player.cursor).not.toBeNull();
    expect(result.state.player.cursor!.row).toBe(Row.of(0));
    expect(result.state.player.cursor!.col).toBe(Col.of(0));
  });

  it('reduceApp: ambiguous kind (select-cell) routes to Builder when state.route="build" — verify state.builder.cursor changes', () => {
    const state = makeState();
    const deps = makeDeps();
    const buildState = {
      ...state,
      route: 'build' as const,
      builder: { ...state.builder, mode: 'fill' as const },
    };
    const result = reduceApp(buildState, { kind: 'select-cell', row: Row.of(0), col: Col.of(0) }, deps);
    expect(result.state.builder.cursor).not.toBeNull();
    expect(result.state.builder.cursor!.row).toBe(Row.of(0));
    expect(result.state.builder.cursor!.col).toBe(Col.of(0));
  });

  it('reduceApp: ambiguous kind (select-cell) on landing route throws (must navigate first)', () => {
    const state = makeState();
    const deps = makeDeps();
    const landingState = {
      ...state,
      route: 'landing' as const,
      builder: { ...state.builder, mode: 'fill' as const },
    };
    expect(() =>
      reduceApp(landingState, { kind: 'select-cell', row: Row.of(0), col: Col.of(0) }, deps),
    ).toThrow(/ambiguous intent kind on landing route: select-cell; navigate first/);
  });

  it('reduceApp: ambiguous kind (type-letter) on play route goes to Player; backspace on build route goes to Builder', () => {
    const state = makeState();
    const deps = makeDeps();
    const puzzle = Puzzle.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(6)));
    const player = {
      ...PlayerState.loaded(puzzle),
      cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
    };
    const playState = { ...state, route: 'play' as const, player };
    const playResult = reduceApp(
      playState,
      { kind: 'type-letter', letter: Letter.try('A')! },
      deps,
    );
    expect(playResult.state.player.phase).toBe('solving');
    if (playResult.state.player.phase !== 'solving') throw new Error('expected solving');
    expect(GridOps.cellAt(playResult.state.player.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toEqual(
      Letter.try('A'),
    );

    const letter = Letter.try('B')!;
    const gridWithAnswer = GridOps.setCell(
      state.builder.puzzle.grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(GridOps.cellAt(state.builder.puzzle.grid, Row.of(0), Col.of(0)), letter),
    );
    const buildState = {
      ...state,
      route: 'build' as const,
      builder: {
        ...state.builder,
        mode: 'fill' as const,
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
        puzzle: Puzzle.withGrid(state.builder.puzzle, gridWithAnswer),
      },
    };
    const buildResult = reduceApp(buildState, { kind: 'backspace' }, deps);
    expect(GridOps.cellAt(buildResult.state.builder.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toBe(null);
  });
});
