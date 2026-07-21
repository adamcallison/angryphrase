import { brand, type Brand } from '../brand';
import type { Rng } from '../rng/Rng';

export type PuzzleKey = Brand<'PuzzleKey', string>;

export const PuzzleKey: {
  generate(rng: Rng): PuzzleKey;
  try(s: string): PuzzleKey | null;
} = {
  generate(rng: Rng): PuzzleKey {
    const hex = Array.from({ length: 16 }, (_, i) => {
      let b = rng.nextInt(256);
      if (i === 6) b = (b & 0x0f) | 0x40;
      if (i === 8) b = (b & 0x3f) | 0x80;
      return b.toString(16).padStart(2, '0');
    }).join('');
    const key = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    return brand<'PuzzleKey', string>(key);
  },

  try(s: string): PuzzleKey | null {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s)) {
      return brand<'PuzzleKey', string>(s);
    }
    return null;
  },
};
