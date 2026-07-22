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
      return handleImportNewPuzzle(state, intent, deps);

    case 'import-puzzle':
      return handleImportPuzzle(state, intent, deps);

    case 'apply-loaded-progress':
      return handleApplyLoadedProgress(state, intent, deps);

    case 'request-reset-player':
      return handleRequestResetPlayer(state, intent, deps);

    case 'confirm-reset-player':
      return handleConfirmResetPlayer(state, intent, deps);

    case 'escape':
      return handleEscape(state, intent, deps);

    case 'close-anagram-helper':
      return handleCloseAnagramHelper(state, intent, deps);

    case 'open-anagram-helper':
      return handleOpenAnagramHelper(state, intent, deps);

    case 'anagram-input':
      return handleAnagramInput(state, intent, deps);

    case 'anagram-scramble':
      return handleAnagramScramble(state, intent, deps);

    case 'select-cell':
      return handleSelectCell(state, intent, deps);

    case 'move-cursor':
      return handleMoveCursor(state, intent, deps);

    case 'click-clue-panel-word':
      return handleClickCluePanelWord(state, intent, deps);

    case 'type-letter':
      return handleTypeLetter(state, intent, deps);

    case 'backspace':
      return handleBackspace(state, intent, deps);

    case 'check':
      return handleCheck(state, intent, deps);

    case 'clear-errors':
      return handleClearErrors(state, intent, deps);

    default:
      assertUnreachable(intent);
  }
}

function assertUnreachable(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
