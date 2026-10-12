import type { AppState } from './state';
import type { AppIntent } from './intents';
import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import type { Rng } from '../../domain/rng/Rng';
import type { EpochMs } from '../../domain/time/EpochMs';
import type { ReducerResult } from '../../domain/notifications/Event';
import { reduceBuilder } from '../../builder/state/reducer';
import { reducePlayer } from '../../player/state/reducer';
import { applyEventsToApp } from './effects';
import { CONFIRMABLE_INTENT_KINDS } from './intentKinds';

export function reduceApp(
  state: AppState,
  intent: AppIntent | BuilderIntent | PlayerIntent,
  deps: { rng: Rng; now: () => EpochMs },
): ReducerResult<AppState> {
  // App-level intents first (narrow by kind)
  switch (intent.kind) {
    case 'navigate':
      return { state: { ...state, route: intent.route }, events: [] };
    case 'cancel-modal':
      return { state: { ...state, modal: null, pendingConfirmIntent: null }, events: [] };
    case 'dismiss-toast':
      return { state: { ...state, toasts: state.toasts.filter(t => t.id !== intent.id) }, events: [] };
    case 'report-download-failure':
      return { state, events: [{ kind: 'toast' as const, toastKind: 'error' as const, message: 'Download failed. Please try again.' }] };
    case 'report-builder-save-failure':
      return { state, events: [{ kind: 'toast' as const, toastKind: 'error' as const, message: 'Saving failed — your Builder changes are not being kept. Download an export to keep a copy.' }] };
    case 'report-player-save-failure':
      return { state, events: [{ kind: 'toast' as const, toastKind: 'error' as const, message: 'Saving failed — your solving progress is not being kept.' }] };
  }

  // Builder or Player intent: dispatch by target.
  function routeToBuilder(builderIntent: BuilderIntent): ReducerResult<AppState> {
    const r = reduceBuilder(state.builder, builderIntent, deps);
    const folded = applyEventsToApp({ ...state, builder: r.state }, r.events, deps);
    if (CONFIRMABLE_INTENT_KINDS.has(builderIntent.kind)) {
      return {
        state: { ...folded.state, modal: null, pendingConfirmIntent: null },
        events: folded.leftoverEvents,
      };
    }
    return { state: folded.state, events: folded.leftoverEvents };
  }

  function routeToPlayer(playerIntent: PlayerIntent): ReducerResult<AppState> {
    const r = reducePlayer(state.player, playerIntent, deps);
    const folded = applyEventsToApp({ ...state, player: r.state }, r.events, deps);
    if (CONFIRMABLE_INTENT_KINDS.has(playerIntent.kind)) {
      return {
        state: { ...folded.state, modal: null, pendingConfirmIntent: null },
        events: folded.leftoverEvents,
      };
    }
    return { state: folded.state, events: folded.leftoverEvents };
  }

  switch (intent.target) {
    case 'builder':
      return routeToBuilder(intent);
    case 'player':
      return routeToPlayer(intent);
    default:
      throw new Error(`reduceApp: unknown intent kind: ${(intent as { kind: string }).kind}`);
  }
}
