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
import { handleConfirmImportPuzzle, handleRequestImportPuzzle } from './internal/importExport';

export function reduceBuilder(
  state: BuilderState,
  intent: BuilderIntent,
  deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void deps;

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
      return handleToggleDesignCell(state, intent, deps);

    case 'change-grid-size':
      return handleChangeGridSize(state, intent, deps);

    case 'request-switch-to-design':
      return handleRequestSwitchToDesign(state, intent, deps);

    case 'confirm-switch-to-design':
      return handleConfirmSwitchToDesign(state, intent, deps);

    case 'request-import-puzzle':
      return handleRequestImportPuzzle(state, intent, deps);

    case 'confirm-import-puzzle':
      return handleConfirmImportPuzzle(state, intent, deps);

    case 'select-cell':
      return handleSelectCell(state, intent, deps);

    case 'move-cursor':
      return handleMoveCursor(state, intent, deps);

    case 'type-letter':
      return handleTypeLetter(state, intent, deps);

    case 'backspace':
      return handleBackspace(state, intent, deps);

    case 'toggle-marker':
      return handleToggleMarker(state, intent, deps);

    case 'edit-clue':
      return handleEditClue(state, intent, deps);

    case 'click-clue-panel-word':
    case 'click-grid-word':
      return handleClickWord(state, intent, deps);

    case 'begin-join':
      return handleBeginJoin(state, intent, deps);

    case 'unjoin':
      return handleUnjoin(state, intent, deps);

    case 'begin-reattach':
      return handleBeginReattach(state, intent, deps);

    case 'delete-displaced-clue':
      return handleDeleteDisplacedClue(state, intent, deps);

    default:
      throw new Error(`reduceBuilder: not implemented: ${(intent as { kind: string }).kind}`);
  }
}
