import { serializeIncomplete, parsePuzzle } from '../../domain/format/v1';
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

  if (
    typeof snap !== 'object' ||
    snap === null ||
    (snap as { kind?: unknown }).kind !== 'builder-snapshot' ||
    (snap as { version?: unknown }).version !== 1
  ) {
    return null;
  }

  // Re-serialize the embedded puzzle back to a string and feed to parsePuzzle.
  const puzzleJSON = JSON.stringify((snap as { puzzle: unknown }).puzzle);
  const result = parsePuzzle(puzzleJSON);
  if (!result.ok || result.fileType !== 'incomplete') {
    return null;
  }

  const mode = (snap as { mode?: unknown }).mode;
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    return null;
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { kind?: unknown }).kind !== 'player-progress' ||
    (parsed as { version?: unknown }).version !== 1
  ) {
    return null;
  }

  if (typeof (parsed as { key: unknown }).key !== 'string' || typeof (parsed as { gridSize: unknown }).gridSize !== 'number') {
    return null;
  }

  if (!Array.isArray((parsed as { playerLetters: unknown }).playerLetters)) {
    return null;
  }

  const key = PuzzleKey.try((parsed as { key: string }).key);
  if (key === null) {
    return null;
  }
  const gridSize = GridSizeCtor.try((parsed as { gridSize: number }).gridSize);
  if (gridSize === null) {
    return null;
  }

  const rawLetters = (parsed as { playerLetters: unknown[] }).playerLetters;
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
