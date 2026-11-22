import { brand, intBrand, type Brand } from '../brand';

export type GridSize = Brand<'GridSize', number>;

export const GridSize: {
  try(n: number): GridSize | null;
  of(n: number): GridSize;
  MIN: GridSize;
  MAX: GridSize;
  DEFAULT: GridSize;
} = {
  ...intBrand('GridSize', 2, 25),
  MIN: brand<'GridSize', 2>(2),
  MAX: brand<'GridSize', 25>(25),
  DEFAULT: brand<'GridSize', 15>(15),
};
