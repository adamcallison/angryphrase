import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppState } from '../../app/state/state';
import type { AppState as AppStateType } from '../../app/state/state';
import { bootApp, _resetAppStateForTests, getToasts, getAppState } from './appStore.svelte';
import { toastVMs, dismissToast } from './toastStore.svelte';
import { setPorts, resetPorts } from './ports';
import { createPersistenceScheduler } from './persistenceScheduler';
import { InMemoryStoragePort } from '../../../test/fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../../test/fakes/StubDownloadPort';
import { SeededRng } from '../../../test/fakes/SeededRng';
import { FakeClock } from '../../../test/fakes/FakeClock';
import { GridSize } from '../../domain/grid/GridSize';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import { brand } from '../../domain/brand';
import type { Toast } from '../../domain/notifications/Toast';
import type { ToastId } from '../../domain/notifications/ToastId';

function makeRng(seed: number): SeededRng {
  return new SeededRng(seed);
}

function makeBlankAppState(seed: number): AppStateType {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  return AppState.blank(GridSize.of(15), key);
}

function makeToast(id: string, kind: Toast['kind'], message: string): Toast {
  return {
    id: brand<'ToastId', string>(id),
    kind,
    message,
    createdAt: 1000,
    ttlMs: 3500,
  };
}

describe('toastStore.svelte.ts', () => {
  let inMemoryStorage: InMemoryStoragePort;
  let stubDownload: StubDownloadPort;
  let seededRng: SeededRng;
  let fakeClock: FakeClock;

  beforeEach(() => {
    inMemoryStorage = new InMemoryStoragePort();
    stubDownload = new StubDownloadPort();
    seededRng = makeRng(42);
    fakeClock = new FakeClock(0);

    setPorts({ storage: inMemoryStorage, download: stubDownload });

    const initial = makeBlankAppState(42);
    bootApp(initial, { rng: seededRng, now: () => fakeClock.now() }, createPersistenceScheduler(inMemoryStorage));
  });

  afterEach(() => {
    resetPorts();
  });

  it('toastStore: toastVMs() with empty AppState.toasts → returns []', () => {
    expect(toastVMs()).toEqual([]);
  });

  it('toastStore: toastVMs() projects toasts into ToastVMs (id, kind, message)', () => {
    const toast = makeToast('toast-1', 'success', 'saved');
    _resetAppStateForTests({ ...getAppState(), toasts: [toast] });

    const vms = toastVMs();
    expect(vms).toHaveLength(1);
    expect(vms[0]).toEqual({
      id: toast.id,
      kind: 'success',
      message: 'saved',
    });
  });

  it('toastStore: toastVMs() reflects updates after _resetAppStateForTests changes state.toasts', () => {
    const first = makeToast('first', 'info', 'first message');
    _resetAppStateForTests({ ...getAppState(), toasts: [first] });
    expect(toastVMs()).toHaveLength(1);
    expect(toastVMs()[0]!.message).toBe('first message');

    const second = makeToast('second', 'warning', 'second message');
    _resetAppStateForTests({ ...getAppState(), toasts: [first, second] });
    const vms = toastVMs();
    expect(vms).toHaveLength(2);
    expect(vms[0]!.message).toBe('first message');
    expect(vms[1]!.message).toBe('second message');
    expect(vms[1]!.kind).toBe('warning');
  });

  it('toastStore: dismissToast(id) dispatches { kind: "dismiss-toast", id } — verify it is removed from getToasts()', () => {
    const toast = makeToast('dismiss-me', 'info', 'dismissible');
    _resetAppStateForTests({ ...getAppState(), toasts: [toast] });
    expect(getToasts()).toHaveLength(1);

    dismissToast(toast.id);

    expect(getToasts()).toHaveLength(0);
  });

  it('toastStore: dismissToast on a non-existent id is a no-op (no throw, toasts unchanged)', () => {
    const toast = makeToast('existing', 'info', 'still here');
    _resetAppStateForTests({ ...getAppState(), toasts: [toast] });

    const missingId: ToastId = brand<'ToastId', string>('missing');
    expect(() => dismissToast(missingId)).not.toThrow();
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]!.id).toBe(toast.id);
  });
});
