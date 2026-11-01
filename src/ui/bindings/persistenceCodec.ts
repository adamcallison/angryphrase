import { serializeIncompleteShape, parsePuzzleShape } from '../../domain/format/v1';
import type { BuilderState } from '../../builder/state/state';
import type { PlayerState } from '../../player/state/state';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import type { GridSize } from '../../domain/grid/GridSize';
import type { Letter } from '../../domain/letter/Letter';
import type { DisplacedClue } from '../../domain/builder/DisplacedClue';

import { GridSize as GridSizeCtor } from '../../domain/grid/GridSize';
import { Letter as LetterCtor } from '../../domain/letter/Letter';

// ----- Builder snapshot -----

export type BuilderSnapshot = {
  puzzle: BuilderState['puzzle'];
  displacedClues: DisplacedClue[];
  mode: BuilderState['mode'];
};

export function serializeBuilderSnapshot(state: BuilderState): string {
  const wrapper = {
    version: 1,
    kind: 'builder-snapshot',
    puzzle: serializeIncompleteShape(state.puzzle, state.displacedClues),
    mode: state.mode,
  };
  return JSON.stringify(wrapper);
}

export function parseBuilderSnapshot(blob: string): BuilderSnapshot | null {
  let snap: unknown;
  try {
    snap = JSON.parse(blob);
  } catch {
    return null;
  }

  if (typeof snap !== 'object' || snap === null) {
    return null;
  }

  const w = snap as { kind?: unknown; version?: unknown; puzzle?: unknown; mode?: unknown };
  if (w.kind !== 'builder-snapshot' || w.version !== 1) return null;

  const puzzleParsed = w.puzzle;
  const result = parsePuzzleShape(puzzleParsed);
  if (!result.ok || result.fileType !== 'incomplete') {
    return null;
  }

  const mode = w.mode;
  if (mode !== 'design' && mode !== 'fill') {
    return null;
  }

  return {
    puzzle: result.puzzle,
    displacedClues: result.displacedClues,
    mode,
  };
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
  const playerLetters = state.puzzle.grid.map((row) =>
    row.map((cell) => (cell.playerLetter === null ? null : cell.playerLetter)),
  );
  return JSON.stringify({
    version: 1,
    kind: 'player-progress',
    key: state.puzzle.key,
    gridSize: size,
    playerLetters,
  });
}

export function parsePlayerProgress(blob: string): PlayerProgressBlob | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const w = parsed as { kind?: unknown; version?: unknown; key?: unknown; gridSize?: unknown; playerLetters?: unknown };
  if (w.kind !== 'player-progress' || w.version !== 1) return null;

  const keyRaw = w.key;
  const gridSizeRaw = w.gridSize;
  if (typeof keyRaw !== 'string' || typeof gridSizeRaw !== 'number') return null;

  const rawLetters = w.playerLetters;
  if (!Array.isArray(rawLetters)) return null;

  const key = PuzzleKey.try(keyRaw);
  if (key === null) return null;
  const gridSize = GridSizeCtor.try(gridSizeRaw);
  if (gridSize === null) return null;

  const playerLetters: (Letter | null)[][] = [];
  for (const rawRow of rawLetters) {
    if (!Array.isArray(rawRow)) return null;
    const row: (Letter | null)[] = [];
    for (const rawCell of rawRow) {
      if (rawCell === null) { row.push(null); continue; }
      if (typeof rawCell !== 'string') return null;
      const letter = LetterCtor.try(rawCell);
      if (letter === null) return null;
      row.push(letter);
    }
    playerLetters.push(row);
  }

  return { key, gridSize, playerLetters };
}
