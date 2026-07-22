import { BuilderState } from '../state';
import type { BuilderIntent } from '../intents';
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
  _intent: Extract<BuilderIntent, { kind: 'request-reset-builder' }>,
  deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void deps.now;

  if (BuilderState.isBlank(state)) {
    return resetBuilder(state, deps.rng);
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
  _intent: Extract<BuilderIntent, { kind: 'confirm-reset-builder' }>,
  deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void _intent;
  void deps.now;

  return resetBuilder(state, deps.rng);
}
