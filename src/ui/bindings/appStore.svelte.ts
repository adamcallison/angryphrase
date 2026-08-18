import type { AppState } from '../../app/state/state';
import { AppState as AppStateCtor } from '../../app/state/state';
import type { AppIntent } from '../../app/state/intents';
import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import { reduceApp } from '../../app/state/reducer';
import type { DomainEvent } from '../../domain/notifications/Event';
import type { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import type { Rng } from '../../domain/rng/Rng';
import { GridSize as GridSizeCtor } from '../../domain/grid/GridSize';
import { PuzzleKey as PuzzleKeyCtor } from '../../domain/puzzle/PuzzleKey';
import { getPorts } from './ports';
import type { PersistenceScheduler } from './persistenceScheduler';
import { parsePlayerProgress } from './persistenceCodec';
import { createPersistenceScheduler } from './persistenceScheduler';

type AppDeps = { rng: Rng; now: () => number };

let state: AppState = $state(AppStateCtor.blank(GridSizeCtor.of(15), PuzzleKeyCtor.generate(getPorts().rng)));
let deps: AppDeps = $state({ rng: getPorts().rng, now: () => Date.now() });
let scheduler: PersistenceScheduler = createPersistenceScheduler(getPorts().storage);

export function bootApp(initial: AppState, depsArg: AppDeps, schedulerArg?: PersistenceScheduler): void {
  state = initial;
  deps = depsArg;
  scheduler = schedulerArg ?? createPersistenceScheduler(getPorts().storage);
}

export function getAppState(): AppState {
  return state;
}

export function getRoute(): AppState['route'] {
  return state.route;
}

export function getToasts() {
  return state.toasts;
}

export function getModal() {
  return state.modal;
}

export function getPendingConfirmIntent() {
  return state.pendingConfirmIntent;
}

export function getBuilder() {
  return state.builder;
}

export function getPlayer() {
  return state.player;
}

export function getScheduler(): PersistenceScheduler {
  return scheduler;
}

export function dispatch(intent: AppIntent | BuilderIntent | PlayerIntent): void {
  const result = reduceApp(state, intent, deps);
  state = result.state;
  for (const event of result.events) {
    performExternalEvent(event);
  }
}

function performExternalEvent(event: DomainEvent): void {
  switch (event.kind) {
    case 'download': {
      try {
        getPorts().download.download(event.filename, event.content);
      } catch (err) {
        console.warn('appStore: download failed', err);
      }
      return;
    }
    case 'clear-builder-storage': {
      scheduler.clearBuilder();
      return;
    }
    case 'clear-player-storage': {
      scheduler.clearPlayer(event.key);
      return;
    }
    case 'load-player-progress': {
      handleLoadPlayerProgress(event.key);
      return;
    }
    case 'toast':
    case 'modal-request':
      return;
  }
}

function handleLoadPlayerProgress(key: PuzzleKey): void {
  let blob: string | null;
  try {
    blob = getPorts().storage.loadPlayerProgress(key);
  } catch (err) {
    console.warn('appStore: loadPlayerProgress threw (NFR-9 silent drop)', err);
    return;
  }
  if (blob === null) {
    return;
  }
  const parsed = parsePlayerProgress(blob);
  if (parsed === null) {
    console.warn('appStore: parsePlayerProgress returned null (NFR-9 silent drop)');
    return;
  }
  const intent: PlayerIntent = {
    kind: 'apply-loaded-progress',
    playerLetters: parsed.playerLetters,
    savedGridSize: parsed.gridSize,
  };
  dispatch(intent);
}

export function _resetAppStateForTests(next: AppState): void {
  state = next;
}
