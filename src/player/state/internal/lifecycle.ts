import { PlayerState } from '../state';
import type { PlayerIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import { Result } from '../../../domain/notifications/Event';
import { parsePuzzle } from '../../../domain/format/v1';
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';

const INCOMPLETE_REJECT_MSG = 'Only complete puzzle files can be loaded into the Player.';
const IMPORT_READ_FAILURE_MSG = 'Could not read that file. Please try again.';
const PICK_FAILURE_MSG = 'Could not open or read that file. Please try again.';

export function handleImportPuzzle(
  intent: Extract<PlayerIntent, { kind: 'import-puzzle' }>,
): ReducerResult<PlayerState> {
  const result = parsePuzzle(intent.fileContent);
  if (!result.ok) {
    const message = result.failures.map((f) => f.message).join('\n');
    return Result.withEvents(
      { phase: 'import', lastImportError: message },
      [{ kind: 'toast', toastKind: 'error', message }],
    );
  }

  if (result.fileType !== 'complete') {
    return Result.withEvents(
      { phase: 'import', lastImportError: INCOMPLETE_REJECT_MSG },
      [{ kind: 'toast', toastKind: 'error', message: INCOMPLETE_REJECT_MSG }],
    );
  }

  const newState: PlayerState = {
    phase: 'solving',
    puzzle: result.puzzle,
    cursor: null,
    checkResult: null,
    anagram: null,
  };

  return Result.withEvents(newState, [
    { kind: 'load-player-progress', key: result.puzzle.key },
  ]);
}

export function handleApplyLoadedProgress(
  state: PlayerState,
  intent: Extract<PlayerIntent, { kind: 'apply-loaded-progress' }>,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  if (intent.savedGridSize !== state.puzzle.gridSize) {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  const size = g.length;
  const updates: { row: Row; col: Col; cell: Cell }[] = [];
  const rowsLen = Math.min(intent.playerLetters.length, size);
  for (let r = 0; r < rowsLen; r++) {
    const savedRow = intent.playerLetters[r];
    if (savedRow === undefined) continue;
    const rowLen = Math.min(savedRow.length, size);
    for (let c = 0; c < rowLen; c++) {
      const saved = savedRow[c];
      if (saved == null) continue;

      const cell = GridOps.cellAt(g, Row.of(r), Col.of(c));
      if (cell.black) continue;

      updates.push({ row: Row.of(r), col: Col.of(c), cell: Cell.setPlayerLetter(cell, saved) });
    }
  }

  if (updates.length === 0) {
    return Result.ok(state);
  }

  const newGrid = GridOps.updateCells(g, updates);
  return Result.ok({ ...state, puzzle: Puzzle.withGrid(state.puzzle, newGrid) });
}

export function handleImportNewPuzzle(): ReducerResult<PlayerState> {
  return Result.ok(PlayerState.importScreen());
}

export function handleReportImportReadFailure(): ReducerResult<PlayerState> {
  return Result.withEvents(
    { phase: 'import', lastImportError: IMPORT_READ_FAILURE_MSG },
    [{ kind: 'toast', toastKind: 'error', message: IMPORT_READ_FAILURE_MSG }],
  );
}

export function handleReportPickFailure(): ReducerResult<PlayerState> {
  return Result.withEvents(
    { phase: 'import', lastImportError: PICK_FAILURE_MSG },
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
    {
      kind: 'modal-request',
      modal: { kind: 'confirm-reset-player' },
      confirmIntent: { kind: 'confirm-reset-player' },
    },
  ]);
}

export function handleConfirmResetPlayer(
  state: PlayerState,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  const size = g.length;
  const updates: { row: Row; col: Col; cell: Cell }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = GridOps.cellAt(g, Row.of(r), Col.of(c));
      if (!cell.black && cell.playerLetter !== null) {
        updates.push({ row: Row.of(r), col: Col.of(c), cell: Cell.setPlayerLetter(cell, null) });
      }
    }
  }

  const newPuzzle =
    updates.length === 0 ? state.puzzle : Puzzle.withGrid(state.puzzle, GridOps.updateCells(g, updates));

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
