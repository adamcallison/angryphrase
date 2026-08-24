import { brand, type Brand } from '../brand';

export type EpochMs = Brand<'EpochMs', number>;

export const EpochMs: {
  try(n: number): EpochMs | null;
  of(n: number): EpochMs;
} = {
  try(n: number): EpochMs | null {
    return Number.isInteger(n) && n >= 0 ? brand(n) : null;
  },
  of(n: number): EpochMs {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError(`Invalid EpochMs: ${n}`);
    }
    return brand(n);
  }
};
