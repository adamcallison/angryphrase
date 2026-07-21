import { describe, expect, it } from 'vitest';
import { reducePlayer } from './reducer';
import { PlayerState } from './state';
import type { PlayerIntent } from './intents';
import { SeededRng } from '../../../test/fakes/SeededRng';
import { FakeClock } from '../../../test/fakes/FakeClock';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import { Puzzle } from '../../domain/puzzle/Puzzle';
import { GridSize } from '../../domain/grid/GridSize';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';

const rng = new SeededRng(42);
const clock = new FakeClock(1000);
const deps = { rng, now: clock.now.bind(clock) };

function solvingState() {
  return PlayerState.loaded(Puzzle.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(1))));
}

function importState() {
  return PlayerState.importScreen();
}

describe('reducePlayer', () => {
  it('import-new-puzzle returns to import screen from solving phase', () => {
    const result = reducePlayer(solvingState(), { kind: 'import-new-puzzle' }, deps);
    expect(result.state.phase).toBe('import');
    expect((result.state as { lastImportError: unknown }).lastImportError).toBe(null);
  });

  it('import-new-puzzle returns to import screen even from import phase', () => {
    const result = reducePlayer(importState(), { kind: 'import-new-puzzle' }, deps);
    expect(result.state.phase).toBe('import');
    expect((result.state as { lastImportError: unknown }).lastImportError).toBe(null);
  });

  it('escape closes anagram modal when open', () => {
    const state = {
      ...solvingState(),
      anagram: {
        openedForWord: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const },
        input: '',
        scrambledArrangement: null,
      },
    };
    const result = reducePlayer(state, { kind: 'escape' }, deps);
    expect(result.state.phase).toBe('solving');
    expect((result.state as { anagram: unknown }).anagram).toBe(null);
  });

  it('escape is no-op when no anagram open', () => {
    const state = solvingState();
    const result = reducePlayer(state, { kind: 'escape' }, deps);
    expect(result.state).toBe(state);
  });

  it('escape is no-op in import phase', () => {
    const state = importState();
    const result = reducePlayer(state, { kind: 'escape' }, deps);
    expect(result.state).toBe(state);
  });

  it('close-anagram-helper behaves like escape for anagram close', () => {
    const state = {
      ...solvingState(),
      anagram: {
        openedForWord: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const },
        input: '',
        scrambledArrangement: null,
      },
    };
    const result = reducePlayer(state, { kind: 'close-anagram-helper' }, deps);
    expect(result.state.phase).toBe('solving');
    expect((result.state as { anagram: unknown }).anagram).toBe(null);
  });

  it('clear-errors throws when checkResult has incorrect cells', () => {
    const state = {
      ...solvingState(),
      checkResult: {
        classification: 'incomplete-incorrect' as const,
        incorrectCells: [{ row: Row.of(0), col: Col.of(0) }],
        emptyCells: [],
      },
    };
    expect(() => reducePlayer(state, { kind: 'clear-errors' }, deps)).toThrow(
      /^reducePlayer: not implemented: clear-errors/,
    );
  });

  it('clear-errors is no-op when checkResult is null', () => {
    const state = solvingState();
    const result = reducePlayer(state, { kind: 'clear-errors' }, deps);
    expect(result.state).toBe(state);
  });

  it('a not-yet-implemented intent kind throws', () => {
    expect(() => reducePlayer(solvingState(), { kind: 'check' } as PlayerIntent, deps)).toThrow(
      /^reducePlayer: not implemented: check/,
    );
  });

  it('returns ReducerResult shape (state + events: [])', () => {
    const result = reducePlayer(importState(), { kind: 'import-new-puzzle' }, deps);
    expect(result.events).toEqual([]);
  });
});
