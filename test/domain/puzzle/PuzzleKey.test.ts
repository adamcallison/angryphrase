import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import type { Rng } from '../../../src/domain/rng/Rng';

describe('PuzzleKey', () => {
  it('PuzzleKey.try accepts a valid lowercase UUID v4 string', () => {
    expect(PuzzleKey.try('01234567-89ab-4def-89ab-0123456789ab')).not.toBeNull();
  });

  it('PuzzleKey.try rejects malformed strings (returns null)', () => {
    expect(PuzzleKey.try('')).toBeNull();
    expect(PuzzleKey.try('not-a-uuid')).toBeNull();
    expect(PuzzleKey.try('01234567-89ab-5def-89ab-0123456789ab')).toBeNull();
    expect(PuzzleKey.try('01234567-89ab-4def-c9ab-0123456789ab')).toBeNull();
    expect(PuzzleKey.try('0123456789ab4def89ab0123456789ab')).toBeNull();
    expect(PuzzleKey.try('01234567-89ab-4def-89ab-0123456789ab-extra')).toBeNull();
  });

  it('PuzzleKey.try rejects uppercase UUIDs (only lowercase accepted)', () => {
    expect(PuzzleKey.try('01234567-89AB-4DEF-89AB-0123456789AB')).toBeNull();
  });

  it('PuzzleKey.generate produces a UUID v4 matching the RFC regex', () => {
    const rng: Rng = { nextInt: () => 0xab };
    expect(PuzzleKey.try(PuzzleKey.generate(rng))).not.toBeNull();
  });

  it('PuzzleKey.generate uses the injected rng for randomness', () => {
    let calls = 0;
    const rng: Rng = {
      nextInt(n: number) {
        calls += 1;
        return calls % n;
      },
    };
    const key = PuzzleKey.generate(rng);
    expect(calls).toBeGreaterThanOrEqual(16);
    expect(PuzzleKey.try(key)).not.toBeNull();
  });

  it('PuzzleKey.generate sets the version nibble to 4 even if the rng would produce a different value', () => {
    const rng: Rng = { nextInt: () => 0xff };
    const key = PuzzleKey.generate(rng);
    expect(key.charAt(14)).toBe('4');
    expect('89ab'.includes(key.charAt(19))).toBe(true);
  });

  it('PuzzleKey.generate id is lowercase hex', () => {
    const rng: Rng = { nextInt: () => 0xab };
    const key = PuzzleKey.generate(rng);
    expect(key).toBe(key.toLowerCase());
    expect(/^[0-9a-f-]+$/.test(key)).toBe(true);
  });
});
