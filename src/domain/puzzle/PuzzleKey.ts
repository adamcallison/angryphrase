import { brand, type Brand } from '../brand';
import { uuidv4 } from '../uuid/uuidv4';
import type { Rng } from '../rng/Rng';

export type PuzzleKey = Brand<'PuzzleKey', string>;

export const PuzzleKey: {
  generate(rng: Rng): PuzzleKey;
  try(s: string): PuzzleKey | null;
} = {
  generate(rng: Rng): PuzzleKey {
    return brand<'PuzzleKey', string>(uuidv4(rng));
  },

  try(s: string): PuzzleKey | null {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s)) {
      return brand<'PuzzleKey', string>(s);
    }
    return null;
  },
};
