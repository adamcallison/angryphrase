import type { AppState } from '../../app/state/state';
import type { AppIntent } from '../../app/state/intents';
import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import { reduceApp } from '../../app/state/reducer';
import { applyEventsToApp } from '../../app/state/effects';
import type { DomainEvent, ConfirmableIntent } from '../../domain/notifications/Event';
import type { Toast } from '../../domain/notifications/Toast';
import type { ModalRequest } from '../../domain/notifications/ModalRequest';
import type { StoragePort } from '../../domain/ports/ports';
import type { DownloadPort } from '../../domain/ports/ports';
import type { FilePickPort } from '../../domain/ports/ports';
import type { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import type { BuilderState } from '../../builder/state/state';
import type { PlayerState } from '../../player/state/state';
import type { Rng } from '../../domain/rng/Rng';
import type { EpochMs } from '../../domain/time/EpochMs';
import type { PersistenceScheduler } from './persistenceScheduler';
import { parsePlayerProgress } from './persistenceCodec';

export type AppDeps = { rng: Rng; now: () => EpochMs };
export type AppPorts = { storage: StoragePort; download: DownloadPort; filePick: FilePickPort };
export type LandingActions = { build(): void; play(): void };

export type AppStore = {
  getState(): AppState;
  getRoute(): AppState['route'];
  getToasts(): Toast[];
  getModal(): ModalRequest | null;
  getPendingConfirmIntent(): ConfirmableIntent | null;
  getBuilder(): BuilderState;
  getPlayer(): PlayerState;
  getScheduler(): PersistenceScheduler;
  getPorts(): AppPorts;
  dispatch(intent: AppIntent | BuilderIntent | PlayerIntent): void;
};

export function createAppStore(
  initial: AppState,
  deps: AppDeps,
  ports: AppPorts,
  scheduler: PersistenceScheduler,
): AppStore {
  let state: AppState = $state(initial);

  function performExternalEvent(event: DomainEvent): AppIntent | BuilderIntent | PlayerIntent | null {
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
    let blob: string | null;
    try {
      blob = ports.storage.loadPlayerProgress(key);
    } catch (err) {
      console.warn('appStore: loadPlayerProgress threw (NFR-9 silent drop)', err);
      return null;
    }
    if (blob === null) {
      return null;
    }
    const parsed = parsePlayerProgress(blob);
    if (parsed === null) {
      console.warn('appStore: parsePlayerProgress returned null (NFR-9 silent drop)');
      return null;
    }
    const intent: PlayerIntent = {
      kind: 'apply-loaded-progress',
      playerLetters: parsed.playerLetters,
      savedGridSize: parsed.gridSize,
    };
    return intent;
  }

  const store: AppStore = {
    getState() {
      return state;
    },
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
    dispatch(intent: AppIntent | BuilderIntent | PlayerIntent): void {
      const d = deps;
      let s: AppState = state;
      const pending: (AppIntent | BuilderIntent | PlayerIntent)[] = [intent];
      while (pending.length > 0) {
        const next = pending.shift();
        if (next === undefined) break;
        const result = reduceApp(s, next, d);
        const folded = applyEventsToApp(result.state, result.events, d);
        s = folded.state;
        state = s;
        for (const event of folded.leftoverEvents) {
          const followup = performExternalEvent(event);
          if (followup !== null) {
            pending.push(followup);
          }
        }
      }
    },
  };

  return store;
}
