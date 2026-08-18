import type { BuilderState } from '../state';
import type { BuilderIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import type { Direction } from '../../../domain/word/Direction';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import type { Grid } from '../../../domain/grid/Grid';
import { Result } from '../../../domain/notifications/Event';
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';
import { CellMarker } from '../../../domain/grid/CellMarker';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { WordKey } from '../../../domain/word/WordKey';
import { WordMap } from '../../../domain/word/WordMap';
import { Chain } from '../../../domain/chain/Chain';
import { resolveJoin } from './joinSubMode';
import { resolveReattach } from './reattachSubMode';

const DELTA: Record<Direction, { dr: number; dc: number }> = {
  across: { dr: 0, dc: 1 },
  down: { dr: 1, dc: 0 },
};

export function handleSelectCell(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'select-cell' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
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
    if (inAcross && inDown) {
      direction = current!.direction === 'across' ? 'down' : 'across';
    } else {
      return Result.ok(state);
    }
  } else {
    direction = inAcross && inDown ? 'across' : inAcross ? 'across' : 'down';
  }

  return Result.ok({
    ...state,
    cursor: { row: intent.row, col: intent.col, direction },
  });
}

export function handleMoveCursor(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'move-cursor' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const cursor = state.cursor;
  if (cursor === null) {
    return Result.ok(state);
  }

  const { dr, dc } = DELTA[intent.direction];
  const signedDr = dr * intent.sign;
  const signedDc = dc * intent.sign;
  const newRow = Row.try(Number(cursor.row) + signedDr);
  const newCol = Col.try(Number(cursor.col) + signedDc);

  const g = state.puzzle.grid;
  if (
    newRow !== null &&
    newCol !== null &&
    GridOps.withinBounds(g, newRow, newCol) &&
    GridOps.isSelectable(g, newRow, newCol)
  ) {
    return Result.ok({
      ...state,
      cursor: { row: newRow, col: newCol, direction: intent.direction },
    });
  }

  return Result.ok({
    ...state,
    cursor: { ...cursor, direction: intent.direction },
  });
}

export function handleTypeLetter(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'type-letter' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill' || state.cursor === null) {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  const c = GridOps.cellAt(g, state.cursor.row, state.cursor.col);
  if (c.black) {
    return Result.ok(state);
  }

  const newCell = Cell.setAnswerLetter(c, intent.letter);
  const newGrid = GridOps.setCell(g, state.cursor.row, state.cursor.col, newCell);
  const newPuzzle = Puzzle.withGrid(state.puzzle, newGrid);

  const { dr, dc } = DELTA[state.cursor.direction];
  const nextRow = Row.of(Number(state.cursor.row) + dr);
  const nextCol = Col.of(Number(state.cursor.col) + dc);
  let cursor = state.cursor;
  if (GridOps.withinBounds(newGrid, nextRow, nextCol) && GridOps.isSelectable(newGrid, nextRow, nextCol)) {
    cursor = { row: nextRow, col: nextCol, direction: state.cursor.direction };
  }

  return Result.ok({ ...state, puzzle: newPuzzle, cursor });
}

export function handleBackspace(
  state: BuilderState,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill' || state.cursor === null) {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  const c = GridOps.cellAt(g, state.cursor.row, state.cursor.col);
  if (c.black) {
    return Result.ok(state);
  }

  if (c.answerLetter !== null) {
    const newPuzzle = Puzzle.withGrid(
      state.puzzle,
      GridOps.setCell(g, state.cursor.row, state.cursor.col, Cell.setAnswerLetter(c, null)),
    );
    return Result.ok({ ...state, puzzle: newPuzzle, cursor: state.cursor });
  }

  const { dr, dc } = DELTA[state.cursor.direction];
  const prevRow = Row.try(Number(state.cursor.row) - dr);
  const prevCol = Col.try(Number(state.cursor.col) - dc);

  if (prevRow === null || prevCol === null || !GridOps.withinBounds(g, prevRow, prevCol)) {
    return Result.ok(state);
  }
  const prevCell = GridOps.cellAt(g, prevRow, prevCol);
  if (!GridOps.isSelectable(g, prevRow, prevCol)) {
    return Result.ok(state);
  }

  const newGrid = GridOps.setCell(g, prevRow, prevCol, Cell.setAnswerLetter(prevCell, null));
  const newPuzzle = Puzzle.withGrid(state.puzzle, newGrid);
  return Result.ok({
    ...state,
    puzzle: newPuzzle,
    cursor: { row: prevRow, col: prevCol, direction: state.cursor.direction },
  });
}

export function handleToggleMarker(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'toggle-marker' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill' || state.cursor === null) {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  const c = GridOps.cellAt(g, state.cursor.row, state.cursor.col);
  if (c.black) {
    return Result.ok(state);
  }

  const newMarker = CellMarker.toggle(c.marker, intent.flag);
  const newCell = Cell.setMarker(c, newMarker);
  const newGrid = GridOps.setCell(g, state.cursor.row, state.cursor.col, newCell);
  const newPuzzle = Puzzle.withGrid(state.puzzle, newGrid);

  return Result.ok({ ...state, puzzle: newPuzzle });
}

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

export function handleEditClue(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'edit-clue' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const words = state.puzzle.words;
  const target = words.find(w => WordKey.equals(w.key, intent.wordKey));
  if (target === undefined) {
    return Result.ok(state);
  }

  const wordMap = WordMap.fromWords(words);
  if (Chain.isNonHead(wordMap, intent.wordKey)) {
    return Result.withEvents(state, [
      {
        kind: 'toast',
        toastKind: 'error',
        message: 'Cannot edit clue of a non-head chain word (FR-31).',
      },
    ]);
  }

  const newWords = words.map(w =>
    WordKey.equals(w.key, intent.wordKey) ? { ...w, clue: intent.clue } : w,
  );
  return Result.ok({ ...state, puzzle: Puzzle.withWords(state.puzzle, newWords) });
}

export function handleClickWord(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'click-clue-panel-word' | 'click-grid-word' }>,
  rng: Rng,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  // Defensive: target word must exist.
  const words = state.puzzle.words;
  if (!words.some(w => WordKey.equals(w.key, intent.wordKey))) {
    return Result.ok(state);
  }

  if (state.subMode.kind === 'none') {
    // §830: navigate cursor to word's start cell + word's direction.
    const target = words.find(w => WordKey.equals(w.key, intent.wordKey))!;
    return Result.ok({
      ...state,
      cursor: {
        row: target.key.startRow,
        col: target.key.startCol,
        direction: target.key.direction,
      },
    });
  }

  if (state.subMode.kind === 'join') {
    return resolveJoin(state, state.subMode.source, intent.wordKey, rng);
  }

  // reattach
  return resolveReattach(state, state.subMode.displacedClueId, intent.wordKey);
}
