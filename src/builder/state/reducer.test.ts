import { describe, it, expect } from 'vitest';
import { reduceBuilder } from './reducer';
import { BuilderState } from './state';
import type { BuilderIntent } from './intents';
import { SeededRng } from '../../../test/fakes/SeededRng';
import { FakeClock } from '../../../test/fakes/FakeClock';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import { Title } from '../../domain/puzzle/Title';
import { Author } from '../../domain/puzzle/Author';
import { GridSize } from '../../domain/grid/GridSize';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';
import { Letter } from '../../domain/letter/Letter';
import { GridOps } from '../../domain/grid/GridOps';
import { Cell } from '../../domain/grid/Cell';
import { Puzzle } from '../../domain/puzzle/Puzzle';
import { WordKey } from '../../domain/word/WordKey';
import { DisplacedClue } from '../../domain/builder/DisplacedClue';
import { WordDerivation } from '../../domain/word/WordDerivation';
import { Numbering } from '../../domain/word/Numbering';
import { WordMap } from '../../domain/word/WordMap';
import { Chain } from '../../domain/chain/Chain';

describe('reduceBuilder', () => {
  const rng = new SeededRng(42);
  const clock = new FakeClock(1000);
  const now = clock.now.bind(clock);
  const deps = { rng, now };

  function blank() {
    return BuilderState.blank(GridSize.DEFAULT, PuzzleKey.generate(new SeededRng(1)));
  }

  function fillState(
    blackCells: [number, number][],
    cursor: { row: number; col: number; direction: 'across' | 'down' } | null = null,
  ): BuilderState {
    const base = blank();
    let grid = base.puzzle.grid;
    for (const [r, c] of blackCells) {
      grid = GridOps.setCell(grid, Row.of(r), Col.of(c), Cell.black());
    }
    return {
      ...base,
      mode: 'fill',
      cursor: cursor
        ? { row: Row.of(cursor.row), col: Col.of(cursor.col), direction: cursor.direction }
        : null,
      puzzle: Puzzle.withGrid(base.puzzle, grid),
    };
  }

  function fillStateWithWords(blackCells: [number, number][] = []): BuilderState {
    const base = fillState(blackCells);
    const derived = WordDerivation.derive(base.puzzle.grid);
    const words = Numbering.assign(base.puzzle.grid, derived);
    return { ...base, puzzle: Puzzle.withWords(base.puzzle, words) };
  }

  function completePuzzleState(): BuilderState {
    const base = fillStateWithWords([]);
    let grid = base.puzzle.grid;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid.length; c++) {
        grid = GridOps.setCell(
          grid,
          Row.of(r),
          Col.of(c),
          Cell.setAnswerLetter(GridOps.cellAt(grid, Row.of(r), Col.of(c)), Letter.try('A')!),
        );
      }
    }
    const puzzleWithGrid = Puzzle.withGrid(base.puzzle, grid);
    const wordMap = WordMap.fromWords(puzzleWithGrid.words);
    const words = puzzleWithGrid.words.map((w) =>
      Chain.isHead(wordMap, w.key) ? { ...w, clue: 'Clue text' } : w,
    );
    return { ...base, puzzle: Puzzle.withWords(puzzleWithGrid, words) };
  }

  it('switch-to-fill sets mode=fill, subMode=none, cursor=null', () => {
    const state = blank();
    const result = reduceBuilder(state, { kind: 'switch-to-fill' }, deps);

    expect(result.state.mode).toBe('fill');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
  });

  it('escape clears subMode to none', () => {
    const state = {
      ...blank(),
      subMode: {
        kind: 'join' as const,
        source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const },
      },
    };
    const result = reduceBuilder(state, { kind: 'escape' }, deps);

    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.mode).toBe(state.mode);
    expect(result.state.cursor).toBe(state.cursor);
  });

  it('edit-title updates puzzle.title via Puzzle.withMetadata', () => {
    const state = blank();
    const title = Title.try('New Title');
    const result = reduceBuilder(state, { kind: 'edit-title', title }, deps);

    expect(result.state.puzzle.title).toBe(title);
    expect(result.state.puzzle.author).toBe(state.puzzle.author);
  });

  it('edit-author updates puzzle.author via Puzzle.withMetadata', () => {
    const state = blank();
    const author = Author.try('New Author');
    const result = reduceBuilder(state, { kind: 'edit-author', author }, deps);

    expect(result.state.puzzle.author).toBe(author);
    expect(result.state.puzzle.title).toBe(state.puzzle.title);
  });

  it('toggle-design-cell is delegated to designMode and toggles a white cell to black', () => {
    const intent: BuilderIntent = {
      kind: 'toggle-design-cell',
      row: Row.of(0),
      col: Col.of(0),
    };

    const result = reduceBuilder(blank(), intent, deps);

    expect(result.state.puzzle.grid[0]![0]!.black).toBe(true);
  });

  it('change-grid-size is delegated to designMode and resizes blank puzzle', () => {
    const state = blank();
    const intent: BuilderIntent = { kind: 'change-grid-size', size: GridSize.of(20) };

    const result = reduceBuilder(state, intent, deps);

    expect(result.state).toBeDefined();
    expect(result.events).toEqual([]);
    expect(Number(result.state.puzzle.grid.length)).toBe(20);
    expect(result.state.cursor).toBeNull();
    expect(result.state.subMode).toEqual({ kind: 'none' });
  });

  it('returns ReducerResult shape (state + events: [])', () => {
    const result = reduceBuilder(blank(), { kind: 'switch-to-fill' }, deps);

    expect(result.state).toBeDefined();
    expect(result.events).toEqual([]);
  });

  it('request-switch-to-design is delegated: executes when blank', () => {
    const state = {
      ...blank(),
      mode: 'fill' as const,
      subMode: { kind: 'join' as const, source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const } },
      cursor: { row: Row.of(1), col: Col.of(2), direction: 'down' as const },
    };

    const result = reduceBuilder(state, { kind: 'request-switch-to-design' }, deps);

    expect(result.state.mode).toBe('design');
    expect(result.state.cursor).toBeNull();
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.events).toEqual([]);
  });

  it('request-switch-to-design is delegated: emits modal-request when not blank', () => {
    const base = blank();
    const letter = Letter.try('A')!;
    const grid = GridOps.setCell(base.puzzle.grid, Row.of(0), Col.of(0), Cell.setAnswerLetter(Cell.white(), letter));
    const state = { ...base, mode: 'fill' as const, puzzle: Puzzle.withGrid(base.puzzle, grid) };

    const result = reduceBuilder(state, { kind: 'request-switch-to-design' }, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([
      {
        kind: 'modal-request',
        modal: { kind: 'confirm-design-switch' },
        confirmIntent: { kind: 'confirm-switch-to-design' },
      },
    ]);
  });

  it('confirm-switch-to-design is delegated: unconditionally switches to design', () => {
    const base = blank();
    const letter = Letter.try('A')!;
    const grid = GridOps.setCell(base.puzzle.grid, Row.of(0), Col.of(0), Cell.setAnswerLetter(Cell.white(), letter));
    const state = {
      ...base,
      mode: 'fill' as const,
      puzzle: Puzzle.withGrid(base.puzzle, grid),
      subMode: { kind: 'join' as const, source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const } },
      cursor: { row: Row.of(1), col: Col.of(2), direction: 'down' as const },
    };

    const result = reduceBuilder(state, { kind: 'confirm-switch-to-design' }, deps);

    expect(result.state.mode).toBe('design');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('select-cell is delegated to fillMode', () => {
    // 5x5 grid; black cells above and below (2,2) create a horizontal-only run.
    const state = fillState([
      [1, 2],
      [3, 2],
    ]);

    const result = reduceBuilder(state, { kind: 'select-cell', row: Row.of(2), col: Col.of(2) }, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(2),
      col: Col.of(2),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('move-cursor is delegated to fillMode', () => {
    const state = fillState([], { row: 2, col: 2, direction: 'down' });

    const result = reduceBuilder(state, { kind: 'move-cursor', direction: 'across' }, deps);

    expect(result.state.cursor).toEqual({
      row: Row.of(2),
      col: Col.of(3),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('type-letter is delegated to fillMode: overwrites answerLetter and advances', () => {
    const state = fillState([], { row: 0, col: 0, direction: 'across' });

    const result = reduceBuilder(state, { kind: 'type-letter', letter: Letter.try('A')! }, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toEqual(
      Letter.try('A'),
    );
    expect(result.state.cursor).toEqual({
      row: Row.of(0),
      col: Col.of(1),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('backspace is delegated to fillMode', () => {
    const base = fillState([], { row: 0, col: 0, direction: 'across' });
    const grid = GridOps.setCell(
      base.puzzle.grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(Cell.white(), Letter.try('A')!),
    );
    const state = { ...base, puzzle: Puzzle.withGrid(base.puzzle, grid) };

    const result = reduceBuilder(state, { kind: 'backspace' }, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toBeNull();
    expect(result.state.cursor).toEqual({
      row: Row.of(0),
      col: Col.of(0),
      direction: 'across',
    });
    expect(result.events).toEqual([]);
  });

  it('toggle-marker is delegated to fillMode', () => {
    const state = fillState([], { row: 0, col: 0, direction: 'across' });

    const result = reduceBuilder(state, { kind: 'toggle-marker', flag: 'space-right' }, deps);

    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).marker.spaceRight).toBe(
      true,
    );
    expect(result.state.puzzle).not.toBe(state.puzzle);
    expect(result.events).toEqual([]);
  });

  it('edit-clue is delegated to fillMode: updates head word clue', () => {
    const state = fillStateWithWords([]);
    const wordKey = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'edit-clue', wordKey, clue: 'New clue' };

    const result = reduceBuilder(state, intent, deps);

    const updated = result.state.puzzle.words.find(w => WordKey.equals(w.key, wordKey));
    expect(updated).toBeDefined();
    expect(updated!.clue).toBe('New clue');
    expect(result.events).toEqual([]);
  });

  it('begin-join is delegated to joinSubMode', () => {
    const state = fillStateWithWords([]);
    const wordKey = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'begin-join', source: wordKey };

    const result = reduceBuilder(state, intent, deps);

    expect(result.state.subMode.kind).toBe('join');
    expect((result.state.subMode as { kind: 'join'; source: typeof wordKey }).source).toEqual(wordKey);
    expect(result.events).toEqual([]);
  });

  it('begin-reattach is delegated: enters reattach sub-mode with displacedClueId', () => {
    const state = {
      ...fillStateWithWords([]),
      displacedClues: [DisplacedClue.create(deps.rng, 'clue', 'across')],
    };
    const clue = state.displacedClues[0]!;
    const intent: BuilderIntent = { kind: 'begin-reattach', displacedClueId: clue.id };

    const result = reduceBuilder(state, intent, deps);

    expect(result.state.subMode).toEqual({ kind: 'reattach', displacedClueId: clue.id });
    expect(result.events).toEqual([]);
  });

  it('delete-displaced-clue is delegated: removes clue and cancels active reattach', () => {
    const clue = DisplacedClue.create(deps.rng, 'clue', 'across');
    const state = {
      ...fillStateWithWords([]),
      displacedClues: [clue],
      subMode: { kind: 'reattach' as const, displacedClueId: clue.id },
    };
    const intent: BuilderIntent = { kind: 'delete-displaced-clue', id: clue.id };

    const result = reduceBuilder(state, intent, deps);

    expect(result.state.displacedClues).toEqual([]);
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.events).toEqual([]);
  });

  it('unjoin is delegated to joinSubMode: clears source.nextWord and empties downstream clue', () => {
    const base = fillStateWithWords([]);
    const words = base.puzzle.words.map((w, i) => {
      if (i === 0) return { ...w, nextWord: base.puzzle.words[1]!.key };
      if (i === 1) return { ...w, clue: 'Downstream clue' };
      return w;
    });
    const state = { ...base, puzzle: Puzzle.withWords(base.puzzle, words) };
    const source = state.puzzle.words[0]!.key;
    const downstreamKey = state.puzzle.words[0]!.nextWord!;
    const intent: BuilderIntent = { kind: 'unjoin', source };

    const result = reduceBuilder(state, intent, deps);

    const sourceAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, source));
    const downstreamAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, downstreamKey));
    expect(sourceAfter!.nextWord).toBeNull();
    expect(downstreamAfter!.clue).toBe('');
    expect(result.events).toEqual([]);
  });

  it('click-clue-panel-word is delegated: navigates cursor in no-sub-mode state', () => {
    const state = fillStateWithWords([]);
    const wordKey = state.puzzle.words[1]!.key;
    const intent: BuilderIntent = { kind: 'click-clue-panel-word', wordKey };

    const result = reduceBuilder(state, intent, deps);

    expect(result.state.cursor).toEqual({
      row: wordKey.startRow,
      col: wordKey.startCol,
      direction: wordKey.direction,
    });
    expect(result.events).toEqual([]);
  });

  it('click-grid-word is delegated: in join sub-mode, source-click cancels join', () => {
    const state = {
      ...fillStateWithWords([]),
      subMode: {
        kind: 'join' as const,
        source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const },
      },
    };
    const intent: BuilderIntent = {
      kind: 'click-grid-word',
      wordKey: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
    };

    const result = reduceBuilder(state, intent, deps);

    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.events).toEqual([]);
  });

  it('click-clue-panel-word is delegated: in reattach sub-mode, success moves clue text', () => {
    const clue = DisplacedClue.create(deps.rng, 'reattached clue', 'across');
    const state = {
      ...fillStateWithWords([]),
      displacedClues: [clue],
      subMode: { kind: 'reattach' as const, displacedClueId: clue.id },
    };
    const target = state.puzzle.words[0]!.key;
    const intent: BuilderIntent = { kind: 'click-clue-panel-word', wordKey: target };

    const result = reduceBuilder(state, intent, deps);

    const targetAfter = result.state.puzzle.words.find(w => WordKey.equals(w.key, target));
    expect(targetAfter!.clue).toBe('reattached clue');
    expect(result.state.displacedClues).toEqual([]);
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.events).toEqual([]);
  });

  const IMPORT_UUID = '00000000-0000-4000-8000-000000000000';

  function importCellJson(black: boolean, letter: string | null = null) {
    return {
      black,
      puzzleLetter: letter,
      spaceRight: false,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    };
  }

  function importWordJson(
    startRow: number,
    startCol: number,
    direction: 'across' | 'down',
    length: number,
    clue: string,
  ) {
    return {
      startRow,
      startCol,
      direction,
      length,
      number: 1,
      clue,
      nextWord: null,
    };
  }

  function validImportJson() {
    return JSON.stringify({
      version: 1,
      type: 'incomplete',
      key: IMPORT_UUID,
      gridSize: 2,
      title: 'Title',
      author: 'Author',
      grid: [
        [importCellJson(false), importCellJson(false)],
        [importCellJson(true), importCellJson(true)],
      ],
      words: [importWordJson(0, 0, 'across', 2, '')],
      displacedClues: [],
    });
  }

  it('request-import-puzzle is delegated: blank state executes the import', () => {
    const state = blank();
    const json = validImportJson();

    const result = reduceBuilder(state, { kind: 'request-import-puzzle', fileContent: json }, deps);

    expect(result.state.puzzle.key).toBe(PuzzleKey.try(IMPORT_UUID));
    expect(result.state.puzzle.gridSize).toBe(GridSize.of(2));
    expect(result.state.mode).toBe('fill');
    expect(result.state.cursor).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('request-import-puzzle is delegated: non-blank state emits modal-request', () => {
    const base = blank();
    const letter = Letter.try('A')!;
    const grid = GridOps.setCell(base.puzzle.grid, Row.of(0), Col.of(0), Cell.setAnswerLetter(Cell.white(), letter));
    const state = { ...base, mode: 'fill' as const, puzzle: Puzzle.withGrid(base.puzzle, grid) };
    const json = validImportJson();

    const result = reduceBuilder(state, { kind: 'request-import-puzzle', fileContent: json }, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([
      {
        kind: 'modal-request',
        modal: { kind: 'confirm-import-puzzle' },
        confirmIntent: { kind: 'confirm-import-puzzle', fileContent: json },
      },
    ]);
  });

  it('confirm-import-puzzle is delegated: executes unconditionally', () => {
    const base = blank();
    const letter = Letter.try('A')!;
    const grid = GridOps.setCell(base.puzzle.grid, Row.of(0), Col.of(0), Cell.setAnswerLetter(Cell.white(), letter));
    const state = { ...base, mode: 'fill' as const, puzzle: Puzzle.withGrid(base.puzzle, grid) };
    const json = validImportJson();

    const result = reduceBuilder(state, { kind: 'confirm-import-puzzle', fileContent: json }, deps);

    expect(result.state.puzzle.key).toBe(PuzzleKey.try(IMPORT_UUID));
    expect(result.state.puzzle.gridSize).toBe(GridSize.of(2));
    expect(result.state.mode).toBe('fill');
    expect(result.state.cursor).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('export-incomplete is delegated: emits download event with serialized content', () => {
    const state = blank();
    const result = reduceBuilder(state, { kind: 'export-incomplete' }, deps);

    expect(result.events.length).toBe(1);
    expect(result.events[0]!.kind).toBe('download');
  });

  it('export-complete is delegated: when puzzle is complete, emits download', () => {
    const state = completePuzzleState();
    const result = reduceBuilder(state, { kind: 'export-complete' }, deps);

    expect(result.events.length).toBe(1);
    expect(result.events[0]!.kind).toBe('download');
  });

  it('export-complete is delegated: when puzzle is incomplete, emits toast events with each violation', () => {
    const state = fillStateWithWords([]);
    const result = reduceBuilder(state, { kind: 'export-complete' }, deps);

    expect(result.events.length).toBeGreaterThan(1);
    expect(result.events.every((e) => e.kind === 'toast' && e.toastKind === 'error')).toBe(true);
    expect(result.events.some((e) => e.kind === 'download')).toBe(false);
  });

  it('request-reset-builder is delegated: blank state executes reset', () => {
    const state = blank();
    const originalKey = state.puzzle.key;

    const result = reduceBuilder(state, { kind: 'request-reset-builder' }, deps);

    expect(result.state.puzzle.gridSize).toBe(GridSize.DEFAULT);
    expect(result.state.puzzle.grid.length).toBe(Number(GridSize.DEFAULT));
    expect(result.state.puzzle.key).not.toBe(originalKey);
    expect(result.events).toEqual([{ kind: 'clear-builder-storage' }]);
  });

  it('request-reset-builder is delegated: non-blank state emits modal-request', () => {
    const base = blank();
    const grid = GridOps.setCell(base.puzzle.grid, Row.of(0), Col.of(0), Cell.setAnswerLetter(Cell.white(), Letter.try('A')!));
    const state = { ...base, mode: 'fill' as const, puzzle: Puzzle.withGrid(base.puzzle, grid) };

    const result = reduceBuilder(state, { kind: 'request-reset-builder' }, deps);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([
      {
        kind: 'modal-request',
        modal: { kind: 'confirm-reset-builder' },
        confirmIntent: { kind: 'confirm-reset-builder' },
      },
    ]);
  });

  it('confirm-reset-builder is delegated: executes unconditionally', () => {
    const base = blank();
    const grid = GridOps.setCell(base.puzzle.grid, Row.of(0), Col.of(0), Cell.setAnswerLetter(Cell.white(), Letter.try('A')!));
    const state = { ...base, mode: 'fill' as const, puzzle: Puzzle.withGrid(base.puzzle, grid) };

    const result = reduceBuilder(state, { kind: 'confirm-reset-builder' }, deps);

    expect(result.state.puzzle.gridSize).toBe(GridSize.DEFAULT);
    expect(result.state.mode).toBe('design');
    expect(result.state.subMode).toEqual({ kind: 'none' });
    expect(result.state.cursor).toBeNull();
    expect(result.state.puzzle.grid.every((row) => row.every((cell) => cell.answerLetter === null))).toBe(true);
    expect(result.events).toEqual([{ kind: 'clear-builder-storage' }]);
  });
});
