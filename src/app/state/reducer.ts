import type { AppState } from './state';
import type { AppIntent } from './intents';
import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import type { Rng } from '../../domain/rng/Rng';
import type { ReducerResult } from '../../domain/notifications/Event';
import { reduceBuilder } from '../../builder/state/reducer';
import { reducePlayer } from '../../player/state/reducer';
import { applyEventsToApp } from './effects';
import {
  BUILDER_INTENT_KINDS,
  PLAYER_INTENT_KINDS,
  CONFIRMABLE_INTENT_KINDS,
  AMBIGUOUS_INTENT_KINDS,
} from './intentKinds';

export function reduceApp(
  state: AppState,
  intent: AppIntent | BuilderIntent | PlayerIntent,
  deps: { rng: Rng; now: () => number },
): ReducerResult<AppState> {
  // App-level intents first (narrow by kind)
  switch (intent.kind) {
    case 'navigate':
      return { state: { ...state, route: intent.route }, events: [] };
    case 'cancel-modal':
      return { state: { ...state, modal: null, pendingConfirmIntent: null }, events: [] };
    case 'dismiss-toast':
      return { state: { ...state, toasts: state.toasts.filter(t => t.id !== intent.id) }, events: [] };
  }

  // Builder or Player intent: dispatch to the appropriate sub-reducer.
  const isBuilderIntent = BUILDER_INTENT_KINDS.has(intent.kind);
  const isPlayerIntent = PLAYER_INTENT_KINDS.has(intent.kind);
  const isAmbiguous = AMBIGUOUS_INTENT_KINDS.has(intent.kind);

  function routeToBuilder(): ReducerResult<AppState> {
    const r = reduceBuilder(state.builder, intent as unknown as BuilderIntent, deps);
    const folded = applyEventsToApp({ ...state, builder: r.state }, r.events, deps);
    if (CONFIRMABLE_INTENT_KINDS.has(intent.kind)) {
      return {
        state: { ...folded.state, modal: null, pendingConfirmIntent: null },
        events: folded.leftoverEvents,
      };
    }
    return { state: folded.state, events: folded.leftoverEvents };
  }

  function routeToPlayer(): ReducerResult<AppState> {
    const r = reducePlayer(state.player, intent as unknown as PlayerIntent, deps);
    const folded = applyEventsToApp({ ...state, player: r.state }, r.events, deps);
    if (CONFIRMABLE_INTENT_KINDS.has(intent.kind)) {
      return {
        state: { ...folded.state, modal: null, pendingConfirmIntent: null },
        events: folded.leftoverEvents,
      };
    }
    return { state: folded.state, events: folded.leftoverEvents };
  }

  if (!isAmbiguous) {
    if (isBuilderIntent) return routeToBuilder();
    if (isPlayerIntent) return routeToPlayer();
    // Should be unreachable — the two sets above cover all Builder/Player intents and the
    // switch above covers all AppIntent variants. If a new intent kind is added, this throws.
    throw new Error(`reduceApp: unknown intent kind: ${(intent as { kind: string }).kind}`);
  }

  // Ambiguous kind: disambiguate by state.route.
  switch (state.route) {
    case 'play':
      return routeToPlayer();
    case 'build':
      return routeToBuilder();
    case 'landing':
      return routeToBuilder(); // back-compat: existing tests dispatch ambiguous kinds during 'landing' expecting Builder behaviour.
  }
}
