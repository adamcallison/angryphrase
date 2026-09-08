import { describe, it, expect, beforeEach } from 'vitest';
import { AppState } from '../../../src/app/state/state';
import type { AppState as AppStateType } from '../../../src/app/state/state';
import { createAppStore, type AppPorts, type AppStore } from '../../../src/ui/bindings/appStore.svelte';
import { createToastFacade, type ToastFacade } from '../../../src/ui/bindings/toastFacade';
import { InMemoryStoragePort } from '../../fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../fakes/StubDownloadPort';
import { SeededRng } from '../../fakes/SeededRng';
import { FakeClock } from '../../fakes/FakeClock';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { brand } from '../../../src/domain/brand';
import type { Toast } from '../../../src/domain/notifications/Toast';
import type { ToastId } from '../../../src/domain/notifications/ToastId';
import { EpochMs } from '../../../src/domain/time/EpochMs';
import { DurationMs } from '../../../src/domain/time/DurationMs';

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
    createdAt: EpochMs.of(1000),
    ttlMs: DurationMs.of(3500),
  };
}

describe('toastFacade.ts', () => {
  let inMemoryStorage: InMemoryStoragePort;
  let stubDownload: StubDownloadPort;
  let seededRng: SeededRng;
  let fakeClock: FakeClock;
  let store: AppStore;
  let toastFacade: ToastFacade;

  function makePorts(): AppPorts {
    return { storage: inMemoryStorage, download: stubDownload, filePick: { pickFile: async () => '', readDroppedFile: async () => '' } };
  }

  beforeEach(() => {
    inMemoryStorage = new InMemoryStoragePort();
    stubDownload = new StubDownloadPort();
    seededRng = makeRng(42);
    fakeClock = new FakeClock(0);

    const initial = makeBlankAppState(42);
    store = createAppStore(
      initial,
      { rng: seededRng, now: () => fakeClock.now() },
      makePorts(),
    );
    toastFacade = createToastFacade(store);
  });

  it('toastFacade: toastVMs() with empty AppState.toasts → returns []', () => {
    expect(toastFacade.toastVMs()).toEqual([]);
  });

  it('toastFacade: toastVMs() projects toasts into ToastVMs (id, kind, message)', () => {
    const toast = makeToast('toast-1', 'success', 'saved');
    const freshStore = createAppStore(
      { ...store.getState(), toasts: [toast] },
      { rng: seededRng, now: () => fakeClock.now() },
      makePorts(),
    );
    const freshToastFacade = createToastFacade(freshStore);

    const vms = freshToastFacade.toastVMs();
    expect(vms).toHaveLength(1);
    expect(vms[0]).toEqual({
      id: toast.id,
      kind: 'success',
      message: 'saved',
      ttlMs: toast.ttlMs,
    });
  });

  it('toastFacade: toastVMs() reflects updates after fresh createAppStore changes state.toasts', () => {
    const first = makeToast('first', 'info', 'first message');
    const firstStore = createAppStore(
      { ...store.getState(), toasts: [first] },
      { rng: seededRng, now: () => fakeClock.now() },
      makePorts(),
    );
    const firstToastFacade = createToastFacade(firstStore);
    expect(firstToastFacade.toastVMs()).toHaveLength(1);
    expect(firstToastFacade.toastVMs()[0]!.message).toBe('first message');

    const second = makeToast('second', 'warning', 'second message');
    const secondStore = createAppStore(
      { ...firstStore.getState(), toasts: [first, second] },
      { rng: seededRng, now: () => fakeClock.now() },
      makePorts(),
    );
    const secondToastFacade = createToastFacade(secondStore);
    const vms = secondToastFacade.toastVMs();
    expect(vms).toHaveLength(2);
    expect(vms[0]!.message).toBe('first message');
    expect(vms[1]!.message).toBe('second message');
    expect(vms[1]!.kind).toBe('warning');
  });

  it('toastFacade: dismissToast(id) dispatches { kind: "dismiss-toast", id } — verify it is removed from getToasts()', () => {
    const toast = makeToast('dismiss-me', 'info', 'dismissible');
    const freshStore = createAppStore(
      { ...store.getState(), toasts: [toast] },
      { rng: seededRng, now: () => fakeClock.now() },
      makePorts(),
    );
    const freshToastFacade = createToastFacade(freshStore);
    expect(freshStore.getState().toasts).toHaveLength(1);

    freshToastFacade.actions.dismiss(toast.id);

    expect(freshStore.getState().toasts).toHaveLength(0);
  });

  it('toastFacade: dismissToast on a non-existent id is a no-op (no throw, toasts unchanged)', () => {
    const toast = makeToast('existing', 'info', 'still here');
    const freshStore = createAppStore(
      { ...store.getState(), toasts: [toast] },
      { rng: seededRng, now: () => fakeClock.now() },
      makePorts(),
    );
    const freshToastFacade = createToastFacade(freshStore);

    const missingId: ToastId = brand<'ToastId', string>('missing');
    expect(() => freshToastFacade.actions.dismiss(missingId)).not.toThrow();
    expect(freshStore.getState().toasts).toHaveLength(1);
    expect(freshStore.getState().toasts[0]!.id).toBe(toast.id);
  });

  it('toastFacade: two createToastFacade instances over two appStores are independent', () => {
    const storeA = createAppStore(
      makeBlankAppState(1),
      { rng: makeRng(1), now: () => fakeClock.now() },
      makePorts(),
    );
    const a = createToastFacade(storeA);
    storeA.dispatch({ kind: 'request-import-puzzle', fileContent: 'not json' });

    const storeB = createAppStore(
      makeBlankAppState(2),
      { rng: makeRng(2), now: () => fakeClock.now() },
      makePorts(),
    );
    const b = createToastFacade(storeB);
    storeB.dispatch({ kind: 'request-import-puzzle', fileContent: 'also not json' });

    const aId = a.toastVMs()[0]!.id;
    a.actions.dismiss(aId);

    expect(a.toastVMs()).toHaveLength(0);
    expect(b.toastVMs()).toHaveLength(1);
  });
});
