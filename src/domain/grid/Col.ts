import { brand, type Brand } from '../brand';

export type Col = Brand<'Col', number>;

export const Col: { try(n: number): Col | null; of(n: number): Col } = {
  try(n: number): Col | null {
    return Number.isInteger(n) && n >= 0 ? brand(n) : null;
  },
  of(n: number): Col {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError(`Invalid Col: ${n}`);
    }
    return brand(n);
  },
};
