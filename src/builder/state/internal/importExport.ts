import type { BuilderIntent } from '../intents';
import { BuilderState } from '../state';
import type { ReducerResult } from '../../../domain/notifications/Event';
import { Result } from '../../../domain/notifications/Event';
import { parsePuzzleV1 } from '../../../domain/format/v1';
import type { Rng } from '../../../domain/rng/Rng';

function executeImport(state: BuilderState, fileContent: string): ReducerResult<BuilderState> {
  const result = parsePuzzleV1(fileContent);
  if (!result.ok) {
    const message = result.failures.map((f) => f.message).join('\n');
    return Result.withEvents(state, [
      {
        kind: 'toast',
        toastKind: 'error',
        message,
      },
    ]);
  }
  return Result.ok({
    ...state,
    puzzle: result.puzzle,
    displacedClues: result.displacedClues,
    mode: 'fill',
    subMode: { kind: 'none' },
    cursor: null,
  });
}

export function handleRequestImportPuzzle(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'request-import-puzzle' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void _deps;
  if (BuilderState.isBlank(state)) {
    return executeImport(state, intent.fileContent);
  }
  return Result.withEvents(state, [
    {
      kind: 'modal-request',
      modal: { kind: 'confirm-import-puzzle' },
      confirmIntent: { kind: 'confirm-import-puzzle', fileContent: intent.fileContent },
    },
  ]);
}

export function handleConfirmImportPuzzle(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'confirm-import-puzzle' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void _deps;
  return executeImport(state, intent.fileContent);
}
