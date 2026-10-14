import type { LoadResult, StoragePort } from '../domain/ports/ports';
import type { PuzzleKey } from '../domain/puzzle/PuzzleKey';

// Key-naming convention:
// - Builder snapshot: one shared slot at 'angryphrase:builder'.
// - Player progress: one slot per puzzle key at 'angryphrase:player-progress:' + String(key).
// PuzzleKey is a Brand<'PuzzleKey', string>, so String(key) yields the underlying UUID string.
const BUILDER_KEY = 'angryphrase:builder';
const PLAYER_PREFIX = 'angryphrase:player-progress:';

export function createLocalStoragePort(): StoragePort {
  return {
    loadBuilder(): LoadResult<string> {
      try {
        const value = localStorage.getItem(BUILDER_KEY);
        return value === null ? { kind: 'absent' } : { kind: 'loaded', value };
      } catch (err) {
        console.warn('localStoragePort.loadBuilder failed:', err);
        return { kind: 'failed', error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    saveBuilder(blob: string): Error | null {
      try {
        localStorage.setItem(BUILDER_KEY, blob);
        return null;
      } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
      }
    },
    clearBuilder(): Error | null {
      try {
        localStorage.removeItem(BUILDER_KEY);
        return null;
      } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
      }
    },
    loadPlayerProgress(key: PuzzleKey): LoadResult<string> {
      try {
        const value = localStorage.getItem(PLAYER_PREFIX + String(key));
        return value === null ? { kind: 'absent' } : { kind: 'loaded', value };
      } catch (err) {
        console.warn('localStoragePort.loadPlayerProgress failed:', err);
        return { kind: 'failed', error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    savePlayerProgress(key: PuzzleKey, blob: string): Error | null {
      try {
        localStorage.setItem(PLAYER_PREFIX + String(key), blob);
        return null;
      } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
      }
    },
    clearPlayerProgress(key: PuzzleKey): Error | null {
      try {
        localStorage.removeItem(PLAYER_PREFIX + String(key));
        return null;
      } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
      }
    },
  };
}

export const localStoragePort: StoragePort = createLocalStoragePort();
