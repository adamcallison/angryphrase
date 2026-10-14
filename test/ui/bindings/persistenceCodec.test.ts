import { describe, it, expect, vi } from 'vitest';
import { serializeIncomplete } from '../../../src/domain/format/v1';
import {
  serializeBuilderSnapshot,
  parseBuilderSnapshot,
  serializePlayerProgress,
  parsePlayerProgress,
  type BuilderSnapshot,
  type PlayerProgressBlob,
} from '../../../src/ui/bindings/persistenceCodec';
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
import { Numbering } from '../../../src/domain/word/Numbering';
import { WordDerivation } from '../../../src/domain/word/WordDerivation';
import { SeededRng } from '../../fakes/SeededRng';
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
  return {
    ...state,
    puzzle: overrides?.puzzle ?? state.puzzle,
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

describe('persistenceCodec.ts', () => {
  describe('serializeBuilderSnapshot + parseBuilderSnapshot', () => {
    it('serializeBuilderSnapshot: output JSON has version=1, kind="builder-snapshot", mode from state.mode, subMode="none" (forced)', () => {
      const state = makeBuilderState(1, {
        mode: 'fill',
        subMode: { kind: 'join', source: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' } },
      });
      const json = serializeBuilderSnapshot(state);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.kind).toBe('builder-snapshot');
      expect(parsed.mode).toBe('fill');
      expect(parsed.subMode).toBe('none');
    });

    it('serializeBuilderSnapshot: cursor field is omitted (C6 — not persisted)', () => {
      const state = makeBuilderState(2, {
        cursor: { row: Row.of(0), col: Col.of(0), direction: 'across' },
      });
      const json = serializeBuilderSnapshot(state);
      const parsed = JSON.parse(json);
      expect(parsed.cursor).toBeUndefined();
    });

    it('parseBuilderSnapshot: round-trips a snapshot built via serializeBuilderSnapshot', () => {
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
  });

  describe('serializePlayerProgress + parsePlayerProgress', () => {
    it('serializePlayerProgress: returns the JSON string for a solving state with player letters', () => {
      const state = makePlayerSolvingState(8);
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
      expect(json).not.toBeNull();
      const parsed = JSON.parse(json as string);
      expect(parsed.version).toBe(1);
      expect(parsed.kind).toBe('player-progress');
      expect(parsed.key).toBe(String(state.puzzle.key));
      expect(parsed.gridSize).toBe(Number(state.puzzle.gridSize));
      expect(parsed.playerLetters[0][1]).toBe('B');
      expect(parsed.playerLetters[0][0]).toBeNull();
    });

    it('serializePlayerProgress: returns null when state.phase !== "solving" (single owner of the phase guard)', () => {
      const state = PlayerState.importScreen();
      expect(serializePlayerProgress(state)).toBeNull();
    });

    it('parsePlayerProgress: round-trips a PlayerProgressBlob built via serializePlayerProgress', () => {
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
  });

  describe('persistenceCodec: no console.warn on parse failures', () => {
    const invalidBuilderBlobs = [
      { name: 'malformed JSON', blob: 'not json' },
      { name: 'wrong kind', blob: JSON.stringify({ version: 1, kind: 'wrong-kind', puzzle: {}, mode: 'design' }) },
      { name: 'wrong version', blob: JSON.stringify({ version: 2, kind: 'builder-snapshot', puzzle: {}, mode: 'design' }) },
      {
        name: 'embedded puzzle fails parse',
        blob: JSON.stringify({
          version: 1,
          kind: 'builder-snapshot',
          puzzle: {
            version: 1,
            type: 'incomplete',
            key: 'not-a-uuid',
            gridSize: 5,
            title: '',
            author: '',
            grid: [],
            words: [],
            displacedClues: [],
          },
          mode: 'design',
        }),
      },
      {
        name: 'invalid mode',
        blob: JSON.stringify({
          version: 1,
          kind: 'builder-snapshot',
          puzzle: JSON.parse(serializeIncomplete(makeAllBlackPuzzle(7, 3), [])),
          mode: 'invalid',
        }),
      },
    ];

    const invalidPlayerBlobs = [
      { name: 'malformed JSON', blob: 'not json' },
      {
        name: 'wrong kind',
        blob: JSON.stringify({
          version: 1,
          kind: 'player-progress-wrong',
          key: '00000000-0000-4000-8000-000000000000',
          gridSize: 5,
          playerLetters: [],
        }),
      },
      {
        name: 'playerLetters missing',
        blob: JSON.stringify({ version: 1, kind: 'player-progress', key: '00000000-0000-4000-8000-000000000000', gridSize: 5 }),
      },
      {
        name: 'playerLetters not an array',
        blob: JSON.stringify({
          version: 1,
          kind: 'player-progress',
          key: '00000000-0000-4000-8000-000000000000',
          gridSize: 5,
          playerLetters: 'letters',
        }),
      },
      {
        name: 'row not an array',
        blob: JSON.stringify({
          version: 1,
          kind: 'player-progress',
          key: '00000000-0000-4000-8000-000000000000',
          gridSize: 5,
          playerLetters: [42],
        }),
      },
      {
        name: 'cell neither null nor string',
        blob: JSON.stringify({
          version: 1,
          kind: 'player-progress',
          key: '00000000-0000-4000-8000-000000000000',
          gridSize: 5,
          playerLetters: [[42, null], [null, null]],
        }),
      },
      {
        name: 'cell string fails Letter.try',
        blob: JSON.stringify({
          version: 1,
          kind: 'player-progress',
          key: '00000000-0000-4000-8000-000000000000',
          gridSize: 2,
          playerLetters: [['@', null], [null, null]],
        }),
      },
      {
        name: 'invalid PuzzleKey',
        blob: JSON.stringify({
          version: 1,
          kind: 'player-progress',
          key: 'not-a-uuid',
          gridSize: 2,
          playerLetters: [[null, null], [null, null]],
        }),
      },
    ];

    it('parseBuilderSnapshot: returns null on malformed JSON (no warn — codec is silent)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parseBuilderSnapshot('not json')).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parseBuilderSnapshot: returns null when shape.kind is not "builder-snapshot" (no warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = JSON.stringify({ version: 1, kind: 'wrong-kind', puzzle: {}, mode: 'design' });
      expect(parseBuilderSnapshot(blob)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parseBuilderSnapshot: returns null when shape.version is not 1 (no warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = JSON.stringify({ version: 2, kind: 'builder-snapshot', puzzle: {}, mode: 'design' });
      expect(parseBuilderSnapshot(blob)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parseBuilderSnapshot: returns null when embedded puzzle fails to parse (no warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = JSON.stringify({
        version: 1,
        kind: 'builder-snapshot',
        puzzle: {
          version: 1,
          type: 'incomplete',
          key: 'not-a-uuid',
          gridSize: 5,
          title: '',
          author: '',
          grid: [],
          words: [],
          displacedClues: [],
        },
        mode: 'design',
      });
      expect(parseBuilderSnapshot(blob)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parseBuilderSnapshot: returns null when mode is neither "design" nor "fill" (no warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = JSON.stringify({
        version: 1,
        kind: 'builder-snapshot',
        puzzle: JSON.parse(serializeIncomplete(makeAllBlackPuzzle(7, 3), [])),
        mode: 'invalid',
      });
      expect(parseBuilderSnapshot(blob)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parsePlayerProgress: returns null on malformed JSON (no warn — codec is silent)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parsePlayerProgress('not json')).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parsePlayerProgress: returns null when shape.kind is not "player-progress" (no warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = JSON.stringify({
        version: 1,
        kind: 'player-progress-wrong',
        key: '00000000-0000-4000-8000-000000000000',
        gridSize: 5,
        playerLetters: [],
      });
      expect(parsePlayerProgress(blob)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parsePlayerProgress: returns null when playerLetters is missing or not an array (no warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const missing = JSON.stringify({
        version: 1,
        kind: 'player-progress',
        key: '00000000-0000-4000-8000-000000000000',
        gridSize: 5,
      });
      const notArray = JSON.stringify({
        version: 1,
        kind: 'player-progress',
        key: '00000000-0000-4000-8000-000000000000',
        gridSize: 5,
        playerLetters: 'letters',
      });
      expect(parsePlayerProgress(missing)).toBeNull();
      expect(parsePlayerProgress(notArray)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parsePlayerProgress: returns null when a row is not an array (no warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = JSON.stringify({
        version: 1,
        kind: 'player-progress',
        key: '00000000-0000-4000-8000-000000000000',
        gridSize: 5,
        playerLetters: [42],
      });
      expect(parsePlayerProgress(blob)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parsePlayerProgress: returns null when a cell is neither null nor a string (no warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = JSON.stringify({
        version: 1,
        kind: 'player-progress',
        key: '00000000-0000-4000-8000-000000000000',
        gridSize: 5,
        playerLetters: [[42, null], [null, null]],
      });
      expect(parsePlayerProgress(blob)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parsePlayerProgress: returns null when a cell string fails Letter.try (no warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = JSON.stringify({
        version: 1,
        kind: 'player-progress',
        key: '00000000-0000-4000-8000-000000000000',
        gridSize: 2,
        playerLetters: [['@', null], [null, null]],
      });
      expect(parsePlayerProgress(blob)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('parsePlayerProgress: rejects PuzzleKey values that are not a v4 UUID via PuzzleKey.try (no warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = JSON.stringify({
        version: 1,
        kind: 'player-progress',
        key: 'not-a-uuid',
        gridSize: 2,
        playerLetters: [[null, null], [null, null]],
      });
      expect(parsePlayerProgress(blob)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('persistenceCodec: tests assert no console.warn fired by parsing failures (spy on console.warn, expect not called)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      for (const { blob } of invalidBuilderBlobs) {
        expect(parseBuilderSnapshot(blob)).toBeNull();
      }
      for (const { blob } of invalidPlayerBlobs) {
        expect(parsePlayerProgress(blob)).toBeNull();
      }
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
