import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppState } from '../../app/state/state';
import type { AppState as AppStateType } from '../../app/state/state';
import { BuilderState } from '../../builder/state/state';
import { PlayerState } from '../../player/state/state';
import { bootApp, _resetAppStateForTests, dispatch } from './appStore.svelte';
import {
  playerShellVM,
  dispatchPlayer,
  getPlayerState,
  dispatchSelectCell,
  dispatchTypeLetter,
  dispatchBackspace,
  dispatchMoveCursor,
  dispatchImportPuzzle,
  dispatchCheck,
  dispatchOpenAnagramHelper,
  dispatchCloseAnagramHelper,
  dispatchAnagramInput,
  dispatchAnagramScramble,
} from './playerStore.svelte';
import { setPorts, resetPorts } from './ports';
import { createPersistenceScheduler } from './persistenceScheduler';
import { InMemoryStoragePort } from '../../../test/fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../../test/fakes/StubDownloadPort';
import { SeededRng } from '../../../test/fakes/SeededRng';
import { FakeClock } from '../../../test/fakes/FakeClock';
import { GridSize } from '../../domain/grid/GridSize';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import { Puzzle } from '../../domain/puzzle/Puzzle';
import { Cell } from '../../domain/grid/Cell';
import { GridOps } from '../../domain/grid/GridOps';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';
import { Letter } from '../../domain/letter/Letter';
import { Title } from '../../domain/puzzle/Title';
import { Author } from '../../domain/puzzle/Author';
import { WordDerivation } from '../../domain/word/WordDerivation';
import { Numbering } from '../../domain/word/Numbering';
import { serializeComplete } from '../../domain/format/v1';

function makeRng(seed: number): SeededRng {
  return new SeededRng(seed);
}

function makeCompletePuzzle(seed: number, size: number): Puzzle {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  let puzzle = Puzzle.blank(GridSize.of(size), key);
  let grid = puzzle.grid;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const letter = Letter.try(String.fromCharCode(65 + ((r * size + c) % 26)));
      if (letter === null) throw new Error('makeCompletePuzzle: invalid letter');
      grid = GridOps.setCell(grid, Row.of(r), Col.of(c), Cell.setAnswerLetter(Cell.white(), letter));
    }
  }

  puzzle = Puzzle.withGrid(puzzle, grid);
  const derived = WordDerivation.derive(grid);
  const numbered = Numbering.assign(grid, derived);
  const wordsWithClues = numbered.map((w) => ({ ...w, clue: 'Clue' }));
  puzzle = Puzzle.withWords(puzzle, wordsWithClues);
  puzzle = Puzzle.withMetadata(puzzle, Title.try('Test Title'), Author.try('Test Author'));
  return puzzle;
}

function makeBlankAppState(seed: number): AppStateType {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  return AppState.blank(GridSize.of(15), key);
}

describe('playerStore.svelte.ts', () => {
  let inMemoryStorage: InMemoryStoragePort;
  let stubDownload: StubDownloadPort;
  let seededRng: SeededRng;
  let fakeClock: FakeClock;

  beforeEach(() => {
    inMemoryStorage = new InMemoryStoragePort();
    stubDownload = new StubDownloadPort();
    seededRng = makeRng(42);
    fakeClock = new FakeClock(0);

    setPorts({ storage: inMemoryStorage, download: stubDownload });

    const initial = makeBlankAppState(42);
    bootApp(initial, { rng: seededRng, now: () => fakeClock.now() }, createPersistenceScheduler(inMemoryStorage));
  });

  afterEach(() => {
    resetPorts();
  });

  it('playerStore: playerShellVM() returns a PlayerShellVM with phase="import" by default', () => {
    const vm = playerShellVM();

    expect(vm.phase).toBe('import');
  });

  it('playerStore: playerShellVM() import phase: title="", author="", anagram.open=false, checkResult=null, toolbar.* all false', () => {
    const vm = playerShellVM();

    expect(vm.title).toBe('');
    expect(vm.author).toBe('');
    expect(vm.anagram.open).toBe(false);
    expect(vm.checkResult).toBeNull();
    expect(vm.toolbar.canCheck).toBe(false);
    expect(vm.toolbar.canClearErrors).toBe(false);
    expect(vm.toolbar.canReset).toBe(false);
    expect(vm.toolbar.canOpenAnagram).toBe(false);
    expect(vm.toolbar.canImportNew).toBe(false);
  });

  it('playerStore: playerShellVM() solving phase (after _resetAppStateForTests): phase="solving", title/author populated from puzzle', () => {
    const puzzle = makeCompletePuzzle(1, 3);
    const rng = makeRng(1);
    const key = PuzzleKey.generate(rng);
    const state: AppStateType = {
      route: 'landing',
      builder: BuilderState.blank(GridSize.of(15), key),
      player: PlayerState.loaded(puzzle),
      toasts: [],
      modal: null,
      pendingConfirmIntent: null,
    };
    _resetAppStateForTests(state);

    const vm = playerShellVM();

    expect(vm.phase).toBe('solving');
    expect(vm.title).toBe('Test Title');
    expect(vm.author).toBe('Test Author');
  });

  it('playerStore: dispatchPlayer import-puzzle (with a valid complete JSON file) transitions state.player to phase=solving', () => {
    const puzzle = makeCompletePuzzle(2, 3);
    const fileContent = serializeComplete(puzzle);

    dispatchPlayer({ kind: 'import-puzzle', fileContent });

    const vm = playerShellVM();

    expect(vm.phase).toBe('solving');
    expect(vm.toolbar.canCheck).toBe(true);
  });

  it('playerStore: dispatchPlayer select-cell intent (during solving) sets state.player.cursor', () => {
    const puzzle = makeCompletePuzzle(3, 3);
    const fileContent = serializeComplete(puzzle);
    dispatchPlayer({ kind: 'import-puzzle', fileContent });
    dispatch({ kind: 'navigate', route: 'play' });

    dispatchPlayer({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });

    const player = getPlayerState();
    expect(player.phase).toBe('solving');
    if (player.phase !== 'solving') throw new Error('unreachable');
    expect(player.cursor).not.toBeNull();
    expect(player.cursor!.row).toBe(Row.of(0));
    expect(player.cursor!.col).toBe(Col.of(0));
  });

  it('playerStore: dispatchPlayer then playerShellVM() reflects new state', () => {
    const puzzle = makeCompletePuzzle(4, 3);
    const fileContent = serializeComplete(puzzle);
    dispatchPlayer({ kind: 'import-puzzle', fileContent });
    dispatch({ kind: 'navigate', route: 'play' });
    dispatchPlayer({ kind: 'select-cell', row: Row.of(1), col: Col.of(1) });

    const vm = playerShellVM();

    expect(vm.phase).toBe('solving');
    expect(vm.grid.cursor).not.toBeNull();
    expect(vm.grid.cursor!.row).toBe(Row.of(1));
    expect(vm.grid.cursor!.col).toBe(Col.of(1));
  });

  it('playerStore: getPlayerState() returns the live PlayerState reference', () => {
    const before = getPlayerState();
    expect(before.phase).toBe('import');

    const puzzle = makeCompletePuzzle(5, 3);
    const fileContent = serializeComplete(puzzle);
    dispatchPlayer({ kind: 'import-puzzle', fileContent });

    const after = getPlayerState();
    expect(after.phase).toBe('solving');
    expect(after).toBe(getPlayerState());
  });

  describe('primitive dispatch helpers', () => {
    function enterSolvingPhase(): void {
      const puzzle = makeCompletePuzzle(10, 3);
      const fileContent = serializeComplete(puzzle);
      dispatchImportPuzzle(fileContent);
      dispatch({ kind: 'navigate', route: 'play' });
    }

    it('playerStore: dispatchSelectCell(0,0) sets player.cursor', () => {
      enterSolvingPhase();
      dispatchSelectCell(0, 0);

      const player = getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.cursor).not.toBeNull();
      expect(player.cursor!.row).toBe(Row.of(0));
      expect(player.cursor!.col).toBe(Col.of(0));
    });

    it('playerStore: dispatchTypeLetter("A") sets player cell letter', () => {
      enterSolvingPhase();
      dispatchSelectCell(0, 0);
      dispatchTypeLetter('A');

      const player = getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.puzzle.grid[0]![0]!.playerLetter).toEqual(Letter.try('A'));
    });

    it('playerStore: dispatchTypeLetter silently drops "!"', () => {
      enterSolvingPhase();
      dispatchSelectCell(0, 0);
      dispatchTypeLetter('!');

      const player = getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.puzzle.grid[0]![0]!.playerLetter).toBeNull();
    });

    it('playerStore: dispatchBackspace clears the selected cell', () => {
      enterSolvingPhase();
      dispatchSelectCell(0, 0);
      dispatchTypeLetter('A');
      dispatchBackspace();

      const player = getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.puzzle.grid[0]![0]!.playerLetter).toBeNull();
    });

    it('playerStore: dispatchImportPuzzle sets lastImportError to null on valid JSON', () => {
      const puzzle = makeCompletePuzzle(11, 3);
      const fileContent = serializeComplete(puzzle);
      dispatchImportPuzzle(fileContent);

      const player = getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(playerShellVM().importError).toBeNull();
    });

    it('playerStore: dispatchCheck sets checkResult with no emptyCells and no incorrectCells when grid empty/unanswered', () => {
      enterSolvingPhase();
      dispatchCheck();

      const player = getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.checkResult).not.toBeNull();
      expect(player.checkResult!.incorrectCells).toEqual([]);
      expect(player.checkResult!.classification).toBe('incomplete-correct');
    });

    it('playerStore: dispatchOpenAnagramHelper opens anagram modal', () => {
      enterSolvingPhase();
      dispatchSelectCell(0, 0);
      dispatchOpenAnagramHelper();

      expect(playerShellVM().anagram.open).toBe(true);
    });

    it('playerStore: dispatchCloseAnagramHelper closes anagram modal', () => {
      enterSolvingPhase();
      dispatchSelectCell(0, 0);
      dispatchOpenAnagramHelper();
      dispatchCloseAnagramHelper();

      expect(playerShellVM().anagram.open).toBe(false);
    });

    it('playerStore: dispatchAnagramInput updates anagram modal input', () => {
      enterSolvingPhase();
      dispatchSelectCell(0, 0);
      dispatchOpenAnagramHelper();
      dispatchAnagramInput('CBA');

      expect(playerShellVM().anagram.input).toBe('CBA');
    });

    it('playerStore: dispatchAnagramScramble populates scrambledArrangement', () => {
      enterSolvingPhase();
      dispatchSelectCell(0, 0);
      dispatchOpenAnagramHelper();
      dispatchAnagramInput('CBA');
      dispatchAnagramScramble();

      const player = getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.anagram).not.toBeNull();
      expect(player.anagram!.scrambledArrangement).not.toBeNull();
      expect(player.anagram!.scrambledArrangement!.length).toBeGreaterThan(0);
    });

    it('playerStore: dispatchMoveCursor("down") does not throw', () => {
      enterSolvingPhase();
      expect(() => dispatchMoveCursor('down')).not.toThrow();
    });
  });
});
