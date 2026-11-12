import type { AppState } from '../../app/state/state';
import type { AppIntent, AnyIntent } from '../../app/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import { reduceApp } from '../../app/state/reducer';
import { applyEventsToApp } from '../../app/state/effects';
import type { DomainEvent, ConfirmableIntent } from '../../domain/notifications/Event';
import type { Toast } from '../../domain/notifications/Toast';
import type { ModalRequest } from '../../domain/notifications/Event';
import type { StoragePort } from '../../domain/ports/ports';
import type { DownloadPort } from '../../domain/ports/ports';
import type { FilePickPort } from '../../domain/ports/ports';
import type { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import type { BuilderState } from '../../builder/state/state';
import type { PlayerState } from '../../player/state/state';
import type { Rng } from '../../domain/rng/Rng';
import type { EpochMs } from '../../domain/time/EpochMs';
import { createPersistenceScheduler, type PersistenceScheduler } from './persistenceScheduler';
import { parsePlayerProgress } from './persistenceCodec';

export type AppDeps = { rng: Rng; now: () => EpochMs };
export type AppPorts = { storage: StoragePort; download: DownloadPort; filePick: FilePickPort };
export type LandingActions = { build(): void; play(): void };

export type AppStore = {
  getRoute(): AppState['route'];
  getToasts(): Toast[];
  getModal(): ModalRequest | null;
  getPendingConfirmIntent(): ConfirmableIntent | null;
  getBuilder(): BuilderState;
  getPlayer(): PlayerState;
  getScheduler(): PersistenceScheduler;
  getPorts(): AppPorts;
  dispatch(intent: AnyIntent): void;
};

export function createAppStore(
  initial: AppState,
  deps: AppDeps,
  ports: AppPorts,
  options?: { persistenceDebounceMs?: number; saveFailureRetoastMs?: number },
): AppStore {
  let state: AppState = $state(initial);
  let activeQueue: AnyIntent[] | null = null;
  const retoastMs = options?.saveFailureRetoastMs ?? 60_000;

  function makeLatch(warnPrefix: string, failureIntent: AppIntent) {
    let armed = false;
    let toastAt: EpochMs | null = null;
    return {
      report(err: Error | null): void {
        if (err === null) {
          armed = false;
          toastAt = null;
          return;
        }
        if (armed && toastAt !== null && deps.now() - toastAt < retoastMs) {
          return;
        }
        armed = true;
        toastAt = deps.now();
        console.warn(warnPrefix, err);
        dispatch(failureIntent);
      },
    };
  }

  const builderLatch = makeLatch('appStore: builder persistence write failed', { kind: 'report-builder-save-failure' });
  const playerLatch = makeLatch('appStore: player persistence write failed', { kind: 'report-player-save-failure' });

  function dispatch(intent: AnyIntent): void {
    if (activeQueue !== null) {
      activeQueue.push(intent);
      return;
    }
    const d = deps;
    let s: AppState = state;
    activeQueue = [intent];
    try {
      while (activeQueue.length > 0) {
        const next = activeQueue.shift();
        if (next === undefined) break;
        const modalWasOpen = s.modal !== null;
        const previousBuilder = state.builder;
        const previousPlayer = state.player;
        const result = reduceApp(s, next, d);
        const folded = applyEventsToApp(result.state, result.events, d);
        s = folded.state;
        // Any dispatch while a modal is open closes it. The UI invariant from
        // architecture.md §5 (Confirmation modals as state) says other guarded controls are disabled while a
        // modal is open, so the only legal dispatches are cancel-modal or the
        // stashed confirm intent — both of which must clear the modal state.
        if (modalWasOpen) {
          s = { ...s, modal: null, pendingConfirmIntent: null };
        }
        state = s;
        // Autosave: schedule before processing leftover external events so that
        // a clear-builder-storage / clear-player-storage event cancels the
        // pending save deterministically (architecture.md §8).
        if (state.builder !== previousBuilder) {
          scheduler.scheduleBuilderSave(state.builder);
        }
        if (state.player !== previousPlayer) {
          scheduler.schedulePlayerSave(state.player);
        }
        for (const event of folded.leftoverEvents) {
          const followup = performExternalEvent(event);
          if (followup !== null) {
            activeQueue.push(followup);
          }
        }
      }
    } finally {
      activeQueue = null;
    }
  }

  function performExternalEvent(event: DomainEvent): AnyIntent | null {
    switch (event.kind) {
      case 'download': {
        const err = ports.download.download(event.filename, event.content);
        if (err !== null) {
          console.warn('appStore: download failed', err);
          return { kind: 'report-download-failure' };
        }
        return null;
      }
      case 'clear-builder-storage': {
        scheduler.clearBuilder();
        return null;
      }
      case 'clear-player-storage': {
        scheduler.clearPlayer(event.key);
        return null;
      }
      case 'load-player-progress': {
        return handleLoadPlayerProgress(event.key);
      }
      case 'toast':
      case 'modal-request':
        return null;
    }
  }

  function handleLoadPlayerProgress(key: PuzzleKey): PlayerIntent | null {
    const result = ports.storage.loadPlayerProgress(key);
    if (result.kind !== 'loaded') {
      // 'absent' is silent. 'failed' was already warned once by localStoragePort;
      // user-visible behaviour stays silent (corrupt progress is dropped silently).
      return null;
    }
    const parsed = parsePlayerProgress(result.value);
    if (parsed === null) {
      console.warn('appStore: parsePlayerProgress returned null (corrupt progress dropped)');
      return null;
    }
    const intent: PlayerIntent = {
      kind: 'apply-loaded-progress',
      target: 'player',
      playerLetters: parsed.playerLetters,
      savedGridSize: parsed.gridSize,
    };
    return intent;
  }

  const scheduler = createPersistenceScheduler(
    ports.storage,
    options?.persistenceDebounceMs ?? 400,
    (slice, err) => (slice === 'builder' ? builderLatch : playerLatch).report(err),
  );

  const store: AppStore = {
    getRoute() {
      return state.route;
    },
    getToasts() {
      return state.toasts;
    },
    getModal() {
      return state.modal;
    },
    getPendingConfirmIntent() {
      return state.pendingConfirmIntent;
    },
    getBuilder() {
      return state.builder;
    },
    getPlayer() {
      return state.player;
    },
    getScheduler() {
      return scheduler;
    },
    getPorts(): AppPorts {
      return ports;
    },
    dispatch,
  };

  return store;
}
