import { BuilderState } from '../state';
import type { BuilderIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import { Result } from '../../../domain/notifications/Event';
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { WordDerivation } from '../../../domain/word/WordDerivation';
import { reconcileWords } from './reconcileWords';

export function handleToggleDesignCell(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'toggle-design-cell' }>,
  deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void deps.now;

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
    deps.rng,
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
  _deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void _deps;

  if (state.mode !== 'design') {
    return Result.ok(state);
  }
  if (!BuilderState.isBlank(state)) {
    return Result.ok(state);
  }

  const newGrid = GridOps.blank(intent.size);
  const newPuzzle = Puzzle.withGrid(state.puzzle, newGrid);

  return Result.ok({
    ...state,
    puzzle: newPuzzle,
    subMode: { kind: 'none' },
    cursor: null,
  });
}

export function handleRequestSwitchToDesign(
  state: BuilderState,
  _intent: Extract<BuilderIntent, { kind: 'request-switch-to-design' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void _intent;
  void _deps;

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
  _intent: Extract<BuilderIntent, { kind: 'confirm-switch-to-design' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void _intent;
  void _deps;

  return Result.ok({
    ...state,
    mode: 'design',
    subMode: { kind: 'none' },
    cursor: null,
  });
}
