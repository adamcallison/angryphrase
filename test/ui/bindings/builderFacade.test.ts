import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppState } from '../../../src/app/state/state';
import type { AppState as AppStateType } from '../../../src/app/state/state';
import { createAppStore, type AppPorts, type AppStore } from '../../../src/ui/bindings/appStore.svelte';
import { InMemoryStoragePort } from '../../fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../fakes/StubDownloadPort';
import { SeededRng } from '../../fakes/SeededRng';
import { FakeClock } from '../../fakes/FakeClock';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { Letter } from '../../../src/domain/letter/Letter';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { Cell } from '../../../src/domain/grid/Cell';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { WordDerivation } from '../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../src/domain/word/Numbering';
import { Title } from '../../../src/domain/puzzle/Title';
import { Author } from '../../../src/domain/puzzle/Author';
import { serializeComplete } from '../../../src/domain/format/v1';
import { createBuilderFacade, type BuilderFacade } from '../../../src/ui/bindings/builderFacade';

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

function makeRng(seed: number): SeededRng {
  return new SeededRng(seed);
}

function makeBlankAppState(seed: number): AppStateType {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  return AppState.blank(GridSize.of(15), key);
}

describe('builderFacade.ts', () => {
  let inMemoryStorage: InMemoryStoragePort;
  let stubDownload: StubDownloadPort;
  let seededRng: SeededRng;
  let fakeClock: FakeClock;
  let store: AppStore;
  let builderFacade: BuilderFacade;

  function makePorts(): AppPorts {
    return { storage: inMemoryStorage, download: stubDownload, filePick: { pickFile: async () => ({ kind: 'picked', text: '' }), readDroppedFile: async () => ({ kind: 'read', text: '' }) } };
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
    );
    builderFacade = createBuilderFacade(store);
    store.dispatch({ kind: 'navigate', route: 'build' });
  });

  it('builderFacade: builderShellVM() returns a BuilderShellVM (with toolbar, grid, cluePanel, displacedClues, subModeBanner, title, author all populated)', () => {
    const vm = builderFacade.builderShellVM();

    expect(vm).toBeDefined();
    expect(vm.toolbar).toBeDefined();
    expect(vm.grid).toBeDefined();
    expect(vm.grid.size).toBe(GridSize.of(15));
    expect(vm.grid.cells).toHaveLength(15);
    expect(vm.cluePanel).toBeDefined();
    expect(vm.cluePanel.across).toBeDefined();
    expect(vm.cluePanel.down).toBeDefined();
    expect(vm.displacedClues).toBeDefined();
    expect(vm.displacedClues.entries).toEqual([]);
    expect(vm.subModeBanner).toBeDefined();
    expect(vm.subModeBanner.kind).toBe('none');
    expect(typeof vm.title).toBe('string');
    expect(typeof vm.author).toBe('string');
  });

  it('builderFacade: builderShellVM() reflects state.builder.mode === "design" initially', () => {
    expect(builderFacade.builderShellVM().toolbar.mode).toBe('design');
  });

  it('builderFacade: dispatchBuilder change-grid-size intent mutates state.builder.puzzle.gridSize', () => {
    builderFacade.dispatch({ kind: 'change-grid-size', size: GridSize.of(12) });

    expect(builderFacade.getBuilderState().puzzle.gridSize).toBe(GridSize.of(12));
    expect(builderFacade.builderShellVM().toolbar.gridSizeInput).toBe(12);
  });

  it('builderFacade: dispatchBuilder select-cell intent mutates state.builder.cursor', () => {
    builderFacade.dispatch({ kind: 'switch-to-fill' });
    builderFacade.dispatch({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });

    expect(builderFacade.getBuilderState().cursor).not.toBeNull();
    expect(builderFacade.builderShellVM().grid.cursor).not.toBeNull();
  });

  it('builderFacade: dispatchBuilder then builderShellVM() reflects the new state ladder', () => {
    builderFacade.dispatch({ kind: 'change-grid-size', size: GridSize.of(12) });
    builderFacade.dispatch({ kind: 'switch-to-fill' });
    builderFacade.dispatch({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });
    builderFacade.dispatch({ kind: 'type-letter', letter: Letter.try('A')! });

    const vm = builderFacade.builderShellVM();
    expect(vm.toolbar.gridSizeInput).toBe(12);
    expect(vm.toolbar.mode).toBe('fill');
    expect(vm.grid.cursor).not.toBeNull();
    expect(vm.grid.cells[0]![0]!.letter).toBe('A');
  });

  it('builderFacade: getBuilderState() returns the live BuilderState reference', () => {
    const before = builderFacade.getBuilderState();
    expect(before.puzzle.gridSize).toBe(GridSize.of(15));

    builderFacade.dispatch({ kind: 'change-grid-size', size: GridSize.of(12) });

    const after = builderFacade.getBuilderState();
    expect(after.puzzle.gridSize).toBe(GridSize.of(12));
    expect(after).toBe(builderFacade.getBuilderState());
  });

  describe('primitive dispatch helpers', () => {
    it('dispatchSelectCell(0,0) sets builder.cursor to (0,0)', () => {
      builderFacade.actions.toolbar.switchToFill();
      builderFacade.actions.grid.selectCell(0, 0);

      const state = builderFacade.getBuilderState();
      expect(state.cursor).not.toBeNull();
      expect(state.cursor!.row).toBe(Row.of(0));
      expect(state.cursor!.col).toBe(Col.of(0));
    });

    it('dispatchToggleDesignCell(0,0) toggles cell (0,0) black/white', () => {
      expect(builderFacade.getBuilderState().puzzle.grid[0]![0]!.black).toBe(false);

      builderFacade.actions.grid.toggleDesignCell(0, 0);

      expect(builderFacade.getBuilderState().puzzle.grid[0]![0]!.black).toBe(true);
    });

    it('dispatchChangeGridSize(12) updates gridSizeInput to 12', () => {
      builderFacade.actions.toolbar.changeGridSize(12);

      expect(builderFacade.builderShellVM().toolbar.gridSizeInput).toBe(12);
      expect(builderFacade.getBuilderState().puzzle.gridSize).toBe(GridSize.of(12));
    });

    it('dispatchChangeGridSize throws when out of range (1)', () => {
      expect(() => builderFacade.actions.toolbar.changeGridSize(1)).toThrow();
    });

    it('dispatchTypeLetter("A") sets letter A on selected cell', () => {
      builderFacade.actions.toolbar.switchToFill();
      builderFacade.actions.grid.selectCell(0, 0);
      builderFacade.actions.grid.typeLetter('A');

      expect(builderFacade.getBuilderState().puzzle.grid[0]![0]!.answerLetter).toEqual(Letter.try('A'));
      expect(builderFacade.builderShellVM().grid.cells[0]![0]!.letter).toBe('A');
    });

    it('dispatchTypeLetter silently drops invalid input "1"', () => {
      builderFacade.actions.toolbar.switchToFill();
      builderFacade.actions.grid.selectCell(0, 0);
      builderFacade.actions.grid.typeLetter('1');

      expect(builderFacade.getBuilderState().puzzle.grid[0]![0]!.answerLetter).toBeNull();
    });

    it('dispatchBackspace dispatches backspace on selected cell', () => {
      builderFacade.actions.toolbar.switchToFill();
      builderFacade.actions.grid.selectCell(0, 0);
      builderFacade.actions.grid.typeLetter('A');
      builderFacade.actions.grid.backspace();

      expect(builderFacade.getBuilderState().puzzle.grid[0]![0]!.answerLetter).toBeNull();
    });

    it('dispatchSwitchToFill flips toolbar.mode to "fill"', () => {
      expect(builderFacade.builderShellVM().toolbar.mode).toBe('design');

      builderFacade.actions.toolbar.switchToFill();

      expect(builderFacade.builderShellVM().toolbar.mode).toBe('fill');
    });

    it('dispatchToggleMarker("space-right") sets spaceRight true on selected cell', () => {
      builderFacade.actions.toolbar.switchToFill();
      builderFacade.actions.grid.selectCell(0, 0);
      builderFacade.actions.toolbar.toggleMarker('space-right');

      expect(builderFacade.getBuilderState().puzzle.grid[0]![0]!.marker.spaceRight).toBe(true);
    });

    it('dispatchEditTitle("Hello") sets puzzle title to "Hello"', () => {
      builderFacade.actions.toolbar.editTitle('Hello');

      expect(builderFacade.getBuilderState().puzzle.title).toEqual(Title.try('Hello'));
      expect(builderFacade.builderShellVM().title).toBe('Hello');
    });

    it('dispatchEditAuthor("Anonymous") sets puzzle author to "Anonymous"', () => {
      builderFacade.actions.toolbar.editAuthor('Anonymous');

      expect(builderFacade.getBuilderState().puzzle.author).toEqual(Author.try('Anonymous'));
      expect(builderFacade.builderShellVM().author).toBe('Anonymous');
    });

    it('dispatchMoveCursor("across") moves cursor (or no-ops if no cursor)', () => {
      expect(() => builderFacade.actions.grid.moveCursor('across', 1)).not.toThrow();
    });

    it('dispatchRequestImportPuzzle passes fileContent through (blank state imports)', () => {
      const puzzle = makeCompletePuzzle(99, 2);
      const fileContent = serializeComplete(puzzle);

      expect(() => builderFacade.actions.toolbar.requestImportPuzzle(fileContent)).not.toThrow();
      expect(builderFacade.builderShellVM().toolbar.gridSizeInput).toBe(2);
    });
  });

  it('builderFacade: pickFile returns text and dispatches nothing when port returns picked', async () => {
    const filePick = { pickFile: vi.fn(async () => ({ kind: 'picked' as const, text: 'known-file-content' })), readDroppedFile: vi.fn(async () => ({ kind: 'read' as const, text: '' })) };
    const ports: AppPorts = { storage: inMemoryStorage, download: stubDownload, filePick };
    const storeWithPick = createAppStore(
      makeBlankAppState(42),
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
    );
    storeWithPick.dispatch({ kind: 'navigate', route: 'build' });
    const builderWithPick = createBuilderFacade(storeWithPick);
    const dispatchSpy = vi.spyOn(storeWithPick, 'dispatch');

    const result = await builderWithPick.pickFile();

    expect(filePick.pickFile).toHaveBeenCalledTimes(1);
    expect(result).toBe('known-file-content');
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('builderFacade: pickFile returns null and dispatches nothing when port returns cancelled', async () => {
    const filePick = { pickFile: async () => ({ kind: 'cancelled' as const }), readDroppedFile: async () => ({ kind: 'read' as const, text: '' }) };
    const ports: AppPorts = { storage: inMemoryStorage, download: stubDownload, filePick };
    const storeWithPick = createAppStore(
      makeBlankAppState(42),
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
    );
    storeWithPick.dispatch({ kind: 'navigate', route: 'build' });
    const builderWithPick = createBuilderFacade(storeWithPick);
    const dispatchSpy = vi.spyOn(storeWithPick, 'dispatch');

    const result = await builderWithPick.pickFile();

    expect(result).toBeNull();
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('builderFacade: pickFile returns null, warns once, dispatches report-pick-failure, and surfaces error toast when port returns failed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const filePick = { pickFile: async () => ({ kind: 'failed' as const, error: new Error('pick failed') }), readDroppedFile: async () => ({ kind: 'read' as const, text: '' }) };
    const ports: AppPorts = { storage: inMemoryStorage, download: stubDownload, filePick };
    const storeWithPick = createAppStore(
      makeBlankAppState(42),
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
    );
    storeWithPick.dispatch({ kind: 'navigate', route: 'build' });
    const builderWithPick = createBuilderFacade(storeWithPick);
    const dispatchSpy = vi.spyOn(storeWithPick, 'dispatch');
    const builderBefore = builderWithPick.getBuilderState();

    const result = await builderWithPick.pickFile();

    expect(result).toBeNull();
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith({ kind: 'report-pick-failure' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('builderFacade: pickFile failed:', new Error('pick failed'));
    expect(storeWithPick.getToasts()).toHaveLength(1);
    expect(storeWithPick.getToasts()[0]).toMatchObject({ kind: 'error', message: 'Could not open or read that file. Please try again.' });
    expect(builderWithPick.getBuilderState()).toBe(builderBefore);
    warnSpy.mockRestore();
  });

  it('builderFacade: importDroppedFile dispatches request-import-puzzle with the port-read text when readDroppedFile succeeds', async () => {
    const file = new File([], 'puzzle.json');
    const filePick = { pickFile: async () => ({ kind: 'picked' as const, text: '' }), readDroppedFile: async () => ({ kind: 'read' as const, text: 'dropped text' }) };
    const ports: AppPorts = { storage: inMemoryStorage, download: stubDownload, filePick };
    const storeWithDrop = createAppStore(
      makeBlankAppState(42),
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
    );
    const builderWithDrop = createBuilderFacade(storeWithDrop);
    const dispatchSpy = vi.spyOn(storeWithDrop, 'dispatch');
    storeWithDrop.dispatch({ kind: 'navigate', route: 'build' });
    dispatchSpy.mockClear();

    await builderWithDrop.actions.toolbar.importDroppedFile(file);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith({ kind: 'request-import-puzzle', fileContent: 'dropped text' });
  });

  it('builderFacade: importDroppedFile dispatches report-import-read-failure, warns once, and leaves state otherwise unchanged when readDroppedFile returns failed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = new File([], 'puzzle.json');
    const filePick = { pickFile: async () => ({ kind: 'picked' as const, text: '' }), readDroppedFile: async () => ({ kind: 'failed' as const, error: new Error('read error') }) };
    const ports: AppPorts = { storage: inMemoryStorage, download: stubDownload, filePick };
    const storeWithDrop = createAppStore(
      makeBlankAppState(42),
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
    );
    const builderWithDrop = createBuilderFacade(storeWithDrop);
    storeWithDrop.dispatch({ kind: 'navigate', route: 'build' });
    const dispatchSpy = vi.spyOn(storeWithDrop, 'dispatch');
    const builderBefore = builderWithDrop.getBuilderState();

    await builderWithDrop.actions.toolbar.importDroppedFile(file);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith({ kind: 'report-import-read-failure' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('builderFacade: failed to read dropped file:', new Error('read error'));
    expect(storeWithDrop.getToasts()).toHaveLength(1);
    expect(storeWithDrop.getToasts()[0]).toMatchObject({ kind: 'error', message: 'Could not read that file. Please try again.' });
    expect(builderWithDrop.getBuilderState()).toBe(builderBefore);
    warnSpy.mockRestore();
  });

  it('builderFacade: two createBuilderFacade instances over two appStores are independent', () => {
    const storeA = createAppStore(
      makeBlankAppState(1),
      { rng: makeRng(1), now: () => fakeClock.now() },
      makePorts(),
    );
    const a = createBuilderFacade(storeA);
    const storeB = createAppStore(
      makeBlankAppState(2),
      { rng: makeRng(2), now: () => fakeClock.now() },
      makePorts(),
    );
    const b = createBuilderFacade(storeB);

    a.dispatch({ kind: 'change-grid-size', size: GridSize.of(12) });

    expect(b.getBuilderState().puzzle.gridSize).toBe(GridSize.of(15));
  });
});
