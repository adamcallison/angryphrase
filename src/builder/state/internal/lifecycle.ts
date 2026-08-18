import { BuilderState } from '../state';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import { Result } from '../../../domain/notifications/Event';
import { PuzzleKey } from '../../../domain/puzzle/PuzzleKey';

function resetBuilder(state: BuilderState, rng: Rng): ReducerResult<BuilderState> {
  const newKey = PuzzleKey.generate(rng);
  const fresh = BuilderState.blank(state.puzzle.gridSize, newKey);
  return Result.withEvents(fresh, [{ kind: 'clear-builder-storage' }]);
}

export function handleRequestResetBuilder(
  state: BuilderState,
  rng: Rng,
): ReducerResult<BuilderState> {
  if (BuilderState.isBlank(state)) {
    return resetBuilder(state, rng);
  }

  return Result.withEvents(state, [
    {
      kind: 'modal-request',
      modal: { kind: 'confirm-reset-builder' },
      confirmIntent: { kind: 'confirm-reset-builder' },
    },
  ]);
}

export function handleConfirmResetBuilder(
  state: BuilderState,
  rng: Rng,
): ReducerResult<BuilderState> {
  return resetBuilder(state, rng);
}
