import { brand, type Brand } from '../brand';

export type GridSize = Brand<'GridSize', number>;

export const GridSize: {
  try(n: number): GridSize | null;
  of(n: number): GridSize;
  MIN: GridSize;
  MAX: GridSize;
  DEFAULT: GridSize;
} = {
  try(n: number): GridSize | null {
    return Number.isInteger(n) && n >= 2 && n <= 25 ? brand(n) : null;
  },
  of(n: number): GridSize {
    if (!Number.isInteger(n) || n < 2 || n > 25) {
      throw new RangeError(`Invalid GridSize: ${n}`);
    }
    return brand(n);
  },
  MIN: brand(2) as Brand<'GridSize', 2>,
  MAX: brand(25) as Brand<'GridSize', 25>,
  DEFAULT: brand(15) as Brand<'GridSize', 15>,
};
