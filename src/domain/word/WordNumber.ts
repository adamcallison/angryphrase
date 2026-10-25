import { brand, type Brand } from '../brand';

export type WordNumber = Brand<'WordNumber', number>;

export const WordNumber: { of(n: number): WordNumber } = {
  of(n: number): WordNumber {
    if (!Number.isInteger(n) || n < 1) {
      throw new RangeError(`Invalid WordNumber: ${n}`);
    }
    return brand(n);
  },
};
