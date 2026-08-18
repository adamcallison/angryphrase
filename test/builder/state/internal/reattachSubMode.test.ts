import { describe, it, expect } from 'vitest';
import { handleBeginReattach, handleDeleteDisplacedClue, resolveReattach } from '../../../../src/builder/state/internal/reattachSubMode';
import { BuilderState } from '../../../../src/builder/state/state';
import type { Cursor } from '../../../../src/domain/grid/Cursor';
import type { BuilderIntent } from '../../../../src/builder/state/intents';
import { GridSize } from '../../../../src/domain/grid/GridSize';
import { PuzzleKey } from '../../../../src/domain/puzzle/PuzzleKey';
import { SeededRng } from '../../../fakes/SeededRng';
import { DisplacedClue } from '../../../../src/domain/builder/DisplacedClue';
import { DisplacedClueId } from '../../../../src/domain/builder/DisplacedClueId';
import { Row } from '../../../../src/domain/grid/Row';
import { Col } from '../../../../src/domain/grid/Col';
import { Puzzle } from '../../../../src/domain/puzzle/Puzzle';
import { WordDerivation } from '../../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../../src/domain/word/Numbering';
import { WordKey } from '../../../../src/domain/word/WordKey';

const rng = new SeededRng(7);

function blankState(mode: 'design' | 'fill' = 'fill'): BuilderState {
  return {
    ...BuilderState.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(1))),
    mode,
  };
}

function withDisplacedClues(state: BuilderState, clues: DisplacedClue[]): BuilderState {
  return { ...state, displacedClues: clues };
}

function withSubMode(state: BuilderState, subMode: BuilderState['subMode']): BuilderState {
  return { ...state, subMode };
}

function withCursor(state: BuilderState, cursor: NonNullable<Cursor>): BuilderState {
  return { ...state, cursor };
}

function withWords(state: BuilderState): BuilderState {
  const derived = WordDerivation.derive(state.puzzle.grid);
  const words = Numbering.assign(state.puzzle.grid, derived);
  return { ...state, puzzle: Puzzle.withWords(state.puzzle, words) };
}

function withChain(state: BuilderState, headIndex: number, targetIndex: number): BuilderState {
  const words = state.puzzle.words;
  const targetKey = words[targetIndex]!.key;
  const newWords = words.map((w, i) => (i === headIndex ? { ...w, nextWord: targetKey } : w));
  return { ...state, puzzle: Puzzle.withWords(state.puzzle, newWords) };
}

function withClues(state: BuilderState, clues: [number, string][]): BuilderState {
  const newWords = state.puzzle.words.map((w, i) => {
    const entry = clues.find(([idx]) => idx === i);
    return entry ? { ...w, clue: entry[1] } : w;
  });
  return { ...state, puzzle: Puzzle.withWords(state.puzzle, newWords) };
}

describe('handleBeginReattach', () => {
  it('begin-reattach: no-op in design mode', () => {
    const state = withDisplacedClues(
      blankState('design'),
      [DisplacedClue.create(rng, 'clue', 'across')],
    );
    const clue = state.displacedClues[0]!;
    const intent: BuilderIntent = { kind: 'begin-reattach', displacedClueId: clue.id };

    const result = handleBeginReattach(state, intent);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('begin-reattach: no-op when displaced clue id not found (defensive)', () => {
    const state = withDisplacedClues(
      blankState('fill'),
      [DisplacedClue.create(rng, 'clue', 'across')],
    );
    const intent: BuilderIntent = {
      kind: 'begin-reattach',
      displacedClueId: DisplacedClueId.generate(rng),
    };

    const result = handleBeginReattach(state, intent);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('begin-reattach: enters reattach sub-mode with displacedClueId (FR-41)', () => {
    const state = withDisplacedClues(
      blankState('fill'),
      [DisplacedClue.create(rng, 'clue', 'across')],
    );
    const clue = state.displacedClues[0]!;
    const intent: BuilderIntent = { kind: 'begin-reattach', displacedClueId: clue.id };

    const result = handleBeginReattach(state, intent);

    expect(result.state.subMode).toEqual({ kind: 'reattach', displacedClueId: clue.id });
    expect(result.state.displacedClues).toBe(state.displacedClues);
    expect(result.events).toEqual([]);
  });

  it('begin-reattach: replaces existing join sub-mode', () => {
    const state = withDisplacedClues(
      withSubMode(blankState('fill'), {
        kind: 'join',
        source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
      }),
      [DisplacedClue.create(rng, 'clue', 'across')],
    );
    const clue = state.displacedClues[0]!;
    const intent: BuilderIntent = { kind: 'begin-reattach', displacedClueId: clue.id };

    const result = handleBeginReattach(state, intent);

    expect(result.state.subMode).toEqual({ kind: 'reattach', displacedClueId: clue.id });
    expect(result.events).toEqual([]);
  });

  it('begin-reattach: cursor untouched', () => {
    const state = withCursor(
      withDisplacedClues(blankState('fill'), [DisplacedClue.create(rng, 'clue', 'across')]),
      { row: Row.of(2), col: Col.of(3), direction: 'across' },
    );
    const clue = state.displacedClues[0]!;
    const intent: BuilderIntent = { kind: 'begin-reattach', displacedClueId: clue.id };

    const result = handleBeginReattach(state, intent);

    expect(result.state.cursor).toEqual({ row: Row.of(2), col: Col.of(3), direction: 'across' });
    expect(result.state.puzzle).toBe(state.puzzle);
  });

  it('begin-reattach: works in fill mode regardless of subMode currently active', () => {
    const clue1 = DisplacedClue.create(rng, 'first', 'across');
    const clue2 = DisplacedClue.create(rng, 'second', 'down');
    const state = withSubMode(
      withDisplacedClues(blankState('fill'), [clue1, clue2]),
      { kind: 'reattach', displacedClueId: clue1.id },
    );
    const intent: BuilderIntent = { kind: 'begin-reattach', displacedClueId: clue2.id };

    const result = handleBeginReattach(state, intent);

    expect(result.state.subMode).toEqual({ kind: 'reattach', displacedClueId: clue2.id });
    expect(result.events).toEqual([]);
  });
});

describe('handleDeleteDisplacedClue', () => {
  it('delete-displaced-clue: no-op when id not found (defensive)', () => {
    const state = withDisplacedClues(
      blankState('fill'),
      [DisplacedClue.create(rng, 'clue', 'across')],
    );
    const intent: BuilderIntent = {
      kind: 'delete-displaced-clue',
      id: DisplacedClueId.generate(rng),
    };

    const result = handleDeleteDisplacedClue(state, intent);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('delete-displaced-clue: removes the matching clue from state.displacedClues (FR-40)', () => {
    const state = withDisplacedClues(
      blankState('fill'),
      [DisplacedClue.create(rng, 'clue', 'across')],
    );
    const clue = state.displacedClues[0]!;
    const intent: BuilderIntent = { kind: 'delete-displaced-clue', id: clue.id };

    const result = handleDeleteDisplacedClue(state, intent);

    expect(result.state.displacedClues).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it('delete-displaced-clue: leaves other displaced clues in place', () => {
    const clue1 = DisplacedClue.create(rng, 'first', 'across');
    const clue2 = DisplacedClue.create(rng, 'second', 'down');
    const state = withDisplacedClues(blankState('fill'), [clue1, clue2]);
    const intent: BuilderIntent = { kind: 'delete-displaced-clue', id: clue1.id };

    const result = handleDeleteDisplacedClue(state, intent);

    expect(result.state.displacedClues).toEqual([clue2]);
  });

  it('delete-displaced-clue: no confirmation, single intent (FR-40)', () => {
    const state = withDisplacedClues(
      blankState('fill'),
      [DisplacedClue.create(rng, 'clue', 'across')],
    );
    const clue = state.displacedClues[0]!;
    const intent: BuilderIntent = { kind: 'delete-displaced-clue', id: clue.id };

    const result = handleDeleteDisplacedClue(state, intent);

    expect(result.state.displacedClues).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it('delete-displaced-clue: cancels reattach sub-mode when the deleted clue is the one referenced (FR-44)', () => {
    const clue = DisplacedClue.create(rng, 'clue', 'across');
    const state = withSubMode(
      withDisplacedClues(blankState('fill'), [clue]),
      { kind: 'reattach', displacedClueId: clue.id },
    );
    const intent: BuilderIntent = { kind: 'delete-displaced-clue', id: clue.id };

    const result = handleDeleteDisplacedClue(state, intent);

    expect(result.state.displacedClues).toEqual([]);
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.events).toEqual([]);
  });

  it('delete-displaced-clue: leaves reattach sub-mode intact when a different displaced clue is deleted (FR-44 "adjusted accordingly" — id-based reference, no index adjustment needed)', () => {
    const clue1 = DisplacedClue.create(rng, 'first', 'across');
    const clue2 = DisplacedClue.create(rng, 'second', 'down');
    const state = withSubMode(
      withDisplacedClues(blankState('fill'), [clue1, clue2]),
      { kind: 'reattach', displacedClueId: clue1.id },
    );
    const intent: BuilderIntent = { kind: 'delete-displaced-clue', id: clue2.id };

    const result = handleDeleteDisplacedClue(state, intent);

    expect(result.state.displacedClues).toEqual([clue1]);
    expect(result.state.subMode).toEqual({ kind: 'reattach', displacedClueId: clue1.id });
  });

  it('delete-displaced-clue: works in design mode (DisplacedCluesPanel is always rendered)', () => {
    const clue = DisplacedClue.create(rng, 'clue', 'across');
    const state = withDisplacedClues(blankState('design'), [clue]);
    const intent: BuilderIntent = { kind: 'delete-displaced-clue', id: clue.id };

    const result = handleDeleteDisplacedClue(state, intent);

    expect(result.state.displacedClues).toEqual([]);
    expect(result.state.mode).toBe('design');
  });

  it('delete-displaced-clue: leaves join sub-mode intact (delete does not affect joins)', () => {
    const clue = DisplacedClue.create(rng, 'clue', 'across');
    const state = withSubMode(
      withDisplacedClues(blankState('design'), [clue]),
      {
        kind: 'join',
        source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
      },
    );
    const intent: BuilderIntent = { kind: 'delete-displaced-clue', id: clue.id };

    const result = handleDeleteDisplacedClue(state, intent);

    expect(result.state.displacedClues).toEqual([]);
    expect(result.state.subMode).toEqual({
      kind: 'join',
      source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
    });
  });

  it('delete-displaced-clue: leaves cursor untouched', () => {
    const state = withCursor(
      withDisplacedClues(blankState('fill'), [DisplacedClue.create(rng, 'clue', 'across')]),
      { row: Row.of(1), col: Col.of(2), direction: 'down' },
    );
    const clue = state.displacedClues[0]!;
    const intent: BuilderIntent = { kind: 'delete-displaced-clue', id: clue.id };

    const result = handleDeleteDisplacedClue(state, intent);

    expect(result.state.cursor).toEqual({ row: Row.of(1), col: Col.of(2), direction: 'down' });
  });

  it('delete-displaced-clue: empty displaced list after deleting the only entry', () => {
    const clue = DisplacedClue.create(rng, 'clue', 'across');
    const state = withDisplacedClues(blankState('fill'), [clue]);
    const intent: BuilderIntent = { kind: 'delete-displaced-clue', id: clue.id };

    const result = handleDeleteDisplacedClue(state, intent);

    expect(result.state.displacedClues).toEqual([]);
    expect(result.state.subMode).toEqual({ kind: 'none' });
  });
});

describe('resolveReattach', () => {
  it('resolveReattach: displacedClue not found (defensive no-op)', () => {
    const state = withDisplacedClues(withWords(blankState('fill')), [
      DisplacedClue.create(rng, 'clue', 'across'),
    ]);
    const target = state.puzzle.words[0]!.key;
    const missingId = DisplacedClueId.generate(rng);
    const stateWithReattach = {
      ...state,
      subMode: { kind: 'reattach' as const, displacedClueId: missingId },
    };

    const result = resolveReattach(stateWithReattach, missingId, target);

    expect(result.state).toBe(stateWithReattach);
    expect(result.events).toEqual([]);
  });

  it('resolveReattach: target word not found (defensive no-op) — defensive', () => {
    const clue = DisplacedClue.create(rng, 'clue', 'across');
    const state = withDisplacedClues(withWords(blankState('fill')), [clue]);
    const missingTarget: WordKey = {
      startRow: Row.of(999),
      startCol: Col.of(999),
      direction: 'across',
    };
    const stateWithReattach = {
      ...state,
      subMode: { kind: 'reattach' as const, displacedClueId: clue.id },
    };

    const result = resolveReattach(stateWithReattach, clue.id, missingTarget);

    expect(result.state).toBe(stateWithReattach);
    expect(result.events).toEqual([]);
  });

  it('resolveReattach: reject when target clue is non-empty (FR-42b) — error toast', () => {
    const clue = DisplacedClue.create(rng, 'clue', 'across');
    const state = withDisplacedClues(withClues(withWords(blankState('fill')), [[0, 'Existing']]), [clue]);
    const target = state.puzzle.words[0]!.key;
    const stateWithReattach = {
      ...state,
      subMode: { kind: 'reattach' as const, displacedClueId: clue.id },
    };

    const result = resolveReattach(stateWithReattach, clue.id, target);

    expect(result.state).toBe(stateWithReattach);
    expect(result.events).toEqual([
      {
        kind: 'toast',
        toastKind: 'error',
        message: 'Target already has a clue.',
      },
    ]);
  });

  it('resolveReattach: reject when target is a non-head chain word (FR-42c) — error toast', () => {
    const clue = DisplacedClue.create(rng, 'clue', 'across');
    const state = withDisplacedClues(withChain(withWords(blankState('fill')), 0, 1), [clue]);
    const target = state.puzzle.words[1]!.key;
    const stateWithReattach = {
      ...state,
      subMode: { kind: 'reattach' as const, displacedClueId: clue.id },
    };

    const result = resolveReattach(stateWithReattach, clue.id, target);

    expect(result.state).toBe(stateWithReattach);
    expect(result.events).toEqual([
      {
        kind: 'toast',
        toastKind: 'error',
        message: 'Target is a non-head chain word and cannot be given a clue (FR-31).',
      },
    ]);
  });

  it('resolveReattach: success copies clue text to target word (FR-43)', () => {
    const clue = DisplacedClue.create(rng, 'displaced clue', 'across');
    const state = withDisplacedClues(withWords(blankState('fill')), [clue]);
    const target = state.puzzle.words[0]!.key;
    const stateWithReattach = {
      ...state,
      subMode: { kind: 'reattach' as const, displacedClueId: clue.id },
    };

    const result = resolveReattach(stateWithReattach, clue.id, target);

    const targetAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, target));
    expect(targetAfter!.clue).toBe('displaced clue');
  });

  it('resolveReattach: success removes displaced clue from list (FR-43)', () => {
    const clue1 = DisplacedClue.create(rng, 'first', 'across');
    const clue2 = DisplacedClue.create(rng, 'second', 'down');
    const state = withDisplacedClues(withWords(blankState('fill')), [clue1, clue2]);
    const target = state.puzzle.words[0]!.key;
    const stateWithReattach = {
      ...state,
      subMode: { kind: 'reattach' as const, displacedClueId: clue1.id },
    };

    const result = resolveReattach(stateWithReattach, clue1.id, target);

    expect(result.state.displacedClues).toEqual([clue2]);
  });

  it('resolveReattach: success resets subMode to none', () => {
    const clue = DisplacedClue.create(rng, 'clue', 'across');
    const state = withDisplacedClues(withWords(blankState('fill')), [clue]);
    const target = state.puzzle.words[0]!.key;
    const stateWithReattach = {
      ...state,
      subMode: { kind: 'reattach' as const, displacedClueId: clue.id },
    };

    const result = resolveReattach(stateWithReattach, clue.id, target);

    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.events).toEqual([]);
  });

  it('resolveReattach: success leaves chain membership unchanged (no nextWord mutations)', () => {
    const clue = DisplacedClue.create(rng, 'clue', 'across');
    const state = withDisplacedClues(withChain(withWords(blankState('fill')), 0, 1), [clue]);
    const target = state.puzzle.words[2]!.key;
    const stateWithReattach = {
      ...state,
      subMode: { kind: 'reattach' as const, displacedClueId: clue.id },
    };

    const result = resolveReattach(stateWithReattach, clue.id, target);

    const head = result.state.puzzle.words.find(w => WordKey.equals(w.key, state.puzzle.words[0]!.key));
    const targetAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, target));
    expect(head!.nextWord).toEqual(state.puzzle.words[1]!.key);
    expect(targetAfter!.nextWord).toBeNull();
  });

  it('resolveReattach: success leaves other words/displaced clues untouched', () => {
    const clue1 = DisplacedClue.create(rng, 'first', 'across');
    const clue2 = DisplacedClue.create(rng, 'second', 'down');
    const state = withDisplacedClues(withClues(withWords(blankState('fill')), [[1, 'Other']]), [clue1, clue2]);
    const target = state.puzzle.words[0]!.key;
    const otherKey = state.puzzle.words[1]!.key;
    const otherBefore = state.puzzle.words.find(w => WordKey.equals(w.key, otherKey))!;
    const stateWithReattach = {
      ...state,
      subMode: { kind: 'reattach' as const, displacedClueId: clue1.id },
    };

    const result = resolveReattach(stateWithReattach, clue1.id, target);

    const otherAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, otherKey))!;
    expect(otherAfter).toEqual(otherBefore);
    expect(result.state.displacedClues).toEqual([clue2]);
  });
});
