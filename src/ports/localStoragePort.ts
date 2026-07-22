import type { StoragePort } from '../domain/persistence/ports.ts';
import type { PuzzleKey } from '../domain/puzzle/PuzzleKey.ts';

// Key-naming convention:
// - Builder snapshot: one shared slot at 'angryphrase:builder'.
// - Player progress: one slot per puzzle key at 'angryphrase:player-progress:' + String(key).
// PuzzleKey is a Brand<'PuzzleKey', string>, so String(key) yields the underlying UUID string.
const BUILDER_KEY = 'angryphrase:builder';
const PLAYER_PREFIX = 'angryphrase:player-progress:';

export function createLocalStoragePort(): StoragePort {
  return {
    loadBuilder(): string | null {
      try {
        return localStorage.getItem(BUILDER_KEY);
      } catch (err) {
        console.warn('localStoragePort.loadBuilder failed:', err);
        return null;
      }
    },
    saveBuilder(blob: string): void {
      try {
        localStorage.setItem(BUILDER_KEY, blob);
      } catch (err) {
        console.warn('localStoragePort.saveBuilder failed:', err);
      }
    },
    clearBuilder(): void {
      try {
        localStorage.removeItem(BUILDER_KEY);
      } catch (err) {
        console.warn('localStoragePort.clearBuilder failed:', err);
      }
    },
    loadPlayerProgress(key: PuzzleKey): string | null {
      try {
        return localStorage.getItem(PLAYER_PREFIX + String(key));
      } catch (err) {
        console.warn('localStoragePort.loadPlayerProgress failed:', err);
        return null;
      }
    },
    savePlayerProgress(key: PuzzleKey, blob: string): void {
      try {
        localStorage.setItem(PLAYER_PREFIX + String(key), blob);
      } catch (err) {
        console.warn('localStoragePort.savePlayerProgress failed:', err);
      }
    },
    clearPlayerProgress(key: PuzzleKey): void {
      try {
        localStorage.removeItem(PLAYER_PREFIX + String(key));
      } catch (err) {
        console.warn('localStoragePort.clearPlayerProgress failed:', err);
      }
    },
  };
}

export const localStoragePort: StoragePort = createLocalStoragePort();
