import type { PlayerState, AnagramModalState, CheckClassification, CheckResult } from '../state';
import type { Cursor } from '../../../domain/grid/Cursor';
import type { PlayerIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Direction } from '../../../domain/word/Direction';
import { Result } from '../../../domain/notifications/Event';
import { GridOps } from '../../../domain/grid/GridOps';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import { WordKey } from '../../../domain/word/WordKey';
import { WordMap } from '../../../domain/word/WordMap';
import { WordSelection } from '../../../domain/word/WordSelection';
import { Chain } from '../../../domain/chain/Chain';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import type { Grid } from '../../../domain/grid/Grid';
import { Cell } from '../../../domain/grid/Cell';
import { Letter } from '../../../domain/letter/Letter';

const DELTA: Record<Direction, { dr: number; dc: number }> = {
  across: { dr: 0, dc: 1 },
  down: { dr: 1, dc: 0 },
};

function partOfAcross(g: Grid, row: Row, col: Col): boolean {
  return hasWhiteNeighbour(g, row, col, 0, -1) || hasWhiteNeighbour(g, row, col, 0, 1);
}

function partOfDown(g: Grid, row: Row, col: Col): boolean {
  return hasWhiteNeighbour(g, row, col, -1, 0) || hasWhiteNeighbour(g, row, col, 1, 0);
}

function hasWhiteNeighbour(
  g: Grid,
  row: Row,
  col: Col,
  dr: number,
  dc: number,
): boolean {
  const r = Number(row) + dr;
  const c = Number(col) + dc;
  if (r < 0 || c < 0) {
    return false;
  }

  const neighbourRow = Row.try(r);
  const neighbourCol = Col.try(c);
  if (
    neighbourRow === null ||
    neighbourCol === null ||
    !GridOps.withinBounds(g, neighbourRow, neighbourCol)
  ) {
    return false;
  }

  return Cell.isWhite(GridOps.cellAt(g, neighbourRow, neighbourCol));
}

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

  const g = state.puzzle.grid;
  if (!GridOps.withinBounds(g, intent.row, intent.col)) {
    return Result.ok(state);
  }

  if (!GridOps.isSelectable(g, intent.row, intent.col)) {
    return Result.ok(state);
  }

  const inAcross = partOfAcross(g, intent.row, intent.col);
  const inDown = partOfDown(g, intent.row, intent.col);

  const current = state.cursor;
  const sameCell =
    current !== null &&
    Number(current.row) === Number(intent.row) &&
    Number(current.col) === Number(intent.col);

  let direction: Direction;
  if (sameCell) {
    if (current === null)
      return Result.ok({
        ...state,
        checkResult: null,
      }); // unreachable: sameCell implies current !== null
    if (inAcross && inDown) {
      direction = current.direction === 'across' ? 'down' : 'across';
    } else {
      return Result.ok({
        ...state,
        checkResult: null,
      });
    }
  } else {
    direction = inAcross && inDown ? 'across' : inAcross ? 'across' : 'down';
  }

  const newCursor: Cursor = { row: intent.row, col: intent.col, direction };
  const newAnagram = anagramAfterCursorChange(state.anagram, state.puzzle, newCursor);
  return Result.ok({
    ...state,
    cursor: newCursor,
    checkResult: null,
    anagram: newAnagram,
  });
}

export function handleMoveCursor(
  state: PlayerState,
  intent: Extract<PlayerIntent, { kind: 'move-cursor' }>,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving' || state.cursor === null) {
    return Result.ok(state);
  }

  const { dr, dc } = DELTA[intent.direction];
  const signedDr = dr * intent.sign;
  const signedDc = dc * intent.sign;
  const newRow = Row.try(Number(state.cursor.row) + signedDr);
  const newCol = Col.try(Number(state.cursor.col) + signedDc);

  const g = state.puzzle.grid;
  let newCursor: Cursor;
  if (
    newRow !== null &&
    newCol !== null &&
    GridOps.withinBounds(g, newRow, newCol) &&
    GridOps.isSelectable(g, newRow, newCol)
  ) {
    newCursor = { row: newRow, col: newCol, direction: intent.direction };
  } else {
    newCursor = { ...state.cursor, direction: intent.direction };
  }

  const newAnagram = anagramAfterCursorChange(state.anagram, state.puzzle, newCursor);
  return Result.ok({
    ...state,
    cursor: newCursor,
    checkResult: null,
    anagram: newAnagram,
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

  const g = state.puzzle.grid;
  const c = GridOps.cellAt(g, state.cursor.row, state.cursor.col);
  if (c.black) {
    return Result.ok(state);
  }

  const newCell = Cell.setPlayerLetter(c, intent.letter);
  const newGrid = GridOps.setCell(g, state.cursor.row, state.cursor.col, newCell);
  const newPuzzle = Puzzle.withGrid(state.puzzle, newGrid);

  const { dr, dc } = DELTA[state.cursor.direction];
  const nextRow = Row.of(Number(state.cursor.row) + dr);
  const nextCol = Col.of(Number(state.cursor.col) + dc);
  let newCursor: Cursor = state.cursor;
  if (
    GridOps.withinBounds(newGrid, nextRow, nextCol) &&
    GridOps.isSelectable(newGrid, nextRow, nextCol)
  ) {
    newCursor = { row: nextRow, col: nextCol, direction: state.cursor.direction };
  }

  const newAnagram = anagramAfterCursorChange(state.anagram, newPuzzle, newCursor);
  return Result.ok({
    ...state,
    puzzle: newPuzzle,
    cursor: newCursor,
    checkResult: null,
    anagram: newAnagram,
  });
}

export function handleBackspace(state: PlayerState): ReducerResult<PlayerState> {
  if (state.phase !== 'solving' || state.cursor === null) {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  const c = GridOps.cellAt(g, state.cursor.row, state.cursor.col);
  if (c.black) {
    return Result.ok(state);
  }

  if (c.playerLetter !== null) {
    const newPuzzle = Puzzle.withGrid(
      state.puzzle,
      GridOps.setCell(g, state.cursor.row, state.cursor.col, Cell.setPlayerLetter(c, null)),
    );
    return Result.ok({
      ...state,
      puzzle: newPuzzle,
      checkResult: null,
    });
  }

  const { dr, dc } = DELTA[state.cursor.direction];
  const prevRow = Row.try(Number(state.cursor.row) - dr);
  const prevCol = Col.try(Number(state.cursor.col) - dc);

  if (prevRow === null || prevCol === null || !GridOps.withinBounds(g, prevRow, prevCol)) {
    return Result.ok({ ...state, checkResult: null });
  }

  const prevCell = GridOps.cellAt(g, prevRow, prevCol);
  if (!GridOps.isSelectable(g, prevRow, prevCol)) {
    return Result.ok({ ...state, checkResult: null });
  }

  const newGrid = GridOps.setCell(g, prevRow, prevCol, Cell.setPlayerLetter(prevCell, null));
  const newPuzzle = Puzzle.withGrid(state.puzzle, newGrid);
  const newCursor: Cursor = {
    row: prevRow,
    col: prevCol,
    direction: state.cursor.direction,
  };
  const newAnagram = anagramAfterCursorChange(state.anagram, newPuzzle, newCursor);
  return Result.ok({
    ...state,
    puzzle: newPuzzle,
    cursor: newCursor,
    checkResult: null,
    anagram: newAnagram,
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
