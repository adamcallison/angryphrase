import { describe, it, expect } from 'vitest';
import { SeededRng } from './SeededRng';

describe('SeededRng', () => {
  it('with the same seed produces the same sequence', () => {
    const rngA = new SeededRng(42);
    const rngB = new SeededRng(42);
    const seqA = Array.from({ length: 5 }, () => rngA.nextInt(100));
    const seqB = Array.from({ length: 5 }, () => rngB.nextInt(100));
    expect(seqA).toEqual(seqB);
  });

  it('nextInt(n) returns integers in [0, n)', () => {
    const rng = new SeededRng(42);
    const values = Array.from({ length: 1000 }, () => rng.nextInt(10));
    expect(values.every((v) => Number.isInteger(v) && v >= 0 && v < 10)).toBe(true);
  });

  it('nextInt throws RangeError on n <= 0 or non-integer', () => {
    const rng = new SeededRng(42);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-1)).toThrow(RangeError);
    expect(() => rng.nextInt(3.5)).toThrow(RangeError);
  });

  it('with different seeds produces different sequences (statistical sanity)', () => {
    const rngA = new SeededRng(1);
    const rngB = new SeededRng(2);
    const seqA = Array.from({ length: 5 }, () => rngA.nextInt(100));
    const seqB = Array.from({ length: 5 }, () => rngB.nextInt(100));
    expect(seqA).not.toEqual(seqB);
  });
});
