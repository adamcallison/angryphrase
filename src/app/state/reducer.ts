import type { AppState } from './state';
import type { AppIntent } from './intents';
import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import type { Rng } from '../../domain/rng/Rng';
import type { EpochMs } from '../../domain/time/EpochMs';
import type { ReducerResult } from '../../domain/notifications/Event';
import { reduceBuilder } from '../../builder/state/reducer';
import { reducePlayer } from '../../player/state/reducer';
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
  function clearPendingConfirm(s: AppState): AppState {
    return { ...s, modal: null, pendingConfirmIntent: null };
  }

  function routeToBuilder(intent: BuilderIntent): ReducerResult<AppState> {
    const r = reduceBuilder(state.builder, intent, deps);
    const merged = { ...state, builder: r.state };
    const final = CONFIRMABLE_INTENT_KINDS.has(intent.kind) ? clearPendingConfirm(merged) : merged;
    return { state: final, events: r.events };
  }

  function routeToPlayer(intent: PlayerIntent): ReducerResult<AppState> {
    const r = reducePlayer(state.player, intent, deps);
    const merged = { ...state, player: r.state };
    const final = CONFIRMABLE_INTENT_KINDS.has(intent.kind) ? clearPendingConfirm(merged) : merged;
    return { state: final, events: r.events };
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
