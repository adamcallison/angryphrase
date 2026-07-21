import { describe, expect, it } from 'vitest';
import { handleConfirmImportPuzzle, handleRequestImportPuzzle } from './importExport';
import { BuilderState } from '../state';
import { SeededRng } from '../../../../test/fakes/SeededRng';
import { FakeClock } from '../../../../test/fakes/FakeClock';
import { GridSize } from '../../../domain/grid/GridSize';
import { PuzzleKey } from '../../../domain/puzzle/PuzzleKey';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';
import { Letter } from '../../../domain/letter/Letter';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import { DisplacedClue } from '../../../domain/builder/DisplacedClue';
import type { Direction } from '../../../domain/word/Direction';

// Fixture key reused from test/domain/format/v1.test.ts minimal valid puzzles.
const VALID_UUID = '00000000-0000-4000-8000-000000000000';

const rng = new SeededRng(42);
const clock = new FakeClock(1000);
const deps = { rng, now: clock.now.bind(clock) };

function blankState() {
  return BuilderState.blank(GridSize.of(2), PuzzleKey.generate(new SeededRng(1)));
}

function makeCellJson(black: boolean, letter: string | null = null) {
  return {
    black,
    puzzleLetter: letter,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
  };
}

function makeWordJson(
  startRow: number,
  startCol: number,
  direction: Direction,
  length: number,
  clue: string,
  nextWord: { startRow: number; startCol: number; direction: Direction } | null = null,
) {
  return {
    startRow,
    startCol,
    direction,
    length,
    number: 1,
    clue,
    nextWord,
  };
}

function validIncompleteJson() {
  return JSON.stringify({
    version: 1,
    type: 'incomplete',
    key: VALID_UUID,
    gridSize: 2,
    title: 'Title',
    author: 'Author',
    grid: [
      [makeCellJson(false), makeCellJson(false)],
      [makeCellJson(true), makeCellJson(true)],
    ],
    words: [makeWordJson(0, 0, 'across', 2, '')],
    displacedClues: [],
  });
}

function validCompleteJson() {
  return JSON.stringify({
    version: 1,
    type: 'complete',
    key: VALID_UUID,
    gridSize: 2,
    title: 'Title',
    author: 'Author',
    grid: [
      [makeCellJson(false, 'A'), makeCellJson(false, 'B')],
      [makeCellJson(true), makeCellJson(true)],
    ],
    words: [makeWordJson(0, 0, 'across', 2, 'Head clue')],
  });
}

function invalidJson() {
  return JSON.stringify({
    version: 2,
    type: 'incomplete',
    key: VALID_UUID,
    gridSize: 2,
    title: 'Title',
    author: 'Author',
    grid: [
      [makeCellJson(false), makeCellJson(false)],
      [makeCellJson(true), makeCellJson(true)],
    ],
    words: [makeWordJson(0, 0, 'across', 2, '')],
    displacedClues: [],
  });
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

describe('request-import-puzzle', () => {
  it('when blank, executes import directly', () => {
    const state = blankState();
    const json = validIncompleteJson();
    const intent = { kind: 'request-import-puzzle' as const, fileContent: json };

    const result = handleRequestImportPuzzle(state, intent, deps);

    expect(result.state.puzzle.key).toBe(PuzzleKey.try(VALID_UUID));
    expect(result.state.puzzle.gridSize).toBe(GridSize.of(2));
    expect(result.state.mode).toBe('fill');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('when blank, accepts a complete file too (FR-57)', () => {
    const state = blankState();
    const json = validCompleteJson();
    const intent = { kind: 'request-import-puzzle' as const, fileContent: json };

    const result = handleRequestImportPuzzle(state, intent, deps);

    expect(result.state.puzzle.key).toBe(PuzzleKey.try(VALID_UUID));
    expect(result.state.displacedClues).toEqual([]);
    expect(result.state.mode).toBe('fill');
    expect(result.state.cursor).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('blank + invalid json → emits toast with parsed failures, state unchanged', () => {
    const state = blankState();
    const json = invalidJson();
    const intent = { kind: 'request-import-puzzle' as const, fileContent: json };

    const result = handleRequestImportPuzzle(state, intent, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'Unknown or missing version.',
    });
  });

  it('blank + malformed JSON (non-JSON text) → toast with "File is not valid JSON."', () => {
    const state = blankState();
    const intent = { kind: 'request-import-puzzle' as const, fileContent: '{not json' };

    const result = handleRequestImportPuzzle(state, intent, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'File is not valid JSON.',
    });
  });

  it('when NOT blank, emits modal-request with confirm-import-puzzle + fileContent', () => {
    const state = nonBlankState();
    const json = validIncompleteJson();
    const intent = { kind: 'request-import-puzzle' as const, fileContent: json };

    const result = handleRequestImportPuzzle(state, intent, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([
      {
        kind: 'modal-request',
        modal: { kind: 'confirm-import-puzzle' },
        confirmIntent: { kind: 'confirm-import-puzzle', fileContent: json },
      },
    ]);
  });

  it('when NOT blank but invalid json → still emits modal-request (guard fires before parse)', () => {
    const state = nonBlankState();
    const json = invalidJson();
    const intent = { kind: 'request-import-puzzle' as const, fileContent: json };

    const result = handleRequestImportPuzzle(state, intent, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([
      {
        kind: 'modal-request',
        modal: { kind: 'confirm-import-puzzle' },
        confirmIntent: { kind: 'confirm-import-puzzle', fileContent: json },
      },
    ]);
  });

  it('imported puzzle.key preserved verbatim from file', () => {
    const state = blankState();
    const json = validIncompleteJson();
    const intent = { kind: 'request-import-puzzle' as const, fileContent: json };

    const result = handleRequestImportPuzzle(state, intent, deps);

    expect(result.state.puzzle.key).toBe(PuzzleKey.try(VALID_UUID));
  });

  it('emits no "download" / "clear-storage" / "load-progress" events (FR-99 / §8.9a step 4)', () => {
    const state = blankState();
    const json = validIncompleteJson();
    const intent = { kind: 'request-import-puzzle' as const, fileContent: json };

    const result = handleRequestImportPuzzle(state, intent, deps);

    expect(result.events).toHaveLength(0);
    expect(result.events.some((e) => e.kind === 'download')).toBe(false);
    expect(result.events.some((e) => e.kind === 'clear-builder-storage')).toBe(false);
    expect(result.events.some((e) => e.kind === 'load-player-progress')).toBe(false);
  });
});

describe('confirm-import-puzzle', () => {
  it('unconditionally executes the import (no blank guard)', () => {
    const state = nonBlankState();
    const json = validIncompleteJson();
    const intent = { kind: 'confirm-import-puzzle' as const, fileContent: json };

    const result = handleConfirmImportPuzzle(state, intent, deps);

    expect(result.state.puzzle.key).toBe(PuzzleKey.try(VALID_UUID));
    expect(result.state.puzzle.gridSize).toBe(GridSize.of(2));
    expect(result.state.mode).toBe('fill');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('with invalid json emits toast (executes but parse fails)', () => {
    const state = nonBlankState();
    const json = invalidJson();
    const intent = { kind: 'confirm-import-puzzle' as const, fileContent: json };

    const result = handleConfirmImportPuzzle(state, intent, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: 'toast',
      toastKind: 'error',
      message: 'Unknown or missing version.',
    });
  });

  it('imports a complete file (FR-57) — displacedClues = []', () => {
    const state = nonBlankState();
    const json = validCompleteJson();
    const intent = { kind: 'confirm-import-puzzle' as const, fileContent: json };

    const result = handleConfirmImportPuzzle(state, intent, deps);

    expect(result.state.displacedClues).toEqual([]);
    expect(result.state.mode).toBe('fill');
    expect(result.events).toEqual([]);
  });

  it('replaces existing displacedClues even if non-empty pre-import', () => {
    const state = {
      ...nonBlankState(),
      displacedClues: [DisplacedClue.create(deps.rng, 'Existing clue', 'across')],
    };
    const json = validIncompleteJson();
    const intent = { kind: 'confirm-import-puzzle' as const, fileContent: json };

    const result = handleConfirmImportPuzzle(state, intent, deps);

    expect(result.state.displacedClues).toEqual([]);
  });

});
