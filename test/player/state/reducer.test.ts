import { describe, expect, it } from 'vitest';
import { reducePlayer } from '../../../src/player/state/reducer';
import { PlayerState } from '../../../src/player/state/state';
import { SeededRng } from '../../fakes/SeededRng';
import { FakeClock } from '../../fakes/FakeClock';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { Letter } from '../../../src/domain/letter/Letter';
import { Cell } from '../../../src/domain/grid/Cell';
import { WordDerivation } from '../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../src/domain/word/Numbering';
import { Anagram } from '../../../src/domain/anagram/Anagram';

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

  it('clear-errors is delegated: clears incorrect cells playerLetter and clears checkResult', () => {
    const puzzle = Puzzle.blank(GridSize.of(2), PuzzleKey.generate(new SeededRng(1)));
    const words = Numbering.assign(puzzle.grid, WordDerivation.derive(puzzle.grid));
    let state = PlayerState.loaded(Puzzle.withWords(puzzle, words));
    if (state.phase !== 'solving') throw new Error('expected solving');

    let grid = state.puzzle.grid;
    grid = GridOps.setCell(
      grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(
        Cell.setPlayerLetter(GridOps.cellAt(grid, Row.of(0), Col.of(0)), Letter.try('A')!),
        Letter.try('A')!,
      ),
    );
    grid = GridOps.setCell(
      grid,
      Row.of(0),
      Col.of(1),
      Cell.setAnswerLetter(
        Cell.setPlayerLetter(GridOps.cellAt(grid, Row.of(0), Col.of(1)), Letter.try('X')!),
        Letter.try('B')!,
      ),
    );
    state = { ...state, puzzle: { ...state.puzzle, grid } };

    const checked = reducePlayer(state, { kind: 'check' }, deps);
    if (checked.state.phase !== 'solving') throw new Error('expected solving');
    expect(checked.state.checkResult?.classification).toBe('incomplete-incorrect');

    const result = reducePlayer(checked.state, { kind: 'clear-errors' }, deps);

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(1)).playerLetter).toBe(null);
    expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(
      Letter.try('A'),
    );
    expect(result.state.checkResult).toBe(null);
    expect(result.events).toEqual([]);
  });

  it('clear-errors is no-op when checkResult is null', () => {
    const state = solvingState();
    const result = reducePlayer(state, { kind: 'clear-errors' }, deps);
    expect(result.state).toBe(state);
  });

  it('check is delegated: solving phase computes CheckResult', () => {
    const puzzle = Puzzle.blank(GridSize.of(2), PuzzleKey.generate(new SeededRng(1)));
    const words = Numbering.assign(puzzle.grid, WordDerivation.derive(puzzle.grid));
    let state = PlayerState.loaded(Puzzle.withWords(puzzle, words));
    if (state.phase !== 'solving') throw new Error('expected solving');

    let grid = state.puzzle.grid;
    grid = GridOps.setCell(
      grid,
      Row.of(0),
      Col.of(0),
      Cell.setAnswerLetter(
        Cell.setPlayerLetter(GridOps.cellAt(grid, Row.of(0), Col.of(0)), Letter.try('A')!),
        Letter.try('A')!,
      ),
    );
    grid = GridOps.setCell(
      grid,
      Row.of(0),
      Col.of(1),
      Cell.setAnswerLetter(
        Cell.setPlayerLetter(GridOps.cellAt(grid, Row.of(0), Col.of(1)), Letter.try('B')!),
        Letter.try('B')!,
      ),
    );
    grid = GridOps.setCell(
      grid,
      Row.of(1),
      Col.of(0),
      Cell.setAnswerLetter(
        Cell.setPlayerLetter(GridOps.cellAt(grid, Row.of(1), Col.of(0)), Letter.try('C')!),
        Letter.try('C')!,
      ),
    );
    grid = GridOps.setCell(
      grid,
      Row.of(1),
      Col.of(1),
      Cell.setAnswerLetter(
        Cell.setPlayerLetter(GridOps.cellAt(grid, Row.of(1), Col.of(1)), Letter.try('D')!),
        Letter.try('D')!,
      ),
    );
    state = { ...state, puzzle: { ...state.puzzle, grid } };

    const result = reducePlayer(state, { kind: 'check' }, deps);

    if (result.state.phase !== 'solving') throw new Error('expected solving');
    expect(result.state.checkResult).toEqual({
      classification: 'complete-correct',
      incorrectCells: [],
      emptyCells: [],
    });
    expect(result.events).toEqual([]);
  });

  it('returns ReducerResult shape (state + events: [])', () => {
    const result = reducePlayer(importState(), { kind: 'import-new-puzzle' }, deps);
    expect(result.events).toEqual([]);
  });

  describe('import-puzzle delegate', () => {
    const VALID_UUID = '00000000-0000-4000-8000-000000000000';

    function makeCellJson(
      black: boolean,
      puzzleLetter: string | null = null,
    ): {
      black: boolean;
      puzzleLetter: string | null;
      spaceRight: boolean;
      spaceBottom: boolean;
      hyphenRight: boolean;
      hyphenBottom: boolean;
    } {
      return {
        black,
        puzzleLetter,
        spaceRight: false,
        spaceBottom: false,
        hyphenRight: false,
        hyphenBottom: false,
      };
    }

    function makeCompleteFixture(): string {
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
        words: [
          {
            startRow: 0,
            startCol: 0,
            direction: 'across',
            length: 2,
            number: 1,
            clue: 'Head clue',
            nextWord: null,
          },
        ],
      });
    }

    it('import-puzzle: valid complete file transitions to solving phase and emits load-player-progress', () => {
      const result = reducePlayer(
        importState(),
        { kind: 'import-puzzle', fileContent: makeCompleteFixture() },
        deps,
      );

      expect(result.state.phase).toBe('solving');
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({ kind: 'load-player-progress', key: expect.any(String) });
    });

    it('import-puzzle: parse failure sets lastImportError and emits error toast', () => {
      const result = reducePlayer(
        importState(),
        { kind: 'import-puzzle', fileContent: 'not json' },
        deps,
      );

      expect(result.state.phase).toBe('import');
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        kind: 'toast',
        toastKind: 'error',
        message: 'File is not valid JSON.',
      });
    });

    it('import-puzzle: incomplete file (fileType !== "complete") is rejected with toast', () => {
      const incomplete = JSON.stringify({
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
        words: [
          {
            startRow: 0,
            startCol: 0,
            direction: 'across',
            length: 2,
            number: 1,
            clue: '',
            nextWord: null,
          },
        ],
        displacedClues: [],
      });

      const result = reducePlayer(
        importState(),
        { kind: 'import-puzzle', fileContent: incomplete },
        deps,
      );

      expect(result.state.phase).toBe('import');
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        kind: 'toast',
        toastKind: 'error',
        message: 'Only complete puzzle files can be loaded into the Player.',
      });
    });
  });

  describe('apply-loaded-progress delegate', () => {
    const VALID_UUID = '00000000-0000-4000-8000-000000000000';

    function makeCompleteFixture(): string {
      return JSON.stringify({
        version: 1,
        type: 'complete',
        key: VALID_UUID,
        gridSize: 2,
        title: 'Title',
        author: 'Author',
        grid: [
          [
            { black: false, puzzleLetter: 'A', spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
            { black: false, puzzleLetter: 'B', spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
          ],
          [
            { black: true, puzzleLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
            { black: true, puzzleLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
          ],
        ],
        words: [
          {
            startRow: 0,
            startCol: 0,
            direction: 'across',
            length: 2,
            number: 1,
            clue: 'Head clue',
            nextWord: null,
          },
        ],
      });
    }

    function loadedFromFixture() {
      const parsed = reducePlayer(
        importState(),
        { kind: 'import-puzzle', fileContent: makeCompleteFixture() },
        deps,
      );
      expect(parsed.state.phase).toBe('solving');
      return parsed.state;
    }

    it('apply-loaded-progress: applies matching-gridSize saved letters to white cells', () => {
      const state = loadedFromFixture();
      const result = reducePlayer(
        state,
        {
          kind: 'apply-loaded-progress',
          playerLetters: [
            [Letter.try('X'), Letter.try('Y')],
            [Letter.try('Z'), Letter.try('W')],
          ],
          savedGridSize: GridSize.of(2),
        },
        deps,
      );

      expect(result.state.phase).toBe('solving');
      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(
        Letter.try('X'),
      );
      expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(1)).playerLetter).toBe(
        Letter.try('Y'),
      );
    });

    it('apply-loaded-progress: no-op when gridSize mismatch', () => {
      const state = loadedFromFixture();
      const result = reducePlayer(
        state,
        {
          kind: 'apply-loaded-progress',
          playerLetters: [[Letter.try('X'), Letter.try('Y')]],
          savedGridSize: GridSize.of(13),
        },
        deps,
      );

      expect(result.state).toBe(state);
    });

    it('apply-loaded-progress: skips white cells where saved letter is null', () => {
      const state = loadedFromFixture();
      const result = reducePlayer(
        state,
        {
          kind: 'apply-loaded-progress',
          playerLetters: [[Letter.try('X'), null]],
          savedGridSize: GridSize.of(2),
        },
        deps,
      );

      expect(result.state.phase).toBe('solving');
      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(
        Letter.try('X'),
      );
      expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(1)).playerLetter).toBe(null);
    });

    it('apply-loaded-progress: silently drops saved letters targeting now-black cells (FR-80)', () => {
      const state = loadedFromFixture();
      const result = reducePlayer(
        state,
        {
          kind: 'apply-loaded-progress',
          playerLetters: [
            [Letter.try('X'), Letter.try('Y')],
            [Letter.try('Z'), Letter.try('W')],
          ],
          savedGridSize: GridSize.of(2),
        },
        deps,
      );

      expect(result.state.phase).toBe('solving');
      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(1), Col.of(0)).playerLetter).toBe(null);
      expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(1), Col.of(1)).playerLetter).toBe(null);
      expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(1), Col.of(0)).black).toBe(true);
    });
  });

  describe('reset-player delegate', () => {
    const VALID_UUID = '00000000-0000-4000-8000-000000000000';

    function makeCompleteFixture(): string {
      return JSON.stringify({
        version: 1,
        type: 'complete',
        key: VALID_UUID,
        gridSize: 2,
        title: 'Title',
        author: 'Author',
        grid: [
          [
            { black: false, puzzleLetter: 'A', spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
            { black: false, puzzleLetter: 'B', spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
          ],
          [
            { black: true, puzzleLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
            { black: true, puzzleLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false },
          ],
        ],
        words: [
          {
            startRow: 0,
            startCol: 0,
            direction: 'across',
            length: 2,
            number: 1,
            clue: 'Head clue',
            nextWord: null,
          },
        ],
      });
    }

    function loadedFromFixture() {
      const parsed = reducePlayer(
        importState(),
        { kind: 'import-puzzle', fileContent: makeCompleteFixture() },
        deps,
      );
      expect(parsed.state.phase).toBe('solving');
      return parsed.state;
    }

    it('request-reset-player is delegated: solving phase emits modal-request', () => {
      const state = loadedFromFixture();
      const result = reducePlayer(state, { kind: 'request-reset-player' }, deps);

      expect(result.events).toEqual([
        {
          kind: 'modal-request',
          modal: { kind: 'confirm-reset-player' },
          confirmIntent: { kind: 'confirm-reset-player' },
        },
      ]);
      expect(result.state).toBe(state);
    });

    it('request-reset-player is delegated: import phase is no-op', () => {
      const state = importState();
      const result = reducePlayer(state, { kind: 'request-reset-player' }, deps);

      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
    });

    it('confirm-reset-player is delegated: clears player letters, cursor, checkResult, anagram; emits clear-player-storage', () => {
      let state = loadedFromFixture();
      if (state.phase !== 'solving') throw new Error('expected solving');

      state = {
        ...state,
        puzzle: {
          ...state.puzzle,
          grid: GridOps.setCell(
            state.puzzle.grid,
            Row.of(0),
            Col.of(0),
            Cell.setPlayerLetter(GridOps.cellAt(state.puzzle.grid, Row.of(0), Col.of(0)), Letter.try('X')),
          ),
        },
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
        checkResult: { classification: 'incomplete-correct' as const, incorrectCells: [], emptyCells: [] },
        anagram: {
          openedForWord: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const },
          input: '',
          scrambledArrangement: null,
        },
      };

      const result = reducePlayer(state, { kind: 'confirm-reset-player' }, deps);

      expect(result.state.phase).toBe('solving');
      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);
      expect(result.state.cursor).toBe(null);
      expect(result.state.checkResult).toBe(null);
      expect(result.state.anagram).toBe(null);
      expect(result.events).toEqual([{ kind: 'clear-player-storage', key: state.puzzle.key }]);
    });
  });

  describe('anagram delegate', () => {
    function solvingStateWith5x5Words() {
      const puzzle = Puzzle.blank(GridSize.of(5), PuzzleKey.generate(new SeededRng(1)));
      let grid = puzzle.grid;
      grid = GridOps.setCell(grid, Row.of(0), Col.of(3), Cell.black());
      grid = GridOps.setCell(grid, Row.of(0), Col.of(4), Cell.black());
      const words = Numbering.assign(grid, WordDerivation.derive(grid));
      return PlayerState.loaded(Puzzle.withWords(Puzzle.withGrid(puzzle, grid), words));
    }

    function withPlayerLetter(
      state: ReturnType<typeof solvingStateWith5x5Words>,
      r: number,
      c: number,
      letter: string,
    ): ReturnType<typeof solvingStateWith5x5Words> {
      if (state.phase !== 'solving') throw new Error('expected solving');
      const cell = GridOps.cellAt(state.puzzle.grid, Row.of(r), Col.of(c));
      const newGrid = GridOps.setCell(
        state.puzzle.grid,
        Row.of(r),
        Col.of(c),
        Cell.setPlayerLetter(cell, Letter.try(letter)!),
      );
      return { ...state, puzzle: Puzzle.withGrid(state.puzzle, newGrid) };
    }

    it('open-anagram-helper is delegated: opens modal for currently selected word', () => {
      let state = solvingStateWith5x5Words();
      if (state.phase !== 'solving') throw new Error('expected solving');
      state = {
        ...state,
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
      };
      const expectedKey = state.puzzle.words[0]!.key;

      const result = reducePlayer(state, { kind: 'open-anagram-helper' }, deps);

      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(result.state.anagram).toEqual({
        openedForWord: expectedKey,
        input: '',
        scrambledArrangement: null,
      });
      expect(result.state.puzzle).toBe(state.puzzle);
      expect(result.state.cursor).toEqual(state.cursor);
    });

    it('anagram-input is delegated: writes filtered input to modal state', () => {
      let state = solvingStateWith5x5Words();
      if (state.phase !== 'solving') throw new Error('expected solving');
      state = {
        ...state,
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
        anagram: {
          openedForWord: state.puzzle.words[0]!.key,
          input: '',
          scrambledArrangement: null,
        },
      };

      const result = reducePlayer(state, { kind: 'anagram-input', input: 'abc123' }, deps);

      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(result.state.anagram?.input).toBe('ABC');
      expect(result.state.anagram?.scrambledArrangement).toBe(null);
    });

    it('anagram-scramble is delegated: produces scrambledArrangement via Anagram.scramble', () => {
      let state = solvingStateWith5x5Words();
      if (state.phase !== 'solving') throw new Error('expected solving');
      state = withPlayerLetter(state, 0, 0, 'A');
      if (state.phase !== 'solving') throw new Error('expected solving');
      state = {
        ...state,
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
        anagram: {
          openedForWord: state.puzzle.words[0]!.key,
          input: 'ABC',
          scrambledArrangement: null,
        },
      };
      const word = state.puzzle.words.find((w) =>
        w.key.startRow === Row.of(0) &&
        w.key.startCol === Col.of(0) &&
        w.key.direction === 'across'
      )!;
      const { entries } = Anagram.buildWordModel(state.puzzle.grid, word);
      const expected = Anagram.scramble(entries, 'ABC', new SeededRng(42))
        .map((e) => e.letter)
        .filter((l): l is Letter => l !== null);

      const result = reducePlayer(state, { kind: 'anagram-scramble' }, {
        rng: new SeededRng(42),
        now: clock.now.bind(clock),
      });

      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(result.state.anagram?.scrambledArrangement).toEqual(expected);
      expect(result.state.puzzle).toBe(state.puzzle);
    });

    it('close-anagram-helper is delegated: closes modal', () => {
      let state = solvingStateWith5x5Words();
      if (state.phase !== 'solving') throw new Error('expected solving');
      state = {
        ...state,
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
        anagram: {
          openedForWord: state.puzzle.words[0]!.key,
          input: '',
          scrambledArrangement: null,
        },
      };

      const result = reducePlayer(state, { kind: 'close-anagram-helper' }, deps);

      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(result.state.anagram).toBe(null);
      expect(result.state.puzzle).toBe(state.puzzle);
    });

    it('escape is delegated: closes anagram modal when open', () => {
      let state = solvingStateWith5x5Words();
      if (state.phase !== 'solving') throw new Error('expected solving');
      state = {
        ...state,
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' as const },
        anagram: {
          openedForWord: state.puzzle.words[0]!.key,
          input: '',
          scrambledArrangement: null,
        },
      };

      const result = reducePlayer(state, { kind: 'escape' }, deps);

      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(result.state.anagram).toBe(null);
      expect(result.state.puzzle).toBe(state.puzzle);
      expect(result.state.cursor).toEqual(state.cursor);
    });
  });

  describe('cursor-navigation delegate', () => {
    function solvingStateWithWords() {
      const puzzle = Puzzle.blank(GridSize.of(2), PuzzleKey.generate(new SeededRng(1)));
      const words = Numbering.assign(puzzle.grid, WordDerivation.derive(puzzle.grid));
      return PlayerState.loaded(Puzzle.withWords(puzzle, words));
    }

    it('select-cell is delegated: solving-phase cursor navigation', () => {
      const result = reducePlayer(
        solvingStateWithWords(),
        { kind: 'select-cell', row: Row.of(0), col: Col.of(0) },
        deps,
      );

      expect(result.state.phase).toBe('solving');
      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(result.state.cursor).toEqual({
        row: Row.of(0),
        col: Col.of(0),
        direction: 'across',
      });
    });

    it('move-cursor is delegated: solving-phase cursor moves and clears checkResult', () => {
      let state = solvingStateWithWords();
      if (state.phase !== 'solving') throw new Error('expected solving');
      state = {
        ...state,
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' },
        checkResult: {
          classification: 'incomplete-correct' as const,
          incorrectCells: [],
          emptyCells: [],
        },
      };

      const result = reducePlayer(state, { kind: 'move-cursor', direction: 'across', sign: 1 }, deps);

      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(result.state.cursor).toEqual({
        row: Row.of(0),
        col: Col.of(1),
        direction: 'across',
      });
      expect(result.state.checkResult).toBe(null);
    });

    it('click-clue-panel-word is delegated: solving-phase cursor jumps to word start', () => {
      const state = solvingStateWithWords();
      if (state.phase !== 'solving') throw new Error('expected solving');
      const wordKey = state.puzzle.words[0]!.key;

      const result = reducePlayer(state, { kind: 'click-clue-panel-word', wordKey }, deps);

      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(result.state.cursor).toEqual({
        row: wordKey.startRow,
        col: wordKey.startCol,
        direction: wordKey.direction,
      });
    });

    it('type-letter is delegated: writes playerLetter and advances cursor', () => {
      let state = solvingStateWithWords();
      if (state.phase !== 'solving') throw new Error('expected solving');
      state = {
        ...state,
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' },
      };

      const result = reducePlayer(state, { kind: 'type-letter', letter: Letter.try('A')! }, deps);

      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(
        Letter.try('A'),
      );
      expect(result.state.cursor).toEqual({
        row: Row.of(0),
        col: Col.of(1),
        direction: 'across',
      });
    });

    it('backspace is delegated: deletes current letter; does not move cursor', () => {
      let state = solvingStateWithWords();
      if (state.phase !== 'solving') throw new Error('expected solving');
      state = {
        ...state,
        puzzle: {
          ...state.puzzle,
          grid: GridOps.setCell(
            state.puzzle.grid,
            Row.of(0),
            Col.of(0),
            Cell.setPlayerLetter(GridOps.cellAt(state.puzzle.grid, Row.of(0), Col.of(0)), Letter.try('X')),
          ),
        },
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' },
      };

      const result = reducePlayer(state, { kind: 'backspace' }, deps);

      if (result.state.phase !== 'solving') throw new Error('expected solving');
      expect(GridOps.cellAt(result.state.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBe(null);
      expect(result.state.cursor).toEqual({
        row: Row.of(0),
        col: Col.of(0),
        direction: 'across',
      });
    });
  });
});
