import { describe, it, expect } from 'vitest';
import {
  handleSelectCell,
  handleMoveCursor,
  handleTypeLetter,
  handleBackspace,
  handleToggleMarker,
  handleEditClue,
  handleClickWord,
} from './fillMode';
import { BuilderState, type Cursor } from '../state';
import type { BuilderIntent } from '../intents';
import { GridSize } from '../../../domain/grid/GridSize';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { PuzzleKey } from '../../../domain/puzzle/PuzzleKey';
import { SeededRng } from '../../../../test/fakes/SeededRng';
import type { Direction } from '../../../domain/word/Direction';
import { Letter } from '../../../domain/letter/Letter';
import { CellMarker } from '../../../domain/grid/CellMarker';
import { WordKey } from '../../../domain/word/WordKey';
import { WordDerivation } from '../../../domain/word/WordDerivation';
import { Numbering } from '../../../domain/word/Numbering';
import { DisplacedClue } from '../../../domain/builder/DisplacedClue';

const deps = { rng: new SeededRng(1), now: () => 0 };

function makeState(
  size: number,
  blackCells: [number, number][],
  cursor: { row: number; col: number; direction: Direction } | null = null,
  mode: 'design' | 'fill' = 'fill',
  letters: [number, number, string][] = [],
  markers: [number, number, CellMarker][] = [],
): BuilderState {
  const gridSize = GridSize.of(size);
  const base = BuilderState.blank(gridSize, PuzzleKey.generate(new SeededRng(1)));
  let grid = base.puzzle.grid;
  for (const [r, c] of blackCells) {
    grid = GridOps.setCell(grid, Row.of(r), Col.of(c), Cell.black());
  }
  for (const [r, c, letter] of letters) {
    const l = Letter.try(letter);
    if (l === null) continue;
    const cell = GridOps.cellAt(grid, Row.of(r), Col.of(c));
    if (cell.black) continue;
    grid = GridOps.setCell(grid, Row.of(r), Col.of(c), Cell.setAnswerLetter(cell, l));
  }
  for (const [r, c, marker] of markers) {
    const cell = GridOps.cellAt(grid, Row.of(r), Col.of(c));
    if (cell.black) continue;
    grid = GridOps.setCell(grid, Row.of(r), Col.of(c), Cell.setMarker(cell, marker));
  }
  const builtCursor: Cursor = cursor
    ? {
        row: Row.of(cursor.row),
        col: Col.of(cursor.col),
        direction: cursor.direction,
      }
    : null;
    return {
      ...base,
      mode,
      cursor: builtCursor,
      puzzle: Puzzle.withGrid(base.puzzle, grid),
    };
  }

  function makeStateWithWords(
    size: number,
    blackCells: [number, number][],
    mode: 'design' | 'fill' = 'fill',
  ): BuilderState {
    const base = makeState(size, blackCells, null, mode);
    const derived = WordDerivation.derive(base.puzzle.grid);
    const words = Numbering.assign(base.puzzle.grid, derived);
    return {
      ...base,
      puzzle: Puzzle.withWords(base.puzzle, words),
    };
  }

  function withChain(state: BuilderState, headIndex: number, targetIndex: number): BuilderState {
    const words = state.puzzle.words;
    const targetKey = words[targetIndex]!.key;
    const newWords = words.map((w, i) => (i === headIndex ? { ...w, nextWord: targetKey } : w));
    return { ...state, puzzle: Puzzle.withWords(state.puzzle, newWords) };
  }

  describe('handleSelectCell', () => {
  it('select-cell: no-op in design mode', () => {
    const state = makeState(5, [], null, 'design');
    const intent: BuilderIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('select-cell: no-op on out-of-bounds coords', () => {
    const state = makeState(5, []);
    const intent: BuilderIntent = { kind: 'select-cell', row: Row.of(999), col: Col.of(0) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('select-cell: no-op on black cell (FR-9)', () => {
    const state = makeState(5, [[0, 0]]);
    const intent: BuilderIntent = { kind: 'select-cell', row: Row.of(0), col: Col.of(0) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('select-cell: on selectable cell that is part of only an across word → direction across', () => {
    // 5x5 grid; black cells above and below (2,2) leave a horizontal-only run.
    const state = makeState(5, [
      [1, 2],
      [3, 2],
    ]);
    const intent: BuilderIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('select-cell: on selectable cell that is part of only a down word → direction down', () => {
    // 5x5 grid; black cells to the left and right of (2,2) leave a vertical-only run.
    const state = makeState(5, [
      [2, 1],
      [2, 3],
    ]);
    const intent: BuilderIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'down',
    });
    expect(result.events).toEqual([]);
  });

  it('select-cell: on selectable cell part of both → direction defaults across (FR-10)', () => {
    const state = makeState(5, []);
    const intent: BuilderIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('select-cell: clicking already-selected cell that is in both words → toggles direction (FR-11)', () => {
    const state = makeState(5, [], { row: 2, col: 2, direction: 'across' });
    const intent: BuilderIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'down',
    });
    expect(result.events).toEqual([]);
  });

  it('select-cell: clicking already-selected cell that is in only one word → cursor unchanged (FR-11)', () => {
    const state = makeState(
      5,
      [
        [1, 2],
        [3, 2],
      ],
      { row: 2, col: 2, direction: 'across' },
    );
    const intent: BuilderIntent = { kind: 'select-cell', row: Row.of(2), col: Col.of(2) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.state.cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('select-cell: clicking a different already-selectable cell replaces cursor with new cell + computed direction', () => {
    const state = makeState(5, [], { row: 2, col: 2, direction: 'across' });
    const intent: BuilderIntent = { kind: 'select-cell', row: Row.of(3), col: Col.of(3) };

    const result = handleSelectCell(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(3),
      col: Col.of(3),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });
});

describe('handleMoveCursor', () => {
  it('move-cursor: no-op in design mode', () => {
    const state = makeState(5, [], { row: 2, col: 2, direction: 'across' }, 'design');
    const intent: BuilderIntent = { kind: 'move-cursor', direction: 'down' };

    const result = handleMoveCursor(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('move-cursor: no-op when cursor is null', () => {
    const state = makeState(5, []);
    const intent: BuilderIntent = { kind: 'move-cursor', direction: 'across' };

    const result = handleMoveCursor(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('move-cursor: target selectable → moves cursor to target and updates direction', () => {
    const state = makeState(5, [], { row: 2, col: 2, direction: 'down' });
    const intent: BuilderIntent = { kind: 'move-cursor', direction: 'across' };

    const result = handleMoveCursor(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(2),
      col: Col.of(3),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor: target not selectable (next cell is black) → cursor stays, direction updates (FR-14)', () => {
    const state = makeState(5, [[2, 3]], { row: 2, col: 2, direction: 'down' });
    const intent: BuilderIntent = { kind: 'move-cursor', direction: 'across' };

    const result = handleMoveCursor(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor: target at grid boundary → cursor stays, direction updates', () => {
    const state = makeState(5, [], { row: 2, col: 4, direction: 'down' });
    const intent: BuilderIntent = { kind: 'move-cursor', direction: 'across' };

    const result = handleMoveCursor(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(2),
      col: Col.of(4),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });
});

describe('handleTypeLetter', () => {
  it('type-letter: no-op in design mode', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' }, 'design');
    const intent: BuilderIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('type-letter: no-op when cursor is null', () => {
    const state = makeState(5, []);
    const intent: BuilderIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('type-letter: writes letter to selected cell answerLetter (FR-12)', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' });
    const intent: BuilderIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toEqual(
      Letter.try('A'),
    );
    expect(result.state.cursor).toEqual({
      row: Row.of(0),
      col: Col.of(1),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('type-letter: overwrites existing letter (FR-12)', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' }, 'fill', [
      [0, 0, 'B'],
    ]);
    const intent: BuilderIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toEqual(
      Letter.try('A'),
    );
  });

  it('type-letter: advances cursor to next selectable cell in current direction (FR-12)', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' });
    const intent: BuilderIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(0),
      col: Col.of(1),
      direction: 'across',
    });
  });

  it('type-letter: stays on current cell when next cell is black (FR-12)', () => {
    const state = makeState(5, [[0, 1]], { row: 0, col: 0, direction: 'across' });
    const intent: BuilderIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('type-letter: stays on current cell when at grid boundary (FR-12)', () => {
    const state = makeState(5, [], { row: 0, col: 4, direction: 'across' });
    const intent: BuilderIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(0),
      col: Col.of(4),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('type-letter: letter still written when cursor stays (FR-12)', () => {
    const state = makeState(5, [], { row: 0, col: 4, direction: 'across' });
    const intent: BuilderIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(4)).answerLetter).toEqual(
      Letter.try('A'),
    );
  });

  it('type-letter: direction "down" advances +1 row', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'down' });
    const intent: BuilderIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(1),
      col: Col.of(0),
      direction: 'down',
    });
  });

  it('type-letter: no-op on black cursor cell (defensive)', () => {
    const state = makeState(5, [[0, 0]], { row: 0, col: 0, direction: 'across' });
    const intent: BuilderIntent = { kind: 'type-letter', letter: Letter.try('A')! };

    const result = handleTypeLetter(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });
});

describe('handleBackspace', () => {
  it('backspace: no-op in design mode', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' }, 'design', [
      [0, 0, 'A'],
    ]);
    const intent: BuilderIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('backspace: no-op when cursor is null', () => {
    const state = makeState(5, [], null, 'fill', [[0, 0, 'A']]);
    const intent: BuilderIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('backspace: deletes letter and keeps cursor when current cell has a letter (FR-13)', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' }, 'fill', [
      [0, 0, 'A'],
    ]);
    const intent: BuilderIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toBeNull();
    expect(result.state.cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('backspace: when current cell empty, retreats and deletes previous cell letter (FR-13)', () => {
    const state = makeState(5, [], { row: 0, col: 1, direction: 'across' }, 'fill', [
      [0, 0, 'A'],
    ]);
    const intent: BuilderIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toBeNull();
    expect(result.state.cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('backspace: when current cell empty and previous is at grid start, stays and nothing deleted (FR-13)', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' });
    const intent: BuilderIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('backspace: when current cell empty and previous is black, stays and nothing deleted (FR-13)', () => {
    const state = makeState(5, [[0, 0]], { row: 0, col: 1, direction: 'across' });
    const intent: BuilderIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('backspace: direction "down" retreats -1 row', () => {
    const state = makeState(5, [], { row: 1, col: 0, direction: 'down' }, 'fill', [
      [0, 0, 'A'],
    ]);
    const intent: BuilderIntent = { kind: 'backspace' };

    const result = handleBackspace(state, intent, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toBeNull();
    expect(result.state.cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'down',
    });
  });
});

describe('handleToggleMarker', () => {
  it('toggle-marker: no-op in design mode', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' }, 'design');
    const intent: BuilderIntent = { kind: 'toggle-marker', flag: 'space-right' };

    const result = handleToggleMarker(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('toggle-marker: no-op when cursor is null', () => {
    const state = makeState(5, []);
    const intent: BuilderIntent = { kind: 'toggle-marker', flag: 'space-right' };

    const result = handleToggleMarker(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('toggle-marker: no-op on black cursor cell (defensive)', () => {
    const state = makeState(5, [[0, 0]], { row: 0, col: 0, direction: 'across' });
    const intent: BuilderIntent = { kind: 'toggle-marker', flag: 'space-right' };

    const result = handleToggleMarker(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('toggle-marker: toggles a virgin marker flag to true (space-right)', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' });
    const intent: BuilderIntent = { kind: 'toggle-marker', flag: 'space-right' };

    const result = handleToggleMarker(state, intent, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).marker.spaceRight).toBe(
      true,
    );
    expect(result.events).toEqual([]);
  });

  it('toggle-marker: toggles an existing flag back to false', () => {
    const marker = CellMarker.toggle(CellMarker.EMPTY, 'space-right');
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' }, 'fill', [], [
      [0, 0, marker],
    ]);
    const intent: BuilderIntent = { kind: 'toggle-marker', flag: 'space-right' };

    const result = handleToggleMarker(state, intent, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).marker.spaceRight).toBe(
      false,
    );
    expect(result.events).toEqual([]);
  });

  it('toggle-marker: FR-27 mutual exclusion — toggling space-right on turns hyphen-right off', () => {
    const marker = CellMarker.toggle(CellMarker.EMPTY, 'hyphen-right');
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' }, 'fill', [], [
      [0, 0, marker],
    ]);
    const intent: BuilderIntent = { kind: 'toggle-marker', flag: 'space-right' };

    const result = handleToggleMarker(state, intent, deps);
    const newMarker = GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).marker;

    expect(newMarker.spaceRight).toBe(true);
    expect(newMarker.hyphenRight).toBe(false);
  });

  it('toggle-marker: FR-27 mutual exclusion — toggling hyphen-right on turns space-right off', () => {
    const marker = CellMarker.toggle(CellMarker.EMPTY, 'space-right');
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' }, 'fill', [], [
      [0, 0, marker],
    ]);
    const intent: BuilderIntent = { kind: 'toggle-marker', flag: 'hyphen-right' };

    const result = handleToggleMarker(state, intent, deps);
    const newMarker = GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).marker;

    expect(newMarker.hyphenRight).toBe(true);
    expect(newMarker.spaceRight).toBe(false);
  });

  it('toggle-marker: FR-27 mutual exclusion — space-bottom and hyphen-bottom pair', () => {
    const marker = CellMarker.toggle(CellMarker.EMPTY, 'space-bottom');
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' }, 'fill', [], [
      [0, 0, marker],
    ]);
    const intent: BuilderIntent = { kind: 'toggle-marker', flag: 'hyphen-bottom' };

    const result = handleToggleMarker(state, intent, deps);
    const newMarker = GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).marker;

    expect(newMarker.hyphenBottom).toBe(true);
    expect(newMarker.spaceBottom).toBe(false);
  });

  it('toggle-marker: left/right independent of top/bottom (toggling space-right does not affect bottom flags)', () => {
    const marker = CellMarker.toggle(CellMarker.EMPTY, 'space-bottom');
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' }, 'fill', [], [
      [0, 0, marker],
    ]);
    const intent: BuilderIntent = { kind: 'toggle-marker', flag: 'space-right' };

    const result = handleToggleMarker(state, intent, deps);
    const newMarker = GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).marker;

    expect(newMarker.spaceRight).toBe(true);
    expect(newMarker.spaceBottom).toBe(true);
    expect(newMarker.hyphenRight).toBe(false);
    expect(newMarker.hyphenBottom).toBe(false);
  });

  it('toggle-marker: updates puzzle.grid via Puzzle.withGrid', () => {
    const state = makeState(5, [], { row: 0, col: 0, direction: 'across' });
    const intent: BuilderIntent = { kind: 'toggle-marker', flag: 'space-right' };

    const result = handleToggleMarker(state, intent, deps);

    expect(result.state.puzzle.grid).not.toBe(state.puzzle.grid);
    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).marker.spaceRight).toBe(
      true,
    );
  });
});

describe('handleEditClue', () => {
  it('edit-clue: no-op in design mode', () => {
    const state = makeStateWithWords(4, [], 'design');
    const wordKey = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'edit-clue', wordKey, clue: 'New clue' };

    const result = handleEditClue(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('edit-clue: no-op when wordKey not found (defensive)', () => {
    const state = makeStateWithWords(4, []);
    const wordKey: WordKey = {
      startRow: Row.of(999),
      startCol: Col.of(999),
      direction: 'across',
    };
    const intent: BuilderIntent = { kind: 'edit-clue', wordKey, clue: 'New clue' };

    const result = handleEditClue(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('edit-clue: updates clue of a head word (no chain)', () => {
    const state = makeStateWithWords(4, []);
    const wordKey = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'edit-clue', wordKey, clue: 'A fine clue' };

    const result = handleEditClue(state, intent, deps);

    const updated = result.state.puzzle.words.find(w => WordKey.equals(w.key, wordKey));
    expect(updated).toBeDefined();
    expect(updated!.clue).toBe('A fine clue');
    expect(result.events).toEqual([]);
  });

  it('edit-clue: updates clue of a chain head word', () => {
    const state = withChain(makeStateWithWords(4, []), 0, 1);
    const headKey = state.puzzle.words[0]!.key;
    const targetKey = state.puzzle.words[1]!.key;
    const intent: BuilderIntent = { kind: 'edit-clue', wordKey: headKey, clue: 'Head clue' };

    const result = handleEditClue(state, intent, deps);

    const head = result.state.puzzle.words.find(w => WordKey.equals(w.key, headKey));
    const target = result.state.puzzle.words.find(w => WordKey.equals(w.key, targetKey));
    expect(head!.clue).toBe('Head clue');
    expect(target!.clue).toBe('');
    expect(result.events).toEqual([]);
  });

  it('edit-clue: rejects edit on non-head chain word with error toast (FR-31)', () => {
    const state = withChain(makeStateWithWords(4, []), 0, 1);
    const targetKey = state.puzzle.words[1]!.key;
    const intent: BuilderIntent = { kind: 'edit-clue', wordKey: targetKey, clue: 'Bad clue' };

    const result = handleEditClue(state, intent, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([
      {
        kind: 'toast',
        toastKind: 'error',
        message: 'Cannot edit clue of a non-head chain word (FR-31).',
      },
    ]);
  });

  it('edit-clue: empty string clue allowed for head word', () => {
    const state = makeStateWithWords(4, []);
    const wordKey = state.puzzle.words[0]!.key;
    const words = state.puzzle.words.map(w =>
      WordKey.equals(w.key, wordKey) ? { ...w, clue: 'Prior' } : w,
    );
    const stateWithClue = { ...state, puzzle: Puzzle.withWords(state.puzzle, words) };
    const intent: BuilderIntent = { kind: 'edit-clue', wordKey, clue: '' };

    const result = handleEditClue(stateWithClue, intent, deps);

    const updated = result.state.puzzle.words.find(w => WordKey.equals(w.key, wordKey));
    expect(updated!.clue).toBe('');
    expect(result.events).toEqual([]);
  });

  it('edit-clue: free-form clue preserved verbatim (whitespace, punctuation)', () => {
    const state = makeStateWithWords(4, []);
    const wordKey = state.puzzle.words[0]!.key;
    const clue = '  spaces & punct!  ';
    const intent: BuilderIntent = { kind: 'edit-clue', wordKey, clue };

    const result = handleEditClue(state, intent, deps);

    const updated = result.state.puzzle.words.find(w => WordKey.equals(w.key, wordKey));
    expect(updated!.clue).toBe('  spaces & punct!  ');
    expect(result.events).toEqual([]);
  });

  it('edit-clue: preserves puzzle.key and other words unchanged', () => {
    const state = makeStateWithWords(4, []);
    const wordKey = state.puzzle.words[0]!.key;
    const otherKey = state.puzzle.words[1]!.key;
    const words = state.puzzle.words.map(w =>
      WordKey.equals(w.key, otherKey) ? { ...w, clue: 'Original other' } : w,
    );
    const stateWithOtherClue = { ...state, puzzle: Puzzle.withWords(state.puzzle, words) };
    const intent: BuilderIntent = { kind: 'edit-clue', wordKey, clue: 'Updated clue' };

    const result = handleEditClue(stateWithOtherClue, intent, deps);

    expect(result.state.puzzle.key).toBe(stateWithOtherClue.puzzle.key);
    const other = result.state.puzzle.words.find(w => WordKey.equals(w.key, otherKey));
    expect(other!.clue).toBe('Original other');
    expect(result.state.puzzle.words).not.toBe(stateWithOtherClue.puzzle.words);
    expect(result.events).toEqual([]);
  });
});

describe('handleClickWord', () => {
  it('click-word: no-op in design mode', () => {
    const state = makeStateWithWords(4, [], 'design');
    const wordKey = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'click-clue-panel-word', wordKey };

    const result = handleClickWord(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('click-word: no-op when target wordKey not found (defensive)', () => {
    const state = makeStateWithWords(4, []);
    const wordKey: WordKey = {
      startRow: Row.of(999),
      startCol: Col.of(999),
      direction: 'across',
    };
    const intent: BuilderIntent = { kind: 'click-clue-panel-word', wordKey };

    const result = handleClickWord(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('click-word: subMode=none navigates cursor to start cell + direction', () => {
    const state = makeStateWithWords(4, []);
    const wordKey = state.puzzle.words[1]!.key;
    const intent: BuilderIntent = { kind: 'click-clue-panel-word', wordKey };

    const result = handleClickWord(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: wordKey.startRow,
      col: wordKey.startCol,
      direction: wordKey.direction,
    });
    expect(result.events).toEqual([]);
  });

  it('click-word: subMode=join delegates to resolveJoin', () => {
    const state = makeStateWithWords(4, []);
    const source = state.puzzle.words[0]!.key;
    const target = state.puzzle.words[1]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };
    const intent: BuilderIntent = { kind: 'click-grid-word', wordKey: target };

    const result = handleClickWord(stateWithJoin, intent, deps);

    const sourceAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, source));
    expect(sourceAfter!.nextWord).toEqual(target);
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.events).toEqual([]);
  });

  it('click-word: subMode=reattach delegates to resolveReattach', () => {
    const clue = DisplacedClue.create(deps.rng, 'reattached clue', 'across');
    const state = {
      ...makeStateWithWords(4, []),
      displacedClues: [clue],
      subMode: { kind: 'reattach' as const, displacedClueId: clue.id },
    };
    const target = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'click-clue-panel-word', wordKey: target };

    const result = handleClickWord(state, intent, deps);

    const targetAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, target));
    expect(targetAfter!.clue).toBe('reattached clue');
    expect(result.state.displacedClues).toEqual([]);
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.events).toEqual([]);
  });

  it('click-word: subMode=join, source === target triggers join cancel (FR-34) — subMode becomes none', () => {
    const state = makeStateWithWords(4, []);
    const source = state.puzzle.words[0]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };
    const intent: BuilderIntent = { kind: 'click-grid-word', wordKey: source };

    const result = handleClickWord(stateWithJoin, intent, deps);

    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.puzzle).toBe(stateWithJoin.puzzle);
    expect(result.events).toEqual([]);
  });
});
