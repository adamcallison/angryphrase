import { describe, it, expect } from 'vitest';
import {
  deriveActiveClueBannerVM,
  derivePlayerCluePanelVM,
  derivePlayerToolbarVM,
  deriveCheckResultVM,
  derivePlayerShellVM,
} from './playerVM';
import { GridOps } from '../../../domain/grid/GridOps';
import { GridSize } from '../../../domain/grid/GridSize';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import { Cell } from '../../../domain/grid/Cell';
import { Letter } from '../../../domain/letter/Letter';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { PuzzleKey } from '../../../domain/puzzle/PuzzleKey';
import { Title } from '../../../domain/puzzle/Title';
import { Author } from '../../../domain/puzzle/Author';
import { WordKey } from '../../../domain/word/WordKey';
import { WordNumber } from '../../../domain/word/WordNumber';
import { WordDerivation } from '../../../domain/word/WordDerivation';
import { Numbering } from '../../../domain/word/Numbering';
import type { Direction } from '../../../domain/word/Direction';
import type { Word } from '../../../domain/word/Word';
import type { Cursor } from '../../../builder/state/state';
import type { PlayerState, CheckResult, AnagramModalState } from '../../../player/state/state';
import type { Grid } from '../../../domain/grid/Grid';

function makeKey(): PuzzleKey {
  return PuzzleKey.try('00000000-0000-4000-8000-000000000000')!;
}

function makeBlankPuzzle(size: number): Puzzle {
  return Puzzle.blank(GridSize.of(size), makeKey());
}

function puzzleWithGrid(p: Puzzle, grid: Grid): Puzzle {
  return Puzzle.withGrid(p, grid);
}

function puzzleWithWords(p: Puzzle, words: Word[]): Puzzle {
  return Puzzle.withWords(p, words);
}

function puzzleWithMetadata(p: Puzzle, title: string, author: string): Puzzle {
  return Puzzle.withMetadata(p, Title.try(title), Author.try(author));
}

function setAnswerLetter(grid: Grid, row: number, col: number, letter: string): Grid {
  const r = Row.of(row);
  const c = Col.of(col);
  const cell = GridOps.cellAt(grid, r, c);
  const l = Letter.try(letter);
  if (l === null) throw new Error(`Invalid letter: ${letter}`);
  return GridOps.setCell(grid, r, c, Cell.setAnswerLetter(cell, l));
}

function setPlayerLetter(grid: Grid, row: number, col: number, letter: string): Grid {
  const r = Row.of(row);
  const c = Col.of(col);
  const cell = GridOps.cellAt(grid, r, c);
  const l = Letter.try(letter);
  if (l === null) throw new Error(`Invalid letter: ${letter}`);
  return GridOps.setCell(grid, r, c, Cell.setPlayerLetter(cell, l));
}

function makeWord(opts: {
  startRow: number;
  startCol: number;
  direction: Direction;
  number: number;
  length: number;
  clue?: string;
  nextWord?: WordKey | null;
}): Word {
  return {
    key: {
      startRow: Row.of(opts.startRow),
      startCol: Col.of(opts.startCol),
      direction: opts.direction,
    },
    number: WordNumber.of(opts.number),
    length: opts.length,
    clue: opts.clue ?? '',
    nextWord: opts.nextWord ?? null,
  };
}

function makeImportState(lastImportError: string | null = null): PlayerState {
  return { phase: 'import', lastImportError };
}

function makeSolvingState(opts: {
  puzzle: Puzzle;
  cursor?: Cursor;
  checkResult?: CheckResult | null;
  anagram?: AnagramModalState | null;
}): PlayerState {
  return {
    phase: 'solving',
    puzzle: opts.puzzle,
    cursor: opts.cursor ?? null,
    checkResult: opts.checkResult ?? null,
    anagram: opts.anagram ?? null,
  };
}

function makeCheckResult(
  classification: CheckResult['classification'],
  incorrectCount: number,
  emptyCount: number,
): CheckResult {
  const incorrectCells: { row: Row; col: Col }[] = [];
  for (let i = 0; i < incorrectCount; i++) {
    incorrectCells.push({ row: Row.of(0), col: Col.of(i) });
  }
  const emptyCells: { row: Row; col: Col }[] = [];
  for (let i = 0; i < emptyCount; i++) {
    emptyCells.push({ row: Row.of(1), col: Col.of(i) });
  }
  return { classification, incorrectCells, emptyCells };
}

function makeCursor(row: number, col: number, direction: Direction): Cursor {
  return { row: Row.of(row), col: Col.of(col), direction };
}

function makeAnagramModal(openedForWord: WordKey, input: string = ''): AnagramModalState {
  return { openedForWord, input, scrambledArrangement: null };
}

describe('deriveActiveClueBannerVM', () => {
  it('deriveActiveClueBannerVM: puzzle null + cursor null → all-null blanker', () => {
    const vm = deriveActiveClueBannerVM({ puzzle: null, cursor: null });
    expect(vm).toEqual({
      visible: true,
      wordNumber: null,
      direction: null,
      displayClue: null,
      lengthPattern: null,
    });
  });

  it('deriveActiveClueBannerVM: cursor null + real puzzle → nulls', () => {
    const puzzle = makeBlankPuzzle(3);
    const vm = deriveActiveClueBannerVM({ puzzle, cursor: null });
    expect(vm).toEqual({
      visible: true,
      wordNumber: null,
      direction: null,
      displayClue: null,
      lengthPattern: null,
    });
  });

  it('deriveActiveClueBannerVM: cursor set on a head word → wordNumber, direction, clue, lengthPattern populated', () => {
    let puzzle = makeBlankPuzzle(3);
    const word = makeWord({
      startRow: 0,
      startCol: 0,
      direction: 'across',
      number: 1,
      length: 3,
      clue: 'Head clue',
    });
    puzzle = puzzleWithWords(puzzle, [word]);
    const cursor = makeCursor(0, 1, 'across');
    const vm = deriveActiveClueBannerVM({ puzzle, cursor });
    expect(vm.wordNumber).toBe(WordNumber.of(1));
    expect(vm.direction).toBe('across');
    expect(vm.displayClue).toBe('Head clue');
    expect(vm.lengthPattern).toBe('3');
  });

  it('deriveActiveClueBannerVM: cursor set on a non-head word → displayClue="See N Direction", lengthPattern=null, wordNumber/direction still present', () => {
    let puzzle = makeBlankPuzzle(3);
    const head = makeWord({
      startRow: 0,
      startCol: 0,
      direction: 'across',
      number: 1,
      length: 3,
      clue: 'Head clue',
    });
    const tail = makeWord({
      startRow: 0,
      startCol: 0,
      direction: 'down',
      number: 2,
      length: 3,
      clue: '',
    });
    puzzle = puzzleWithWords(puzzle, [{ ...head, nextWord: tail.key }, tail]);
    const cursor = makeCursor(0, 0, 'down');
    const vm = deriveActiveClueBannerVM({ puzzle, cursor });
    expect(vm.wordNumber).toBe(WordNumber.of(2));
    expect(vm.direction).toBe('down');
    expect(vm.displayClue).toBe('See 1 Across');
    expect(vm.lengthPattern).toBeNull();
  });
});

describe('derivePlayerCluePanelVM', () => {
  it('derivePlayerCluePanelVM: produces CluePanelVM with all builder-only affordances false', () => {
    const head = makeWord({
      startRow: 0,
      startCol: 0,
      direction: 'across',
      number: 1,
      length: 3,
      clue: 'Head clue',
    });
    const tail = makeWord({
      startRow: 0,
      startCol: 0,
      direction: 'down',
      number: 2,
      length: 3,
      clue: '',
    });
    const words = [{ ...head, nextWord: tail.key }, tail];
    const puzzle = puzzleWithWords(makeBlankPuzzle(3), words);
    const vm = derivePlayerCluePanelVM({ puzzle, highlightedWordKey: null });
    for (const entry of [...vm.across, ...vm.down]) {
      expect(entry.isStartableJoinSource).toBe(false);
      expect(entry.isLinkableFromJoinSource).toBe(false);
      expect(entry.isUnjoinable).toBe(false);
    }
  });

  it('derivePlayerCluePanelVM: highlightedWordKey passed through; across/down sorted by WordNumber', () => {
    const across2 = makeWord({ startRow: 2, startCol: 0, direction: 'across', number: 3, length: 2 });
    const across1 = makeWord({ startRow: 0, startCol: 0, direction: 'across', number: 1, length: 2 });
    const down2 = makeWord({ startRow: 0, startCol: 2, direction: 'down', number: 4, length: 2 });
    const down1 = makeWord({ startRow: 0, startCol: 0, direction: 'down', number: 1, length: 3 });
    const puzzle = puzzleWithWords(makeBlankPuzzle(3), [across2, down2, across1, down1]);
    const highlighted = across1.key;
    const vm = derivePlayerCluePanelVM({ puzzle, highlightedWordKey: highlighted });
    expect(vm.highlightedWordKey).toEqual(highlighted);
    expect(vm.across.map((e) => Number(e.number))).toEqual([1, 3]);
    expect(vm.down.map((e) => Number(e.number))).toEqual([1, 4]);
  });
});

describe('derivePlayerToolbarVM', () => {
  it('derivePlayerToolbarVM: import phase → all flags false', () => {
    const state = makeImportState();
    const vm = derivePlayerToolbarVM(state);
    expect(vm).toEqual({
      canCheck: false,
      canClearErrors: false,
      canReset: false,
      canOpenAnagram: false,
      canImportNew: false,
    });
  });

  it('derivePlayerToolbarVM: solving phase with cursor on a word → canCheck/canReset/canImportNew=true, canOpenAnagram=true', () => {
    const word = makeWord({ startRow: 0, startCol: 0, direction: 'across', number: 1, length: 3 });
    const puzzle = puzzleWithWords(makeBlankPuzzle(3), [word]);
    const state = makeSolvingState({ puzzle, cursor: makeCursor(0, 1, 'across') });
    const vm = derivePlayerToolbarVM(state);
    expect(vm.canCheck).toBe(true);
    expect(vm.canReset).toBe(true);
    expect(vm.canImportNew).toBe(true);
    expect(vm.canOpenAnagram).toBe(true);
  });

  it('derivePlayerToolbarVM: solving phase with cursor null → canOpenAnagram=false', () => {
    const state = makeSolvingState({ puzzle: makeBlankPuzzle(3) });
    const vm = derivePlayerToolbarVM(state);
    expect(vm.canOpenAnagram).toBe(false);
  });

  it('derivePlayerToolbarVM: solving phase with cursor on a stray cell (no word) → canOpenAnagram=false', () => {
    let puzzle = makeBlankPuzzle(3);
    let grid = puzzle.grid;
    grid = GridOps.setCell(grid, Row.of(2), Col.of(1), Cell.black());
    const words = Numbering.assign(grid, WordDerivation.derive(grid));
    puzzle = puzzleWithWords(puzzleWithGrid(puzzle, grid), words);
    const state = makeSolvingState({
      puzzle,
      cursor: makeCursor(2, 2, 'across'),
    });
    const vm = derivePlayerToolbarVM(state);
    expect(vm.canOpenAnagram).toBe(false);
  });

  it('derivePlayerToolbarVM: solving phase with checkResult containing incorrectCells → canClearErrors=true', () => {
    const state = makeSolvingState({
      puzzle: makeBlankPuzzle(3),
      checkResult: makeCheckResult('complete-incorrect', 2, 0),
    });
    const vm = derivePlayerToolbarVM(state);
    expect(vm.canClearErrors).toBe(true);
  });

  it('derivePlayerToolbarVM: solving phase with checkResult containing no incorrectCells → canClearErrors=false', () => {
    const state = makeSolvingState({
      puzzle: makeBlankPuzzle(3),
      checkResult: makeCheckResult('complete-correct', 0, 0),
    });
    const vm = derivePlayerToolbarVM(state);
    expect(vm.canClearErrors).toBe(false);
  });
});

describe('deriveCheckResultVM', () => {
  it('deriveCheckResultVM: null input → null output', () => {
    expect(deriveCheckResultVM(null)).toBeNull();
  });

  it('deriveCheckResultVM: complete-correct → message "Puzzle solved!", colorClass "text-green-600", counts from result', () => {
    const result = makeCheckResult('complete-correct', 0, 0);
    const vm = deriveCheckResultVM(result);
    expect(vm).toEqual({
      classification: 'complete-correct',
      incorrectCount: 0,
      emptyCount: 0,
      message: 'Puzzle solved!',
      colorClass: 'text-green-600',
    });
  });

  it('deriveCheckResultVM: incomplete-correct → "Looks good so far..." + text-green-600', () => {
    const result = makeCheckResult('incomplete-correct', 0, 3);
    const vm = deriveCheckResultVM(result);
    expect(vm?.message).toBe(
      'Looks good so far. No incorrect letters, but some empty cells remain.',
    );
    expect(vm?.colorClass).toBe('text-green-600');
    expect(vm?.incorrectCount).toBe(0);
    expect(vm?.emptyCount).toBe(3);
  });

  it('deriveCheckResultVM: complete-incorrect → "Some letters are incorrect." + text-red-600 + emptyCount=0', () => {
    const result = makeCheckResult('complete-incorrect', 2, 0);
    const vm = deriveCheckResultVM(result);
    expect(vm?.message).toBe('Some letters are incorrect.');
    expect(vm?.colorClass).toBe('text-red-600');
    expect(vm?.incorrectCount).toBe(2);
    expect(vm?.emptyCount).toBe(0);
  });

  it('deriveCheckResultVM: incomplete-incorrect → "Some letters are incorrect and some cells are empty." + text-red-600', () => {
    const result = makeCheckResult('incomplete-incorrect', 1, 2);
    const vm = deriveCheckResultVM(result);
    expect(vm?.message).toBe('Some letters are incorrect and some cells are empty.');
    expect(vm?.colorClass).toBe('text-red-600');
    expect(vm?.incorrectCount).toBe(1);
    expect(vm?.emptyCount).toBe(2);
  });

  it('deriveCheckResultVM: incorrectCount and emptyCount reflect checkResult.incorrectCells.length and .emptyCells.length', () => {
    const result = makeCheckResult('incomplete-incorrect', 5, 7);
    const vm = deriveCheckResultVM(result);
    expect(vm?.incorrectCount).toBe(5);
    expect(vm?.emptyCount).toBe(7);
  });
});

describe('derivePlayerShellVM', () => {
  it('derivePlayerShellVM: import phase → phase="import"; title=""; author=""; anagram.open=false; checkResult=null; toolbar.* all false', () => {
    const state = makeImportState('bad import');
    const vm = derivePlayerShellVM(state);
    expect(vm.phase).toBe('import');
    expect(vm.importError).toBe('bad import');
    expect(vm.title).toBe('');
    expect(vm.author).toBe('');
    expect(vm.anagram.open).toBe(false);
    expect(vm.checkResult).toBeNull();
    expect(vm.toolbar).toEqual({
      canCheck: false,
      canClearErrors: false,
      canReset: false,
      canOpenAnagram: false,
      canImportNew: false,
    });
  });

  it('derivePlayerShellVM: solving phase empty cursor → phase="solving"; grid empty cursor reflected; topBanner nulls; bottomBanner === topBanner (same instance)', () => {
    let puzzle = puzzleWithMetadata(makeBlankPuzzle(3), 'Test Title', 'Test Author');
    const word = makeWord({
      startRow: 0,
      startCol: 0,
      direction: 'across',
      number: 1,
      length: 3,
      clue: 'Head clue',
    });
    puzzle = puzzleWithWords(puzzle, [word]);
    const state = makeSolvingState({ puzzle });
    const vm = derivePlayerShellVM(state);
    expect(vm.phase).toBe('solving');
    expect(vm.importError).toBeNull();
    expect(vm.title).toBe('Test Title');
    expect(vm.author).toBe('Test Author');
    expect(vm.grid.cursor).toBeNull();
    expect(vm.topBanner).toEqual({
      visible: true,
      wordNumber: null,
      direction: null,
      displayClue: null,
      lengthPattern: null,
    });
    expect(vm.bottomBanner).toBe(vm.topBanner);
  });

  it('derivePlayerShellVM: solving phase with cursor on word — topBanner populated; same instance assigned to bottomBanner', () => {
    let puzzle = makeBlankPuzzle(3);
    const word = makeWord({
      startRow: 0,
      startCol: 0,
      direction: 'across',
      number: 1,
      length: 3,
      clue: 'Head clue',
    });
    puzzle = puzzleWithWords(puzzle, [word]);
    const state = makeSolvingState({ puzzle, cursor: makeCursor(0, 1, 'across') });
    const vm = derivePlayerShellVM(state);
    expect(vm.topBanner.wordNumber).toBe(WordNumber.of(1));
    expect(vm.topBanner.displayClue).toBe('Head clue');
    expect(vm.bottomBanner).toBe(vm.topBanner);
  });

  it('derivePlayerShellVM: solving phase grid whichLetter=player (playerLetter used for letter extraction)', () => {
    let puzzle = makeBlankPuzzle(3);
    let grid = puzzle.grid;
    grid = setAnswerLetter(grid, 0, 0, 'A');
    grid = setPlayerLetter(grid, 0, 0, 'Z');
    puzzle = puzzleWithGrid(puzzle, grid);
    const state = makeSolvingState({ puzzle, cursor: makeCursor(0, 0, 'across') });
    const vm = derivePlayerShellVM(state);
    expect(vm.grid.cells[0]![0]!.letter).toBe('Z');
  });

  it('derivePlayerShellVM: anagram modal open when state.anagram exists — anagram.open=true', () => {
    let puzzle = makeBlankPuzzle(3);
    const word = makeWord({
      startRow: 0,
      startCol: 0,
      direction: 'across',
      number: 1,
      length: 3,
      clue: 'Head clue',
    });
    puzzle = puzzleWithWords(puzzle, [word]);
    let grid = puzzle.grid;
    grid = setAnswerLetter(grid, 0, 0, 'A');
    grid = setAnswerLetter(grid, 0, 2, 'C');
    puzzle = puzzleWithGrid(puzzle, grid);
    const state = makeSolvingState({
      puzzle,
      cursor: makeCursor(0, 1, 'across'),
      anagram: makeAnagramModal(word.key, 'ABC'),
    });
    const vm = derivePlayerShellVM(state);
    expect(vm.anagram.open).toBe(true);
    expect(vm.anagram.wordLength).toBe(3);
  });
});
