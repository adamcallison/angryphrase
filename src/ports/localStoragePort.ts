import type { LoadResult, StoragePort } from '../domain/ports/ports';
import type { PuzzleKey } from '../domain/puzzle/PuzzleKey';

// Key-naming convention:
// - Builder snapshot: one shared slot at 'angryphrase:builder'.
// - Player progress: one slot per puzzle key at 'angryphrase:player-progress:' + String(key).
// PuzzleKey is a Brand<'PuzzleKey', string>, so String(key) yields the underlying UUID string.
const BUILDER_KEY = 'angryphrase:builder';
const PLAYER_PREFIX = 'angryphrase:player-progress:';

function coerceError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function loadKey(key: string): LoadResult<string> {
  try {
    const value = localStorage.getItem(key);
    return value === null ? { kind: 'absent' } : { kind: 'loaded', value };
  } catch (err) {
    console.warn('localStoragePort.load failed:', err);
    return { kind: 'failed', error: coerceError(err) };
  }
}

function saveKey(key: string, blob: string): Error | null {
  try {
    localStorage.setItem(key, blob);
    return null;
  } catch (err) {
    return coerceError(err);
  }
}

function removeKey(key: string): Error | null {
  try {
    localStorage.removeItem(key);
    return null;
  } catch (err) {
    return coerceError(err);
  }
}

export function createLocalStoragePort(): StoragePort {
  return {
    loadBuilder(): LoadResult<string> {
      return loadKey(BUILDER_KEY);
    },
    saveBuilder(blob: string): Error | null {
      return saveKey(BUILDER_KEY, blob);
    },
    clearBuilder(): Error | null {
      return removeKey(BUILDER_KEY);
    },
    loadPlayerProgress(key: PuzzleKey): LoadResult<string> {
      return loadKey(PLAYER_PREFIX + String(key));
    },
    savePlayerProgress(key: PuzzleKey, blob: string): Error | null {
      return saveKey(PLAYER_PREFIX + String(key), blob);
    },
    clearPlayerProgress(key: PuzzleKey): Error | null {
      return removeKey(PLAYER_PREFIX + String(key));
    },
  };
}

export const localStoragePort: StoragePort = createLocalStoragePort();
