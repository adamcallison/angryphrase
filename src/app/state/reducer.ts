import type { AppState } from './state';
import type { AnyIntent } from './intents';
import type { Rng } from '../../domain/rng/Rng';
import type { EpochMs } from '../../domain/time/EpochMs';
import type { ReducerResult } from '../../domain/notifications/Event';
import { reduceBuilder } from '../../builder/state/reducer';
import { reducePlayer } from '../../player/state/reducer';
import { GridSize } from '../../domain/grid/GridSize';

export function reduceApp(
  state: AppState,
  intent: AnyIntent,
  deps: { rng: Rng; now: () => EpochMs },
): ReducerResult<AppState> {
  // App-level intents first (narrow by kind)
  switch (intent.kind) {
    case 'navigate':
      return { state: { ...state, route: intent.route }, events: [] };
    case 'cancel-modal':
      // modal clearing happens in the bindings layer's dispatch loop (see appStore.svelte.ts dispatch)
      return { state, events: [] };
    case 'dismiss-toast':
      return { state: { ...state, toasts: state.toasts.filter(t => t.id !== intent.id) }, events: [] };
    case 'report-download-failure':
      return { state, events: [{ kind: 'toast' as const, toastKind: 'error' as const, message: 'Download failed. Please try again.' }] };
    case 'report-builder-save-failure':
      return { state, events: [{ kind: 'toast' as const, toastKind: 'error' as const, message: 'Saving failed — your Builder changes are not being kept. Download an export to keep a copy.' }] };
    case 'report-player-save-failure':
      return { state, events: [{ kind: 'toast' as const, toastKind: 'error' as const, message: 'Saving failed — your solving progress is not being kept.' }] };
    case 'report-grid-size-failure':
      return { state, events: [{ kind: 'toast' as const, toastKind: 'error' as const, message: GridSize.invalidMessage() }] };
  }

  // Builder or Player intent: dispatch by target.
  switch (intent.target) {
    case 'builder': {
      const r = reduceBuilder(state.builder, intent, deps);
      return { state: { ...state, builder: r.state }, events: r.events };
    }
    case 'player': {
      const r = reducePlayer(state.player, intent, deps);
      return { state: { ...state, player: r.state }, events: r.events };
    }
  }

  throw new Error(`reduceApp: unknown intent target: ${JSON.stringify(intent)}`);
}
