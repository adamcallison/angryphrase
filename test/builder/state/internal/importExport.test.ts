import { describe, expect, it } from 'vitest';
import {
  handleConfirmImportPuzzle,
  handleExportComplete,
  handleExportIncomplete,
  handleRequestImportPuzzle,
} from '../../../../src/builder/state/internal/importExport';
import { BuilderState } from '../../../../src/builder/state/state';
import { SeededRng } from '../../../fakes/SeededRng';
import { GridSize } from '../../../../src/domain/grid/GridSize';
import { PuzzleKey } from '../../../../src/domain/puzzle/PuzzleKey';
import { Puzzle } from '../../../../src/domain/puzzle/Puzzle';
import { GridOps } from '../../../../src/domain/grid/GridOps';
import { Cell } from '../../../../src/domain/grid/Cell';
import { Letter } from '../../../../src/domain/letter/Letter';
import { Row } from '../../../../src/domain/grid/Row';
import { Col } from '../../../../src/domain/grid/Col';
import { DisplacedClue } from '../../../../src/domain/builder/DisplacedClue';
import type { Direction } from '../../../../src/domain/word/Direction';
import { serializeComplete, serializeIncomplete } from '../../../../src/domain/format/v1';
import { CompletenessCheck } from '../../../../src/domain/puzzle/CompletenessCheck';
import { WordMap } from '../../../../src/domain/word/WordMap';
import { Chain } from '../../../../src/domain/chain/Chain';
import { WordKey } from '../../../../src/domain/word/WordKey';
import { WordNumber } from '../../../../src/domain/word/WordNumber';
import { WordDerivation } from '../../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../../src/domain/word/Numbering';

// Fixture key reused from test/domain/format/v1.test.ts minimal valid puzzles.
const VALID_UUID = '00000000-0000-4000-8000-000000000000';

const rng = new SeededRng(42);

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

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LETTERS = Letter.from(ALPHABET);

function fillAllAnswerLetters(state: BuilderState): BuilderState {
  const grid = state.puzzle.grid;
  const size = grid.length;
  let newGrid = grid;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const letter = LETTERS[(r * size + c) % LETTERS.length]!;
      newGrid = GridOps.setCell(
        newGrid,
        Row.of(r),
        Col.of(c),
        Cell.setAnswerLetter(GridOps.cellAt(newGrid, Row.of(r), Col.of(c)), letter),
      );
    }
  }
  return { ...state, puzzle: Puzzle.withGrid(state.puzzle, newGrid) };
}

function withDerivedWords(state: BuilderState): BuilderState {
  const derived = WordDerivation.derive(state.puzzle.grid);
  const words = Numbering.assign(state.puzzle.grid, derived);
  return { ...state, puzzle: Puzzle.withWords(state.puzzle, words) };
}

function withHeadClues(state: BuilderState, clue: string): BuilderState {
  const wordMap = WordMap.fromWords(state.puzzle.words);
  const words = state.puzzle.words.map((w) =>
    Chain.isHead(wordMap, w.key) ? { ...w, clue } : { ...w, clue: '' },
  );
  return { ...state, puzzle: Puzzle.withWords(state.puzzle, words) };
}

function completeState(size: number): BuilderState {
  return withHeadClues(
    withDerivedWords(fillAllAnswerLetters(BuilderState.blank(GridSize.of(size), PuzzleKey.generate(new SeededRng(1))))),
    'Head clue',
  );
}

function completeStateWithChain(): BuilderState {
  const base = completeState(5);
  const firstAcross = base.puzzle.words.find(
    (w) => w.key.startRow === Row.of(0) && w.key.direction === 'across',
  );
  const secondAcross = base.puzzle.words.find(
    (w) => w.key.startRow === Row.of(1) && w.key.direction === 'across',
  );
  if (!firstAcross || !secondAcross) {
    throw new Error('completeStateWithChain: expected across words');
  }
  const chained = base.puzzle.words.map((w) =>
    WordKey.equals(w.key, firstAcross.key) ? { ...w, nextWord: secondAcross.key } : w,
  );
  return { ...base, puzzle: Puzzle.withWords(base.puzzle, chained) };
}

describe('request-import-puzzle', () => {
  it('when blank, executes import directly', () => {
    const state = blankState();
    const json = validIncompleteJson();
    const intent = { kind: 'request-import-puzzle' as const, fileContent: json };

    const result = handleRequestImportPuzzle(state, intent);

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

    const result = handleRequestImportPuzzle(state, intent);

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

    const result = handleRequestImportPuzzle(state, intent);

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

    const result = handleRequestImportPuzzle(state, intent);

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

    const result = handleRequestImportPuzzle(state, intent);

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

    const result = handleRequestImportPuzzle(state, intent);

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

    const result = handleRequestImportPuzzle(state, intent);

    expect(result.state.puzzle.key).toBe(PuzzleKey.try(VALID_UUID));
  });

  it('emits no "download" / "clear-storage" / "load-progress" events (FR-99 / §8.9a step 4)', () => {
    const state = blankState();
    const json = validIncompleteJson();
    const intent = { kind: 'request-import-puzzle' as const, fileContent: json };

    const result = handleRequestImportPuzzle(state, intent);

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

    const result = handleConfirmImportPuzzle(state, intent);

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

    const result = handleConfirmImportPuzzle(state, intent);

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

    const result = handleConfirmImportPuzzle(state, intent);

    expect(result.state.displacedClues).toEqual([]);
    expect(result.state.mode).toBe('fill');
    expect(result.events).toEqual([]);
  });

  it('replaces existing displacedClues even if non-empty pre-import', () => {
    const state = {
      ...nonBlankState(),
      displacedClues: [DisplacedClue.create(rng, 'Existing clue', 'across')],
    };
    const json = validIncompleteJson();
    const intent = { kind: 'confirm-import-puzzle' as const, fileContent: json };

    const result = handleConfirmImportPuzzle(state, intent);

    expect(result.state.displacedClues).toEqual([]);
  });

});

describe('export-incomplete', () => {
  it('emits a single download event', () => {
    const state = blankState();
    const result = handleExportIncomplete(state);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ kind: 'download' });
  });

  it('filename follows Filename.incomplete pattern', () => {
    const state = blankState();
    const result = handleExportIncomplete(state);

    expect(result.events[0]).toMatchObject({
      kind: 'download',
      filename: expect.stringMatching(/^puzzle-[0-9a-f]{8}-incomplete\.json$/),
    });
  });

  it('content matches serializeIncomplete output', () => {
    const state = blankState();
    const result = handleExportIncomplete(state);

    expect(result.events[0]).toMatchObject({
      kind: 'download',
      content: serializeIncomplete(state.puzzle, state.displacedClues),
    });
  });

  it('state is returned unchanged (no export side effects)', () => {
    const state = blankState();
    const result = handleExportIncomplete(state);

    expect(result.state).toBe(state);
  });

  it('works on blank puzzle (always available)', () => {
    const state = blankState();
    const result = handleExportIncomplete(state);

    expect(result.events[0]).toMatchObject({ kind: 'download' });
  });

  it('works on a partially filled puzzle', () => {
    const state = {
      ...nonBlankState(),
      displacedClues: [DisplacedClue.create(rng, 'Displaced clue', 'across')],
    };
    const result = handleExportIncomplete(state);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      kind: 'download',
      content: serializeIncomplete(state.puzzle, state.displacedClues),
    });
  });
});

describe('export-complete', () => {
  it('emits download event when puzzle is complete', () => {
    const state = completeState(2);
    const result = handleExportComplete(state);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ kind: 'download' });
  });

  it('filename follows Filename.complete pattern', () => {
    const state = completeState(2);
    const result = handleExportComplete(state);

    expect(result.events[0]).toMatchObject({
      kind: 'download',
      filename: expect.stringMatching(/^puzzle-[0-9a-f]{8}-complete\.json$/),
    });
  });

  it('content matches serializeComplete output', () => {
    const state = completeState(2);
    const result = handleExportComplete(state);

    expect(result.events[0]).toMatchObject({
      kind: 'download',
      content: serializeComplete(state.puzzle),
    });
  });

  it('rejects incomplete puzzle with one toast per violation', () => {
    const state = BuilderState.blank(GridSize.of(2), PuzzleKey.generate(new SeededRng(1)));
    const violations = CompletenessCheck.check(state.puzzle);

    const result = handleExportComplete(state);

    expect(result.events).toHaveLength(violations.length);
    expect(result.events.every((e) => e.kind === 'toast' && e.toastKind === 'error')).toBe(true);
  });

  it('missing-answer-letter violation emits a relevant toast message (includes row and col)', () => {
    const base = completeState(2);
    const grid = GridOps.setCell(base.puzzle.grid, Row.of(0), Col.of(0), Cell.white());
    const state = { ...base, puzzle: Puzzle.withGrid(base.puzzle, grid) };

    const result = handleExportComplete(state);

    const toast = result.events.find(
      (e): e is { kind: 'toast'; toastKind: 'error'; message: string } =>
        e.kind === 'toast' && e.message.includes('row 0') && e.message.includes('col 0'),
    );
    expect(toast).toBeDefined();
    expect(toast!.kind).toBe('toast');
    expect(toast!.toastKind).toBe('error');
  });

  it('missing-clue violation emits a relevant toast message (includes word number and direction)', () => {
    const base = completeState(2);
    const words = base.puzzle.words.map((w) =>
      w.number === WordNumber.of(1) && w.key.direction === 'across' ? { ...w, clue: '' } : w,
    );
    const state = { ...base, puzzle: Puzzle.withWords(base.puzzle, words) };

    const result = handleExportComplete(state);

    const toast = result.events.find(
      (e): e is { kind: 'toast'; toastKind: 'error'; message: string } =>
        e.kind === 'toast' && e.message.includes('word 1') && e.message.includes('across'),
    );
    expect(toast).toBeDefined();
    expect(toast!.kind).toBe('toast');
    expect(toast!.toastKind).toBe('error');
  });

  it('multiple violations emit multiple toast events (no download)', () => {
    let state = BuilderState.blank(GridSize.of(2), PuzzleKey.generate(new SeededRng(1)));
    state = withDerivedWords(state);
    const violations = CompletenessCheck.check(state.puzzle);

    const result = handleExportComplete(state);

    expect(result.events).toHaveLength(violations.length);
    expect(result.events.every((e) => e.kind === 'toast' && e.toastKind === 'error')).toBe(true);
    expect(result.events.some((e) => e.kind === 'download')).toBe(false);
  });

  it('state is returned unchanged on both success and failure', () => {
    const complete = completeState(2);
    const success = handleExportComplete(complete);
    expect(success.state).toBe(complete);

    const incomplete = blankState();
    const failure = handleExportComplete(incomplete);
    expect(failure.state).toBe(incomplete);
  });

  it('works on a complete puzzle with chains (head words non-empty clue, non-heads empty)', () => {
    const state = completeStateWithChain();
    expect(CompletenessCheck.check(state.puzzle)).toHaveLength(0);

    const result = handleExportComplete(state);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ kind: 'download' });
  });
});
