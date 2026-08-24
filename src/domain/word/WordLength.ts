import { brand, type Brand } from '../brand';

export type WordLength = Brand<'WordLength', number>;

export const WordLength: {
  try(n: number): WordLength | null;
  of(n: number): WordLength;
  equals(a: WordLength, b: WordLength): boolean;
} = {
  try(n: number): WordLength | null {
    return Number.isInteger(n) && n >= 2 ? brand(n) : null;
  },
  of(n: number): WordLength {
    if (!Number.isInteger(n) || n < 2) {
      throw new RangeError(`Invalid WordLength: ${n}`);
    }
    return brand(n);
  },
  equals(a: WordLength, b: WordLength): boolean {
    return a === b;
  }
};
