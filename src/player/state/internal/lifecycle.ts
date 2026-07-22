import { PlayerState } from '../state';
import type { PlayerIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import { Result } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import { parsePuzzleV1 } from '../../../domain/format/v1';
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';

const INCOMPLETE_REJECT_MSG = 'Only complete puzzle files can be loaded into the Player.';

export function handleImportPuzzle(
  _state: PlayerState,
  intent: Extract<PlayerIntent, { kind: 'import-puzzle' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  void _state;
  void _deps;

  const result = parsePuzzleV1(intent.fileContent);
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
  _deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  void _deps;

  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  if (intent.savedGridSize !== state.puzzle.gridSize) {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  let newGrid = g;
  const rowsLen = Math.min(intent.playerLetters.length, g.length);
  for (let r = 0; r < rowsLen; r++) {
    const savedRow = intent.playerLetters[r]!;
    const rowLen = Math.min(savedRow.length, g[r]!.length);
    for (let c = 0; c < rowLen; c++) {
      const saved = savedRow[c];
      if (saved == null) continue;

      const cell = GridOps.cellAt(newGrid, Row.of(r), Col.of(c));
      if (cell.black) continue;

      newGrid = GridOps.setCell(newGrid, Row.of(r), Col.of(c), Cell.setPlayerLetter(cell, saved));
    }
  }

  if (newGrid === g) {
    return Result.ok(state);
  }

  return Result.ok({ ...state, puzzle: Puzzle.withGrid(state.puzzle, newGrid) });
}

export function handleImportNewPuzzle(
  _state: PlayerState,
  _intent: Extract<PlayerIntent, { kind: 'import-new-puzzle' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  void _state;
  void _intent;
  void _deps;

  return Result.ok(PlayerState.importScreen());
}

export function handleRequestResetPlayer(
  state: PlayerState,
  _intent: Extract<PlayerIntent, { kind: 'request-reset-player' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  void _intent;
  void _deps;

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
  _intent: Extract<PlayerIntent, { kind: 'confirm-reset-player' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  void _intent;
  void _deps;

  if (state.phase !== 'solving') {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  let newGrid = g;
  for (let r = 0; r < g.length; r++) {
    for (let c = 0; c < g[r]!.length; c++) {
      const cell = GridOps.cellAt(newGrid, Row.of(r), Col.of(c));
      if (!cell.black && cell.playerLetter !== null) {
        newGrid = GridOps.setCell(
          newGrid,
          Row.of(r),
          Col.of(c),
          Cell.setPlayerLetter(cell, null),
        );
      }
    }
  }

  const newPuzzle = newGrid === g ? state.puzzle : Puzzle.withGrid(state.puzzle, newGrid);

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
