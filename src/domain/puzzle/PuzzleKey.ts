import { brand, type Brand } from '../brand';
import { isUuidV4, uuidv4 } from '../uuid/uuidv4';
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
    return isUuidV4(s) ? brand<'PuzzleKey', string>(s) : null;
  },
};
