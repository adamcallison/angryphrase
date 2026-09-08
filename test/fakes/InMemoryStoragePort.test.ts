import { describe, it, expect } from 'vitest';
import { InMemoryStoragePort } from './InMemoryStoragePort';
import { PuzzleKey } from '../../src/domain/puzzle/PuzzleKey';

describe('InMemoryStoragePort', () => {
  it('round-trips a builder blob', () => {
    const storage = new InMemoryStoragePort();
    storage.saveBuilder('builder-state');
    expect(storage.loadBuilder()).toBe('builder-state');
    storage.clearBuilder();
    expect(storage.loadBuilder()).toBeNull();
  });

  it('round-trips a player-progress blob', () => {
    const storage = new InMemoryStoragePort();
    const key = PuzzleKey.try('00000000-0000-4000-8000-000000000000')!;
    storage.savePlayerProgress(key, 'progress-state');
    expect(storage.loadPlayerProgress(key)).toBe('progress-state');
    storage.clearPlayerProgress(key);
    expect(storage.loadPlayerProgress(key)).toBeNull();
  });

  it('loadBuilder returns null initially', () => {
    const storage = new InMemoryStoragePort();
    expect(storage.loadBuilder()).toBeNull();
  });

  it('throws when throwOnNextLoad is set, then clears the flag', () => {
    const storage = new InMemoryStoragePort();
    storage.throwOnNextLoad = true;
    expect(() => storage.loadBuilder()).toThrow('simulated storage read error');
    expect(storage.loadBuilder()).toBeNull();
    expect(storage.throwOnNextLoad).toBe(false);
  });

  it('nextWriteError on saveBuilder returns the Error and leaves the builder blob unchanged, one-shot', () => {
    const storage = new InMemoryStoragePort();
    const err = new Error('save failed');
    storage.nextWriteError = err;
    expect(storage.saveBuilder('builder-state')).toBe(err);
    expect(storage.getBuilderBlob()).toBeNull();
    expect(storage.saveBuilder('builder-state')).toBeNull();
    expect(storage.getBuilderBlob()).toBe('builder-state');
  });

  it('nextWriteError on clearBuilder returns the Error and preserves the builder blob', () => {
    const storage = new InMemoryStoragePort();
    storage.saveBuilder('builder-state');
    const err = new Error('clear failed');
    storage.nextWriteError = err;
    expect(storage.clearBuilder()).toBe(err);
    expect(storage.getBuilderBlob()).toBe('builder-state');
  });

  it('nextWriteError on savePlayerProgress returns the Error and leaves progress unchanged for that key', () => {
    const storage = new InMemoryStoragePort();
    const key = PuzzleKey.try('00000000-0000-4000-8000-000000000000')!;
    const err = new Error('save failed');
    storage.nextWriteError = err;
    expect(storage.savePlayerProgress(key, 'progress-state')).toBe(err);
    expect(storage.loadPlayerProgress(key)).toBeNull();
    expect(storage.savePlayerProgress(key, 'progress-state')).toBeNull();
    expect(storage.loadPlayerProgress(key)).toBe('progress-state');
  });
});
