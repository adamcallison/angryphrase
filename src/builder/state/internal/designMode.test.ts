import { describe, it, expect } from 'vitest';
import { handleChangeGridSize, handleConfirmSwitchToDesign, handleRequestSwitchToDesign, handleToggleDesignCell } from './designMode';
import { BuilderState } from '../state';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { PuzzleKey } from '../../../domain/puzzle/PuzzleKey';
import { GridSize } from '../../../domain/grid/GridSize';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';
import { CellMarker } from '../../../domain/grid/CellMarker';
import { WordDerivation } from '../../../domain/word/WordDerivation';
import { Numbering } from '../../../domain/word/Numbering';
import { Letter } from '../../../domain/letter/Letter';
import { WordKey } from '../../../domain/word/WordKey';
import { WordNumber } from '../../../domain/word/WordNumber';
import type { Word } from '../../../domain/word/Word';
import type { Grid } from '../../../domain/grid/Grid';
import { SeededRng } from '../../../../test/fakes/SeededRng';
import { FakeClock } from '../../../../test/fakes/FakeClock';

const rng = new SeededRng(42);
const clock = new FakeClock(1000);
const deps = { rng, now: clock.now.bind(clock) };

function blankState() {
  return BuilderState.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(1)));
}

function key(row: number, col: number, direction: 'across' | 'down') {
  return { startRow: Row.of(row), startCol: Col.of(col), direction };
}

function word(
  row: number,
  col: number,
  direction: 'across' | 'down',
  number: number,
  length: number,
  clue: string,
  nextWord: ReturnType<typeof key> | null = null,
): Word {
  return {
    key: key(row, col, direction),
    number: WordNumber.of(number),
    length,
    clue,
    nextWord,
  };
}

function gridWithBlacks(grid: Grid, cells: [number, number][]): Grid {
  let g = grid;
  for (const [row, col] of cells) {
    g = GridOps.setCell(g, Row.of(row), Col.of(col), Cell.black());
  }
  return g;
}

function designState(size: GridSize, blackCells: [number, number][], words: Word[] = []) {
  const grid = gridWithBlacks(GridOps.blank(size), blackCells);
  const puzzle = Puzzle.withWords(
    Puzzle.withGrid(Puzzle.blank(size, PuzzleKey.generate(new SeededRng(2))), grid),
    words,
  );
  return {
    puzzle,
    displacedClues: [],
    mode: 'design' as const,
    subMode: { kind: 'none' as const },
    cursor: null,
  };
}

describe('toggle-design-cell', () => {
  it('white cell becomes black', () => {
    const state = blankState();

    const result = handleToggleDesignCell(state, { kind: 'toggle-design-cell', row: Row.of(0), col: Col.of(0) }, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).black).toBe(true);
  });

  it('black cell becomes white', () => {
    const grid = GridOps.setCell(GridOps.blank(GridSize.DEFAULT), Row.of(0), Col.of(0), Cell.black());
    const state = { ...blankState(), puzzle: Puzzle.withGrid(blankState().puzzle, grid) };

    const result = handleToggleDesignCell(state, { kind: 'toggle-design-cell', row: Row.of(0), col: Col.of(0) }, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).black).toBe(false);
  });

  it('cursor is cleared (FR-21)', () => {
    const state = {
      ...blankState(),
      cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
    };

    const result = handleToggleDesignCell(state, { kind: 'toggle-design-cell', row: Row.of(0), col: Col.of(0) }, deps);

    expect(result.state.cursor).toBeNull();
  });

  it('triggers reconcile; puzzle.words reflect new grid geometry', () => {
    const state = designState(GridSize.of(3), [], [word(0, 0, 'across', 1, 2, '')]);
    // Force the grid to only have a length-2 across run at (0,0)-(0,1).
    const grid = gridWithBlacks(state.puzzle.grid, [
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ]);
    const before = { ...state, puzzle: Puzzle.withGrid(state.puzzle, grid) };
    const acrossKey = key(0, 0, 'across');

    const result = handleToggleDesignCell(before, { kind: 'toggle-design-cell', row: Row.of(0), col: Col.of(1) }, deps);

    expect(result.state.puzzle.words.find((w) => WordKey.toCanonical(w.key) === WordKey.toCanonical(acrossKey))).toBeUndefined();
  });

  it('destroyed word with clue populates displacedClues', () => {
    const state = designState(GridSize.of(3), [], [word(0, 0, 'across', 1, 2, 'My clue')]);
    const grid = gridWithBlacks(state.puzzle.grid, [
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ]);
    const before = { ...state, puzzle: Puzzle.withGrid(state.puzzle, grid) };

    const result = handleToggleDesignCell(before, { kind: 'toggle-design-cell', row: Row.of(0), col: Col.of(1) }, deps);

    expect(result.state.displacedClues).toHaveLength(1);
    expect(result.state.displacedClues[0]!.clue).toBe('My clue');
    expect(result.state.displacedClues[0]!.direction).toBe('across');
  });

  it('newly-appearing word has empty clue and no nextWord', () => {
    // (0,0) is white, (0,1) is black, (0,2) is black: no words initially.
    const state = designState(GridSize.of(3), [[0, 1], [0, 2]], []);

    const result = handleToggleDesignCell(state, { kind: 'toggle-design-cell', row: Row.of(0), col: Col.of(1) }, deps);

    const acrossKey = key(0, 0, 'across');
    const newWord = result.state.puzzle.words.find((w) => WordKey.toCanonical(w.key) === WordKey.toCanonical(acrossKey));
    expect(newWord).toBeDefined();
    expect(newWord!.clue).toBe('');
    expect(newWord!.nextWord).toBeNull();
  });

  it('forwards events from reconcileWords', () => {
    // Length-4 across word at (0,0)-(0,3); (0,4) is black to cap the run.
    const state = designState(GridSize.of(5), [[0, 4]], [word(0, 0, 'across', 1, 4, 'A clue')]);

    const result = handleToggleDesignCell(state, { kind: 'toggle-design-cell', row: Row.of(0), col: Col.of(3) }, deps);

    expect(result.events).toContainEqual({
      kind: 'toast',
      toastKind: 'info',
      message: 'Word 1 across was shortened.',
    });
  });

  it('no-op when state.mode is fill', () => {
    const state = { ...blankState(), mode: 'fill' as const };

    const result = handleToggleDesignCell(state, { kind: 'toggle-design-cell', row: Row.of(0), col: Col.of(0) }, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([]);
  });

  it('no-op when row/col out of bounds', () => {
    const state = blankState();

    const result = handleToggleDesignCell(
      state,
      { kind: 'toggle-design-cell', row: Row.of(Number(GridSize.DEFAULT)), col: Col.of(Number(GridSize.DEFAULT)) },
      deps,
    );

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([]);
  });

  it('toggled cell resets answerLetter and marker', () => {
    const letter = Letter.try('A')!;
    const marker = CellMarker.toggle(CellMarker.EMPTY, 'space-right');
    const whiteCell = Cell.setMarker(Cell.setAnswerLetter(Cell.white(), letter), marker);
    const grid = GridOps.setCell(GridOps.blank(GridSize.DEFAULT), Row.of(0), Col.of(0), whiteCell);
    const state = { ...blankState(), puzzle: Puzzle.withGrid(blankState().puzzle, grid) };

    const afterBlack = handleToggleDesignCell(state, { kind: 'toggle-design-cell', row: Row.of(0), col: Col.of(0) }, deps);
    const afterWhite = handleToggleDesignCell(
      afterBlack.state,
      { kind: 'toggle-design-cell', row: Row.of(0), col: Col.of(0) },
      deps,
    );

    const finalCell = GridOps.cellAt(afterWhite.state.puzzle.grid, Row.of(0), Col.of(0));
    expect(finalCell.black).toBe(false);
    expect(finalCell.answerLetter).toBeNull();
    expect(finalCell.marker).toEqual(CellMarker.EMPTY);
  });
});

describe('change-grid-size', () => {
  it('replaces blank grid with new size', () => {
    const key = PuzzleKey.generate(new SeededRng(1));
    const state = BuilderState.blank(GridSize.of(15), key);

    const result = handleChangeGridSize(state, { kind: 'change-grid-size', size: GridSize.of(20) }, deps);

    expect(Number(result.state.puzzle.grid.length)).toBe(20);
    expect(Number(result.state.puzzle.grid[0]!.length)).toBe(20);
    expect(result.events).toEqual([]);
  });

  it('when blank, all new cells are white and empty', () => {
    const state = BuilderState.blank(GridSize.of(15), PuzzleKey.generate(new SeededRng(1)));

    const result = handleChangeGridSize(state, { kind: 'change-grid-size', size: GridSize.of(20) }, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(5), Col.of(5))).toEqual(Cell.white());
  });

  it('clears cursor and resets subMode to none', () => {
    const state = {
      ...blankState(),
      subMode: {
        kind: 'join' as const,
        source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const },
      },
      cursor: { row: Row.of(2), col: Col.of(3), direction: 'across' as const },
    };

    const result = handleChangeGridSize(state, { kind: 'change-grid-size', size: GridSize.of(20) }, deps);

    expect(result.state.cursor).toBeNull();
    expect(result.state.subMode).toEqual({ kind: 'none' });
  });

  it('no-op when not blank (answerLetter present)', () => {
    const base = blankState();
    const grid = GridOps.setCell(
      base.puzzle.grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(Cell.white(), Letter.try('A')!),
    );
    const state = { ...base, puzzle: Puzzle.withGrid(base.puzzle, grid) };

    const result = handleChangeGridSize(state, { kind: 'change-grid-size', size: GridSize.of(20) }, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([]);
  });

  it('no-op when not blank (non-empty clue)', () => {
    const base = blankState();
    const state = {
      ...base,
      puzzle: Puzzle.withWords(base.puzzle, [word(0, 0, 'across', 1, 1, 'a')]),
    };

    const result = handleChangeGridSize(state, { kind: 'change-grid-size', size: GridSize.of(20) }, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([]);
  });

  it('no-op when not in design mode', () => {
    const state = { ...blankState(), mode: 'fill' as const };

    const result = handleChangeGridSize(state, { kind: 'change-grid-size', size: GridSize.of(20) }, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([]);
  });

  it('preserves puzzle.key', () => {
    const key = PuzzleKey.generate(new SeededRng(1));
    const state = BuilderState.blank(GridSize.of(15), key);

    const result = handleChangeGridSize(state, { kind: 'change-grid-size', size: GridSize.of(20) }, deps);

    expect(result.state.puzzle.key).toBe(key);
  });

  it('re-derives words for the new grid size so words correspond to maximal white runs in the new grid', () => {
    const state = BuilderState.blank(GridSize.of(15), PuzzleKey.generate(new SeededRng(1)));
    const result = handleChangeGridSize(state, { kind: 'change-grid-size', size: GridSize.of(10) }, deps);
    const expected = Numbering.assign(result.state.puzzle.grid, WordDerivation.derive(result.state.puzzle.grid));
    expect(result.state.puzzle.words).toStrictEqual(expected);
    for (const w of result.state.puzzle.words) {
      expect(Number(w.key.startRow)).toBeLessThan(10);
      expect(Number(w.key.startCol)).toBeLessThan(10);
    }
  });
});

describe('request-switch-to-design', () => {
  it('when blank, switches mode to design and clears subMode/cursor', () => {
    const state = {
      ...blankState(),
      mode: 'fill' as const,
      subMode: { kind: 'join' as const, source: key(0, 0, 'across') },
      cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
    };

    const result = handleRequestSwitchToDesign(state, { kind: 'request-switch-to-design' }, deps);

    expect(result.state.mode).toBe('design');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
  });

  it('when blank, emits no events', () => {
    const state = { ...blankState(), mode: 'fill' as const };

    const result = handleRequestSwitchToDesign(state, { kind: 'request-switch-to-design' }, deps);

    expect(result.events).toEqual([]);
  });

  it('when not blank (answerLetter set), returns state unchanged and emits modal-request', () => {
    const base = blankState();
    const grid = GridOps.setCell(
      base.puzzle.grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(Cell.white(), Letter.try('A')!),
    );
    const state = { ...base, mode: 'fill' as const, puzzle: Puzzle.withGrid(base.puzzle, grid) };

    const result = handleRequestSwitchToDesign(state, { kind: 'request-switch-to-design' }, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([
      {
        kind: 'modal-request',
        modal: { kind: 'confirm-design-switch' },
        confirmIntent: { kind: 'confirm-switch-to-design' },
      },
    ]);
  });

  it('modal-request has correct shape (kind, modal.kind === confirm-design-switch, confirmIntent.kind confirm-switch-to-design)', () => {
    const base = blankState();
    const grid = GridOps.setCell(
      base.puzzle.grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(Cell.white(), Letter.try('A')!),
    );
    const state = { ...base, puzzle: Puzzle.withGrid(base.puzzle, grid) };

    const result = handleRequestSwitchToDesign(state, { kind: 'request-switch-to-design' }, deps);

    expect(result.events).toHaveLength(1);
    const event = result.events[0]!;
    expect(event.kind).toBe('modal-request');
    if (event.kind !== 'modal-request') {
      throw new Error('expected modal-request event');
    }
    expect(event.modal).toEqual({ kind: 'confirm-design-switch' });
    expect(event.confirmIntent).toEqual({ kind: 'confirm-switch-to-design' });
  });

  it('when not blank (non-empty clue), emits modal-request', () => {
    const base = blankState();
    const state = {
      ...base,
      mode: 'fill' as const,
      puzzle: Puzzle.withWords(base.puzzle, [word(0, 0, 'across', 1, 1, 'a clue')]),
    };

    const result = handleRequestSwitchToDesign(state, { kind: 'request-switch-to-design' }, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([
      {
        kind: 'modal-request',
        modal: { kind: 'confirm-design-switch' },
        confirmIntent: { kind: 'confirm-switch-to-design' },
      },
    ]);
  });
});

describe('confirm-switch-to-design', () => {
  it('unconditionally sets mode design and clears subMode/cursor', () => {
    const state = {
      ...blankState(),
      mode: 'fill' as const,
      subMode: { kind: 'join' as const, source: key(0, 0, 'across') },
      cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
    };

    const result = handleConfirmSwitchToDesign(state, { kind: 'confirm-switch-to-design' }, deps);

    expect(result.state.mode).toBe('design');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
  });

  it('no guard fires even when state is non-blank', () => {
    const base = blankState();
    const grid = GridOps.setCell(
      base.puzzle.grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(Cell.white(), Letter.try('A')!),
    );
    const state = { ...base, mode: 'fill' as const, puzzle: Puzzle.withGrid(base.puzzle, grid) };

    const result = handleConfirmSwitchToDesign(state, { kind: 'confirm-switch-to-design' }, deps);

    expect(result.state.mode).toBe('design');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('emits no events', () => {
    const state = { ...blankState(), mode: 'fill' as const };

    const result = handleConfirmSwitchToDesign(state, { kind: 'confirm-switch-to-design' }, deps);

    expect(result.events).toEqual([]);
  });
});
