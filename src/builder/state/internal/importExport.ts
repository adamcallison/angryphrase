import type { BuilderIntent } from '../intents';
import { BuilderState } from '../state';
import type { ReducerResult } from '../../../domain/notifications/Event';
import { Result } from '../../../domain/notifications/Event';
import { parsePuzzleV1, serializeComplete, serializeIncomplete, Filename } from '../../../domain/format/v1';
import { CompletenessCheck } from '../../../domain/puzzle/CompletenessCheck';
import type { CompletenessViolation } from '../../../domain/puzzle/CompletenessCheck';
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

function violationMessage(v: CompletenessViolation): string {
  switch (v.kind) {
    case 'missing-answer-letter':
      return `Missing answer letter at row ${Number(v.row)}, col ${Number(v.col)}.`;
    case 'invalid-answer-letter':
      return `Invalid answer letter ${v.value} at row ${Number(v.row)}, col ${Number(v.col)}.`;
    case 'missing-clue':
      return `Missing clue for word ${Number(v.wordNumber)} ${v.direction}.`;
  }
}

export function handleExportIncomplete(
  state: BuilderState,
  _intent: Extract<BuilderIntent, { kind: 'export-incomplete' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void _deps;
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

export function handleExportComplete(
  state: BuilderState,
  _intent: Extract<BuilderIntent, { kind: 'export-complete' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void _deps;
  const violations = CompletenessCheck.check(state.puzzle);
  if (violations.length > 0) {
    return Result.withEvents(
      state,
      violations.map((v) => ({
        kind: 'toast' as const,
        toastKind: 'error' as const,
        message: violationMessage(v),
      })),
    );
  }
  const content = serializeComplete(state.puzzle);
  const filename = Filename.complete(state.puzzle.key);
  return Result.withEvents(state, [
    {
      kind: 'download' as const,
      filename,
      content,
    },
  ]);
}
