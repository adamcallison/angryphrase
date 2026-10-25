import { brand, type Brand } from '../brand';

export type WordLength = Brand<'WordLength', number>;

export const WordLength: {
  of(n: number): WordLength;
} = {
  of(n: number): WordLength {
    if (!Number.isInteger(n) || n < 2) {
      throw new RangeError(`Invalid WordLength: ${n}`);
    }
    return brand(n);
  }
};
