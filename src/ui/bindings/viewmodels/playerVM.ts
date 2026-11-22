import type { Puzzle } from '../../../domain/puzzle/Puzzle';
import type { WordKey } from '../../../domain/word/WordKey';
import type { Direction } from '../../../domain/word/Direction';
import type { Cursor } from '../../../domain/grid/Cursor';
import type { PlayerState, CheckResult, CheckClassification } from '../../../player/state/state';
import { WordSelection } from '../../../domain/word/WordSelection';
import { ChainCells } from '../../../domain/chain/ChainCells';
import { DisplayClue } from '../../../domain/chain/DisplayClue';
import { LengthPattern } from '../../../domain/chain/LengthPattern';
import { ChainIndex } from '../../../domain/chain/ChainIndex';
import { deriveGridVM, type GridVM } from './gridVM';
import { deriveCluePanelVM, type CluePanelVM } from './cluePanelVM';
import { deriveAnagramModalVM, type AnagramModalVM } from './anagramVM';
import { renderDisplayClue, renderLengthPatternLabel } from './clueCopy';
import { renderToastReason } from './toastCopy';

export type ActiveClueBannerVM = {
  wordNumber: number | null;
  direction: Direction | null;
  displayClue: string | null;
  lengthPatternLabel: string | null;
  announcement: string;
};

export type PlayerCluePanelVM = CluePanelVM;

export type PlayerToolbarVM = {
  canCheck: boolean;
  canClearErrors: boolean;
  canReset: boolean;
  canOpenAnagram: boolean;
  canImportNew: boolean;
};

export type PlayerCheckResultVM = {
  classification: CheckClassification;
  incorrectCount: number;
  emptyCount: number;
  message: string;
  announcement: string;
} | null;

export type PlayerShellVM =
  | { phase: 'import'; importError: string | null }
  | {
      phase: 'solving';
      title: string;
      author: string;
      grid: GridVM;
      banner: ActiveClueBannerVM;
      cluePanel: PlayerCluePanelVM;
      toolbar: PlayerToolbarVM;
      anagram: AnagramModalVM | null;
      checkResult: PlayerCheckResultVM;
    };

function emptyBanner(): ActiveClueBannerVM {
  return {
    wordNumber: null,
    direction: null,
    displayClue: null,
    lengthPatternLabel: null,
    announcement: '',
  };
}

export function deriveActiveClueBannerVM(input: {
  puzzle: Puzzle | null;
  cursor: Cursor;
}): ActiveClueBannerVM {
  const { puzzle, cursor } = input;
  if (puzzle === null || cursor === null) {
    return emptyBanner();
  }

  const word = WordSelection.findContainingWord(puzzle.words, cursor);
  if (word === null) {
    return emptyBanner();
  }

  const index = ChainIndex.build(puzzle.words);
  const displayClue = renderDisplayClue(DisplayClue.forWord(index, word));
  const lengthPatternLabel = index.isHead(word.key)
    ? renderLengthPatternLabel(LengthPattern.forWord(puzzle.grid, index, word))
    : null;

  const wordNumber = Number(word.number);
  const announcement =
    `${wordNumber} ${word.key.direction}: ${displayClue}` +
    (lengthPatternLabel !== null ? ` ${lengthPatternLabel}` : '');

  return {
    wordNumber,
    direction: word.key.direction,
    displayClue,
    lengthPatternLabel,
    announcement,
  };
}

export function derivePlayerCluePanelVM(input: {
  puzzle: Puzzle;
  highlightedWordKey: WordKey | null;
}): PlayerCluePanelVM {
  return deriveCluePanelVM({
    grid: input.puzzle.grid,
    words: input.puzzle.words,
    highlightedWordKey: input.highlightedWordKey,
    isBuilder: false,
  });
}

export function derivePlayerToolbarVM(
  state: Extract<PlayerState, { phase: 'solving' }>,
): PlayerToolbarVM {
  const hasIncorrect =
    state.checkResult !== null && state.checkResult.incorrectCells.length > 0;
  const cursorOnWord =
    state.cursor !== null && WordSelection.findContainingWord(state.puzzle.words, state.cursor) !== null;

  return {
    canCheck: true,
    canClearErrors: hasIncorrect,
    canReset: true,
    canOpenAnagram: cursorOnWord,
    canImportNew: true,
  };
}

export function deriveCheckResultVM(
  checkResult: CheckResult | null,
): PlayerCheckResultVM {
  if (checkResult === null) {
    return null;
  }

  const incorrectCount = checkResult.incorrectCells.length;
  const emptyCount = checkResult.emptyCells.length;
  let message: string;

  switch (checkResult.classification) {
    case 'complete-correct':
      message = 'Puzzle solved!';
      break;
    case 'incomplete-correct':
      message = 'Looks good so far. No incorrect letters, but some empty cells remain.';
      break;
    case 'complete-incorrect':
      message = 'Some letters are incorrect.';
      break;
    case 'incomplete-incorrect':
      message = 'Some letters are incorrect and some cells are empty.';
      break;
  }

  const announcement =
    message +
    (incorrectCount > 0 ? ` (${incorrectCount} incorrect)` : '') +
    (emptyCount > 0 ? ` (${emptyCount} empty)` : '');

  return {
    classification: checkResult.classification,
    incorrectCount,
    emptyCount,
    message,
    announcement,
  };
}

export function derivePlayerShellVM(state: PlayerState): PlayerShellVM {
  if (state.phase === 'import') {
    return {
      phase: 'import',
      importError: state.lastImportReject === null ? null : renderToastReason(state.lastImportReject),
    };
  }

  const cursorWord = state.cursor
    ? WordSelection.findContainingWord(state.puzzle.words, state.cursor)
    : null;
  const highlightedWordKey = cursorWord ? cursorWord.key : null;
  const selectedWordCells = ChainCells.cellsOfChain(state.puzzle.words, cursorWord);

  const grid = deriveGridVM({
    grid: state.puzzle.grid,
    cursor: state.cursor,
    words: state.puzzle.words,
    whichLetter: 'player',
    selectedWordCells,
    typingFocusSeq: state.typingFocusSeq,
  });
  const banner = deriveActiveClueBannerVM({
    puzzle: state.puzzle,
    cursor: state.cursor,
  });
  const cluePanel = derivePlayerCluePanelVM({
    puzzle: state.puzzle,
    highlightedWordKey,
  });
  const toolbar = derivePlayerToolbarVM(state);
  const anagram = deriveAnagramModalVM({
    anagramModal: state.anagram,
    grid: state.puzzle.grid,
    words: state.puzzle.words,
  });
  const checkResult = deriveCheckResultVM(state.checkResult);

  return {
    phase: 'solving',
    title: String(state.puzzle.title),
    author: String(state.puzzle.author),
    grid,
    banner,
    cluePanel,
    toolbar,
    anagram,
    checkResult,
  };
}

