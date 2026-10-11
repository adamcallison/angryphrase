import type { PlayerState, AnagramModalState, CheckClassification, CheckResult } from '../state';
import type { Cursor } from '../../../domain/grid/Cursor';
import type { PlayerIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import { Result } from '../../../domain/notifications/Event';
import { GridOps } from '../../../domain/grid/GridOps';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import { WordKey } from '../../../domain/word/WordKey';
import { WordMap } from '../../../domain/word/WordMap';
import { WordSelection } from '../../../domain/word/WordSelection';
import { Chain } from '../../../domain/chain/Chain';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { Cell } from '../../../domain/grid/Cell';
import { Letter } from '../../../domain/letter/Letter';
import { GridInteraction, type LetterSlot } from '../../../domain/grid/GridInteraction';

const PLAYER_SLOT: LetterSlot = {
  read: (c) => c.playerLetter,
  set: Cell.setPlayerLetter,
};

function anagramAfterCursorChange(
  anagram: AnagramModalState | null,
  puzzle: Puzzle,
  newCursor: Cursor,
): AnagramModalState | null {
  if (anagram === null) return null;
  if (newCursor === null) return null;
  const word = WordSelection.findContainingWord(puzzle.words, newCursor);
  if (word === null) return null;
  const wordMap = WordMap.fromWords(puzzle.words);
  const head = Chain.headOf(wordMap, word.key);
  if (!WordKey.equals(head, anagram.openedForWord)) return null;
  return anagram;
}

export function handleSelectCell(
  state: PlayerState,
  intent: Extract<PlayerIntent, { kind: 'select-cell' }>,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  const cursor = GridInteraction.select(state.puzzle.grid, state.cursor, intent.row, intent.col);
  if (cursor === null) return Result.ok(state);
  return Result.ok({
    ...state,
    cursor,
    checkResult: null,
    anagram: anagramAfterCursorChange(state.anagram, state.puzzle, cursor),
  });
}

export function handleMoveCursor(
  state: PlayerState,
  intent: Extract<PlayerIntent, { kind: 'move-cursor' }>,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  const cursor = GridInteraction.move(state.puzzle.grid, state.cursor, intent.direction, intent.sign);
  if (cursor === null) return Result.ok(state);
  return Result.ok({
    ...state,
    cursor,
    checkResult: null,
    anagram: anagramAfterCursorChange(state.anagram, state.puzzle, cursor),
  });
}

export function handleClickCluePanelWord(
  state: PlayerState,
  intent: Extract<PlayerIntent, { kind: 'click-clue-panel-word' }>,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  const target = state.puzzle.words.find((w) => WordKey.equals(w.key, intent.wordKey));
  if (target === undefined) {
    return Result.ok(state);
  }

  const newCursor: Cursor = {
    row: target.key.startRow,
    col: target.key.startCol,
    direction: target.key.direction,
  };
  const newAnagram = anagramAfterCursorChange(state.anagram, state.puzzle, newCursor);
  return Result.ok({
    ...state,
    cursor: newCursor,
    checkResult: null,
    anagram: newAnagram,
  });
}

export function handleTypeLetter(
  state: PlayerState,
  intent: Extract<PlayerIntent, { kind: 'type-letter' }>,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving' || state.cursor === null) {
    return Result.ok(state);
  }

  const out = GridInteraction.typeLetter(
    state.puzzle.grid,
    state.cursor,
    intent.letter,
    PLAYER_SLOT,
  );
  if (out === null) return Result.ok(state);

  const newPuzzle = Puzzle.withGrid(state.puzzle, out.grid);
  return Result.ok({
    ...state,
    puzzle: newPuzzle,
    cursor: out.cursor,
    checkResult: null,
    anagram: anagramAfterCursorChange(state.anagram, newPuzzle, out.cursor),
  });
}

export function handleBackspace(state: PlayerState): ReducerResult<PlayerState> {
  if (state.phase !== 'solving' || state.cursor === null) {
    return Result.ok(state);
  }

  const out = GridInteraction.backspace(state.puzzle.grid, state.cursor, PLAYER_SLOT);
  if (out === null) return Result.ok(state);

  const newPuzzle = Puzzle.withGrid(state.puzzle, out.grid);
  return Result.ok({
    ...state,
    puzzle: newPuzzle,
    cursor: out.cursor,
    checkResult: null,
    anagram: anagramAfterCursorChange(state.anagram, newPuzzle, out.cursor),
  });
}

export function handleCheck(state: PlayerState): ReducerResult<PlayerState> {
  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  const incorrectCells: { row: Row; col: Col }[] = [];
  const emptyCells: { row: Row; col: Col }[] = [];

  const size = g.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = GridOps.cellAt(g, Row.of(r), Col.of(c));
      if (cell.black) continue;
      if (cell.playerLetter === null) {
        emptyCells.push({ row: Row.of(r), col: Col.of(c) });
      } else if (cell.answerLetter === null || !Letter.equals(cell.playerLetter, cell.answerLetter)) {
        incorrectCells.push({ row: Row.of(r), col: Col.of(c) });
      }
    }
  }

  const hasEmpty = emptyCells.length > 0;
  const hasIncorrect = incorrectCells.length > 0;
  const allFilled = !hasEmpty;

  let classification: CheckClassification;
  if (!hasIncorrect && allFilled) classification = 'complete-correct';
  else if (!hasIncorrect && !allFilled) classification = 'incomplete-correct';
  else if (hasIncorrect && allFilled) classification = 'complete-incorrect';
  else classification = 'incomplete-incorrect';

  const checkResult: CheckResult = { classification, incorrectCells, emptyCells };
  return Result.ok({ ...state, checkResult });
}

export function handleClearErrors(state: PlayerState): ReducerResult<PlayerState> {
  if (state.phase !== 'solving' || state.checkResult === null) {
    return Result.ok(state);
  }

  if (state.checkResult.incorrectCells.length === 0) {
    return Result.ok(state);
  }

  const incorrectCells = state.checkResult.incorrectCells;
  let newGrid = state.puzzle.grid;
  for (const { row, col } of incorrectCells) {
    const cell = GridOps.cellAt(newGrid, row, col);
    newGrid = GridOps.setCell(newGrid, row, col, Cell.setPlayerLetter(cell, null));
  }
  const newPuzzle = newGrid === state.puzzle.grid
    ? state.puzzle
    : Puzzle.withGrid(state.puzzle, newGrid);

  return Result.ok({
    ...state,
    puzzle: newPuzzle,
    checkResult: null,
  });
}
