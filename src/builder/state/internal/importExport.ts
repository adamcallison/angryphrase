import type { BuilderIntent } from '../intents';
import { BuilderState } from '../state';
import type { DomainEvent, ReducerResult } from '../../../domain/notifications/Event';
import { Result } from '../../../domain/notifications/Event';
import { parsePuzzle, serializeComplete, serializeIncomplete, Filename } from '../../../domain/format/v1';
import { CompletenessCheck } from '../../../domain/puzzle/CompletenessCheck';

const IMPORT_READ_FAILURE_MSG = 'Could not read that file. Please try again.';
const PICK_FAILURE_MSG = 'Could not open or read that file. Please try again.';

function executeImport(state: BuilderState, fileContent: string): ReducerResult<BuilderState> {
  const result = parsePuzzle(fileContent);
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
): ReducerResult<BuilderState> {
  if (BuilderState.isBlank(state)) {
    return executeImport(state, intent.fileContent);
  }
  return Result.withEvents(state, [
    {
      kind: 'modal-request',
      modal: { kind: 'confirm-import-puzzle' },
      confirmIntent: { target: 'builder', kind: 'confirm-import-puzzle', fileContent: intent.fileContent },
    },
  ]);
}

export function handleConfirmImportPuzzle(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'confirm-import-puzzle' }>,
): ReducerResult<BuilderState> {
  return executeImport(state, intent.fileContent);
}

export function handleReportImportReadFailure(state: BuilderState): ReducerResult<BuilderState> {
  return Result.withEvents(state, [{ kind: 'toast', toastKind: 'error', message: IMPORT_READ_FAILURE_MSG }]);
}

export function handleReportPickFailure(state: BuilderState): ReducerResult<BuilderState> {
  return Result.withEvents(state, [{ kind: 'toast', toastKind: 'error', message: PICK_FAILURE_MSG }]);
}

export function handleExportIncomplete(state: BuilderState): ReducerResult<BuilderState> {
  const content = serializeIncomplete(state.puzzle, state.displacedClues);
  const filename = Filename.incomplete(state.puzzle.key);
  return Result.withEvents(state, [
    {
      kind: 'download' as const,
      filename,
      content,
    },
  ]);
}

export function handleExportComplete(state: BuilderState): ReducerResult<BuilderState> {
  const violations = CompletenessCheck.check(state.puzzle);
  if (violations.length > 0) {
    return Result.withEvents(
      state,
      violations.map((v) => ({
        kind: 'toast' as const,
        toastKind: 'error' as const,
        message: CompletenessCheck.message(v),
      })),
    );
  }
  const content = serializeComplete(state.puzzle);
  const filename = Filename.complete(state.puzzle.key);
  const events: DomainEvent[] = [
    {
      kind: 'download' as const,
      filename,
      content,
    },
  ];
  if (state.displacedClues.length > 0) {
    const n = state.displacedClues.length;
    events.push({
      kind: 'toast' as const,
      toastKind: 'warning' as const,
      message: `Exported without ${n} displaced clue${n === 1 ? '' : 's'}. They remain in the Displaced Clues panel.`,
    });
  }
  return Result.withEvents(state, events);
}
