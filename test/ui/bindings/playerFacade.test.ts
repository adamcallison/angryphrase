import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppState } from '../../../src/app/state/state';
import type { AppState as AppStateType } from '../../../src/app/state/state';
import { BuilderState } from '../../../src/builder/state/state';
import { PlayerState } from '../../../src/player/state/state';
import { createAppStore, type AppPorts, type AppStore } from '../../../src/ui/bindings/appStore.svelte';
import { createPlayerFacade, type PlayerFacade } from '../../../src/ui/bindings/playerFacade';
import { createPersistenceScheduler } from '../../../src/ui/bindings/persistenceScheduler';
import { InMemoryStoragePort } from '../../fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../fakes/StubDownloadPort';
import { SeededRng } from '../../fakes/SeededRng';
import { FakeClock } from '../../fakes/FakeClock';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { Cell } from '../../../src/domain/grid/Cell';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { Letter } from '../../../src/domain/letter/Letter';
import { Title } from '../../../src/domain/puzzle/Title';
import { Author } from '../../../src/domain/puzzle/Author';
import { WordDerivation } from '../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../src/domain/word/Numbering';
import { serializeComplete } from '../../../src/domain/format/v1';

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

describe('playerFacade.ts', () => {
  let inMemoryStorage: InMemoryStoragePort;
  let stubDownload: StubDownloadPort;
  let seededRng: SeededRng;
  let fakeClock: FakeClock;
  let store: AppStore;
  let playerFacade: PlayerFacade;

  function makePorts(): AppPorts {
    return { storage: inMemoryStorage, download: stubDownload, filePick: { pickFile: async () => '', readDroppedFile: async () => '' } };
  }

  beforeEach(() => {
    inMemoryStorage = new InMemoryStoragePort();
    stubDownload = new StubDownloadPort();
    seededRng = makeRng(42);
    fakeClock = new FakeClock(0);

    const initial = makeBlankAppState(42);
    store = createAppStore(
      initial,
      { rng: seededRng, now: () => fakeClock.now() },
      makePorts(),
      createPersistenceScheduler(inMemoryStorage),
    );
    playerFacade = createPlayerFacade(store);
  });

  it('playerFacade: playerShellVM() returns a PlayerShellVM with phase="import" by default', () => {
    const vm = playerFacade.playerShellVM();

    expect(vm.phase).toBe('import');
  });

  it('playerFacade: playerShellVM() import phase: title="", author="", anagram.open=false, checkResult=null, toolbar.* all false', () => {
    const vm = playerFacade.playerShellVM();

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

  it('playerFacade: playerShellVM() solving phase (after fresh createAppStore): phase="solving", title/author populated from puzzle', () => {
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
    const freshStore = createAppStore(
      state,
      { rng, now: () => fakeClock.now() },
      makePorts(),
      createPersistenceScheduler(inMemoryStorage),
    );
    const freshPlayerFacade = createPlayerFacade(freshStore);

    const vm = freshPlayerFacade.playerShellVM();

    expect(vm.phase).toBe('solving');
    expect(vm.title).toBe('Test Title');
    expect(vm.author).toBe('Test Author');
  });

  it('playerFacade: dispatchPlayer import-puzzle (with a valid complete JSON file) transitions state.player to phase=solving', () => {
    const puzzle = makeCompletePuzzle(2, 3);
    const fileContent = serializeComplete(puzzle);

    playerFacade.dispatch({ kind: 'import-puzzle', fileContent });

    const vm = playerFacade.playerShellVM();

    expect(vm.phase).toBe('solving');
    expect(vm.toolbar.canCheck).toBe(true);
  });

  it('playerFacade: dispatchPlayer select-cell intent (during solving) sets state.player.cursor', () => {
    const puzzle = makeCompletePuzzle(3, 3);
    const fileContent = serializeComplete(puzzle);
    playerFacade.dispatch({ kind: 'import-puzzle', fileContent });
    store.dispatch({ kind: 'navigate', route: 'play' });

    playerFacade.dispatch({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });

    const player = playerFacade.getPlayerState();
    expect(player.phase).toBe('solving');
    if (player.phase !== 'solving') throw new Error('unreachable');
    expect(player.cursor).not.toBeNull();
    expect(player.cursor!.row).toBe(Row.of(0));
    expect(player.cursor!.col).toBe(Col.of(0));
  });

  it('playerFacade: dispatchPlayer then playerShellVM() reflects new state', () => {
    const puzzle = makeCompletePuzzle(4, 3);
    const fileContent = serializeComplete(puzzle);
    playerFacade.dispatch({ kind: 'import-puzzle', fileContent });
    store.dispatch({ kind: 'navigate', route: 'play' });
    playerFacade.dispatch({ kind: 'select-cell', row: Row.of(1), col: Col.of(1) });

    const vm = playerFacade.playerShellVM();

    expect(vm.phase).toBe('solving');
    expect(vm.grid.cursor).not.toBeNull();
    expect(vm.grid.cursor!.row).toBe(Row.of(1));
    expect(vm.grid.cursor!.col).toBe(Col.of(1));
  });

  it('playerFacade: getPlayerState() returns the live PlayerState reference', () => {
    const before = playerFacade.getPlayerState();
    expect(before.phase).toBe('import');

    const puzzle = makeCompletePuzzle(5, 3);
    const fileContent = serializeComplete(puzzle);
    playerFacade.dispatch({ kind: 'import-puzzle', fileContent });

    const after = playerFacade.getPlayerState();
    expect(after.phase).toBe('solving');
    expect(after).toBe(playerFacade.getPlayerState());
  });

  describe('primitive dispatch helpers', () => {
    function enterSolvingPhase(): void {
      const puzzle = makeCompletePuzzle(10, 3);
      const fileContent = serializeComplete(puzzle);
      playerFacade.actions.importScreen.importPuzzle(fileContent);
      store.dispatch({ kind: 'navigate', route: 'play' });
    }

    it('playerFacade: dispatchSelectCell(0,0) sets player.cursor', () => {
      enterSolvingPhase();
      playerFacade.actions.grid.selectCell(0, 0);

      const player = playerFacade.getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.cursor).not.toBeNull();
      expect(player.cursor!.row).toBe(Row.of(0));
      expect(player.cursor!.col).toBe(Col.of(0));
    });

    it('playerFacade: dispatchTypeLetter("A") sets player cell letter', () => {
      enterSolvingPhase();
      playerFacade.actions.grid.selectCell(0, 0);
      playerFacade.actions.grid.typeLetter('A');

      const player = playerFacade.getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.puzzle.grid[0]![0]!.playerLetter).toEqual(Letter.try('A'));
    });

    it('playerFacade: dispatchTypeLetter silently drops "!"', () => {
      enterSolvingPhase();
      playerFacade.actions.grid.selectCell(0, 0);
      playerFacade.actions.grid.typeLetter('!');

      const player = playerFacade.getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.puzzle.grid[0]![0]!.playerLetter).toBeNull();
    });

    it('playerFacade: dispatchBackspace clears the selected cell', () => {
      enterSolvingPhase();
      playerFacade.actions.grid.selectCell(0, 0);
      playerFacade.actions.grid.typeLetter('A');
      playerFacade.actions.grid.backspace();

      const player = playerFacade.getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.puzzle.grid[0]![0]!.playerLetter).toBeNull();
    });

    it('playerFacade: dispatchImportPuzzle sets lastImportError to null on valid JSON', () => {
      const puzzle = makeCompletePuzzle(11, 3);
      const fileContent = serializeComplete(puzzle);
      playerFacade.actions.importScreen.importPuzzle(fileContent);

      const player = playerFacade.getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(playerFacade.playerShellVM().importError).toBeNull();
    });

    it('playerFacade: dispatchCheck sets checkResult with no emptyCells and no incorrectCells when grid empty/unanswered', () => {
      enterSolvingPhase();
      playerFacade.actions.toolbar.check();

      const player = playerFacade.getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.checkResult).not.toBeNull();
      expect(player.checkResult!.incorrectCells).toEqual([]);
      expect(player.checkResult!.classification).toBe('incomplete-correct');
    });

    it('playerFacade: dispatchOpenAnagramHelper opens anagram modal', () => {
      enterSolvingPhase();
      playerFacade.actions.grid.selectCell(0, 0);
      playerFacade.actions.toolbar.openAnagramHelper();

      expect(playerFacade.playerShellVM().anagram.open).toBe(true);
    });

    it('playerFacade: dispatchCloseAnagramHelper closes anagram modal', () => {
      enterSolvingPhase();
      playerFacade.actions.grid.selectCell(0, 0);
      playerFacade.actions.toolbar.openAnagramHelper();
      playerFacade.actions.anagram.close();

      expect(playerFacade.playerShellVM().anagram.open).toBe(false);
    });

    it('playerFacade: dispatchAnagramInput updates anagram modal input', () => {
      enterSolvingPhase();
      playerFacade.actions.grid.selectCell(0, 0);
      playerFacade.actions.toolbar.openAnagramHelper();
      playerFacade.actions.anagram.input('CBA');

      expect(playerFacade.playerShellVM().anagram.input).toBe('CBA');
    });

    it('playerFacade: dispatchAnagramScramble populates scrambledArrangement', () => {
      enterSolvingPhase();
      playerFacade.actions.grid.selectCell(0, 0);
      playerFacade.actions.toolbar.openAnagramHelper();
      playerFacade.actions.anagram.input('CBA');
      playerFacade.actions.anagram.scramble();

      const player = playerFacade.getPlayerState();
      expect(player.phase).toBe('solving');
      if (player.phase !== 'solving') throw new Error('unreachable');
      expect(player.anagram).not.toBeNull();
      expect(player.anagram!.scrambledArrangement).not.toBeNull();
      expect(player.anagram!.scrambledArrangement!.length).toBeGreaterThan(0);
    });

    it('playerFacade: dispatchMoveCursor("down") does not throw', () => {
      enterSolvingPhase();
      expect(() => playerFacade.actions.grid.moveCursor('down', 1)).not.toThrow();
    });
  });

  it('playerFacade: pickFile delegates to appStore.getPorts().filePick', async () => {
    const filePick = { pickFile: vi.fn(async () => 'known-file-content'), readDroppedFile: vi.fn(async () => '') };
    const ports: AppPorts = { storage: inMemoryStorage, download: stubDownload, filePick };
    const storeWithPick = createAppStore(
      makeBlankAppState(42),
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
      createPersistenceScheduler(inMemoryStorage),
    );
    const playerWithPick = createPlayerFacade(storeWithPick);

    const result = await playerWithPick.pickFile();

    expect(filePick.pickFile).toHaveBeenCalledTimes(1);
    expect(result).toBe('known-file-content');
  });

  it('playerFacade: pickFile resolves null when the port resolves null (cancel is a silent pass-through, not a throw)', async () => {
    const filePick = { pickFile: async () => null, readDroppedFile: async () => '' };
    const ports: AppPorts = { storage: inMemoryStorage, download: stubDownload, filePick };
    const storeWithPick = createAppStore(
      makeBlankAppState(42),
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
      createPersistenceScheduler(inMemoryStorage),
    );
    const playerWithPick = createPlayerFacade(storeWithPick);

    const result = await playerWithPick.pickFile();

    expect(result).toBeNull();
  });

  it('playerFacade: importDroppedFile dispatches import-puzzle with the port-read text when readDroppedFile succeeds', async () => {
    const file = new File([], 'puzzle.json');
    const filePick = { pickFile: async () => '', readDroppedFile: async () => 'dropped text' };
    const ports: AppPorts = { storage: inMemoryStorage, download: stubDownload, filePick };
    const storeWithDrop = createAppStore(
      makeBlankAppState(42),
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
      createPersistenceScheduler(inMemoryStorage),
    );
    const playerWithDrop = createPlayerFacade(storeWithDrop);
    storeWithDrop.dispatch({ kind: 'navigate', route: 'play' });
    const dispatchSpy = vi.spyOn(storeWithDrop, 'dispatch');

    await playerWithDrop.actions.importScreen.importDroppedFile(file);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith({ kind: 'import-puzzle', fileContent: 'dropped text' });
  });

  it('playerFacade: importDroppedFile dispatches report-import-read-failure when readDroppedFile returns null', async () => {
    const file = new File([], 'puzzle.json');
    const filePick = { pickFile: async () => '', readDroppedFile: async () => null };
    const ports: AppPorts = { storage: inMemoryStorage, download: stubDownload, filePick };
    const storeWithDrop = createAppStore(
      makeBlankAppState(42),
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
      createPersistenceScheduler(inMemoryStorage),
    );
    const playerWithDrop = createPlayerFacade(storeWithDrop);
    storeWithDrop.dispatch({ kind: 'navigate', route: 'play' });
    const dispatchSpy = vi.spyOn(storeWithDrop, 'dispatch');

    await playerWithDrop.actions.importScreen.importDroppedFile(file);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith({ kind: 'report-import-read-failure' });
    expect(storeWithDrop.getToasts()).toHaveLength(1);
    expect(storeWithDrop.getToasts()[0]).toMatchObject({ kind: 'error', message: 'Could not read that file. Please try again.' });
    expect(playerWithDrop.getPlayerState()).toEqual({ phase: 'import', lastImportError: 'Could not read that file. Please try again.' });
  });

  it('playerFacade: two createPlayerFacade instances over two appStores are independent', () => {
    const storeA = createAppStore(
      makeBlankAppState(1),
      { rng: makeRng(1), now: () => fakeClock.now() },
      makePorts(),
      createPersistenceScheduler(inMemoryStorage),
    );
    const a = createPlayerFacade(storeA);
    const storeB = createAppStore(
      makeBlankAppState(2),
      { rng: makeRng(2), now: () => fakeClock.now() },
      makePorts(),
      createPersistenceScheduler(inMemoryStorage),
    );
    const b = createPlayerFacade(storeB);

    const puzzle = makeCompletePuzzle(99, 3);
    a.actions.importScreen.importPuzzle(serializeComplete(puzzle));

    expect(b.getPlayerState().phase).toBe('import');
  });
});
