import type { Puzzle } from '../../../domain/puzzle/Puzzle';
import type { WordKey } from '../../../domain/word/WordKey';
import type { Direction } from '../../../domain/word/Direction';
import type { Cursor } from '../../../domain/grid/Cursor';
import type { PlayerState, CheckResult, CheckClassification } from '../../../player/state/state';
import { WordMap } from '../../../domain/word/WordMap';
import { WordSelection } from '../../../domain/word/WordSelection';
import { Chain } from '../../../domain/chain/Chain';
import { ChainCells } from '../../../domain/chain/ChainCells';
import { DisplayClue } from '../../../domain/chain/DisplayClue';
import { LengthPattern } from '../../../domain/chain/LengthPattern';
import { deriveGridVM, type GridVM } from './gridVM';
import { deriveCluePanelVM, type CluePanelVM } from './cluePanelVM';
import { deriveAnagramModalVM, type AnagramModalVM } from './anagramVM';
import type { LengthPattern as LengthPatternType } from '../../../domain/chain/LengthPattern';

export type { LengthPatternType as LengthPattern };

export type ActiveClueBannerVM = {
  visible: true;
  wordNumber: number | null;
  direction: Direction | null;
  displayClue: string | null;
  lengthPattern: LengthPattern | null;
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
  colorClass: string;
} | null;

export type PlayerShellVM =
  | { phase: 'import'; importError: string | null }
  | {
      phase: 'solving';
      title: string;
      author: string;
      grid: GridVM;
      topBanner: ActiveClueBannerVM;
      bottomBanner: ActiveClueBannerVM;
      cluePanel: PlayerCluePanelVM;
      toolbar: PlayerToolbarVM;
      anagram: AnagramModalVM;
      checkResult: PlayerCheckResultVM;
    };

function emptyBanner(): ActiveClueBannerVM {
  return {
    visible: true,
    wordNumber: null,
    direction: null,
    displayClue: null,
    lengthPattern: null,
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

  const wordMap = WordMap.fromWords(puzzle.words);
  const displayClue = DisplayClue.forWord(wordMap, word);
  const lengthPattern = Chain.isHead(wordMap, word.key)
    ? LengthPattern.forWord(puzzle.grid, wordMap, word)
    : null;

  return {
    visible: true,
    wordNumber: Number(word.number),
    direction: word.key.direction,
    displayClue,
    lengthPattern,
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
  let colorClass: string;

  switch (checkResult.classification) {
    case 'complete-correct':
      message = 'Puzzle solved!';
      colorClass = 'text-green-600';
      break;
    case 'incomplete-correct':
      message = 'Looks good so far. No incorrect letters, but some empty cells remain.';
      colorClass = 'text-green-600';
      break;
    case 'complete-incorrect':
      message = 'Some letters are incorrect.';
      colorClass = 'text-red-600';
      break;
    case 'incomplete-incorrect':
      message = 'Some letters are incorrect and some cells are empty.';
      colorClass = 'text-red-600';
      break;
  }

  return {
    classification: checkResult.classification,
    incorrectCount,
    emptyCount,
    message,
    colorClass,
  };
}

export function derivePlayerShellVM(state: PlayerState): PlayerShellVM {
  if (state.phase === 'import') {
    return { phase: 'import', importError: state.lastImportError };
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
  });
  const topBanner = deriveActiveClueBannerVM({
    puzzle: state.puzzle,
    cursor: state.cursor,
  });
  const bottomBanner = topBanner;
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
    topBanner,
    bottomBanner,
    cluePanel,
    toolbar,
    anagram,
    checkResult,
  };
}

