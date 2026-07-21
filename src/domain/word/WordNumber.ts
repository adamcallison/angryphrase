import { brand, type Brand } from '../brand';

export type WordNumber = Brand<'WordNumber', number>;

export const WordNumber: { try(n: number): WordNumber | null; of(n: number): WordNumber } = {
  try(n: number): WordNumber | null {
    return Number.isInteger(n) && n >= 1 ? brand(n) : null;
  },
  of(n: number): WordNumber {
    if (!Number.isInteger(n) || n < 1) {
      throw new RangeError(`Invalid WordNumber: ${n}`);
    }
    return brand(n);
  },
};
