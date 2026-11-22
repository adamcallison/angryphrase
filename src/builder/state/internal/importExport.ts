import type { BuilderIntentOf } from '../intents';
import { BuilderState } from '../state';
import type { DomainEvent, ReducerResult } from '../../../domain/notifications/Event';
import { Result, confirmEvent } from '../../../domain/notifications/Event';
import { parsePuzzle, serializeComplete, serializeIncomplete, Filename } from '../../../domain/format/v1Json';
import { CompletenessCheck } from '../../../domain/puzzle/CompletenessCheck';

function executeImport(state: BuilderState, fileContent: string): ReducerResult<BuilderState> {
  const result = parsePuzzle(fileContent);
  if (!result.ok) {
    return Result.withEvents(state, [
      {
        kind: 'toast',
        toastKind: 'error',
        reason: { code: 'import-parse-failures', messages: result.failures.map((f) => f.message) },
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
  intent: BuilderIntentOf<'request-import-puzzle'>,
): ReducerResult<BuilderState> {
  if (BuilderState.isBlank(state)) {
    return executeImport(state, intent.fileContent);
  }
  return Result.withEvents(state, [
    confirmEvent('confirm-import-puzzle', { target: 'builder', kind: 'confirm-import-puzzle', fileContent: intent.fileContent }),
  ]);
}

export function handleConfirmImportPuzzle(
  state: BuilderState,
  intent: BuilderIntentOf<'confirm-import-puzzle'>,
): ReducerResult<BuilderState> {
  return executeImport(state, intent.fileContent);
}

export function handleReportImportReadFailure(state: BuilderState): ReducerResult<BuilderState> {
  return Result.withEvents(state, [{ kind: 'toast', toastKind: 'error', reason: { code: 'import-read-failure' } }]);
}

export function handleReportPickFailure(state: BuilderState): ReducerResult<BuilderState> {
  return Result.withEvents(state, [{ kind: 'toast', toastKind: 'error', reason: { code: 'import-pick-failure' } }]);
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
        reason: { code: 'export-completeness-violation', violation: v },
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
    events.push({
      kind: 'toast' as const,
      toastKind: 'warning' as const,
      reason: { code: 'export-displaced-clues', count: state.displacedClues.length },
    });
  }
  return Result.withEvents(state, events);
}
