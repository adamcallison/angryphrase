import { describe, expect, it } from 'vitest';
import { createRngPort, rngPort } from './rngPort';

describe('createRngPort', () => {
  it('produces nextInt(n) results in [0, n) over many samples', () => {
    const rng = createRngPort();
    for (let n = 2; n <= 100; n++) {
      for (let i = 0; i < 50; i++) {
        const result = rng.nextInt(n);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(n);
      }
    }
  });

  it('nextInt(1) always returns 0', () => {
    const rng = createRngPort();
    for (let i = 0; i < 100; i++) {
      expect(rng.nextInt(1)).toBe(0);
    }
  });

  it('throws RangeError for non-positive maxExclusive', () => {
    const rng = createRngPort();
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-1)).toThrow(RangeError);
    expect(() => rng.nextInt(-100)).toThrow(RangeError);
  });
});

describe('rngPort singleton', () => {
  it('satisfies the same contract as createRngPort', () => {
    const result = rngPort.nextInt(10);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(10);
  });
});
