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

type AppDeps = { rng: Rng; now: () => number };

let state: AppState = $state(AppStateCtor.blank(GridSizeCtor.of(15), PuzzleKeyCtor.generate(getPorts().rng)));
let deps: AppDeps = $state({ rng: getPorts().rng, now: () => Date.now() });
let scheduler!: PersistenceScheduler;

export function bootApp(initial: AppState, depsArg: AppDeps, schedulerArg: PersistenceScheduler): void {
  state = initial;
  deps = depsArg;
  scheduler = schedulerArg;
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
  const pending: (AppIntent | BuilderIntent | PlayerIntent)[] = [intent];
  while (pending.length > 0) {
    const next = pending.shift()!;
    const result = reduceApp(state, next, deps);
    state = result.state;
    for (const event of result.events) {
      const followup = performExternalEvent(event);
      if (followup !== null) {
        pending.push(followup);
      }
    }
  }
}

function performExternalEvent(event: DomainEvent): PlayerIntent | null {
  switch (event.kind) {
    case 'download': {
      try {
        getPorts().download.download(event.filename, event.content);
      } catch (err) {
        console.warn('appStore: download failed', err);
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
    blob = getPorts().storage.loadPlayerProgress(key);
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

export function _resetAppStateForTests(next: AppState): void {
  state = next;
}
