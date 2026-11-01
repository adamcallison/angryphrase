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
  /** Synchronously clear Builder storage AND cancel any pending Builder save (event-driven clears — architecture.md §8 (Persistence)). */
  clearBuilder(): void;
  /** Synchronously clear one player's progress AND cancel any pending Player save for that key. */
  clearPlayer(key: PuzzleKey): void;
  /** Synchronously fire any pending saves immediately (used by boot/teardown). */
  flush(): void;
}

type SliceScheduler<S, C> = {
  schedule(state: S): void;
  clear(arg: C): void;
  flush(): void;
};

/** One timer + pending state + cancel + flush, parameterized by saved state and clear-argument types. */
function createSliceScheduler<S, C>(
  doSave: (state: S) => void,
  doClear: (arg: C) => void,
  debounceMs: number,
): SliceScheduler<S, C> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: S | null = null;

  function cancelTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    schedule(state) {
      pending = state;
      cancelTimer();
      timer = setTimeout(() => {
        timer = null;
        const snapshot = pending;
        pending = null;
        if (snapshot === null) return;
        doSave(snapshot);
      }, debounceMs);
    },

    clear(arg) {
      cancelTimer();
      pending = null;
      doClear(arg);
    },

    flush() {
      cancelTimer();
      if (pending !== null) {
        const snapshot = pending;
        pending = null;
        doSave(snapshot);
      }
    },
  };
}

export function createPersistenceScheduler(
  storage: StoragePort,
  debounceMs: number = 400,
  onWriteResult: (slice: 'builder' | 'player', err: Error | null) => void,
): PersistenceScheduler {
  const builder = createSliceScheduler<BuilderState, void>(
    (state) => {
      const blob = serializeBuilderSnapshot(state);
      const err = storage.saveBuilder(blob);
      onWriteResult('builder', err);
    },
    () => {
      const err = storage.clearBuilder();
      onWriteResult('builder', err);
    },
    debounceMs,
  );

  const player = createSliceScheduler<PlayerState, PuzzleKey>(
    (state) => {
      const blob = serializePlayerProgress(state);
      if (blob === null || state.phase !== 'solving') return;
      const err = storage.savePlayerProgress(state.puzzle.key, blob);
      onWriteResult('player', err);
    },
    (key) => {
      const err = storage.clearPlayerProgress(key);
      onWriteResult('player', err);
    },
    debounceMs,
  );

  return {
    scheduleBuilderSave: builder.schedule,
    schedulePlayerSave: player.schedule,
    clearBuilder: () => builder.clear(),
    clearPlayer: player.clear,
    flush() {
      builder.flush();
      player.flush();
    },
  };
}
