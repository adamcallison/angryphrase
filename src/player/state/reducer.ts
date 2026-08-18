import type { PlayerIntent } from './intents';
import { PlayerState } from './state';
import type { ReducerResult } from '../../domain/notifications/Event';
import type { Rng } from '../../domain/rng/Rng';
import {
  handleApplyLoadedProgress,
  handleConfirmResetPlayer,
  handleImportNewPuzzle,
  handleImportPuzzle,
  handleRequestResetPlayer,
} from './internal/lifecycle';
import {
  handleBackspace,
  handleCheck,
  handleClearErrors,
  handleClickCluePanelWord,
  handleMoveCursor,
  handleSelectCell,
  handleTypeLetter,
} from './internal/solving';
import {
  handleAnagramInput,
  handleAnagramScramble,
  handleCloseAnagramHelper,
  handleEscape,
  handleOpenAnagramHelper,
} from './internal/anagram';

export function reducePlayer(
  state: PlayerState,
  intent: PlayerIntent,
  deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  switch (intent.kind) {
    case 'import-new-puzzle':
      return handleImportNewPuzzle();

    case 'import-puzzle':
      return handleImportPuzzle(intent);

    case 'apply-loaded-progress':
      return handleApplyLoadedProgress(state, intent);

    case 'request-reset-player':
      return handleRequestResetPlayer(state);

    case 'confirm-reset-player':
      return handleConfirmResetPlayer(state);

    case 'escape':
      return handleEscape(state);

    case 'close-anagram-helper':
      return handleCloseAnagramHelper(state);

    case 'open-anagram-helper':
      return handleOpenAnagramHelper(state);

    case 'anagram-input':
      return handleAnagramInput(state, intent);

    case 'anagram-scramble':
      return handleAnagramScramble(state, deps.rng);

    case 'select-cell':
      return handleSelectCell(state, intent);

    case 'move-cursor':
      return handleMoveCursor(state, intent);

    case 'click-clue-panel-word':
      return handleClickCluePanelWord(state, intent);

    case 'type-letter':
      return handleTypeLetter(state, intent);

    case 'backspace':
      return handleBackspace(state);

    case 'check':
      return handleCheck(state);

    case 'clear-errors':
      return handleClearErrors(state);

    default:
      assertUnreachable(intent);
  }
}

function assertUnreachable(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
