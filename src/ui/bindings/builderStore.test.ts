import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppState } from '../../app/state/state';
import type { AppState as AppStateType } from '../../app/state/state';
import { bootApp } from './appStore.svelte';
import { setPorts, resetPorts } from './ports';
import { createPersistenceScheduler } from './persistenceScheduler';
import { InMemoryStoragePort } from '../../../test/fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../../test/fakes/StubDownloadPort';
import { SeededRng } from '../../../test/fakes/SeededRng';
import { FakeClock } from '../../../test/fakes/FakeClock';
import { GridSize } from '../../domain/grid/GridSize';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';
import { Letter } from '../../domain/letter/Letter';
import { Puzzle } from '../../domain/puzzle/Puzzle';
import { Cell } from '../../domain/grid/Cell';
import { GridOps } from '../../domain/grid/GridOps';
import { WordDerivation } from '../../domain/word/WordDerivation';
import { Numbering } from '../../domain/word/Numbering';
import { Title } from '../../domain/puzzle/Title';
import { Author } from '../../domain/puzzle/Author';
import { serializeComplete } from '../../domain/format/v1';
import {
  builderShellVM,
  dispatchBuilder,
  getBuilderState,
  dispatchSelectCell,
  dispatchToggleDesignCell,
  dispatchChangeGridSize,
  dispatchTypeLetter,
  dispatchBackspace,
  dispatchSwitchToFill,
  dispatchMoveCursor,
  dispatchToggleMarker,
  dispatchEditTitle,
  dispatchEditAuthor,
  dispatchRequestImportPuzzle,
} from './builderStore.svelte';

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

describe('builderStore.svelte.ts', () => {
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

  it('builderStore: builderShellVM() returns a BuilderShellVM (with toolbar, grid, cluePanel, displacedClues, subModeBanner, title, author all populated)', () => {
    const vm = builderShellVM();

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

  it('builderStore: builderShellVM() reflects state.builder.mode === "design" initially', () => {
    expect(builderShellVM().toolbar.mode).toBe('design');
  });

  it('builderStore: dispatchBuilder change-grid-size intent mutates state.builder.puzzle.gridSize', () => {
    dispatchBuilder({ kind: 'change-grid-size', size: GridSize.of(12) });

    expect(getBuilderState().puzzle.gridSize).toBe(GridSize.of(12));
    expect(builderShellVM().toolbar.gridSizeInput).toBe(12);
  });

  it('builderStore: dispatchBuilder select-cell intent mutates state.builder.cursor', () => {
    dispatchBuilder({ kind: 'switch-to-fill' });
    dispatchBuilder({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });

    expect(getBuilderState().cursor).not.toBeNull();
    expect(builderShellVM().grid.cursor).not.toBeNull();
  });

  it('builderStore: dispatchBuilder then builderShellVM() reflects the new state ladder', () => {
    dispatchBuilder({ kind: 'change-grid-size', size: GridSize.of(12) });
    dispatchBuilder({ kind: 'switch-to-fill' });
    dispatchBuilder({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });
    dispatchBuilder({ kind: 'type-letter', letter: Letter.try('A')! });

    const vm = builderShellVM();
    expect(vm.toolbar.gridSizeInput).toBe(12);
    expect(vm.toolbar.mode).toBe('fill');
    expect(vm.grid.cursor).not.toBeNull();
    expect(vm.grid.cells[0]![0]!.letter).toBe('A');
  });

  it('builderStore: getBuilderState() returns the live BuilderState reference', () => {
    const before = getBuilderState();
    expect(before.puzzle.gridSize).toBe(GridSize.of(15));

    dispatchBuilder({ kind: 'change-grid-size', size: GridSize.of(12) });

    const after = getBuilderState();
    expect(after.puzzle.gridSize).toBe(GridSize.of(12));
    expect(after).toBe(getBuilderState());
  });

  describe('primitive dispatch helpers', () => {
    it('dispatchSelectCell(0,0) sets builder.cursor to (0,0)', () => {
      dispatchSwitchToFill();
      dispatchSelectCell(0, 0);

      const state = getBuilderState();
      expect(state.cursor).not.toBeNull();
      expect(state.cursor!.row).toBe(Row.of(0));
      expect(state.cursor!.col).toBe(Col.of(0));
    });

    it('dispatchToggleDesignCell(0,0) toggles cell (0,0) black/white', () => {
      expect(getBuilderState().puzzle.grid[0]![0]!.black).toBe(false);

      dispatchToggleDesignCell(0, 0);

      expect(getBuilderState().puzzle.grid[0]![0]!.black).toBe(true);
    });

    it('dispatchChangeGridSize(12) updates gridSizeInput to 12', () => {
      dispatchChangeGridSize(12);

      expect(builderShellVM().toolbar.gridSizeInput).toBe(12);
      expect(getBuilderState().puzzle.gridSize).toBe(GridSize.of(12));
    });

    it('dispatchChangeGridSize throws when out of range (1)', () => {
      expect(() => dispatchChangeGridSize(1)).toThrow();
    });

    it('dispatchTypeLetter("A") sets letter A on selected cell', () => {
      dispatchSwitchToFill();
      dispatchSelectCell(0, 0);
      dispatchTypeLetter('A');

      expect(getBuilderState().puzzle.grid[0]![0]!.answerLetter).toEqual(Letter.try('A'));
      expect(builderShellVM().grid.cells[0]![0]!.letter).toBe('A');
    });

    it('dispatchTypeLetter silently drops invalid input "1"', () => {
      dispatchSwitchToFill();
      dispatchSelectCell(0, 0);
      dispatchTypeLetter('1');

      expect(getBuilderState().puzzle.grid[0]![0]!.answerLetter).toBeNull();
    });

    it('dispatchBackspace dispatches backspace on selected cell', () => {
      dispatchSwitchToFill();
      dispatchSelectCell(0, 0);
      dispatchTypeLetter('A');
      dispatchBackspace();

      expect(getBuilderState().puzzle.grid[0]![0]!.answerLetter).toBeNull();
    });

    it('dispatchSwitchToFill flips toolbar.mode to "fill"', () => {
      expect(builderShellVM().toolbar.mode).toBe('design');

      dispatchSwitchToFill();

      expect(builderShellVM().toolbar.mode).toBe('fill');
    });

    it('dispatchToggleMarker("space-right") sets spaceRight true on selected cell', () => {
      dispatchSwitchToFill();
      dispatchSelectCell(0, 0);
      dispatchToggleMarker('space-right');

      expect(getBuilderState().puzzle.grid[0]![0]!.marker.spaceRight).toBe(true);
    });

    it('dispatchEditTitle("Hello") sets puzzle title to "Hello"', () => {
      dispatchEditTitle('Hello');

      expect(getBuilderState().puzzle.title).toEqual(Title.try('Hello'));
      expect(builderShellVM().title).toBe('Hello');
    });

    it('dispatchEditAuthor("Anonymous") sets puzzle author to "Anonymous"', () => {
      dispatchEditAuthor('Anonymous');

      expect(getBuilderState().puzzle.author).toEqual(Author.try('Anonymous'));
      expect(builderShellVM().author).toBe('Anonymous');
    });

    it('dispatchMoveCursor("across") moves cursor (or no-ops if no cursor)', () => {
      expect(() => dispatchMoveCursor('across', 1)).not.toThrow();
    });

    it('dispatchRequestImportPuzzle passes fileContent through (blank state imports)', () => {
      const puzzle = makeCompletePuzzle(99, 2);
      const fileContent = serializeComplete(puzzle);

      expect(() => dispatchRequestImportPuzzle(fileContent)).not.toThrow();
      expect(builderShellVM().toolbar.gridSizeInput).toBe(2);
    });
  });
});
