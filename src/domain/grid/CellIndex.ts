import { brand, type Brand } from '../brand';

export type CellIndex = Brand<'CellIndex', number>;

export const CellIndex: { try(n: number): CellIndex | null; of(n: number): CellIndex } = {
  try(n: number): CellIndex | null {
    return Number.isInteger(n) && n >= 0 ? brand(n) : null;
  },
  of(n: number): CellIndex {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError(`Invalid CellIndex: ${n}`);
    }
    return brand(n);
  },
};
