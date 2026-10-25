import { describe, it, expect, vi } from 'vitest';
import {
  createFilePickActions,
  type FilePickActions,
  type FilePickFailureIntent,
} from '../../../src/ui/bindings/filePickActions';
import type { AppStore } from '../../../src/ui/bindings/appStore.svelte';
import type { PickResult, DroppedFileResult } from '../../../src/domain/ports/ports';

type TargetedFilePickIntent = { target: 'builder' | 'player' } & FilePickFailureIntent;

describe('filePickActions.ts', () => {
  function makeStore(filePick: {
    pickFile: () => Promise<PickResult>;
    readDroppedFile: (file: File) => Promise<DroppedFileResult>;
  }): AppStore {
    return {
      getRoute: () => 'landing',
      getToasts: () => [],
      getModal: () => null,
      getPendingConfirmIntent: () => null,
      getBuilder: () => null as never,
      getPlayer: () => null as never,
      getScheduler: () => null as never,
      getPorts: () => ({ storage: null as never, download: null as never, filePick }),
      dispatch: () => {},
    };
  }

  function makeActions(appStore: AppStore): {
    actions: FilePickActions;
    failures: TargetedFilePickIntent[];
    read: string[];
  } {
    const failures: TargetedFilePickIntent[] = [];
    const read: string[] = [];
    const actions = createFilePickActions(
      appStore,
      'testFacade',
      'builder',
      (intent) => failures.push(intent),
      (text) => read.push(text),
    );
    return { actions, failures, read };
  }

  it('pickFile returns text when port returns picked', async () => {
    const filePick = {
      pickFile: vi.fn(async () => ({ kind: 'picked' as const, text: 'file-content' })),
      readDroppedFile: vi.fn(),
    };
    const { actions } = makeActions(makeStore(filePick));

    const result = await actions.pickFile();

    expect(result).toBe('file-content');
    expect(filePick.pickFile).toHaveBeenCalledTimes(1);
  });

  it('pickFile returns null when port returns cancelled', async () => {
    const filePick = {
      pickFile: vi.fn(async () => ({ kind: 'cancelled' as const })),
      readDroppedFile: vi.fn(),
    };
    const { actions } = makeActions(makeStore(filePick));

    const result = await actions.pickFile();

    expect(result).toBeNull();
  });

  it('pickFile returns null, warns once, and dispatches report-pick-failure when port returns failed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('pick failed');
    const filePick = {
      pickFile: vi.fn(async () => ({ kind: 'failed' as const, error })),
      readDroppedFile: vi.fn(),
    };
    const { actions, failures } = makeActions(makeStore(filePick));

    const result = await actions.pickFile();

    expect(result).toBeNull();
    expect(failures).toEqual([{ target: 'builder', kind: 'report-pick-failure' }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('testFacade: pickFile failed:', error);
    warnSpy.mockRestore();
  });

  it('importDroppedFile calls onRead with text when port returns read', async () => {
    const file = new File([], 'puzzle.json');
    const filePick = {
      pickFile: vi.fn(),
      readDroppedFile: vi.fn(async () => ({ kind: 'read' as const, text: 'dropped text' })),
    };
    const { actions, read, failures } = makeActions(makeStore(filePick));

    await actions.importDroppedFile(file);

    expect(filePick.readDroppedFile).toHaveBeenCalledWith(file);
    expect(read).toEqual(['dropped text']);
    expect(failures).toEqual([]);
  });

  it('importDroppedFile warns once and dispatches report-import-read-failure when port returns failed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = new File([], 'puzzle.json');
    const error = new Error('read failed');
    const filePick = {
      pickFile: vi.fn(),
      readDroppedFile: vi.fn(async () => ({ kind: 'failed' as const, error })),
    };
    const { actions, read, failures } = makeActions(makeStore(filePick));

    await actions.importDroppedFile(file);

    expect(read).toEqual([]);
    expect(failures).toEqual([{ target: 'builder', kind: 'report-import-read-failure' }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('testFacade: failed to read dropped file:', error);
    warnSpy.mockRestore();
  });
});
