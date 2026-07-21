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
});
