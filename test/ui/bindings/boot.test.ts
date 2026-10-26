import { describe, it, expect } from 'vitest';
import { createInitialAppState } from '../../../src/ui/bindings/boot';
import type { AppPorts, AppDeps } from '../../../src/ui/bindings/appStore.svelte';
import { InMemoryStoragePort } from '../../fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../fakes/StubDownloadPort';
import { SeededRng } from '../../fakes/SeededRng';
import { FakeClock } from '../../fakes/FakeClock';
import { BuilderState } from '../../../src/builder/state/state';
import { serializeBuilderSnapshot } from '../../../src/ui/bindings/persistenceCodec';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { DisplacedClue } from '../../../src/domain/builder/DisplacedClue';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { Cell } from '../../../src/domain/grid/Cell';
import { GridAccess } from '../../../src/domain/grid/GridAccess';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { Letter } from '../../../src/domain/letter/Letter';
import { WordDerivation } from '../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../src/domain/word/Numbering';
import { serializeComplete } from '../../../src/domain/format/v1Json';
import type { Rng } from '../../../src/domain/rng/Rng';

function makeRng(seed: number): SeededRng {
  return new SeededRng(seed);
}

function makePorts(storage: InMemoryStoragePort): AppPorts {
  return {
    storage,
    download: new StubDownloadPort(),
    filePick: {
      pickFile: async () => ({ kind: 'picked' as const, text: '' }),
      readDroppedFile: async () => ({ kind: 'read' as const, text: '' }),
    },
  };
}

function makeDeps(rng: Rng): AppDeps {
  return { rng, now: () => new FakeClock(0).now() };
}

class CountingRng implements Rng {
  count = 0;

  nextInt(n: number): number {
    void n;
    this.count++;
    return 0;
  }
}

function makeBuilderSnapshot(
  mode: 'design' | 'fill',
  seed: number,
  withDisplacedClue = false,
): { blob: string; state: ReturnType<typeof BuilderState.blank> } {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  let state = BuilderState.blank(GridSize.of(5), key);
  if (withDisplacedClue) {
    const clue = DisplacedClue.create(rng, 'saved clue', 'down');
    state = { ...state, displacedClues: [clue] };
  }
  state = { ...state, mode };
  return { blob: serializeBuilderSnapshot(state), state };
}

function makeCompletePuzzle(seed: number, size: number) {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  let puzzle = Puzzle.blank(GridSize.of(size), key);
  let grid = puzzle.grid;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const letter = Letter.try(String.fromCharCode(65 + ((r * size + c) % 26)));
      if (letter === null) throw new Error('makeCompletePuzzle: invalid letter');
      grid = GridAccess.setCell(grid, Row.of(r), Col.of(c), Cell.setAnswerLetter(Cell.white(), letter));
    }
  }

  puzzle = Puzzle.withGrid(puzzle, grid);
  const derived = WordDerivation.derive(grid);
  const numbered = Numbering.assign(grid, derived);
  const wordsWithClues = numbered.map((w) => ({ ...w, clue: 'Clue' }));
  puzzle = Puzzle.withWords(puzzle, wordsWithClues);
  return puzzle;
}

describe('boot.ts', () => {
  it('storage returns absent → returns blank AppState', () => {
    const storage = new InMemoryStoragePort();
    const deps = makeDeps(makeRng(1));
    const state = createInitialAppState(makePorts(storage), deps);

    expect(state.route).toBe('landing');
    expect(state.player.phase).toBe('import');
    expect(state.builder.cursor).toBeNull();
    expect(state.builder.subMode.kind).toBe('none');
    expect(state.builder.puzzle.key).not.toBe(
      PuzzleKey.try('00000000-0000-4000-8000-000000000000')!,
    );
  });

  it('storage returns failed → blank', () => {
    const storage = new InMemoryStoragePort();
    storage.simulateFailure = new Error('load failed');
    const deps = makeDeps(makeRng(2));
    const state = createInitialAppState(makePorts(storage), deps);

    expect(state.route).toBe('landing');
    expect(state.player.phase).toBe('import');
    expect(state.builder.cursor).toBeNull();
    expect(state.builder.subMode.kind).toBe('none');
  });

  it('storage returns loaded with valid fill-mode snapshot → builder has snap.puzzle, snap.displacedClues, snap.mode; subMode.kind "none"; cursor null; player always importScreen', () => {
    const storage = new InMemoryStoragePort();
    const { blob, state: snapState } = makeBuilderSnapshot('fill', 3, true);
    storage.saveBuilder(blob);

    const deps = makeDeps(makeRng(4));
    const state = createInitialAppState(makePorts(storage), deps);

    expect(state.builder.puzzle.key).toBe(snapState.puzzle.key);
    expect(state.builder.mode).toBe('fill');
    expect(state.builder.displacedClues).toHaveLength(1);
    expect(state.builder.displacedClues[0]?.clue).toBe('saved clue');
    expect(state.builder.subMode.kind).toBe('none');
    expect(state.builder.cursor).toBeNull();
    expect(state.player.phase).toBe('import');
    expect(state.route).toBe('landing');
  });

  it('storage returns loaded with valid design-mode snapshot → same restoration with mode "design"', () => {
    const storage = new InMemoryStoragePort();
    const { blob, state: snapState } = makeBuilderSnapshot('design', 5, true);
    storage.saveBuilder(blob);

    const deps = makeDeps(makeRng(6));
    const state = createInitialAppState(makePorts(storage), deps);

    expect(state.builder.puzzle.key).toBe(snapState.puzzle.key);
    expect(state.builder.mode).toBe('design');
    expect(state.builder.displacedClues).toHaveLength(1);
    expect(state.builder.subMode.kind).toBe('none');
    expect(state.builder.cursor).toBeNull();
    expect(state.player.phase).toBe('import');
  });

  it('snapshot blob has subMode "join" (legacy / hostile) → ignored; subMode.kind "none"', () => {
    const storage = new InMemoryStoragePort();
    const { blob } = makeBuilderSnapshot('fill', 7);
    const parsed = JSON.parse(blob);
    parsed.subMode = 'join';
    storage.saveBuilder(JSON.stringify(parsed));

    const deps = makeDeps(makeRng(8));
    const state = createInitialAppState(makePorts(storage), deps);

    expect(state.builder.mode).toBe('fill');
    expect(state.builder.subMode.kind).toBe('none');
  });

  it('corrupt JSON snapshot → blank', () => {
    const storage = new InMemoryStoragePort();
    storage.saveBuilder('not valid json');

    const deps = makeDeps(makeRng(9));
    const state = createInitialAppState(makePorts(storage), deps);

    expect(state.builder.subMode.kind).toBe('none');
    expect(state.player.phase).toBe('import');
  });

  it('snapshot parses but is complete (fileType !== "incomplete") → blank', () => {
    const storage = new InMemoryStoragePort();
    const puzzle = makeCompletePuzzle(11, 3);
    const wrapper = {
      version: 1,
      kind: 'builder-snapshot',
      puzzle: JSON.parse(serializeComplete(puzzle)),
      mode: 'fill',
    };
    storage.saveBuilder(JSON.stringify(wrapper));

    const deps = makeDeps(makeRng(12));
    const state = createInitialAppState(makePorts(storage), deps);

    expect(state.builder.subMode.kind).toBe('none');
    expect(state.player.phase).toBe('import');
  });

  it('rng is called exactly once on the blank path', () => {
    const storage = new InMemoryStoragePort();
    const rng = new CountingRng();
    const deps = makeDeps(rng);
    createInitialAppState(makePorts(storage), deps);

    // PuzzleKey.generate delegates to uuidv4, which draws 16 bytes from the rng.
    expect(rng.count).toBe(16);
  });

  it('rng is NOT called on the loaded-snapshot path', () => {
    const storage = new InMemoryStoragePort();
    const { blob } = makeBuilderSnapshot('fill', 13);
    storage.saveBuilder(blob);

    const rng = new CountingRng();
    const deps = makeDeps(rng);
    createInitialAppState(makePorts(storage), deps);

    expect(rng.count).toBe(0);
  });
});
