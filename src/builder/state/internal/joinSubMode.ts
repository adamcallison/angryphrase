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
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';
import type { CellMarker } from '../../../domain/grid/CellMarker';
import type { Grid } from '../../../domain/grid/Grid';
import type { Row } from '../../../domain/grid/Row';
import type { Col } from '../../../domain/grid/Col';

function sourceLastCell(source: Word): { row: Row; col: Col } {
  return Direction.advance(
    { row: source.key.startRow, col: source.key.startCol },
    source.key.direction,
    Number(source.length) - 1,
  );
}

function isBoundaryPairEmpty(marker: CellMarker, direction: Direction): boolean {
  return direction === 'across'
    ? !marker.spaceRight && !marker.hyphenRight
    : !marker.spaceBottom && !marker.hyphenBottom;
}

function materializeJoinMarker(grid: Grid, source: Word): Grid {
  const { row, col } = sourceLastCell(source);
  const cell = GridOps.cellAt(grid, row, col);
  if (!Cell.isWhite(cell)) return grid;
  if (!isBoundaryPairEmpty(cell.marker, source.key.direction)) return grid;
  const newMarker =
    source.key.direction === 'across'
      ? { ...cell.marker, spaceRight: true, hyphenRight: false }
      : { ...cell.marker, spaceBottom: true, hyphenBottom: false };
  return GridOps.setCell(grid, row, col, Cell.setMarker(cell, newMarker));
}

function clearBoundaryMarker(grid: Grid, source: Word): Grid {
  const { row, col } = sourceLastCell(source);
  const cell = GridOps.cellAt(grid, row, col);
  if (!Cell.isWhite(cell)) return grid;
  const newMarker =
    source.key.direction === 'across'
      ? { ...cell.marker, spaceRight: false, hyphenRight: false }
      : { ...cell.marker, spaceBottom: false, hyphenBottom: false };
  return GridOps.setCell(grid, row, col, Cell.setMarker(cell, newMarker));
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
  const newWords = state.puzzle.words.map(w => {
    if (WordKey.equals(w.key, intent.source)) return { ...w, nextWord: null };
    if (WordKey.equals(w.key, downstreamKey)) return { ...w, clue: '' };
    return w;
  });
  const newGrid = clearBoundaryMarker(state.puzzle.grid, source);

  return Result.ok({
    ...state,
    puzzle: Puzzle.withWords(Puzzle.withGrid(state.puzzle, newGrid), newWords),
  });
}

export function resolveJoin(
  state: BuilderState,
  sourceKey: WordKey,
  targetKey: WordKey,
  rng: Rng,
): ReducerResult<BuilderState> {
  if (WordKey.equals(sourceKey, targetKey)) {
    // FR-34: clicking the source again cancels the join.
    return Result.ok({ ...state, subMode: { kind: 'none' } });
  }

  const words = state.puzzle.words;
  const source = words.find(w => WordKey.equals(w.key, sourceKey));
  const target = words.find(w => WordKey.equals(w.key, targetKey));
  if (source === undefined || target === undefined) {
    return Result.ok(state); // defensive — both should exist
  }

  // FR-35(b): source must not already have a nextWord link.
  if (source.nextWord !== null) {
    return Result.withEvents(state, [{
      kind: 'toast',
      toastKind: 'error',
      message: 'Source already has a chain link.',
    }]);
  }

  // FR-35(c): target must not be pointed to by any other word.
  const targetAlreadyLinked = words.some(w =>
    w.nextWord !== null && WordKey.equals(w.nextWord, targetKey),
  );
  if (targetAlreadyLinked) {
    return Result.withEvents(state, [{
      kind: 'toast',
      toastKind: 'error',
      message: 'Target is already linked to by another word.',
    }]);
  }

  // FR-36: success. Set source.nextWord = target.key; if target had a non-empty clue, displace it.
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
