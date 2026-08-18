import { BuilderState } from '../state';
import type { BuilderIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import { Result } from '../../../domain/notifications/Event';
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { WordDerivation } from '../../../domain/word/WordDerivation';
import { Numbering } from '../../../domain/word/Numbering';
import { reconcileWords } from './reconcileWords';

export function handleToggleDesignCell(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'toggle-design-cell' }>,
  rng: Rng,
): ReducerResult<BuilderState> {

  if (state.mode !== 'design') {
    return Result.ok(state);
  }

  if (!GridOps.withinBounds(state.puzzle.grid, intent.row, intent.col)) {
    return Result.ok(state);
  }

  const currentCell = GridOps.cellAt(state.puzzle.grid, intent.row, intent.col);
  const newCell = currentCell.black ? Cell.white() : Cell.black();
  const newGrid = GridOps.setCell(state.puzzle.grid, intent.row, intent.col, newCell);
  const puzzleWithNewGrid = Puzzle.withGrid(state.puzzle, newGrid);

  const newDerived = WordDerivation.derive(newGrid);
  const { words, displacedClues, events } = reconcileWords(
    newGrid,
    state.puzzle.words,
    newDerived,
    state.displacedClues,
    rng,
  );

  const newPuzzle = Puzzle.withWords(puzzleWithNewGrid, words);

  return Result.withEvents(
    {
      ...state,
      puzzle: newPuzzle,
      displacedClues,
      cursor: null,
    },
    events,
  );
}

export function handleChangeGridSize(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'change-grid-size' }>,
): ReducerResult<BuilderState> {

  if (state.mode !== 'design') {
    return Result.ok(state);
  }
  if (!BuilderState.isBlank(state)) {
    return Result.ok(state);
  }

  const newGrid = GridOps.blank(intent.size);
  const newWords = Numbering.assign(newGrid, WordDerivation.derive(newGrid));
  const newPuzzle = Puzzle.withWords(Puzzle.withGrid(state.puzzle, newGrid), newWords);

  return Result.ok({
    ...state,
    puzzle: newPuzzle,
    subMode: { kind: 'none' },
    cursor: null,
  });
}

export function handleRequestSwitchToDesign(
  state: BuilderState,
): ReducerResult<BuilderState> {

  if (BuilderState.isBlank(state)) {
    return Result.ok({
      ...state,
      mode: 'design',
      subMode: { kind: 'none' },
      cursor: null,
    });
  }

  return Result.withEvents(state, [
    {
      kind: 'modal-request',
      modal: { kind: 'confirm-design-switch' },
      confirmIntent: { kind: 'confirm-switch-to-design' },
    },
  ]);
}

export function handleConfirmSwitchToDesign(
  state: BuilderState,
): ReducerResult<BuilderState> {

  return Result.ok({
    ...state,
    mode: 'design',
    subMode: { kind: 'none' },
    cursor: null,
  });
}
