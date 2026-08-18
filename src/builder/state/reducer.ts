import type { BuilderIntent } from './intents';
import type { BuilderState } from './state';
import type { ReducerResult } from '../../domain/notifications/Event';
import { Result } from '../../domain/notifications/Event';
import type { Rng } from '../../domain/rng/Rng';
import { Puzzle } from '../../domain/puzzle/Puzzle';
import {
  handleChangeGridSize,
  handleConfirmSwitchToDesign,
  handleRequestSwitchToDesign,
  handleToggleDesignCell,
} from './internal/designMode';
import {
  handleBackspace,
  handleClickWord,
  handleEditClue,
  handleMoveCursor,
  handleSelectCell,
  handleToggleMarker,
  handleTypeLetter,
} from './internal/fillMode';
import { handleBeginJoin, handleUnjoin } from './internal/joinSubMode';
import { handleBeginReattach, handleDeleteDisplacedClue } from './internal/reattachSubMode';
import {
  handleConfirmImportPuzzle,
  handleExportComplete,
  handleExportIncomplete,
  handleRequestImportPuzzle,
} from './internal/importExport';
import { handleConfirmResetBuilder, handleRequestResetBuilder } from './internal/lifecycle';

export function reduceBuilder(
  state: BuilderState,
  intent: BuilderIntent,
  deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  switch (intent.kind) {
    case 'switch-to-fill':
      return Result.ok({ ...state, mode: 'fill', subMode: { kind: 'none' }, cursor: null });

    case 'escape':
      return Result.ok({ ...state, subMode: { kind: 'none' } });

    case 'edit-title':
      return Result.ok({
        ...state,
        puzzle: Puzzle.withMetadata(state.puzzle, intent.title, state.puzzle.author),
      });

    case 'edit-author':
      return Result.ok({
        ...state,
        puzzle: Puzzle.withMetadata(state.puzzle, state.puzzle.title, intent.author),
      });

    case 'toggle-design-cell':
      return handleToggleDesignCell(state, intent, deps.rng);

    case 'change-grid-size':
      return handleChangeGridSize(state, intent);

    case 'request-switch-to-design':
      return handleRequestSwitchToDesign(state);

    case 'confirm-switch-to-design':
      return handleConfirmSwitchToDesign(state);

    case 'request-import-puzzle':
      return handleRequestImportPuzzle(state, intent);

    case 'confirm-import-puzzle':
      return handleConfirmImportPuzzle(state, intent);

    case 'export-incomplete':
      return handleExportIncomplete(state);

    case 'export-complete':
      return handleExportComplete(state);

    case 'select-cell':
      return handleSelectCell(state, intent);

    case 'move-cursor':
      return handleMoveCursor(state, intent);

    case 'type-letter':
      return handleTypeLetter(state, intent);

    case 'backspace':
      return handleBackspace(state);

    case 'toggle-marker':
      return handleToggleMarker(state, intent);

    case 'edit-clue':
      return handleEditClue(state, intent);

    case 'click-clue-panel-word':
    case 'click-grid-word':
      return handleClickWord(state, intent, deps.rng);

    case 'begin-join':
      return handleBeginJoin(state, intent);

    case 'unjoin':
      return handleUnjoin(state, intent);

    case 'begin-reattach':
      return handleBeginReattach(state, intent);

    case 'delete-displaced-clue':
      return handleDeleteDisplacedClue(state, intent);

    case 'request-reset-builder':
      return handleRequestResetBuilder(state, deps.rng);

    case 'confirm-reset-builder':
      return handleConfirmResetBuilder(state, deps.rng);

    default:
      assertUnreachable(intent);
  }
}

function assertUnreachable(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
