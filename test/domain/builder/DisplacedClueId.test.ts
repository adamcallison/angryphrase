import { DisplacedClueId } from '../../../src/domain/builder/DisplacedClueId';
import type { Rng } from '../../../src/domain/rng/Rng';
import { SeededRng } from '../../fakes/SeededRng';

describe('DisplacedClueId', () => {
  it('DisplacedClueId.generate produces a UUID v4 matching the RFC regex', () => {
    const rng: Rng = { nextInt: () => 0xab };
    expect(DisplacedClueId.generate(rng)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('DisplacedClueId.generate uses the injected rng for randomness', () => {
    let calls = 0;
    const rng: Rng = {
      nextInt(n: number) {
        calls += 1;
        return calls % n;
      },
    };
    const id = DisplacedClueId.generate(rng);
    expect(calls).toBeGreaterThanOrEqual(16);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('DisplacedClueId.generate id is lowercase hex', () => {
    const rng: Rng = { nextInt: () => 0xab };
    const id = DisplacedClueId.generate(rng);
    expect(id).toBe(id.toLowerCase());
    expect(/^[0-9a-f-]+$/.test(id)).toBe(true);
  });

  it('DisplacedClueId.try accepts a valid lowercase UUID v4 string', () => {
    expect(DisplacedClueId.try('01234567-89ab-4def-89ab-0123456789ab')).not.toBeNull();
  });

  it('DisplacedClueId.try rejects malformed strings (returns null)', () => {
    expect(DisplacedClueId.try('')).toBeNull();
    expect(DisplacedClueId.try('not-a-uuid')).toBeNull();
    expect(DisplacedClueId.try('ab'.repeat(16))).toBeNull();
    expect(DisplacedClueId.try('01234567-89ab-5def-89ab-0123456789ab')).toBeNull();
    expect(DisplacedClueId.try('01234567-89ab-4def-c9ab-0123456789ab')).toBeNull();
    expect(DisplacedClueId.try('01234567-89ab-4def-89ab-0123456789ab-extra')).toBeNull();
  });

  it('DisplacedClueId.try rejects uppercase UUIDs (only lowercase accepted)', () => {
    expect(DisplacedClueId.try('01234567-89AB-4DEF-89AB-0123456789AB')).toBeNull();
  });

  it('DisplacedClueId.generate result passes DisplacedClueId.try', () => {
    const rng: Rng = { nextInt: () => 0xab };
    expect(DisplacedClueId.try(DisplacedClueId.generate(rng))).not.toBeNull();
  });

  it('DisplacedClueId.equals returns true for the same id, false for different ids', () => {
    const a = DisplacedClueId.generate(new SeededRng(1));
    const b = DisplacedClueId.generate(new SeededRng(2));
    const a2 = DisplacedClueId.generate(new SeededRng(1));

    expect(DisplacedClueId.equals(a, a2)).toBe(true);
    expect(DisplacedClueId.equals(a, b)).toBe(false);
  });
});
