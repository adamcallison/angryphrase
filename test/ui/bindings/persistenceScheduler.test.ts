import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serializeIncomplete } from '../../../src/domain/format/v1';
import {
  serializeBuilderSnapshot,
  parseBuilderSnapshot,
  serializePlayerProgress,
  parsePlayerProgress,
  type BuilderSnapshot,
  type PlayerProgressBlob,
} from '../../../src/ui/bindings/persistenceCodec';
import {
  createPersistenceScheduler,
  type PersistenceScheduler,
} from '../../../src/ui/bindings/persistenceScheduler';
import { BuilderState } from '../../../src/builder/state/state';
import { PlayerState } from '../../../src/player/state/state';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { Cell } from '../../../src/domain/grid/Cell';
import { Letter } from '../../../src/domain/letter/Letter';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { DisplacedClue } from '../../../src/domain/builder/DisplacedClue';
import { InMemoryStoragePort } from '../../fakes/InMemoryStoragePort';
import { SeededRng } from '../../fakes/SeededRng';
import { WordDerivation } from '../../../src/domain/word/WordDerivation';
import { Numbering } from '../../../src/domain/word/Numbering';
import type { StoragePort } from '../../../src/domain/ports/ports';
import type { BuilderState as BuilderStateType } from '../../../src/builder/state/state';
import type { PlayerState as PlayerStateType } from '../../../src/player/state/state';
import type { Puzzle as PuzzleType } from '../../../src/domain/puzzle/Puzzle';

function makeRng(seed: number): SeededRng {
  return new SeededRng(seed);
}

function makeBuilderState(seed: number, overrides?: Partial<BuilderStateType>): BuilderStateType {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  const state = BuilderState.blank(GridSize.of(5), key);
  const puzzle = overrides?.puzzle ?? state.puzzle;
  return {
    ...state,
    puzzle,
    displacedClues: overrides?.displacedClues ?? state.displacedClues,
    mode: overrides?.mode ?? state.mode,
    subMode: overrides?.subMode ?? state.subMode,
    cursor: overrides?.cursor ?? state.cursor,
  };
}

type SolvingPlayerState = Extract<PlayerStateType, { phase: 'solving' }>;

function makePlayerSolvingState(seed: number, overrides?: { puzzle?: PuzzleType }): SolvingPlayerState {
  const rng = makeRng(seed);
  const puzzle = overrides?.puzzle ?? Puzzle.blank(GridSize.of(5), PuzzleKey.generate(rng));
  return PlayerState.loaded(puzzle) as SolvingPlayerState;
}

function makeAllBlackPuzzle(seed: number, size: number): PuzzleType {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  const puzzle = Puzzle.blank(GridSize.of(size), key);
  let grid = puzzle.grid;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      grid = GridOps.setCell(grid, Row.of(r), Col.of(c), Cell.black());
    }
  }
  const words = Numbering.assign(grid, WordDerivation.derive(grid));
  return Puzzle.withWords(Puzzle.withGrid(puzzle, grid), words);
}

describe('persistenceScheduler.ts', () => {
  describe('serializeBuilderSnapshot + parseBuilderSnapshot', () => {
    it('serializeBuilderSnapshot: output JSON has version=1, kind="builder-snapshot", mode from state.mode, subMode="none" (forced)', () => {
      const state = makeBuilderState(1, { mode: 'fill', subMode: { kind: 'join', source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' } } });
      const json = serializeBuilderSnapshot(state);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.kind).toBe('builder-snapshot');
      expect(parsed.mode).toBe('fill');
      expect(parsed.subMode).toBe('none');
      expect(parsed.cursor).toBeUndefined();
    });

    it('serializeBuilderSnapshot: no top-level displacedClues field (lives only inside embedded puzzle)', () => {
      const rng = makeRng(2);
      const clue = DisplacedClue.create(rng, 'a clue', 'across');
      const state = makeBuilderState(3, { displacedClues: [clue] });
      const json = serializeBuilderSnapshot(state);
      const parsed = JSON.parse(json);
      expect(parsed.displacedClues).toBeUndefined();
      expect(parsed.puzzle.displacedClues).toEqual([{ id: clue.id, clue: clue.clue, direction: clue.direction }]);
    });

    it('parseBuilderSnapshot: round-trips a BuilderState: returns puzzle, displacedClues, mode; subMode is discarded', () => {
      const rng = makeRng(4);
      const clue = DisplacedClue.create(rng, 'round-trip clue', 'down');
      const puzzle = makeAllBlackPuzzle(5, 3);
      const state = makeBuilderState(6, { mode: 'fill', puzzle, displacedClues: [clue] });
      const json = serializeBuilderSnapshot(state);
      const result = parseBuilderSnapshot(json);
      expect(result).not.toBeNull();
      const snap = result as BuilderSnapshot;
      expect(snap.mode).toBe('fill');
      expect(snap.displacedClues).toHaveLength(1);
      expect(snap.displacedClues[0]?.clue).toBe('round-trip clue');
      expect(snap.puzzle.key).toBe(state.puzzle.key);
      expect(snap.puzzle.gridSize).toBe(state.puzzle.gridSize);
      expect(GridOps.equals(snap.puzzle.grid, state.puzzle.grid)).toBe(true);
    });

    it('parseBuilderSnapshot: returns null on shape mismatch (wrong kind)', () => {
      const json = JSON.stringify({ version: 1, kind: 'wrong-kind', puzzle: {}, mode: 'design' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parseBuilderSnapshot(json)).toBeNull();
      warnSpy.mockRestore();
    });

    it('parseBuilderSnapshot: returns null on shape mismatch (wrong version)', () => {
      const json = JSON.stringify({ version: 2, kind: 'builder-snapshot', puzzle: {}, mode: 'design' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parseBuilderSnapshot(json)).toBeNull();
      warnSpy.mockRestore();
    });

    it('parseBuilderSnapshot: returns null on garbage JSON (and console.warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parseBuilderSnapshot('not json')).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parseBuilderSnapshot: returns null when embedded puzzle fails parsePuzzleV1', () => {
      const json = JSON.stringify({ version: 1, kind: 'builder-snapshot', puzzle: { version: 1, type: 'incomplete', key: 'not-a-uuid', gridSize: 5, title: '', author: '', grid: [], words: [], displacedClues: [] }, mode: 'design' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parseBuilderSnapshot(json)).toBeNull();
      warnSpy.mockRestore();
    });

    it('parseBuilderSnapshot: returns null on invalid mode value', () => {
      const puzzle = makeAllBlackPuzzle(7, 3);
      const puzzleJson = JSON.parse(serializeIncomplete(puzzle, []));
      const json = JSON.stringify({ version: 1, kind: 'builder-snapshot', puzzle: puzzleJson, mode: 'invalid', subMode: 'none' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parseBuilderSnapshot(json)).toBeNull();
      warnSpy.mockRestore();
    });
  });

  describe('serializePlayerProgress + parsePlayerProgress', () => {
    it('serializePlayerProgress: phase=import → null (nothing to save)', () => {
      const state = PlayerState.importScreen();
      expect(serializePlayerProgress(state)).toBeNull();
    });

    it('serializePlayerProgress: phase=solving → JSON has version=1, kind="player-progress", key, gridSize, playerLetters grid', () => {
      const state = makePlayerSolvingState(8);
      const json = serializePlayerProgress(state);
      expect(json).not.toBeNull();
      const parsed = JSON.parse(json as string);
      expect(parsed.version).toBe(1);
      expect(parsed.kind).toBe('player-progress');
      expect(parsed.key).toBe(String(state.puzzle.key));
      expect(parsed.gridSize).toBe(Number(state.puzzle.gridSize));
      expect(parsed.playerLetters).toHaveLength(5);
      expect(parsed.playerLetters[0]).toHaveLength(5);
    });

    it('serializePlayerProgress: black cells in playerLetters array are null', () => {
      const state = makePlayerSolvingState(9);
      const puzzle = Puzzle.withGrid(
        state.puzzle,
        GridOps.setCell(state.puzzle.grid, Row.of(0), Col.of(0), Cell.black()),
      );
      const stateWithBlackCell = { ...state, puzzle };
      const json = serializePlayerProgress(stateWithBlackCell);
      const parsed = JSON.parse(json as string);
      expect(parsed.playerLetters[0][0]).toBeNull();
    });

    it('parsePlayerProgress: round-trips a solving PlayerState (key as branded PuzzleKey, gridSize as branded GridSize, letters as Letter|null)', () => {
      const state = makePlayerSolvingState(10);
      const puzzle = Puzzle.withGrid(
        state.puzzle,
        GridOps.setCell(
          state.puzzle.grid,
          Row.of(0),
          Col.of(1),
          Cell.setPlayerLetter(state.puzzle.grid[0]![1]!, Letter.try('B')!),
        ),
      );
      const stateWithLetter = { ...state, puzzle };
      const json = serializePlayerProgress(stateWithLetter);
      const result = parsePlayerProgress(json as string);
      expect(result).not.toBeNull();
      const blob = result as PlayerProgressBlob;
      expect(blob.key).toBe(state.puzzle.key);
      expect(blob.gridSize).toBe(state.puzzle.gridSize);
      expect(blob.playerLetters[0]![1]).toBe(Letter.try('B'));
      expect(blob.playerLetters[0]![0]).toBeNull();
    });

    it('parsePlayerProgress: returns null on shape mismatch (wrong kind)', () => {
      const json = JSON.stringify({ version: 1, kind: 'player-progress-wrong', key: '00000000-0000-4000-8000-000000000000', gridSize: 5, playerLetters: [] });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parsePlayerProgress(json)).toBeNull();
      warnSpy.mockRestore();
    });

    it('parsePlayerProgress: invalid letter in playerLetters returns null (NFR-9 corrupt-drop, consistent with row/cell throws)', () => {
      const json = JSON.stringify({ version: 1, kind: 'player-progress', key: '00000000-0000-4000-8000-000000000000', gridSize: 2, playerLetters: [['@', null], [null, null]] });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parsePlayerProgress(json)).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parsePlayerProgress: returns null on garbage JSON', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parsePlayerProgress('not json')).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('createPersistenceScheduler', () => {
    let storage: InMemoryStoragePort;
    let scheduler: PersistenceScheduler;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.useFakeTimers();
      storage = new InMemoryStoragePort();
      scheduler = createPersistenceScheduler(storage, 400);
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
      vi.useRealTimers();
    });

    it('createPersistenceScheduler: scheduleBuilderSave does NOT save immediately (within 100ms)', () => {
      const state = makeBuilderState(11);
      scheduler.scheduleBuilderSave(state);
      vi.advanceTimersByTime(100);
      expect(storage.getBuilderBlob()).toBeNull();
    });

    it('createPersistenceScheduler: scheduleBuilderSave saves after debounce delay (advance timers by 400ms); storage.saveBuilder called with blob', () => {
      const state = makeBuilderState(12);
      scheduler.scheduleBuilderSave(state);
      vi.advanceTimersByTime(400);
      const blob = storage.getBuilderBlob();
      expect(blob).not.toBeNull();
      expect(JSON.parse(blob as string).kind).toBe('builder-snapshot');
    });

    it('createPersistenceScheduler: multiple scheduleBuilderSave calls in quick succession coalesce into one save that takes the latest state', () => {
      const state1 = makeBuilderState(13);
      const state2 = makeBuilderState(14);
      scheduler.scheduleBuilderSave(state1);
      vi.advanceTimersByTime(200);
      scheduler.scheduleBuilderSave(state2);
      vi.advanceTimersByTime(400);
      const blob = storage.getBuilderBlob();
      expect(blob).not.toBeNull();
      const parsed = JSON.parse(blob as string);
      expect(parsed.puzzle.key).toBe(state2.puzzle.key);
      expect(parsed.puzzle.key).not.toBe(state1.puzzle.key);
    });

    it('createPersistenceScheduler: schedulePlayerSave phase=import → no save ever fires (even after debounce delay)', () => {
      const state = PlayerState.importScreen();
      scheduler.schedulePlayerSave(state);
      vi.advanceTimersByTime(500);
      expect(storage.getPlayerProgressMap().size).toBe(0);
    });

    it('createPersistenceScheduler: schedulePlayerSave phase=solving → saves via storage.savePlayerProgress after debounce with matching PuzzleKey', () => {
      const state = makePlayerSolvingState(15);
      scheduler.schedulePlayerSave(state);
      vi.advanceTimersByTime(400);
      const saved = storage.getPlayerProgressMap().get(state.puzzle.key);
      expect(saved).not.toBeUndefined();
      expect(JSON.parse(saved as string).kind).toBe('player-progress');
    });

    it('createPersistenceScheduler: clearBuilder cancels pending Builder save AND calls storage.clearBuilder synchronously', () => {
      const state = makeBuilderState(16);
      scheduler.scheduleBuilderSave(state);
      vi.advanceTimersByTime(200);
      scheduler.clearBuilder();
      expect(storage.getBuilderBlob()).toBeNull();
      vi.advanceTimersByTime(400);
      expect(storage.getBuilderBlob()).toBeNull();
    });

    it('createPersistenceScheduler: clearPlayer cancels pending PlayerSave AND calls storage.clearPlayerProgress(key) synchronously', () => {
      const state = makePlayerSolvingState(17);
      scheduler.schedulePlayerSave(state);
      vi.advanceTimersByTime(200);
      scheduler.clearPlayer(state.puzzle.key);
      expect(storage.getPlayerProgressMap().get(state.puzzle.key)).toBeUndefined();
      vi.advanceTimersByTime(400);
      expect(storage.getPlayerProgressMap().get(state.puzzle.key)).toBeUndefined();
    });

    it('createPersistenceScheduler: flush() fires pending saves immediately', () => {
      const builderState = makeBuilderState(18);
      const playerState = makePlayerSolvingState(19);
      scheduler.scheduleBuilderSave(builderState);
      scheduler.schedulePlayerSave(playerState);
      scheduler.flush();
      expect(storage.getBuilderBlob()).not.toBeNull();
      expect(storage.getPlayerProgressMap().get(playerState.puzzle.key)).not.toBeUndefined();
      vi.advanceTimersByTime(400);
      // Still exactly one save each.
      expect(storage.getPlayerProgressMap().size).toBe(1);
    });

    it('createPersistenceScheduler: storage errors are caught via console.warn, not thrown', () => {
      const throwingStorage: StoragePort = {
        loadBuilder: () => null,
        saveBuilder: () => { throw new Error('save failed'); },
        clearBuilder: () => { throw new Error('clear failed'); },
        loadPlayerProgress: () => null,
        savePlayerProgress: () => { throw new Error('save player failed'); },
        clearPlayerProgress: () => { throw new Error('clear player failed'); },
      };
      const throwingScheduler = createPersistenceScheduler(throwingStorage, 400);
      const builderState = makeBuilderState(20);
      const playerState = makePlayerSolvingState(21);
      throwingScheduler.scheduleBuilderSave(builderState);
      throwingScheduler.schedulePlayerSave(playerState);
      vi.advanceTimersByTime(400);
      throwingScheduler.clearBuilder();
      throwingScheduler.clearPlayer(playerState.puzzle.key);
      expect(warnSpy).toHaveBeenCalledTimes(4);
    });

    it('createPersistenceScheduler: flush() with phase=import pending PlayerSave is a no-op (no savePlayerProgress call)', () => {
      const importState = PlayerState.importScreen();
      scheduler.schedulePlayerSave(importState);
      scheduler.flush();
      expect(storage.getPlayerProgressMap().size).toBe(0);
      vi.advanceTimersByTime(400);
      expect(storage.getPlayerProgressMap().size).toBe(0);
    });
  });
});
