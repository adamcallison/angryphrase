import type { PlayerIntent } from './intents';
import { PlayerState } from './state';
import type { ReducerResult } from '../../domain/notifications/Event';
import { Result } from '../../domain/notifications/Event';
import type { Rng } from '../../domain/rng/Rng';

export function reducePlayer(
  state: PlayerState,
  intent: PlayerIntent,
  deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  void deps;

  switch (intent.kind) {
    case 'import-new-puzzle':
      return Result.ok(PlayerState.importScreen());

    case 'escape':
      if (state.phase === 'solving' && state.anagram != null) {
        return Result.ok({ ...state, anagram: null });
      }
      return Result.ok(state);

    case 'close-anagram-helper':
      if (state.phase === 'solving' && state.anagram != null) {
        return Result.ok({ ...state, anagram: null });
      }
      return Result.ok(state);

    case 'clear-errors': {
      if (
        state.phase === 'solving' &&
        state.checkResult != null &&
        state.checkResult.incorrectCells.length > 0
      ) {
        throw new Error('reducePlayer: not implemented: clear-errors');
      }
      return Result.ok(state);
    }

    default:
      throw new Error(`reducePlayer: not implemented: ${(intent as { kind: string }).kind}`);
  }
}
