import { describe, it, expect } from 'vitest';
import { AppState } from './state';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import { GridSize } from '../../domain/grid/GridSize';
import { Puzzle } from '../../domain/puzzle/Puzzle';
import { SeededRng } from '../../../test/fakes/SeededRng';
import type { AppState as AppStateType } from './state';

describe('AppState', () => {
  it('blank produces landing route with blank Builder, import-screen Player, empty toasts, no modal', () => {
    const rng = new SeededRng(1);
    const state = AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(rng));

    expect(state.route).toBe('landing');
    expect(Puzzle.isBlank(state.builder.puzzle)).toBe(true);
    expect(state.builder.displacedClues).toEqual([]);
    expect(state.player.phase).toBe('import');
    if (state.player.phase === 'import') {
      expect(state.player.lastImportError).toBeNull();
    }
    expect(state.toasts).toEqual([]);
    expect(state.modal).toBeNull();
    expect(state.pendingConfirmIntent).toBeNull();
  });

  it('blank has blank BuilderState (BuilderState.isBlank true)', () => {
    const rng = new SeededRng(2);
    const state = AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(rng));

    expect(Puzzle.isBlank(state.builder.puzzle)).toBe(true);
    expect(state.builder.displacedClues).toEqual([]);
    expect(state.builder.mode).toBe('design');
    expect(state.builder.subMode).toEqual({ kind: 'none' });
    expect(state.builder.cursor).toBeNull();
  });

  it('AppState fields are the shape required by design §4.1', () => {
    const rng = new SeededRng(3);
    const state = AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(rng));

    const typed: AppStateType = state;
    expect(typed.route).toBe('landing');
    expect(typed.builder).toBeDefined();
    expect(typed.player).toBeDefined();
    expect(Array.isArray(typed.toasts)).toBe(true);
    expect(typed.modal).toBeNull();
    expect(typed.pendingConfirmIntent).toBeNull();
  });
});
