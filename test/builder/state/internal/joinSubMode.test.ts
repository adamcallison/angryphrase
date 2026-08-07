import { describe, it, expect } from 'vitest';
import { handleBeginJoin, handleUnjoin, resolveJoin } from '../../../../src/builder/state/internal/joinSubMode';
import { BuilderState, type Cursor } from '../../../../src/builder/state/state';
import type { BuilderIntent } from '../../../../src/builder/state/intents';
import { GridSize } from '../../../../src/domain/grid/GridSize';
import { Row } from '../../../../src/domain/grid/Row';
import { Col } from '../../../../src/domain/grid/Col';
import { GridOps } from '../../../../src/domain/grid/GridOps';
import { Cell } from '../../../../src/domain/grid/Cell';
import { Puzzle } from '../../../../src/domain/puzzle/Puzzle';
import { PuzzleKey } from '../../../../src/domain/puzzle/PuzzleKey';
import { SeededRng } from '../../../fakes/SeededRng';
import type { Direction } from '../../../../src/domain/word/Direction';
import { WordKey } from '../../../../src/domain/word/WordKey';
import { WordDerivation } from '../../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../../src/domain/word/Numbering';
import { DisplacedClue } from '../../../../src/domain/builder/DisplacedClue';
import { DisplacedClueId } from '../../../../src/domain/builder/DisplacedClueId';

const deps = { rng: new SeededRng(1), now: () => 0 };

function makeState(
  size: number,
  blackCells: [number, number][],
  cursor: { row: number; col: number; direction: Direction } | null = null,
  mode: 'design' | 'fill' = 'fill',
): BuilderState {
  const gridSize = GridSize.of(size);
  const base = BuilderState.blank(gridSize, PuzzleKey.generate(new SeededRng(1)));
  let grid = base.puzzle.grid;
  for (const [r, c] of blackCells) {
    grid = GridOps.setCell(grid, Row.of(r), Col.of(c), Cell.black());
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

function withClues(state: BuilderState, clues: [number, string][]): BuilderState {
  const newWords = state.puzzle.words.map((w, i) => {
    const entry = clues.find(([idx]) => idx === i);
    return entry ? { ...w, clue: entry[1] } : w;
  });
  return { ...state, puzzle: Puzzle.withWords(state.puzzle, newWords) };
}

describe('handleBeginJoin', () => {
  it('begin-join: no-op in design mode', () => {
    const state = makeStateWithWords(5, [], 'design');
    const source = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'begin-join', source };

    const result = handleBeginJoin(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('begin-join: no-op when source wordKey not found (defensive)', () => {
    const state = makeStateWithWords(5, []);
    const source: WordKey = {
      startRow: Row.of(999),
      startCol: Col.of(999),
      direction: 'across',
    };
    const intent: BuilderIntent = { kind: 'begin-join', source };

    const result = handleBeginJoin(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('begin-join: no-op when source already has nextWord link (defensive)', () => {
    const state = withChain(makeStateWithWords(5, []), 0, 1);
    const source = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'begin-join', source };

    const result = handleBeginJoin(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('begin-join: enters join sub-mode with source set (FR-34)', () => {
    const state = makeStateWithWords(5, []);
    const source = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'begin-join', source };

    const result = handleBeginJoin(state, intent, deps);

    expect(result.state.subMode).toEqual({ kind: 'join', source });
    expect(result.state.puzzle).toBe(state.puzzle);
    expect(result.events).toEqual([]);
  });

  it('begin-join: subMode replaces existing reattach subMode', () => {
    const state = makeStateWithWords(5, []);
    const source = state.puzzle.words[0]!.key;
    const stateWithReattach = {
      ...state,
      subMode: {
        kind: 'reattach' as const,
        displacedClueId: DisplacedClueId.generate(deps.rng),
      },
    };
    const intent: BuilderIntent = { kind: 'begin-join', source };

    const result = handleBeginJoin(stateWithReattach, intent, deps);

    expect(result.state.subMode).toEqual({ kind: 'join', source });
    expect(result.events).toEqual([]);
  });

  it('begin-join: cursor untouched', () => {
    const state = {
      ...makeStateWithWords(5, [], 'fill'),
      cursor: { row: Row.of(2), col: Col.of(3), direction: 'across' as const },
    };
    const source = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'begin-join', source };

    const result = handleBeginJoin(state, intent, deps);

    expect(result.state.cursor).toEqual({ row: Row.of(2), col: Col.of(3), direction: 'across' });
    expect(result.state.puzzle).toBe(state.puzzle);
  });
});

describe('handleUnjoin', () => {
  it('unjoin: no-op in design mode', () => {
    const state = withClues(withChain(makeStateWithWords(4, [], 'design'), 0, 1), [[1, 'Downstream']]);
    const source = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = handleUnjoin(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('unjoin: no-op when source wordKey not found', () => {
    const state = makeStateWithWords(4, []);
    const source: WordKey = {
      startRow: Row.of(999),
      startCol: Col.of(999),
      direction: 'across',
    };
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = handleUnjoin(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('unjoin: no-op when source.nextWord is null (defensive)', () => {
    const state = makeStateWithWords(4, []);
    const source = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = handleUnjoin(state, intent, deps);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('unjoin: clears source.nextWord link (FR-37)', () => {
    const state = withChain(makeStateWithWords(4, []), 0, 1);
    const source = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = handleUnjoin(state, intent, deps);

    const sourceAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, source));
    expect(sourceAfter!.nextWord).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('unjoin: resets downstream word clue to empty (FR-37)', () => {
    const state = withClues(withChain(makeStateWithWords(4, []), 0, 1), [[1, 'Downstream clue']]);
    const source = state.puzzle.words[0]!.key;
    const downstreamKey = state.puzzle.words[0]!.nextWord!;
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = handleUnjoin(state, intent, deps);

    const downstreamAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, downstreamKey));
    expect(downstreamAfter!.clue).toBe('');
  });

  it('unjoin: preserves downstream word other fields (key, number, length, nextWord)', () => {
    const base = makeStateWithWords(4, []);
    const words = base.puzzle.words;
    const chainedWords = words.map((w, i) => {
      if (i === 0) return { ...w, nextWord: words[1]!.key };
      if (i === 1) return { ...w, nextWord: words[2]!.key, clue: 'B clue' };
      return w;
    });
    const state = { ...base, puzzle: Puzzle.withWords(base.puzzle, chainedWords) };
    const source = state.puzzle.words[0]!.key;
    const downstreamKey = state.puzzle.words[1]!.key;
    const downstreamBefore = state.puzzle.words[1]!;
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = handleUnjoin(state, intent, deps);

    const downstreamAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, downstreamKey))!;
    expect(downstreamAfter.key).toEqual(downstreamBefore.key);
    expect(downstreamAfter.number).toBe(downstreamBefore.number);
    expect(downstreamAfter.length).toBe(downstreamBefore.length);
    expect(downstreamAfter.nextWord).toEqual(downstreamBefore.nextWord);
  });

  it('unjoin: chain A→B→C, unjoin A; B retains nextWord→C (FR-37)', () => {
    const base = makeStateWithWords(4, []);
    const words = base.puzzle.words;
    const chainedWords = words.map((w, i) => {
      if (i === 0) return { ...w, nextWord: words[1]!.key };
      if (i === 1) return { ...w, nextWord: words[2]!.key };
      return w;
    });
    const state = { ...base, puzzle: Puzzle.withWords(base.puzzle, chainedWords) };
    const source = state.puzzle.words[0]!.key;
    const bKey = state.puzzle.words[1]!.key;
    const cKey = state.puzzle.words[2]!.key;
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = handleUnjoin(state, intent, deps);

    const bAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, bKey))!;
    expect(WordKey.equals(bAfter.nextWord!, cKey)).toBe(true);
  });

  it('unjoin: chain A→B→C, unjoin A; C unchanged (only direct downstream B is affected)', () => {
    const base = makeStateWithWords(4, []);
    const words = base.puzzle.words;
    const cBefore = words[2]!;
    const chainedWords = words.map((w, i) => {
      if (i === 0) return { ...w, nextWord: words[1]!.key };
      if (i === 1) return { ...w, nextWord: words[2]!.key };
      return w;
    });
    const state = { ...base, puzzle: Puzzle.withWords(base.puzzle, chainedWords) };
    const source = state.puzzle.words[0]!.key;
    const cKey = state.puzzle.words[2]!.key;
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = handleUnjoin(state, intent, deps);

    const cAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, cKey))!;
    expect(cAfter).toEqual(cBefore);
  });

  it('unjoin: source word retains its clue (only downstream clue is reset)', () => {
    const state = withClues(withChain(makeStateWithWords(4, []), 0, 1), [
      [0, 'Source clue'],
      [1, 'Downstream clue'],
    ]);
    const source = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = handleUnjoin(state, intent, deps);

    const sourceAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, source))!;
    expect(sourceAfter.clue).toBe('Source clue');
  });

  it('unjoin: other words in puzzle untouched', () => {
    const state = withClues(withChain(makeStateWithWords(4, []), 0, 1), [
      [1, 'Downstream'],
      [2, 'Unchanged'],
    ]);
    const source = state.puzzle.words[0]!.key;
    const otherKey = state.puzzle.words[2]!.key;
    const otherBefore = state.puzzle.words.find(w => WordKey.equals(w.key, otherKey))!;
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = handleUnjoin(state, intent, deps);

    const otherAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, otherKey))!;
    expect(otherAfter).toEqual(otherBefore);
  });
});

describe('resolveJoin', () => {
  it('resolveJoin: source === target cancels the join (FR-34)', () => {
    const state = makeStateWithWords(4, []);
    const source = state.puzzle.words[0]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };

    const result = resolveJoin(stateWithJoin, source, source, deps);

    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.puzzle).toBe(stateWithJoin.puzzle);
    expect(result.state.displacedClues).toBe(stateWithJoin.displacedClues);
    expect(result.events).toEqual([]);
  });

  it('resolveJoin: source not found (defensive no-op)', () => {
    const state = makeStateWithWords(4, []);
    const source = state.puzzle.words[0]!.key;
    const target = state.puzzle.words[1]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };
    const missingSource: WordKey = {
      startRow: Row.of(999),
      startCol: Col.of(999),
      direction: 'across',
    };

    const result = resolveJoin(stateWithJoin, missingSource, target, deps);

    expect(result.state).toBe(stateWithJoin);
    expect(result.events).toEqual([]);
  });

  it('resolveJoin: target not found (defensive no-op)', () => {
    const state = makeStateWithWords(4, []);
    const source = state.puzzle.words[0]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };
    const missingTarget: WordKey = {
      startRow: Row.of(999),
      startCol: Col.of(999),
      direction: 'across',
    };

    const result = resolveJoin(stateWithJoin, source, missingTarget, deps);

    expect(result.state).toBe(stateWithJoin);
    expect(result.events).toEqual([]);
  });

  it('resolveJoin: reject when source already has nextWord (FR-35b) — emits error toast', () => {
    const state = withClues(withChain(makeStateWithWords(4, []), 0, 1), [[1, 'Downstream']]);
    const source = state.puzzle.words[0]!.key;
    const target = state.puzzle.words[2]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };

    const result = resolveJoin(stateWithJoin, source, target, deps);

    expect(result.state).toBe(stateWithJoin);
    expect(result.events).toEqual([
      {
        kind: 'toast',
        toastKind: 'error',
        message: 'Source already has a chain link.',
      },
    ]);
  });

  it('resolveJoin: reject when target is already pointed to by another word (FR-35c) — emits error toast with specific reason', () => {
    const base = makeStateWithWords(4, []);
    const words = base.puzzle.words.map((w, i) => {
      if (i === 0) return { ...w, nextWord: base.puzzle.words[2]!.key };
      if (i === 1) return { ...w, nextWord: base.puzzle.words[2]!.key };
      return w;
    });
    const state = { ...base, puzzle: Puzzle.withWords(base.puzzle, words) };
    const target = state.puzzle.words[2]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source: state.puzzle.words[3]!.key } };

    const result = resolveJoin(stateWithJoin, state.puzzle.words[3]!.key, target, deps);

    expect(result.state).toBe(stateWithJoin);
    expect(result.events).toEqual([
      {
        kind: 'toast',
        toastKind: 'error',
        message: 'Target is already linked to by another word.',
      },
    ]);
  });

  it('resolveJoin: success sets source.nextWord = target.key (FR-35)', () => {
    const state = makeStateWithWords(4, []);
    const source = state.puzzle.words[0]!.key;
    const target = state.puzzle.words[1]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };

    const result = resolveJoin(stateWithJoin, source, target, deps);

    const sourceAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, source));
    expect(sourceAfter!.nextWord).toEqual(target);
  });

  it('resolveJoin: success resets subMode to none', () => {
    const state = makeStateWithWords(4, []);
    const source = state.puzzle.words[0]!.key;
    const target = state.puzzle.words[1]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };

    const result = resolveJoin(stateWithJoin, source, target, deps);

    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.events).toEqual([]);
  });

  it('resolveJoin: success with target having non-empty clue → displaces clue (FR-36) — appended to displacedClues with target direction', () => {
    const state = withClues(makeStateWithWords(4, []), [[1, 'Target clue']]);
    const source = state.puzzle.words[0]!.key;
    const target = state.puzzle.words[1]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };

    const result = resolveJoin(stateWithJoin, source, target, deps);

    expect(result.state.displacedClues).toHaveLength(1);
    expect(result.state.displacedClues[0]!.clue).toBe('Target clue');
    expect(result.state.displacedClues[0]!.direction).toBe(target.direction);
  });

  it('resolveJoin: success with target having non-empty clue → target.clue becomes empty (FR-36/FR-31)', () => {
    const state = withClues(makeStateWithWords(4, []), [[1, 'Target clue']]);
    const source = state.puzzle.words[0]!.key;
    const target = state.puzzle.words[1]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };

    const result = resolveJoin(stateWithJoin, source, target, deps);

    const targetAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, target));
    expect(targetAfter!.clue).toBe('');
  });

  it('resolveJoin: success with target having empty clue → no displaced clue added (FR-36)', () => {
    const state = makeStateWithWords(4, []);
    const source = state.puzzle.words[0]!.key;
    const target = state.puzzle.words[1]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };

    const result = resolveJoin(stateWithJoin, source, target, deps);

    expect(result.state.displacedClues).toHaveLength(0);
  });

  it('resolveJoin: preserves all other words and displaced clues', () => {
    const base = makeStateWithWords(4, []);
    const words = base.puzzle.words.map((w, i) => {
      if (i === 2) return { ...w, clue: 'Other clue' };
      return w;
    });
    const displaced = DisplacedClue.create(deps.rng, 'existing', 'down');
    const state = {
      ...base,
      puzzle: Puzzle.withWords(base.puzzle, words),
      displacedClues: [displaced],
    };
    const source = state.puzzle.words[0]!.key;
    const target = state.puzzle.words[1]!.key;
    const stateWithJoin = { ...state, subMode: { kind: 'join' as const, source } };
    const otherKey = state.puzzle.words[2]!.key;
    const otherBefore = state.puzzle.words.find(w => WordKey.equals(w.key, otherKey))!;

    const result = resolveJoin(stateWithJoin, source, target, deps);

    const otherAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, otherKey))!;
    expect(otherAfter).toEqual(otherBefore);
    expect(result.state.displacedClues).toContain(displaced);
  });
});
