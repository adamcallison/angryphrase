import type { AppState } from './state';
import type { AppIntent } from './intents';
import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import type { Rng } from '../../domain/rng/Rng';
import type { ReducerResult } from '../../domain/notifications/Event';
import { reduceBuilder } from '../../builder/state/reducer';
import { reducePlayer } from '../../player/state/reducer';
import { applyEventsToApp } from './effects';

const BUILDER_INTENT_KINDS: ReadonlySet<string> = new Set([
  'switch-to-fill', 'request-switch-to-design', 'confirm-switch-to-design',
  'toggle-design-cell', 'change-grid-size',
  'select-cell', 'move-cursor', 'type-letter', 'backspace',
  'toggle-marker', 'edit-clue',
  'begin-join', 'click-clue-panel-word', 'click-grid-word', 'unjoin', 'escape',
  'begin-reattach', 'delete-displaced-clue',
  'edit-title', 'edit-author',
  'request-import-puzzle', 'confirm-import-puzzle', 'export-incomplete', 'export-complete',
  'request-reset-builder', 'confirm-reset-builder',
]);

const PLAYER_INTENT_KINDS: ReadonlySet<string> = new Set([
  'import-puzzle', 'apply-loaded-progress', 'import-new-puzzle',
  'select-cell', 'move-cursor', 'type-letter', 'backspace', 'escape', 'click-clue-panel-word',
  'check', 'clear-errors',
  'request-reset-player', 'confirm-reset-player',
  'open-anagram-helper', 'close-anagram-helper', 'anagram-input', 'anagram-scramble',
]);

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
  if (BUILDER_INTENT_KINDS.has(intent.kind)) {
    const r = reduceBuilder(state.builder, intent as unknown as BuilderIntent, deps);
    const folded = applyEventsToApp({ ...state, builder: r.state }, r.events, deps);
    return { state: folded.state, events: folded.leftoverEvents };
  }
  if (PLAYER_INTENT_KINDS.has(intent.kind)) {
    const r = reducePlayer(state.player, intent as unknown as PlayerIntent, deps);
    const folded = applyEventsToApp({ ...state, player: r.state }, r.events, deps);
    return { state: folded.state, events: folded.leftoverEvents };
  }
  // Should be unreachable — the two sets above cover all Builder/Player intents and the
  // switch above covers all AppIntent variants. If a new intent kind is added, this throws.
  throw new Error(`reduceApp: unknown intent kind: ${(intent as { kind: string }).kind}`);
}
