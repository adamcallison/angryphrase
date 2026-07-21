import { describe, it, expect } from 'vitest';
import { PlayerState } from './state';
import { Puzzle } from '../../domain/puzzle/Puzzle';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import { GridSize } from '../../domain/grid/GridSize';
import { SeededRng } from '../../../test/fakes/SeededRng';

describe('PlayerState', () => {
  it('importScreen produces phase=import with null lastImportError', () => {
    const state = PlayerState.importScreen();

    expect(state.phase).toBe('import');
    if (state.phase === 'import') {
      expect(state.lastImportError).toBeNull();
    }
  });

  it('loaded produces phase=solving with nulls for cursor/checkResult/anagram', () => {
    const rng = new SeededRng(1);
    const key = PuzzleKey.generate(rng);
    const puzzle = Puzzle.blank(GridSize.DEFAULT, key);

    const state = PlayerState.loaded(puzzle);

    expect(state.phase).toBe('solving');
    if (state.phase === 'solving') {
      expect(state.puzzle).toBe(puzzle);
      expect(state.cursor).toBeNull();
      expect(state.checkResult).toBeNull();
      expect(state.anagram).toBeNull();
    }
  });

  it('PlayerState discriminated union narrows by phase', () => {
    const importState = PlayerState.importScreen();
    const rng = new SeededRng(2);
    const puzzle = Puzzle.blank(GridSize.DEFAULT, PuzzleKey.generate(rng));
    const solvingState = PlayerState.loaded(puzzle);

    expect(importState.phase).toBe('import');
    expect(solvingState.phase).toBe('solving');

    if (solvingState.phase === 'solving') {
      expect(solvingState.puzzle).toBe(puzzle);
    }

    // @ts-expect-error import-phase state does not have a puzzle field
    const _puzzle = importState.puzzle;
    expect(_puzzle).toBeUndefined();
  });
});
