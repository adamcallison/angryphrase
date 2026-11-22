import { describe, it, expect, vi } from 'vitest';
import { createUrlLoadActions, type UrlLoadActions } from '../../../src/ui/bindings/urlLoadActions';
import type { AppStore } from '../../../src/ui/bindings/appStore.svelte';
import type { UrlLoadResult } from '../../../src/domain/ports/ports';

type TargetedUrlLoadIntent = { target: 'player'; kind: 'report-url-load-failure' };

describe('urlLoadActions.ts', () => {
  function makeStore(urlLoad: { load: (url: string) => Promise<UrlLoadResult> }): AppStore {
    return {
      getRoute: () => 'landing',
      getToasts: () => [],
      getModal: () => null,
      getPendingConfirmIntent: () => null,
      getBuilder: () => null as never,
      getPlayer: () => null as never,
      getSaveHealth: () => ({ builder: false, player: false }),
      getScheduler: () => null as never,
      getPorts: () => ({ storage: null as never, download: null as never, filePick: null as never, urlLoad }),
      dispatch: () => {},
    };
  }

  function makeActions(appStore: AppStore): {
    actions: UrlLoadActions;
    failures: TargetedUrlLoadIntent[];
    read: string[];
  } {
    const failures: TargetedUrlLoadIntent[] = [];
    const read: string[] = [];
    const actions = createUrlLoadActions(
      appStore,
      'testFacade',
      (intent) => failures.push(intent),
      (text) => read.push(text),
    );
    return { actions, failures, read };
  }

  it('loadUrl passes the URL to the port and calls onRead with the text when loaded', async () => {
    const urlLoad = { load: vi.fn(async () => ({ kind: 'loaded' as const, text: 'fetched text' })) };
    const { actions, read, failures } = makeActions(makeStore(urlLoad));

    await actions.loadUrl('https://example.com/puzzle.json');

    expect(urlLoad.load).toHaveBeenCalledWith('https://example.com/puzzle.json');
    expect(read).toEqual(['fetched text']);
    expect(failures).toEqual([]);
  });

  it('loadUrl warns and dispatches the failure intent when the port fails, and does not call onRead', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('load failed');
    const urlLoad = { load: vi.fn(async () => ({ kind: 'failed' as const, error })) };
    const { actions, read, failures } = makeActions(makeStore(urlLoad));

    await actions.loadUrl('https://example.com/puzzle.json');

    expect(read).toEqual([]);
    expect(failures).toEqual([{ target: 'player', kind: 'report-url-load-failure' }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('testFacade: failed to load URL:', error);
    warnSpy.mockRestore();
  });
});
