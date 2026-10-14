import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installTeardown } from '../src/ui/bindings/teardown';
import { createAppStore } from '../src/ui/bindings/appStore.svelte';
import { AppState } from '../src/app/state/state';
import { InMemoryStoragePort } from './fakes/InMemoryStoragePort';
import { SeededRng } from './fakes/SeededRng';
import { FakeClock } from './fakes/FakeClock';
import { GridSize } from '../src/domain/grid/GridSize';
import { PuzzleKey } from '../src/domain/puzzle/PuzzleKey';
import { serializeBuilderSnapshot } from '../src/ui/bindings/persistenceCodec';
import type { AppPorts } from '../src/ui/bindings/appStore.svelte';

function makeStore(storage: InMemoryStoragePort) {
  const rng = new SeededRng(1);
  const initial = AppState.blank(GridSize.of(5), PuzzleKey.generate(rng));
  const ports: AppPorts = {
    storage,
    download: { download: () => null },
    filePick: {
      pickFile: async () => ({ kind: 'picked' as const, text: '' }),
      readDroppedFile: async () => ({ kind: 'read' as const, text: '' }),
    },
  };
  return createAppStore(initial, { rng, now: () => new FakeClock(0).now() }, ports);
}

function getPagehideCallback() {
  const calls = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
  const pagehide = calls.find(([event]) => event === 'pagehide');
  expect(pagehide).toBeDefined();
  return pagehide![1] as () => void;
}

describe('main.ts teardown wiring', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'window',
      { addEventListener: vi.fn() },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pagehide after scheduleBuilderSave fires flush synchronously', () => {
    const storage = new InMemoryStoragePort();
    const store = makeStore(storage);
    installTeardown(store);

    const spy = vi.spyOn(storage, 'saveBuilder');
    const latest = { ...store.getBuilder(), mode: 'fill' as const };
    store.getScheduler().scheduleBuilderSave(latest);

    expect(spy).not.toHaveBeenCalled();

    getPagehideCallback()();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(serializeBuilderSnapshot(latest));
  });

  it('pagehide after a second scheduleBuilderSave flushes the new pending save', () => {
    const storage = new InMemoryStoragePort();
    const store = makeStore(storage);
    installTeardown(store);

    const spy = vi.spyOn(storage, 'saveBuilder');
    const first = { ...store.getBuilder(), mode: 'fill' as const };
    const second = { ...store.getBuilder(), mode: 'design' as const };
    store.getScheduler().scheduleBuilderSave(first);
    store.getScheduler().scheduleBuilderSave(second);

    getPagehideCallback()();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(serializeBuilderSnapshot(second));
    expect(spy).not.toHaveBeenCalledWith(serializeBuilderSnapshot(first));
  });

  it('no beforeunload listener registered', () => {
    const storage = new InMemoryStoragePort();
    const store = makeStore(storage);
    installTeardown(store);

    const calls = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe('pagehide');
    expect(calls.some(([event]) => event === 'beforeunload')).toBe(false);
  });
});
