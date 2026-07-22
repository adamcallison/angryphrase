import type { Rng } from '../domain/rng/Rng.ts';

export function createRngPort(): Rng {
  return {
    nextInt(n: number): number {
      if (!Number.isInteger(n) || n <= 0) {
        throw new RangeError('n must be a positive integer');
      }
      return Math.floor(Math.random() * n);
    },
  };
}

export const rngPort: Rng = createRngPort();
