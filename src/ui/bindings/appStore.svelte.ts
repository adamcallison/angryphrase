import type { AppState } from '../../app/state/state';
import type { AppIntent } from '../../app/state/intents';
import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import { reduceApp } from '../../app/state/reducer';
import { applyEventsToApp } from '../../app/state/effects';
import type { DomainEvent } from '../../domain/notifications/Event';
import type { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import type { Rng } from '../../domain/rng/Rng';
import { getPorts } from './ports';
import type { PersistenceScheduler } from './persistenceScheduler';
import { parsePlayerProgress } from './persistenceCodec';

type AppDeps = { rng: Rng; now: () => number };

let state: AppState | null = $state(null);
let deps: AppDeps | null = $state(null);
let scheduler: PersistenceScheduler | null = null;

function ensureState(): AppState {
  if (state === null) throw new Error('appStore: bootApp() not called yet');
  return state;
}

function ensureScheduler(): PersistenceScheduler {
  if (scheduler === null) throw new Error('appStore: bootApp() not called yet');
  return scheduler;
}

export function bootApp(initial: AppState, depsArg: AppDeps, schedulerArg: PersistenceScheduler): void {
  state = initial;
  deps = depsArg;
  scheduler = schedulerArg;
}

export function getAppState(): AppState {
  return ensureState();
}

export function getRoute(): AppState['route'] {
  return ensureState().route;
}

export function getToasts() {
  return ensureState().toasts;
}

export function getModal() {
  return ensureState().modal;
}

export function getPendingConfirmIntent() {
  return ensureState().pendingConfirmIntent;
}

export function getBuilder() {
  return ensureState().builder;
}

export function getPlayer() {
  return ensureState().player;
}

export function getScheduler(): PersistenceScheduler {
  return ensureScheduler();
}

export function dispatch(intent: AppIntent | BuilderIntent | PlayerIntent): void {
  if (state === null || deps === null || scheduler === null) {
    throw new Error('appStore: bootApp() not called yet');
  }
  const d = deps;
  const sched = scheduler;
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
      const followup = performExternalEvent(event, sched);
      if (followup !== null) {
        pending.push(followup);
      }
    }
  }
}

function performExternalEvent(event: DomainEvent, sched: PersistenceScheduler): AppIntent | BuilderIntent | PlayerIntent | null {
  switch (event.kind) {
    case 'download': {
      const err = getPorts().download.download(event.filename, event.content);
      if (err !== null) {
        console.warn('appStore: download failed', err);
        return { kind: 'report-download-failure' };
      }
      return null;
    }
    case 'clear-builder-storage': {
      sched.clearBuilder();
      return null;
    }
    case 'clear-player-storage': {
      sched.clearPlayer(event.key);
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
