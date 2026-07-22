import { describe, it, expect } from 'vitest';
import { handleConfirmResetBuilder, handleRequestResetBuilder } from './lifecycle';
import { BuilderState } from '../state';
import { GridSize } from '../../../domain/grid/GridSize';
import { PuzzleKey } from '../../../domain/puzzle/PuzzleKey';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import { Letter } from '../../../domain/letter/Letter';
import { DisplacedClue } from '../../../domain/builder/DisplacedClue';
import { SeededRng } from '../../../../test/fakes/SeededRng';
import { FakeClock } from '../../../../test/fakes/FakeClock';
import { WordDerivation } from '../../../domain/word/WordDerivation';
import { Numbering } from '../../../domain/word/Numbering';

const rng = new SeededRng(42);
const clock = new FakeClock(1000);
const deps = { rng, now: clock.now.bind(clock) };

function blankState() {
  return BuilderState.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(1)));
}

function nonBlankState() {
  const base = blankState();
  const grid = GridOps.setCell(
    base.puzzle.grid,
    Row.of(0),
    Col.of(0),
    Cell.setAnswerLetter(Cell.white(), Letter.try('A')!),
  );
  return { ...base, puzzle: Puzzle.withGrid(base.puzzle, grid) };
}

function isBlankGrid(grid: ReturnType<typeof GridOps.blank>): boolean {
  return grid.every((row) => row.every((cell) => Cell.isWhite(cell)));
}

describe('request-reset-builder', () => {
  it('when blank, executes reset directly', () => {
    const state = blankState();
    const originalKey = state.puzzle.key;

    const result = handleRequestResetBuilder(state, { kind: 'request-reset-builder' }, deps);

    expect(result.state.puzzle.gridSize).toBe(state.puzzle.gridSize);
    expect(isBlankGrid(result.state.puzzle.grid)).toBe(true);
    expect(result.state.puzzle.key).not.toBe(originalKey);
  });

  it('when blank, emits a single clear-builder-storage event', () => {
    const state = blankState();

    const result = handleRequestResetBuilder(state, { kind: 'request-reset-builder' }, deps);

    expect(result.events).toEqual([{ kind: 'clear-builder-storage' }]);
  });

  it('when blank, fresh state has mode=design, subMode=none, cursor=null', () => {
    const state = blankState();

    const result = handleRequestResetBuilder(state, { kind: 'request-reset-builder' }, deps);

    expect(result.state.mode).toBe('design');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
  });

  it('when blank, preserves grid size of original', () => {
    const key = PuzzleKey.generate(new SeededRng(1));
    const state = BuilderState.blank(GridSize.of(5), key);

    const result = handleRequestResetBuilder(state, { kind: 'request-reset-builder' }, deps);

    expect(result.state.puzzle.gridSize).toBe(GridSize.of(5));
    expect(result.state.puzzle.grid.length).toBe(5);
  });

  it('when NOT blank, emits modal-request with confirmIntent=confirm-reset-builder', () => {
    const state = nonBlankState();

    const result = handleRequestResetBuilder(state, { kind: 'request-reset-builder' }, deps);

    expect(result.events).toEqual([
      {
        kind: 'modal-request',
        modal: { kind: 'confirm-reset-builder' },
        confirmIntent: { kind: 'confirm-reset-builder' },
      },
    ]);
  });

  it('when NOT blank, state is returned unchanged', () => {
    const state = nonBlankState();

    const result = handleRequestResetBuilder(state, { kind: 'request-reset-builder' }, deps);

    expect(result.state).toEqual(state);
  });

  it('when NOT blank, events is exactly the expected modal-request', () => {
    const state = nonBlankState();

    const result = handleRequestResetBuilder(state, { kind: 'request-reset-builder' }, deps);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'modal-request',
      modal: { kind: 'confirm-reset-builder' },
      confirmIntent: { kind: 'confirm-reset-builder' },
    });
  });
});

describe('confirm-reset-builder', () => {
  it('unconditionally resets to blank', () => {
    const state = nonBlankState();

    const result = handleConfirmResetBuilder(state, { kind: 'confirm-reset-builder' }, deps);

    expect(result.state.puzzle.gridSize).toBe(state.puzzle.gridSize);
    expect(isBlankGrid(result.state.puzzle.grid)).toBe(true);
    expect(result.state.mode).toBe('design');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
  });

  it('emits clear-builder-storage event', () => {
    const state = nonBlankState();

    const result = handleConfirmResetBuilder(state, { kind: 'confirm-reset-builder' }, deps);

    expect(result.events).toEqual([{ kind: 'clear-builder-storage' }]);
  });

  it('fresh PuzzleKey is different from the original', () => {
    const key = PuzzleKey.generate(new SeededRng(1));
    const state = BuilderState.blank(GridSize.of(5), key);

    const result = handleConfirmResetBuilder(state, { kind: 'confirm-reset-builder' }, deps);

    expect(result.state.puzzle.key).not.toBe(key);
  });

  it('preserves grid size', () => {
    const key = PuzzleKey.generate(new SeededRng(1));
    const state = BuilderState.blank(GridSize.of(7), key);

    const result = handleConfirmResetBuilder(state, { kind: 'confirm-reset-builder' }, deps);

    expect(result.state.puzzle.gridSize).toBe(GridSize.of(7));
    expect(result.state.puzzle.grid.length).toBe(7);
  });

  it('fresh state has mode=design, subMode=none, cursor=null', () => {
    const state = {
      ...nonBlankState(),
      mode: 'fill' as const,
      subMode: { kind: 'join' as const, source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const } },
      cursor: { row: Row.of(1), col: Col.of(2), direction: 'down' as const },
    };

    const result = handleConfirmResetBuilder(state, { kind: 'confirm-reset-builder' }, deps);

    expect(result.state.mode).toBe('design');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
  });

  it('clears existing displacedClues', () => {
    const state = {
      ...nonBlankState(),
      displacedClues: [DisplacedClue.create(deps.rng, 'clue', 'across')],
    };

    const result = handleConfirmResetBuilder(state, { kind: 'confirm-reset-builder' }, deps);

    expect(result.state.displacedClues).toEqual([]);
  });

  it('throws out user edits', () => {
    const state = nonBlankState();

    const result = handleConfirmResetBuilder(state, { kind: 'confirm-reset-builder' }, deps);

    const expectedWords = Numbering.assign(
      result.state.puzzle.grid,
      WordDerivation.derive(result.state.puzzle.grid),
    );
    expect(result.state.puzzle.words).toEqual(expectedWords);
    expect(result.state.puzzle.grid.every((row) =>
      row.every((cell) => cell.answerLetter === null),
    )).toBe(true);
  });

  it('deterministic: confirm-reset-builder with two different SeededRng produces two different keys', () => {
    const state = BuilderState.blank(GridSize.of(5), PuzzleKey.generate(new SeededRng(1)));
    const deps1 = { rng: new SeededRng(1), now: clock.now.bind(clock) };
    const deps2 = { rng: new SeededRng(2), now: clock.now.bind(clock) };

    const result1 = handleConfirmResetBuilder(state, { kind: 'confirm-reset-builder' }, deps1);
    const result2 = handleConfirmResetBuilder(state, { kind: 'confirm-reset-builder' }, deps2);

    expect(String(result1.state.puzzle.key)).not.toBe(String(result2.state.puzzle.key));
  });
});
