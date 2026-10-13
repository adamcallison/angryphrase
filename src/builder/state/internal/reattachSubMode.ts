import type { BuilderState } from '../state';
import type { BuilderIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import { DisplacedClueId } from '../../../domain/builder/DisplacedClueId';
import { Result } from '../../../domain/notifications/Event';
import { WordKey } from '../../../domain/word/WordKey';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { ChainAdmission } from '../../../domain/chain/ChainAdmission';


export function handleBeginReattach(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'begin-reattach' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const exists = state.displacedClues.some(d => DisplacedClueId.equals(d.id, intent.displacedClueId));
  if (!exists) {
    return Result.ok(state);
  }

  return Result.ok({
    ...state,
    subMode: { kind: 'reattach', displacedClueId: intent.displacedClueId },
  });
}

export function handleDeleteDisplacedClue(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'delete-displaced-clue' }>,
): ReducerResult<BuilderState> {
  const exists = state.displacedClues.some(d => DisplacedClueId.equals(d.id, intent.id));
  if (!exists) {
    return Result.ok(state);
  }

  const newDisplacedClues = state.displacedClues.filter(d => !DisplacedClueId.equals(d.id, intent.id));

  let subMode = state.subMode;
  if (subMode.kind === 'reattach' && DisplacedClueId.equals(subMode.displacedClueId, intent.id)) {
    subMode = { kind: 'none' };
  }

  return Result.ok({
    ...state,
    displacedClues: newDisplacedClues,
    subMode,
  });
}

export function resolveReattach(
  state: BuilderState,
  displacedClueId: DisplacedClueId,
  targetKey: WordKey,
): ReducerResult<BuilderState> {
  const admission = ChainAdmission.canReattach(
    state.puzzle.words,
    state.displacedClues,
    displacedClueId,
    targetKey,
  );
  if (!admission.ok) {
    if (admission.reason === 'clue-not-found' || admission.reason === 'target-not-found') {
      return Result.ok(state); // defensive — UI should not dispatch
    }
    return Result.withEvents(state, [{
      kind: 'toast',
      toastKind: 'error',
      message: ChainAdmission.message(admission),
    }]);
  }

  // FR-43: success. Move text; remove displaced clue from list; reset sub-mode.
  const displacedClue = state.displacedClues.find(d =>
    DisplacedClueId.equals(d.id, displacedClueId),
  );
  if (displacedClue === undefined) {
    return Result.ok(state); // defensive — admission mismatch
  }
  const words = state.puzzle.words;
  const newWords = words.map(w =>
    WordKey.equals(w.key, targetKey) ? { ...w, clue: displacedClue.clue } : w,
  );
  const newDisplacedClues = state.displacedClues.filter(d =>
    !DisplacedClueId.equals(d.id, displacedClueId),
  );

  return Result.ok({
    ...state,
    puzzle: Puzzle.withWords(state.puzzle, newWords),
    displacedClues: newDisplacedClues,
    subMode: { kind: 'none' },
  });
}
