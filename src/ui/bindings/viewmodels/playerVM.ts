import type { Puzzle } from '../../../domain/puzzle/Puzzle';
import type { Word } from '../../../domain/word/Word';
import type { WordKey } from '../../../domain/word/WordKey';
import type { WordNumber } from '../../../domain/word/WordNumber';
import type { Direction } from '../../../domain/word/Direction';
import type { Cursor } from '../../../builder/state/state';
import type { PlayerState, CheckResult, CheckClassification } from '../../../player/state/state';
import { GridOps } from '../../../domain/grid/GridOps';
import { GridSize } from '../../../domain/grid/GridSize';
import { WordMap } from '../../../domain/word/WordMap';
import { Chain } from '../../../domain/chain/Chain';
import { DisplayClue } from '../../../domain/chain/DisplayClue';
import { LengthPattern } from '../../../domain/chain/LengthPattern';
import { deriveGridVM, type GridVM } from './gridVM';
import { deriveCluePanelVM } from './cluePanelVM';
import { deriveAnagramModalVM, type AnagramModalVM } from './anagramVM';
import type { ClueEntryVM } from './cluePanelVM';
import type { LengthPattern as LengthPatternType } from '../../../domain/chain/LengthPattern';

export type { LengthPatternType as LengthPattern };

export type ActiveClueBannerVM = {
  visible: true;
  wordNumber: WordNumber | null;
  direction: Direction | null;
  displayClue: string | null;
  lengthPattern: LengthPattern | null;
};

export type PlayerCluePanelVM = {
  across: ClueEntryVM[];
  down: ClueEntryVM[];
  highlightedWordKey: WordKey | null;
};

export type PlayerToolbarVM = {
  canCheck: boolean;
  canClearErrors: boolean;
  canReset: boolean;
  canOpenAnagram: boolean;
  canImportNew: boolean;
};

export type PlayerShellVM = {
  phase: 'import' | 'solving';
  importError: string | null;
  title: string;
  author: string;
  grid: GridVM;
  topBanner: ActiveClueBannerVM;
  bottomBanner: ActiveClueBannerVM;
  cluePanel: PlayerCluePanelVM;
  toolbar: PlayerToolbarVM;
  anagram: AnagramModalVM;
  checkResult: {
    classification: CheckClassification;
    incorrectCount: number;
    emptyCount: number;
    message: string;
    colorClass: string;
  } | null;
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

  const word = findContainingWord(puzzle.words, cursor);
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
    wordNumber: word.number,
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

export function derivePlayerToolbarVM(state: PlayerState): PlayerToolbarVM {
  if (state.phase === 'import') {
    return {
      canCheck: false,
      canClearErrors: false,
      canReset: false,
      canOpenAnagram: false,
      canImportNew: false,
    };
  }

  const hasIncorrect =
    state.checkResult !== null && state.checkResult.incorrectCells.length > 0;
  const cursorOnWord =
    state.cursor !== null && findContainingWord(state.puzzle.words, state.cursor) !== null;

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
): PlayerShellVM['checkResult'] {
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
    const blankGrid = GridOps.blank(GridSize.of(2));
    const grid = deriveGridVM({
      grid: blankGrid,
      cursor: null,
      words: [],
      whichLetter: 'player',
      selectedWordCells: new Set<string>(),
    });
    const topBanner = deriveActiveClueBannerVM({ puzzle: null, cursor: null });
    const bottomBanner = topBanner;
    const cluePanel: PlayerCluePanelVM = {
      across: [],
      down: [],
      highlightedWordKey: null,
    };
    const toolbar = derivePlayerToolbarVM(state);
    const anagram = deriveAnagramModalVM({
      anagramModal: null,
      grid: blankGrid,
      words: [],
    });

    return {
      phase: 'import',
      importError: state.lastImportError,
      title: '',
      author: '',
      grid,
      topBanner,
      bottomBanner,
      cluePanel,
      toolbar,
      anagram,
      checkResult: null,
    };
  }

  const cursorWord = state.cursor
    ? findContainingWord(state.puzzle.words, state.cursor)
    : null;
  const highlightedWordKey = cursorWord ? cursorWord.key : null;
  const selectedWordCells = cursorWord ? cellsOfWord(cursorWord) : new Set<string>();

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
    importError: null,
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

function findContainingWord(words: Word[], cursor: Cursor): Word | null {
  if (cursor === null) {
    return null;
  }
  const r = Number(cursor.row);
  const c = Number(cursor.col);
  for (const w of words) {
    if (w.key.direction !== cursor.direction) continue;
    const sr = Number(w.key.startRow);
    const sc = Number(w.key.startCol);
    if (cursor.direction === 'across') {
      if (sr === r && c >= sc && c < sc + w.length) return w;
    } else {
      if (sc === c && r >= sr && r < sr + w.length) return w;
    }
  }
  return null;
}

function cellsOfWord(w: Word): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < w.length; i++) {
    const r = w.key.direction === 'across' ? Number(w.key.startRow) : Number(w.key.startRow) + i;
    const c = w.key.direction === 'across' ? Number(w.key.startCol) + i : Number(w.key.startCol);
    set.add(`${r},${c}`);
  }
  return set;
}
