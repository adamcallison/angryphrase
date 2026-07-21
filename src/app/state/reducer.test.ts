import { describe, it, expect } from 'vitest';
import { reduceApp } from './reducer';
import { AppState } from './state';
import { PlayerState } from '../../player/state/state';
import { Puzzle } from '../../domain/puzzle/Puzzle';
import { GridSize } from '../../domain/grid/GridSize';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import { Title } from '../../domain/puzzle/Title';
import { Toast } from '../../domain/notifications/Toast';
import { SeededRng } from '../../../test/fakes/SeededRng';
import { FakeClock } from '../../../test/fakes/FakeClock';

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

  it.skip('passthrough: a BuilderIntent that emits a download event returns that event in leftoverEvents', () => {
    // no implemented Builder case emits download yet; revisit when export-incomplete lands.
  });
});
