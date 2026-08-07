import { describe, it, expect } from 'vitest';
import { BuilderState } from '../../../src/builder/state/state';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { Cell } from '../../../src/domain/grid/Cell';
import { Letter } from '../../../src/domain/letter/Letter';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { DisplacedClue } from '../../../src/domain/builder/DisplacedClue';
import { SeededRng } from '../../fakes/SeededRng';

describe('BuilderState', () => {
  it('blank produces design-mode, no-submode, no-cursor state with empty displacedClues', () => {
    const rng = new SeededRng(1);
    const state = BuilderState.blank(GridSize.DEFAULT, PuzzleKey.generate(rng));

    expect(state.mode).toBe('design');
    expect(state.subMode).toEqual({ kind: 'none' });
    expect(state.cursor).toBeNull();
    expect(state.displacedClues).toEqual([]);
  });

  it('blank puzzle has DEFAULT grid size when DEFAULT passed', () => {
    const rng = new SeededRng(2);
    const state = BuilderState.blank(GridSize.DEFAULT, PuzzleKey.generate(rng));

    expect(state.puzzle.gridSize).toBe(GridSize.DEFAULT);
    expect(state.puzzle.grid.length).toBe(GridSize.DEFAULT);
    expect(state.puzzle.grid[0]?.length).toBe(GridSize.DEFAULT);
  });

  it('isBlank is true for a fresh blank BuilderState', () => {
    const rng = new SeededRng(3);
    const state = BuilderState.blank(GridSize.DEFAULT, PuzzleKey.generate(rng));

    expect(BuilderState.isBlank(state)).toBe(true);
  });

  it('isBlank is false after displacedClues non-empty', () => {
    const rng = new SeededRng(4);
    const key = PuzzleKey.generate(rng);
    const state = BuilderState.blank(GridSize.DEFAULT, key);
    const displacedClue = DisplacedClue.create(rng, 'a displaced clue', 'across');
    const stateWithDisplacedClue = {
      ...state,
      displacedClues: [displacedClue],
    };

    expect(BuilderState.isBlank(stateWithDisplacedClue)).toBe(false);
  });

  it('isBlank is false when puzzle has any answer letter', () => {
    const rng = new SeededRng(5);
    const key = PuzzleKey.generate(rng);
    const puzzle = Puzzle.blank(GridSize.DEFAULT, key);
    const gridWithAnswer = GridOps.setCell(
      puzzle.grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(puzzle.grid[0]![0]!, Letter.try('A')!),
    );
    const state = {
      ...BuilderState.blank(GridSize.DEFAULT, key),
      puzzle: { ...puzzle, grid: gridWithAnswer },
    };

    expect(BuilderState.isBlank(state)).toBe(false);
  });
});
