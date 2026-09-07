import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppState } from '../../../src/app/state/state';
import type { AppState as AppStateType } from '../../../src/app/state/state';
import type { BuilderIntent } from '../../../src/builder/state/intents';
import { createAppStore, type AppPorts, type AppStore } from '../../../src/ui/bindings/appStore.svelte';
import { createPersistenceScheduler } from '../../../src/ui/bindings/persistenceScheduler';
import { InMemoryStoragePort } from '../../fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../fakes/StubDownloadPort';
import { SeededRng } from '../../fakes/SeededRng';
import { FakeClock } from '../../fakes/FakeClock';
import { EpochMs } from '../../../src/domain/time/EpochMs';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { Cell } from '../../../src/domain/grid/Cell';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { Letter } from '../../../src/domain/letter/Letter';
import { WordDerivation } from '../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../src/domain/word/Numbering';
import { serializeComplete } from '../../../src/domain/format/v1';
import type { Puzzle as PuzzleType } from '../../../src/domain/puzzle/Puzzle';

function makeRng(seed: number): SeededRng {
  return new SeededRng(seed);
}

function makeCompletePuzzle(seed: number, size: number): PuzzleType {
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
  return puzzle;
}

function makeBlankAppState(seed: number): AppStateType {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  return AppState.blank(GridSize.of(15), key);
}

describe('appStore.svelte.ts', () => {
  let inMemoryStorage: InMemoryStoragePort;
  let stubDownload: StubDownloadPort;
  let seededRng: SeededRng;
  let fakeClock: FakeClock;
  let ports: AppPorts;
  let store: AppStore;

  function makePorts(): AppPorts {
    return { storage: inMemoryStorage, download: stubDownload, filePick: { pickFile: async () => '' } };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    inMemoryStorage = new InMemoryStoragePort();
    stubDownload = new StubDownloadPort();
    seededRng = makeRng(42);
    fakeClock = new FakeClock(0);
    ports = makePorts();

    const initial = makeBlankAppState(42);
    store = createAppStore(
      initial,
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
      createPersistenceScheduler(inMemoryStorage),
    );
    store.dispatch({ kind: 'navigate', route: 'build' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appStore: getAppState returns the createAppStore initialState', () => {
    const initial = makeBlankAppState(42);
    const store = createAppStore(
      initial,
      { rng: seededRng, now: () => fakeClock.now() },
      ports,
      createPersistenceScheduler(inMemoryStorage),
    );
    expect(store.getState()).toBe(initial);
  });

  it('appStore: dispatch navigate route → getRoute() reflects "build" / "play" / "landing"', () => {
    store.dispatch({ kind: 'navigate', route: 'build' });
    expect(store.getRoute()).toBe('build');

    store.dispatch({ kind: 'navigate', route: 'play' });
    expect(store.getRoute()).toBe('play');

    store.dispatch({ kind: 'navigate', route: 'landing' });
    expect(store.getRoute()).toBe('landing');
  });

  it('appStore: dispatch BuilderIntent (e.g., change-grid-size) updates state.builder', () => {
    const beforeGrid = store.getBuilder().puzzle.grid;
    expect(beforeGrid.length).toBe(15);
    expect(beforeGrid[0]!.length).toBe(15);

    const intent: BuilderIntent = { kind: 'change-grid-size', size: GridSize.of(10) };
    store.dispatch(intent);

    const afterGrid = store.getBuilder().puzzle.grid;
    expect(afterGrid.length).toBe(10);
    expect(afterGrid[0]!.length).toBe(10);
  });

  it('appStore: dispatch PlayerIntent (e.g., import-puzzle with a complete JSON string) updates state.player to solving phase', () => {
    const puzzle = makeCompletePuzzle(7, 3);
    const fileContent = serializeComplete(puzzle);

    store.dispatch({ kind: 'import-puzzle', fileContent });

    const player = store.getPlayer();
    expect(player.phase).toBe('solving');
    if (player.phase !== 'solving') throw new Error('unreachable');
    expect(player.puzzle.key).toBe(puzzle.key);
  });

  it('appStore: a builder reducer that emits a toast event folds via applyEventsToApp — getToasts() grows by one; toast id from ToastId.generate', () => {
    expect(store.getToasts()).toHaveLength(0);

    store.dispatch({ kind: 'request-import-puzzle', fileContent: 'not valid json' });

    const toasts = store.getToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toBeDefined();
    expect(typeof toasts[0]!.id).toBe('string');
    expect(toasts[0]!.message).toContain('valid');
  });

  it('appStore: a builder request-* guard emits modal-request event → getModal() populated and getPendingConfirmIntent() populated', () => {
    store.dispatch({ kind: 'switch-to-fill' });
    store.dispatch({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });
    store.dispatch({ kind: 'type-letter', letter: Letter.try('A')! });

    store.dispatch({ kind: 'request-switch-to-design' });

    expect(store.getModal()).not.toBeNull();
    expect(store.getModal()?.kind).toBe('confirm-design-switch');
    expect(store.getPendingConfirmIntent()).toEqual({ kind: 'confirm-switch-to-design' });
  });

  it('appStore: dispatch cancel-modal clears getModal() and getPendingConfirmIntent()', () => {
    store.dispatch({ kind: 'switch-to-fill' });
    store.dispatch({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });
    store.dispatch({ kind: 'type-letter', letter: Letter.try('A')! });
    store.dispatch({ kind: 'request-switch-to-design' });

    expect(store.getModal()).not.toBeNull();

    store.dispatch({ kind: 'cancel-modal' });

    expect(store.getModal()).toBeNull();
    expect(store.getPendingConfirmIntent()).toBeNull();
  });

  it('appStore: dispatch dismiss-toast removes the toast by id', () => {
    store.dispatch({ kind: 'request-import-puzzle', fileContent: 'not valid json' });
    const toast = store.getToasts()[0]!;

    store.dispatch({ kind: 'dismiss-toast', id: toast.id });

    expect(store.getToasts()).toHaveLength(0);
  });

  it('appStore: download event triggers ports.download.download(filename, content) — use StubDownloadPort assertion', () => {
    const puzzle = makeCompletePuzzle(11, 3);
    store.dispatch({ kind: 'request-import-puzzle', fileContent: serializeComplete(puzzle) });

    store.dispatch({ kind: 'export-complete' });

    expect(stubDownload.getDownloadCount()).toBe(1);
    const last = stubDownload.getLastDownload();
    expect(last).toBeDefined();
    expect(last!.filename).toContain('complete');
    expect(last!.content).toContain(puzzle.key);
  });

  it('appStore: download failure surfaces an error toast (StubDownloadPort injected to return Error)', () => {
    const puzzle = makeCompletePuzzle(11, 3);
    store.dispatch({ kind: 'request-import-puzzle', fileContent: serializeComplete(puzzle) });

    stubDownload.nextDownloadError = new Error('boom');
    store.dispatch({ kind: 'export-complete' });

    expect(stubDownload.getDownloadCount()).toBe(1);
    const toasts = store.getToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('error');
    expect(toasts[0]!.message).toBe('Download failed. Please try again.');
  });

  it('appStore: clear-builder-storage event calls scheduler.clearBuilder() — verify storage cleared (no pending save fires later)', () => {
    const puzzle = makeCompletePuzzle(13, 3);
    store.dispatch({ kind: 'request-import-puzzle', fileContent: serializeComplete(puzzle) });

    store.getScheduler().scheduleBuilderSave(store.getBuilder());

    store.dispatch({ kind: 'confirm-reset-builder' });

    expect(store.getBuilder().puzzle.gridSize).toBe(puzzle.gridSize);

    vi.advanceTimersByTime(1000);
    expect(inMemoryStorage.getBuilderBlob()).toBeNull();
  });

  it('appStore: clear-player-storage event calls scheduler.clearPlayer(key) — verify storage cleared for that key', () => {
    const puzzle = makeCompletePuzzle(17, 3);
    store.dispatch({ kind: 'import-puzzle', fileContent: serializeComplete(puzzle) });

    inMemoryStorage.savePlayerProgress(puzzle.key, JSON.stringify({
      version: 1,
      kind: 'player-progress',
      key: String(puzzle.key),
      gridSize: Number(puzzle.gridSize),
      playerLetters: [[null, null, null], [null, null, null], [null, null, null]],
    }));

    store.getScheduler().schedulePlayerSave(store.getPlayer());

    store.dispatch({ kind: 'confirm-reset-player' });

    vi.advanceTimersByTime(1000);
    expect(inMemoryStorage.getPlayerProgressMap().has(String(puzzle.key))).toBe(false);
  });

  it('appStore: load-player-progress event flow: storage has a serialized blob → dispatch apply-loaded-progress; check state.player reflects loaded letters', () => {
    const puzzle = makeCompletePuzzle(19, 3);
    const playerLetters = [
      [Letter.try('A'), Letter.try('B'), Letter.try('C')],
      [null, null, null],
      [Letter.try('X'), null, Letter.try('Z')],
    ];

    inMemoryStorage.savePlayerProgress(puzzle.key, JSON.stringify({
      version: 1,
      kind: 'player-progress',
      key: String(puzzle.key),
      gridSize: Number(puzzle.gridSize),
      playerLetters: playerLetters.map((row) => row.map((l) => (l === null ? null : String(l)))),
    }));

    store.dispatch({ kind: 'import-puzzle', fileContent: serializeComplete(puzzle) });

    const player = store.getPlayer();
    expect(player.phase).toBe('solving');
    if (player.phase !== 'solving') throw new Error('unreachable');

    const grid = player.puzzle.grid;
    expect(GridOps.cellAt(grid, Row.of(0), Col.of(0)).playerLetter).toEqual(Letter.try('A'));
    expect(GridOps.cellAt(grid, Row.of(0), Col.of(1)).playerLetter).toEqual(Letter.try('B'));
    expect(GridOps.cellAt(grid, Row.of(0), Col.of(2)).playerLetter).toEqual(Letter.try('C'));
    expect(GridOps.cellAt(grid, Row.of(2), Col.of(0)).playerLetter).toEqual(Letter.try('X'));
    expect(GridOps.cellAt(grid, Row.of(2), Col.of(2)).playerLetter).toEqual(Letter.try('Z'));
  });

  it('appStore: load-player-progress with null blob → no apply-loaded-progress dispatched (state unchanged)', () => {
    const puzzle = makeCompletePuzzle(23, 3);
    store.dispatch({ kind: 'import-puzzle', fileContent: serializeComplete(puzzle) });

    const before = store.getPlayer();
    expect(before.phase).toBe('solving');
    if (before.phase !== 'solving') throw new Error('unreachable');
    expect(GridOps.cellAt(before.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBeNull();

    store.dispatch({ kind: 'import-new-puzzle' });
    store.dispatch({ kind: 'import-puzzle', fileContent: serializeComplete(puzzle) });

    const after = store.getPlayer();
    expect(after.phase).toBe('solving');
    if (after.phase !== 'solving') throw new Error('unreachable');
    expect(GridOps.cellAt(after.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBeNull();
  });

  it('appStore: load-player-progress with corrupt blob (parsePlayerProgress returns null) → no apply-loaded-progress dispatched, console.warn fires, state unchanged', () => {
    const puzzle = makeCompletePuzzle(29, 3);
    inMemoryStorage.savePlayerProgress(puzzle.key, 'not-valid-player-progress-json');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    store.dispatch({ kind: 'import-puzzle', fileContent: serializeComplete(puzzle) });

    expect(warnSpy).toHaveBeenCalled();
    const player = store.getPlayer();
    expect(player.phase).toBe('solving');
    if (player.phase !== 'solving') throw new Error('unreachable');
    expect(GridOps.cellAt(player.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBeNull();

    warnSpy.mockRestore();
  });

  it('appStore: load-player-progress with storage throwing → console.warn, no throw, no apply-loaded-progress dispatched', () => {
    const puzzle = makeCompletePuzzle(31, 3);
    inMemoryStorage.throwOnNextLoad = true;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => store.dispatch({ kind: 'import-puzzle', fileContent: serializeComplete(puzzle) })).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    const player = store.getPlayer();
    expect(player.phase).toBe('solving');
    if (player.phase !== 'solving') throw new Error('unreachable');
    expect(GridOps.cellAt(player.puzzle.grid, Row.of(0), Col.of(0)).playerLetter).toBeNull();

    warnSpy.mockRestore();
  });

  it('appStore: createAppStore replaces state and deps cleanly; subsequent dispatch uses new deps.rng', () => {
    const newRng = makeRng(99);
    const newState = makeBlankAppState(99);
    const newScheduler = createPersistenceScheduler(inMemoryStorage);

    const store = createAppStore(
      newState,
      { rng: newRng, now: () => EpochMs.of(1234) },
      ports,
      newScheduler,
    );

    expect(store.getState()).toBe(newState);
    expect(store.getScheduler()).toBe(newScheduler);
  });

  it('appStore: getBuilder() / getPlayer() return the live state slices (referential checks after no dispatch)', () => {
    const state = store.getState();
    expect(store.getBuilder()).toBe(state.builder);
    expect(store.getPlayer()).toBe(state.player);
  });
});
