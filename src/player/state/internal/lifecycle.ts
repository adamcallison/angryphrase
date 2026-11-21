import { PlayerState } from '../state';
import type { PlayerIntentOf } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import { Result, confirmEvent } from '../../../domain/notifications/Event';
import { parsePuzzle } from '../../../domain/format/v1Json';
import { Grid } from '../../../domain/grid/Grid';
import { Cell } from '../../../domain/grid/Cell';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';

const INCOMPLETE_REJECT_MSG = 'Only complete puzzle files can be loaded into the Player.';
const IMPORT_READ_FAILURE_MSG = 'Could not read that file. Please try again.';
const PICK_FAILURE_MSG = 'Could not open or read that file. Please try again.';

export function handleImportPuzzle(
  intent: PlayerIntentOf<'import-puzzle'>,
): ReducerResult<PlayerState> {
  const result = parsePuzzle(intent.fileContent);
  if (!result.ok) {
    const errors = result.failures.map((f) => f.message);
    return Result.withEvents(
      { phase: 'import', lastImportErrors: errors },
      // Toast events carry a single string today; the joined payload is the
      // current truth until toasts move to reason codes in a later copy-home stage.
      [{ kind: 'toast', toastKind: 'error', message: errors.join('\n') }],
    );
  }

  if (result.fileType !== 'complete') {
    return Result.withEvents(
      { phase: 'import', lastImportErrors: [INCOMPLETE_REJECT_MSG] },
      [{ kind: 'toast', toastKind: 'error', message: INCOMPLETE_REJECT_MSG }],
    );
  }

  const newState: PlayerState = PlayerState.loaded(result.puzzle);

  return Result.withEvents(newState, [
    { kind: 'load-player-progress', key: result.puzzle.key },
  ]);
}

export function handleApplyLoadedProgress(
  state: PlayerState,
  intent: PlayerIntentOf<'apply-loaded-progress'>,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  if (intent.savedGridSize !== state.puzzle.gridSize) {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  const updates: { row: Row; col: Col; cell: Cell }[] = [];
  // The codec guarantees playerLetters is exactly savedGridSize × savedGridSize and
  // savedGridSize === state.puzzle.gridSize was checked above, so iterating the saved
  // array stays in bounds. An out-of-dimension array here is a bug: it fails loud via
  // Grid.cellAt's RangeError.
  for (const [r, savedRow] of intent.playerLetters.entries()) {
    for (const [c, saved] of savedRow.entries()) {
      if (saved == null) continue;

      const cell = Grid.cellAt(g, Row.of(r), Col.of(c));
      if (cell.black) continue;

      updates.push({ row: Row.of(r), col: Col.of(c), cell: Cell.setPlayerLetter(cell, saved) });
    }
  }

  if (updates.length === 0) {
    return Result.ok(state);
  }

  const newGrid = Grid.updateCells(g, updates);
  return Result.ok({ ...state, puzzle: Puzzle.withGrid(state.puzzle, newGrid) });
}

export function handleImportNewPuzzle(): ReducerResult<PlayerState> {
  return Result.ok(PlayerState.importScreen());
}

export function handleReportImportReadFailure(): ReducerResult<PlayerState> {
  return Result.withEvents(
    { phase: 'import', lastImportErrors: [IMPORT_READ_FAILURE_MSG] },
    [{ kind: 'toast', toastKind: 'error', message: IMPORT_READ_FAILURE_MSG }],
  );
}

export function handleReportPickFailure(): ReducerResult<PlayerState> {
  return Result.withEvents(
    { phase: 'import', lastImportErrors: [PICK_FAILURE_MSG] },
    [{ kind: 'toast', toastKind: 'error', message: PICK_FAILURE_MSG }],
  );
}

export function handleRequestResetPlayer(
  state: PlayerState,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  return Result.withEvents(state, [
    confirmEvent('confirm-reset-player', { target: 'player', kind: 'confirm-reset-player' }),
  ]);
}

export function handleConfirmResetPlayer(
  state: PlayerState,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  const updates: { row: Row; col: Col; cell: Cell }[] = [];
  for (const [r, row] of g.entries()) {
    for (const [c, cell] of row.entries()) {
      if (!cell.black && cell.playerLetter !== null) {
        updates.push({ row: Row.of(r), col: Col.of(c), cell: Cell.setPlayerLetter(cell, null) });
      }
    }
  }

  const newPuzzle =
    updates.length === 0 ? state.puzzle : Puzzle.withGrid(state.puzzle, Grid.updateCells(g, updates));

  return Result.withEvents(
    {
      ...state,
      puzzle: newPuzzle,
      cursor: null,
      checkResult: null,
      anagram: null,
    },
    [{ kind: 'clear-player-storage', key: state.puzzle.key }],
  );
}
