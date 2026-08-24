import { serializeIncomplete, parsePuzzleV1 } from '../../domain/format/v1';
import type { BuilderState } from '../../builder/state/state';
import type { PlayerState } from '../../player/state/state';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import type { GridSize } from '../../domain/grid/GridSize';
import type { Letter } from '../../domain/letter/Letter';
import type { DisplacedClue } from '../../domain/builder/DisplacedClue';

import { GridOps } from '../../domain/grid/GridOps';
import { GridSize as GridSizeCtor } from '../../domain/grid/GridSize';
import { Row as RowCtor } from '../../domain/grid/Row';
import { Col as ColCtor } from '../../domain/grid/Col';
import { Letter as LetterCtor } from '../../domain/letter/Letter';

// ----- Builder snapshot -----

export type BuilderSnapshot = {
  puzzle: BuilderState['puzzle'];
  displacedClues: DisplacedClue[];
  mode: BuilderState['mode'];
};

export function serializeBuilderSnapshot(state: BuilderState): string {
  // Puzzle JSON (incomplete) is embedded as an object, not a string.
  const puzzleJSON = serializeIncomplete(state.puzzle, state.displacedClues);
  const puzzleObj = JSON.parse(puzzleJSON);
  const wrapper = {
    version: 1,
    kind: 'builder-snapshot',
    puzzle: puzzleObj, // includes displacedClues field already
    mode: state.mode,
    subMode: 'none', // FR-64: forced to 'none' on save
    // cursor omitted per C6
  };
  return JSON.stringify(wrapper);
}

export function parseBuilderSnapshot(blob: string): BuilderSnapshot | null {
  try {
    const snap = JSON.parse(blob) as unknown;
    if (
      typeof snap !== 'object' ||
      snap === null ||
      (snap as { kind?: unknown }).kind !== 'builder-snapshot' ||
      (snap as { version?: unknown }).version !== 1
    ) {
      console.warn('parseBuilderSnapshot: shape mismatch', snap);
      return null;
    }

    // Re-serialize the embedded puzzle back to a string and feed to parsePuzzleV1.
    const puzzleJSON = JSON.stringify((snap as { puzzle: unknown }).puzzle);
    const result = parsePuzzleV1(puzzleJSON);
    if (!result.ok || result.fileType !== 'incomplete') {
      console.warn('parseBuilderSnapshot: embedded puzzle failed to parse', result);
      return null;
    }

    const mode = (snap as { mode?: unknown }).mode;
    if (mode !== 'design' && mode !== 'fill') {
      console.warn('parseBuilderSnapshot: invalid mode', mode);
      return null;
    }

    return {
      puzzle: result.puzzle,
      displacedClues: result.displacedClues,
      mode,
    };
  } catch (err) {
    console.warn('parseBuilderSnapshot: parse error', err);
    return null;
  }
}

// ----- Player progress -----

export type PlayerProgressBlob = {
  key: PuzzleKey;
  gridSize: GridSize;
  playerLetters: (Letter | null)[][];
};

export function serializePlayerProgress(state: PlayerState): string | null {
  if (state.phase !== 'solving') return null;
  const size = Number(state.puzzle.gridSize);
  const playerLetters: (Letter | null)[][] = [];
  for (let r = 0; r < size; r++) {
    const row: (Letter | null)[] = [];
    for (let c = 0; c < size; c++) {
      const cell = GridOps.cellAt(state.puzzle.grid, RowCtor.of(r), ColCtor.of(c));
      row.push(cell.playerLetter);
    }
    playerLetters.push(row);
  }
  return JSON.stringify({
    version: 1,
    kind: 'player-progress',
    key: String(state.puzzle.key),
    gridSize: size,
    playerLetters: playerLetters.map((row) => row.map((l) => (l === null ? null : String(l)))),
  });
}

export function parsePlayerProgress(blob: string): PlayerProgressBlob | null {
  try {
    const parsed = JSON.parse(blob) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as { kind?: unknown }).kind !== 'player-progress' ||
      (parsed as { version?: unknown }).version !== 1
    ) {
      console.warn('parsePlayerProgress: shape mismatch', parsed);
      return null;
    }

    if (typeof (parsed as { key: unknown }).key !== 'string' || typeof (parsed as { gridSize: unknown }).gridSize !== 'number') {
      console.warn('parsePlayerProgress: scalar shape mismatch');
      return null;
    }

    if (!Array.isArray((parsed as { playerLetters: unknown }).playerLetters)) {
      console.warn('parsePlayerProgress: playerLetters not an array');
      return null;
    }

    const key = PuzzleKey.try((parsed as { key: string }).key);
    if (key === null) {
      console.warn('parsePlayerProgress: invalid PuzzleKey (not a UUID v4)');
      return null;
    }
    const gridSize = GridSizeCtor.of((parsed as { gridSize: number }).gridSize);
    const rawLetters = (parsed as { playerLetters: unknown[] }).playerLetters;
    const playerLetters: (Letter | null)[][] = rawLetters.map((row: unknown) => {
      if (!Array.isArray(row)) throw new Error('parsePlayerProgress: row not array');
      return row.map((cell: unknown) => {
        if (cell === null) return null;
        if (typeof cell !== 'string') throw new Error('parsePlayerProgress: cell not string');
        const letter = LetterCtor.try(cell);
        if (letter === null) throw new Error('parsePlayerProgress: invalid letter cell');
        return letter;
      });
    });

    return { key, gridSize, playerLetters };
  } catch (err) {
    console.warn('parsePlayerProgress: parse error', err);
    return null;
  }
}
