import type { StoragePort } from '../../domain/ports/ports';
import type { BuilderState } from '../../builder/state/state';
import type { PlayerState } from '../../player/state/state';
import type { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import { serializeBuilderSnapshot, serializePlayerProgress } from './persistenceCodec';

// ----- Scheduler -----

export interface PersistenceScheduler {
  /** Queue a debounced Builder save; if another save is pending, the latest state wins (coalescing). 400 ms default. */
  scheduleBuilderSave(state: BuilderState): void;
  /** Queue a debounced Player save; if another save is pending, the latest state wins. 400 ms default. */
  schedulePlayerSave(state: PlayerState): void;
  /** Synchronously clear Builder storage AND cancel any pending Builder save (FR-55 / §4.5 event-driven clears). */
  clearBuilder(): void;
  /** Synchronously clear one player's progress AND cancel any pending Player save for that key. */
  clearPlayer(key: PuzzleKey): void;
  /** Synchronously fire any pending saves immediately (used by boot/teardown). */
  flush(): void;
}

export function createPersistenceScheduler(
  storage: StoragePort,
  debounceMs: number = 400,
  onWriteResult: (slice: 'builder' | 'player', err: Error | null) => void,
): PersistenceScheduler {

  let builderTimer: ReturnType<typeof setTimeout> | null = null;
  let playerTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingBuilderState: BuilderState | null = null;
  let pendingPlayerState: PlayerState | null = null;

  function doSaveBuilder(state: BuilderState): void {
    const blob = serializeBuilderSnapshot(state);
    const err = storage.saveBuilder(blob);
    onWriteResult('builder', err);
  }

  function doSavePlayer(state: PlayerState): void {
    if (state.phase !== 'solving') return;
    const key = state.puzzle.key;
    const blob = serializePlayerProgress(state);
    if (blob === null) return;
    const err = storage.savePlayerProgress(key, blob);
    onWriteResult('player', err);
  }

  return {
    scheduleBuilderSave(state) {
      pendingBuilderState = state;
      if (builderTimer !== null) clearTimeout(builderTimer);
      builderTimer = setTimeout(() => {
        builderTimer = null;
        const snapshot = pendingBuilderState;
        pendingBuilderState = null;
        if (snapshot === null) return;
        doSaveBuilder(snapshot);
      }, debounceMs);
    },

    schedulePlayerSave(state) {
      if (state.phase !== 'solving') return; // Nothing to save during import phase.
      pendingPlayerState = state;
      if (playerTimer !== null) clearTimeout(playerTimer);
      playerTimer = setTimeout(() => {
        playerTimer = null;
        const snapshot = pendingPlayerState;
        pendingPlayerState = null;
        if (snapshot === null) return;
        doSavePlayer(snapshot);
      }, debounceMs);
    },

    clearBuilder() {
      if (builderTimer !== null) {
        clearTimeout(builderTimer);
        builderTimer = null;
      }
      pendingBuilderState = null;
      const err = storage.clearBuilder();
      onWriteResult('builder', err);
    },

    clearPlayer(key) {
      if (playerTimer !== null) {
        clearTimeout(playerTimer);
        playerTimer = null;
      }
      pendingPlayerState = null;
      const err = storage.clearPlayerProgress(key);
      onWriteResult('player', err);
    },

    flush() {
      if (builderTimer !== null) {
        clearTimeout(builderTimer);
        builderTimer = null;
      }
      if (pendingBuilderState !== null) {
        const snapshot = pendingBuilderState;
        pendingBuilderState = null;
        doSaveBuilder(snapshot);
      }
      if (playerTimer !== null) {
        clearTimeout(playerTimer);
        playerTimer = null;
      }
      if (pendingPlayerState !== null) {
        const snapshot = pendingPlayerState;
        pendingPlayerState = null;
        doSavePlayer(snapshot);
      }
    },
  };
}
