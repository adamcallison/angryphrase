import { brand, type Brand } from '../brand';

export type Row = Brand<'Row', number>;

export const Row: { try(n: number): Row | null; of(n: number): Row } = {
  try(n: number): Row | null {
    return Number.isInteger(n) && n >= 0 ? brand(n) : null;
  },
  of(n: number): Row {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError(`Invalid Row: ${n}`);
    }
    return brand(n);
  },
};
