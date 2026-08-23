import { brand, type Brand } from '../brand';

export type DurationMs = Brand<'DurationMs', number>;

export const DurationMs: {
  try(n: number): DurationMs | null;
  of(n: number): DurationMs;
  DEFAULT: DurationMs;
} = {
  try(n: number): DurationMs | null {
    return Number.isInteger(n) && n > 0 ? brand(n) : null;
  },
  of(n: number): DurationMs {
    if (!Number.isInteger(n) || n <= 0) {
      throw new RangeError(`Invalid DurationMs: ${n}`);
    }
    return brand(n);
  },
  DEFAULT: brand(3500) as Brand<'DurationMs', 3500>
};
