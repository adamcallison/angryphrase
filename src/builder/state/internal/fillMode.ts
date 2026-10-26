import type { BuilderState } from '../state';
import type { BuilderIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import { Result } from '../../../domain/notifications/Event';
import { Grid } from '../../../domain/grid/Grid';
import { Cell } from '../../../domain/grid/Cell';
import { CellMarker } from '../../../domain/grid/CellMarker';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { WordKey } from '../../../domain/word/WordKey';
import { ChainIndex } from '../../../domain/chain/ChainIndex';
import { GridInteraction, type LetterSlot } from '../../../domain/grid/GridInteraction';
import { resolveJoin } from './joinSubMode';
import { resolveReattach } from './reattachSubMode';

const ANSWER_SLOT: LetterSlot = {
  read: (c) => c.answerLetter,
  set: Cell.setAnswerLetter,
};

export function handleSelectCell(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'select-cell' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const cursor = GridInteraction.select(state.puzzle.grid, state.cursor, intent.row, intent.col);
  return cursor === null ? Result.ok(state) : Result.ok({ ...state, cursor });
}

export function handleMoveCursor(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'move-cursor' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const cursor = GridInteraction.move(
    state.puzzle.grid,
    state.cursor,
    intent.direction,
    intent.sign,
  );
  return cursor === null ? Result.ok(state) : Result.ok({ ...state, cursor });
}

export function handleTypeLetter(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'type-letter' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const out = GridInteraction.typeLetter(
    state.puzzle.grid,
    state.cursor,
    intent.letter,
    ANSWER_SLOT,
  );
  return out === null
    ? Result.ok(state)
    : Result.ok({
        ...state,
        puzzle: Puzzle.withGrid(state.puzzle, out.grid),
        cursor: out.cursor,
      });
}

export function handleBackspace(state: BuilderState): ReducerResult<BuilderState> {
  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const out = GridInteraction.backspace(state.puzzle.grid, state.cursor, ANSWER_SLOT);
  return out === null
    ? Result.ok(state)
    : Result.ok({
        ...state,
        puzzle: Puzzle.withGrid(state.puzzle, out.grid),
        cursor: out.cursor,
      });
}

export function handleSetMarker(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'set-marker' }>,
): ReducerResult<BuilderState> {
  if (state.mode !== 'fill' || state.cursor === null) {
    return Result.ok(state);
  }

  const g = state.puzzle.grid;
  const c = Grid.cellAt(g, state.cursor.row, state.cursor.col);
  if (c.black) {
    return Result.ok(state);
  }

  const newMarker = CellMarker.write(c.marker, intent.axis, intent.separator);
  const newCell = Cell.setMarker(c, newMarker);
  const newGrid = Grid.setCell(g, state.cursor.row, state.cursor.col, newCell);
  const newPuzzle = Puzzle.withGrid(state.puzzle, newGrid);

  return Result.ok({ ...state, puzzle: newPuzzle });
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

  const index = ChainIndex.build(words);
  if (!index.isHead(intent.wordKey)) {
    return Result.withEvents(state, [
      {
        kind: 'toast',
        toastKind: 'error',
        message: 'Cannot edit clue of a non-head chain word.',
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
  const target = words.find(w => WordKey.equals(w.key, intent.wordKey));
  if (target === undefined) {
    return Result.ok(state);
  }

  if (state.subMode.kind === 'none') {
    // Navigate the cursor to the word's start cell and set its direction.
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
