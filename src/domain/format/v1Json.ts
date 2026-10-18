import type { Puzzle } from '../puzzle/Puzzle';
import type { PuzzleKey } from '../puzzle/PuzzleKey';
import type { DisplacedClue } from '../builder/DisplacedClue';
import {
  parsePuzzleShape,
  serializeIncompleteShape,
  serializeCompleteShape,
  type ParseFailure,
  type PuzzleFileType,
} from './v1';

type Result =
  | { ok: true; puzzle: Puzzle; fileType: PuzzleFileType; displacedClues: DisplacedClue[] }
  | { ok: false; failures: ParseFailure[] };

export const parsePuzzle = (json: string): Result => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, failures: [{ message: 'File is not valid JSON.' }] };
  }

  return parsePuzzleShape(parsed);
};

export const serializeIncomplete = (p: Puzzle, displacedClues: DisplacedClue[]): string => {
  return JSON.stringify(serializeIncompleteShape(p, displacedClues), null, 0);
};

export const serializeComplete = (p: Puzzle): string => {
  return JSON.stringify(serializeCompleteShape(p), null, 0);
};

export const Filename: {
  incomplete(key: PuzzleKey): string;
  complete(key: PuzzleKey): string;
} = {
  incomplete(key: PuzzleKey): string {
    return `puzzle-${String(key).slice(0, 8)}-incomplete.json`;
  },
  complete(key: PuzzleKey): string {
    return `puzzle-${String(key).slice(0, 8)}-complete.json`;
  },
};
