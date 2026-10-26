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

  it('cancel-modal returns state unchanged; modal clearing happens in bindings layer', () => {
    const state = {
      ...makeState(),
      modal: { kind: 'confirm-reset-builder' as const },
      pendingConfirmIntent: { target: 'builder', kind: 'confirm-reset-builder' } as const,
    };
    const deps = makeDeps();
    const result = reduceApp(state, { kind: 'cancel-modal' }, deps);
    expect(result.state).toBe(state);
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

  it('reduceApp: report-builder-save-failure emits an error toast event, state unchanged', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(state, { kind: 'report-builder-save-failure' }, deps);
    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'Saving failed — your Builder changes are not being kept. Download an export to keep a copy.',
    });
  });

  it('reduceApp: report-player-save-failure emits an error toast event, state unchanged', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(state, { kind: 'report-player-save-failure' }, deps);
    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'Saving failed — your solving progress is not being kept.',
    });
  });

  it('report-grid-size-failure: returns a toast event with the domain message and leaves the state unchanged', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(state, { kind: 'report-grid-size-failure' }, deps);
    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: GridSize.invalidMessage(),
    });
  });

  it('switch-to-fill (a BuilderIntent) dispatches to reduceBuilder and folds result', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(state, { target: 'builder', kind: 'switch-to-fill' }, deps);
    expect(result.state.builder.mode).toBe('fill');
    expect(result.events.length).toBe(0);
  });

  it('edit-title dispatches to reduceBuilder and updates builder.puzzle.title', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(state, { target: 'builder', kind: 'edit-title', title: Title.of('My Puzzle') }, deps);
    expect(result.state.builder.puzzle.title).toEqual(Title.of('My Puzzle'));
    expect(result.events.length).toBe(0);
  });

  it('import-new-puzzle (a PlayerIntent) dispatches to reducePlayer and returns PlayerState.phase=import', () => {
    const state = makeState();
    const puzzle = Puzzle.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(5)));
    const stateWithPlayer = { ...state, player: PlayerState.loaded(puzzle) };
    const deps = makeDeps();
    const result = reduceApp(stateWithPlayer, { target: 'player', kind: 'import-new-puzzle' }, deps);
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
    const result = reduceApp(state, { target: 'builder', kind: 'export-incomplete' }, deps);
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

  it('reduceApp: ambiguous kind (select-cell) routes to Player when state.route="play" — verify state.player.cursor changes', () => {
    const state = makeState();
    const deps = makeDeps();
    const puzzle = Puzzle.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(5)));
    const playState = { ...state, route: 'play' as const, player: PlayerState.loaded(puzzle) };
    const result = reduceApp(playState, { target: 'player', kind: 'select-cell', row: Row.of(0), col: Col.of(0) }, deps);
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
    const result = reduceApp(buildState, { target: 'builder', kind: 'select-cell', row: Row.of(0), col: Col.of(0) }, deps);
    expect(result.state.builder.cursor).not.toBeNull();
    expect(result.state.builder.cursor!.row).toBe(Row.of(0));
    expect(result.state.builder.cursor!.col).toBe(Col.of(0));
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
      { target: 'player', kind: 'type-letter', letter: Letter.try('A')! },
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
    const buildResult = reduceApp(buildState, { target: 'builder', kind: 'backspace' }, deps);
    expect(GridOps.cellAt(buildResult.state.builder.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toBe(null);
  });

  it('reduceApp: ambiguous kind (report-import-read-failure) routes to Player on play route and Builder on build route', () => {
    const state = makeState();
    const deps = makeDeps();
    const puzzle = Puzzle.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(5)));
    const playState = { ...state, route: 'play' as const, player: PlayerState.loaded(puzzle) };
    const playResult = reduceApp(playState, { target: 'player', kind: 'report-import-read-failure' }, deps);
    expect(playResult.state.player.phase).toBe('import');
    if (playResult.state.player.phase !== 'import') throw new Error('expected import');
    expect(playResult.state.player.lastImportError).toBe('Could not read that file. Please try again.');
    expect(playResult.events).toContainEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'Could not read that file. Please try again.',
    });

    const buildState = { ...state, route: 'build' as const };
    const buildResult = reduceApp(buildState, { target: 'builder', kind: 'report-import-read-failure' }, deps);
    expect(buildResult.state.builder).toBe(state.builder);
    expect(buildResult.events).toContainEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'Could not read that file. Please try again.',
    });
  });

  it('reduceApp: ambiguous kind (report-pick-failure) routes to Player on play route and Builder on build route', () => {
    const state = makeState();
    const deps = makeDeps();
    const puzzle = Puzzle.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(5)));
    const playState = { ...state, route: 'play' as const, player: PlayerState.loaded(puzzle) };
    const playResult = reduceApp(playState, { target: 'player', kind: 'report-pick-failure' }, deps);
    expect(playResult.state.player.phase).toBe('import');
    if (playResult.state.player.phase !== 'import') throw new Error('expected import');
    expect(playResult.state.player.lastImportError).toBe('Could not open or read that file. Please try again.');
    expect(playResult.events).toContainEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'Could not open or read that file. Please try again.',
    });

    const buildState = { ...state, route: 'build' as const };
    const buildResult = reduceApp(buildState, { target: 'builder', kind: 'report-pick-failure' }, deps);
    expect(buildResult.state.builder).toBe(state.builder);
    expect(buildResult.events).toContainEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'Could not open or read that file. Please try again.',
    });
  });

  it('reduceApp: returns sub-reducer toast events raw (state.toasts unchanged; fold happens in the store)', () => {
    const state = makeState();
    const deps = makeDeps();
    const result = reduceApp(
      state,
      { target: 'builder', kind: 'request-import-puzzle', fileContent: 'not valid json' },
      deps,
    );
    expect(result.events).toContainEqual({
      kind: 'toast',
      toastKind: 'error',
      message: expect.stringContaining('valid'),
    });
    expect(result.state.toasts).toBe(state.toasts);
    expect(result.state.builder).toBe(state.builder);
  });
});
