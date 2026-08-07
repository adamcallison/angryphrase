import { describe, it, expect } from 'vitest';
import { applyEventsToApp } from '../../../src/app/state/effects';
import { AppState } from '../../../src/app/state/state';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { Toast } from '../../../src/domain/notifications/Toast';
import type { DomainEvent } from '../../../src/domain/notifications/Event';
import { SeededRng } from '../../fakes/SeededRng';
import { FakeClock } from '../../fakes/FakeClock';

describe('applyEventsToApp', () => {
  function blankState() {
    return AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(1)));
  }

  function makeDeps(seed: number = 2) {
    const rng = new SeededRng(seed);
    const clock = new FakeClock(1000);
    return { rng, now: () => clock.now(), clock };
  }

  it('applyEventsToApp: empty events returns state unchanged with empty leftover', () => {
    const state = blankState();
    const deps = makeDeps();
    const result = applyEventsToApp(state, [], deps);
    expect(result.state).toBe(state);
    expect(result.leftoverEvents).toEqual([]);
  });

  it('applyEventsToApp: toast event appends a Toast (with id + createdAt from deps.now)', () => {
    const state = blankState();
    const deps = makeDeps();
    const event: DomainEvent = { kind: 'toast', toastKind: 'info', message: 'hello' };
    const result = applyEventsToApp(state, [event], deps);
    expect(result.state.toasts).toHaveLength(1);
    const toast = result.state.toasts[0]!;
    expect(toast.kind).toBe('info');
    expect(toast.message).toBe('hello');
    expect(toast.createdAt).toBe(1000);
    expect(toast.id).toBeDefined();
    expect(result.leftoverEvents).toEqual([]);
  });

  it('applyEventsToApp: modal-request event sets modal and pendingConfirmIntent', () => {
    const state = blankState();
    const deps = makeDeps();
    const event: DomainEvent = {
      kind: 'modal-request',
      modal: { kind: 'confirm-design-switch' },
      confirmIntent: { kind: 'confirm-switch-to-design' },
    };
    const result = applyEventsToApp(state, [event], deps);
    expect(result.state.modal).toEqual({ kind: 'confirm-design-switch' });
    expect(result.state.pendingConfirmIntent).toEqual({ kind: 'confirm-switch-to-design' });
    expect(result.leftoverEvents).toEqual([]);
  });

  it('applyEventsToApp: download event passes through to leftoverEvents', () => {
    const state = blankState();
    const deps = makeDeps();
    const event: DomainEvent = { kind: 'download', filename: 'puzzle.json', content: '{}' };
    const result = applyEventsToApp(state, [event], deps);
    expect(result.state).toBe(state);
    expect(result.leftoverEvents).toEqual([event]);
  });

  it('applyEventsToApp: clear-builder-storage passes through to leftoverEvents', () => {
    const state = blankState();
    const deps = makeDeps();
    const event: DomainEvent = { kind: 'clear-builder-storage' };
    const result = applyEventsToApp(state, [event], deps);
    expect(result.state).toBe(state);
    expect(result.leftoverEvents).toEqual([event]);
  });

  it('applyEventsToApp: clear-player-storage passes through to leftoverEvents', () => {
    const state = blankState();
    const deps = makeDeps();
    const event: DomainEvent = {
      kind: 'clear-player-storage',
      key: PuzzleKey.generate(new SeededRng(3)),
    };
    const result = applyEventsToApp(state, [event], deps);
    expect(result.state).toBe(state);
    expect(result.leftoverEvents).toEqual([event]);
  });

  it('applyEventsToApp: load-player-progress passes through to leftoverEvents', () => {
    const state = blankState();
    const deps = makeDeps();
    const event: DomainEvent = {
      kind: 'load-player-progress',
      key: PuzzleKey.generate(new SeededRng(4)),
    };
    const result = applyEventsToApp(state, [event], deps);
    expect(result.state).toBe(state);
    expect(result.leftoverEvents).toEqual([event]);
  });

  it('applyEventsToApp: multiple toasts append in order', () => {
    const state = blankState();
    const rng1 = new SeededRng(10);
    const rng2 = new SeededRng(20);
    const clock = new FakeClock(5000);
    const toast1 = Toast.create(rng1, 'info', 'first', () => clock.now());
    clock.advance(1);
    const toast2 = Toast.create(rng2, 'success', 'second', () => clock.now());
    const stateWithToasts = { ...state, toasts: [toast1, toast2] };
    const event1: DomainEvent = { kind: 'toast', toastKind: 'warning', message: 'third' };
    const event2: DomainEvent = { kind: 'toast', toastKind: 'error', message: 'fourth' };
    const deps = { rng: new SeededRng(30), now: () => clock.now() };
    const result = applyEventsToApp(stateWithToasts, [event1, event2], deps);
    expect(result.state.toasts).toHaveLength(4);
    expect(result.state.toasts[0]).toBe(toast1);
    expect(result.state.toasts[1]).toBe(toast2);
    expect(result.state.toasts[2]!.message).toBe('third');
    expect(result.state.toasts[3]!.message).toBe('fourth');
    expect(result.leftoverEvents).toEqual([]);
  });
});
