import type { BuilderState } from '../state';
import type { BuilderIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import type { Word } from '../../../domain/word/Word';
import { Result } from '../../../domain/notifications/Event';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { WordKey } from '../../../domain/word/WordKey';
import { DisplacedClue } from '../../../domain/builder/DisplacedClue';
import { Direction } from '../../../domain/word/Direction';
import { Grid } from '../../../domain/grid/Grid';
import { Cell } from '../../../domain/grid/Cell';
import { CellMarker } from '../../../domain/grid/CellMarker';
import type { CellMarkerAxis } from '../../../domain/grid/CellMarker';
import { ChainAdmission } from '../../../domain/chain/ChainAdmission';
import type { Row } from '../../../domain/grid/Row';
import type { Col } from '../../../domain/grid/Col';

function sourceLastCell(source: Word): { row: Row; col: Col } {
  return Direction.advance(
    { row: source.key.startRow, col: source.key.startCol },
    source.key.direction,
    Number(source.length) - 1,
  );
}

function directionAxis(direction: Direction): CellMarkerAxis {
  return direction === 'across' ? 'right' : 'bottom';
}

function isBoundaryPairEmpty(marker: CellMarker, direction: Direction): boolean {
  return CellMarker.isEmpty(marker, directionAxis(direction));
}

function materializeJoinMarker(grid: Grid, source: Word): Grid {
  const { row, col } = sourceLastCell(source);
  const cell = Grid.cellAt(grid, row, col);
  if (!Cell.isWhite(cell)) return grid;
  if (!isBoundaryPairEmpty(cell.marker, source.key.direction)) return grid;
  const newMarker = CellMarker.write(cell.marker, directionAxis(source.key.direction), 'space');
  return Grid.setCell(grid, row, col, Cell.setMarker(cell, newMarker));
}

function clearBoundaryMarker(grid: Grid, source: Word): Grid {
  const { row, col } = sourceLastCell(source);
  const cell = Grid.cellAt(grid, row, col);
  if (!Cell.isWhite(cell)) return grid;
  const newMarker = CellMarker.write(cell.marker, directionAxis(source.key.direction), 'none');
  return Grid.setCell(grid, row, col, Cell.setMarker(cell, newMarker));
}

export function handleBeginJoin(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'begin-join' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const source = state.puzzle.words.find(w => WordKey.equals(w.key, intent.source));
  if (source === undefined) {
    return Result.ok(state);
  }

  if (source.nextWord !== null) {
    return Result.ok(state);
  }

  return Result.ok({
    ...state,
    subMode: { kind: 'join', source: intent.source },
  });
}

export function handleUnjoin(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'unjoin' }>,
  rng: Rng,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const sourceIdx = state.puzzle.words.findIndex(w => WordKey.equals(w.key, intent.source));
  if (sourceIdx === -1) {
    return Result.ok(state);
  }
  const source = state.puzzle.words[sourceIdx];
  if (source === undefined) return Result.ok(state);
  if (source.nextWord === null) {
    return Result.ok(state);
  }

  const downstreamKey = source.nextWord;
  const downstream = state.puzzle.words.find(w => WordKey.equals(w.key, downstreamKey));
  const newDisplacedClues = downstream !== undefined && downstream.clue !== ''
    ? [...state.displacedClues, DisplacedClue.create(rng, downstream.clue, downstream.key.direction)]
    : state.displacedClues;
  const newWords = state.puzzle.words.map(w => {
    if (WordKey.equals(w.key, intent.source)) return { ...w, nextWord: null };
    if (WordKey.equals(w.key, downstreamKey)) return { ...w, clue: '' };
    return w;
  });
  const newGrid = clearBoundaryMarker(state.puzzle.grid, source);

  return Result.ok({
    ...state,
    puzzle: Puzzle.withWords(Puzzle.withGrid(state.puzzle, newGrid), newWords),
    displacedClues: newDisplacedClues,
  });
}

export function resolveJoin(
  state: BuilderState,
  sourceKey: WordKey,
  targetKey: WordKey,
  rng: Rng,
): ReducerResult<BuilderState> {
  if (WordKey.equals(sourceKey, targetKey)) {
    // Clicking the source again cancels the join.
    return Result.ok({ ...state, subMode: { kind: 'none' } });
  }

  const words = state.puzzle.words;
  const admission = ChainAdmission.canLink(words, sourceKey, targetKey);
  if (!admission.ok) {
    if (admission.reason === 'source-not-found' || admission.reason === 'target-not-found') {
      return Result.ok(state); // defensive — stale UI dispatch
    }
    return Result.withEvents(state, [{
      kind: 'toast',
      toastKind: 'error',
      message: ChainAdmission.message(admission),
    }]);
  }

  // Success. Set source.nextWord = target.key; if target had a non-empty clue, displace it.
  const source = words.find(w => WordKey.equals(w.key, sourceKey));
  const target = words.find(w => WordKey.equals(w.key, targetKey));
  if (source === undefined || target === undefined) {
    return Result.ok(state); // defensive — admission mismatch
  }
  const newDisplacedClues = target.clue !== ''
    ? [...state.displacedClues, DisplacedClue.create(rng, target.clue, target.key.direction)]
    : state.displacedClues;
  const newWords = words.map(w => {
    if (WordKey.equals(w.key, sourceKey)) return { ...w, nextWord: targetKey };
    if (WordKey.equals(w.key, targetKey)) return { ...w, clue: '' };
    return w;
  });
  const newGrid = materializeJoinMarker(state.puzzle.grid, source);

  return Result.ok({
    ...state,
    puzzle: Puzzle.withWords(Puzzle.withGrid(state.puzzle, newGrid), newWords),
    displacedClues: newDisplacedClues,
    subMode: { kind: 'none' },
  });
}
