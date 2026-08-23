import { GridOps } from '../grid/GridOps';
import type { Grid } from '../grid/Grid';
import type { Row } from '../grid/Row';
import type { Col } from '../grid/Col';
import { Direction } from '../word/Direction';
import type { Word } from '../word/Word';
import { Letter } from '../letter/Letter';
import type { Rng } from '../rng/Rng';
import type { CellSeparator } from '../grid/CellSeparator';
import type { AnagramEntry } from './AnagramEntry';

export type { AnagramEntry } from './AnagramEntry';

function validateAgainst(
  totalLength: number,
  entries: AnagramEntry[],
  input: string
): { ok: true } | { ok: false; reason: string } {
  const filtered = Letter.from(input);

  if (filtered.length !== totalLength) {
    return { ok: false, reason: `Input must be ${totalLength} letters (got ${filtered.length}).` };
  }

  const fixedCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.fixed && entry.letter !== null) {
      const ch = entry.letter;
      fixedCounts.set(ch, (fixedCounts.get(ch) ?? 0) + 1);
    }
  }

  const inputCounts = new Map<string, number>();
  for (const letter of filtered) {
    inputCounts.set(letter, (inputCounts.get(letter) ?? 0) + 1);
  }

  for (const [letter, count] of fixedCounts) {
    if ((inputCounts.get(letter) ?? 0) < count) {
      return { ok: false, reason: 'Input letters do not cover the fixed-position letters.' };
    }
  }

  return { ok: true };
}

export const Anagram: {
  buildWordModel(grid: Grid, word: Word): { entries: AnagramEntry[]; separators: CellSeparator[] };
  buildChainModel(grid: Grid, members: Word[]): { entries: AnagramEntry[]; separators: CellSeparator[] };
  validateInput(
    word: Word,
    entries: AnagramEntry[],
    input: string
  ): { ok: true } | { ok: false; reason: string };
  validateChainInput(
    totalLength: number,
    entries: AnagramEntry[],
    input: string
  ): { ok: true } | { ok: false; reason: string };
  scramble(entries: AnagramEntry[], input: string, rng: Rng): AnagramEntry[];
} = {
  buildWordModel(grid: Grid, word: Word): { entries: AnagramEntry[]; separators: CellSeparator[] } {
    const entries: AnagramEntry[] = [];
    const separators: CellSeparator[] = [];

    let coord: { row: Row; col: Col } = { row: word.key.startRow, col: word.key.startCol };
    const direction = word.key.direction;

    for (let i = 0; i < word.length; i++) {
      const cell = GridOps.cellAt(grid, coord.row, coord.col);
      if (cell.black) {
        throw new Error('Anagram.buildWordModel: word cell is black');
      }

      entries.push({
        position: i,
        fixed: cell.playerLetter !== null,
        letter: cell.playerLetter,
      });

      if (i < word.length - 1) {
        const marker = cell.marker;
        if (direction === 'across') {
          if (marker.spaceRight) {
            separators.push('space');
          } else if (marker.hyphenRight) {
            separators.push('hyphen');
          } else {
            separators.push('none');
          }
        } else {
          if (marker.spaceBottom) {
            separators.push('space');
          } else if (marker.hyphenBottom) {
            separators.push('hyphen');
          } else {
            separators.push('none');
          }
        }
      }

      coord = Direction.advance(coord, direction, 1);
    }

    return { entries, separators };
  },

  buildChainModel(grid: Grid, members: Word[]): { entries: AnagramEntry[]; separators: CellSeparator[] } {
    const entries: AnagramEntry[] = [];
    const separators: CellSeparator[] = [];

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (member === undefined) throw new Error('Anagram.buildChainModel: members[i] undefined');
      const memberModel = Anagram.buildWordModel(grid, member);
      const offset = entries.length;

      for (const entry of memberModel.entries) {
        entries.push({ ...entry, position: entry.position + offset });
      }

      for (const separator of memberModel.separators) {
        separators.push(separator);
      }

      if (i < members.length - 1) {
        separators.push('none');
      }
    }

    return { entries, separators };
  },

  validateInput(
    word: Word,
    entries: AnagramEntry[],
    input: string
  ): { ok: true } | { ok: false; reason: string } {
    return validateAgainst(word.length, entries, input);
  },

  validateChainInput(
    totalLength: number,
    entries: AnagramEntry[],
    input: string
  ): { ok: true } | { ok: false; reason: string } {
    return validateAgainst(totalLength, entries, input);
  },

  scramble(entries: AnagramEntry[], input: string, rng: Rng): AnagramEntry[] {
    const filtered = Letter.from(input);
    const wordLength = entries.length;

    const fixedCount = entries.filter((e) => e.fixed && e.letter !== null).length;

    if (filtered.length < fixedCount) {
      throw new Error('Anagram.scramble: insufficient letters for fixed positions');
    }
    if (filtered.length > wordLength) {
      throw new Error('Anagram.scramble: input longer than word');
    }

    const inputCounts = new Map<string, number>();
    for (const letter of filtered) {
      inputCounts.set(letter, (inputCounts.get(letter) ?? 0) + 1);
    }

    for (const entry of entries) {
      if (entry.fixed && entry.letter !== null) {
        const letter = entry.letter;
        const count = inputCounts.get(letter) ?? 0;
        if (count <= 0) {
          throw new Error('Anagram.scramble: insufficient letters for fixed positions');
        }
        inputCounts.set(letter, count - 1);
      }
    }

    const pool: Letter[] = [];
    for (const [letter, count] of inputCounts) {
      for (let i = 0; i < count; i++) {
        pool.push(letter as Letter);
      }
    }

    for (let i = 0; i < pool.length - 1; i++) {
      const j = rng.nextInt(pool.length - i);
      const k = pool.length - 1 - i;
      const temp = pool[k];
      if (temp === undefined) throw new Error('Anagram.scramble: pool[k] undefined');
      const swap = pool[j];
      if (swap === undefined) throw new Error('Anagram.scramble: pool[j] undefined');
      pool[k] = swap;
      pool[j] = temp;
    }

    const result: AnagramEntry[] = [];
    let poolIndex = 0;
    for (const entry of entries) {
      if (entry.fixed) {
        result.push({ ...entry });
      } else {
        result.push({
          position: entry.position,
          fixed: false,
          letter: pool[poolIndex] ?? null,
        });
        poolIndex++;
      }
    }

    return result;
  },
};
