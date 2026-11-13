import { BuilderState } from '../state';
import type { BuilderIntentOf } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import { Result, confirmEvent } from '../../../domain/notifications/Event';
import { Grid } from '../../../domain/grid/Grid';
import { Cell } from '../../../domain/grid/Cell';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { WordDerivation } from '../../../domain/word/WordDerivation';
import { Numbering } from '../../../domain/word/Numbering';
import { reconcileWords } from './reconcileWords';

export function handleToggleDesignCell(
  state: BuilderState,
  intent: BuilderIntentOf<'toggle-design-cell'>,
  rng: Rng,
): ReducerResult<BuilderState> {

  if (state.mode !== 'design') {
    return Result.ok(state);
  }

  const currentCell = Grid.cellAt(state.puzzle.grid, intent.cell.row, intent.cell.col);
  const newCell = currentCell.black ? Cell.white() : Cell.black();
  const newGrid = Grid.setCell(state.puzzle.grid, intent.cell.row, intent.cell.col, newCell);

  const newDerived = WordDerivation.derive(newGrid);
  const { grid: reconciledGrid, words, displacedClues, events } = reconcileWords(
    newGrid,
    state.puzzle.words,
    newDerived,
    state.displacedClues,
    rng,
  );

  const newPuzzle = Puzzle.withWords(Puzzle.withGrid(state.puzzle, reconciledGrid), words);

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
  intent: BuilderIntentOf<'change-grid-size'>,
): ReducerResult<BuilderState> {

  if (state.mode !== 'design') {
    return Result.ok(state);
  }
  if (!BuilderState.isBlank(state)) {
    return Result.ok(state);
  }

  const newGrid = Grid.blank(intent.size);
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
    confirmEvent('confirm-design-switch', { target: 'builder', kind: 'confirm-switch-to-design' }),
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
