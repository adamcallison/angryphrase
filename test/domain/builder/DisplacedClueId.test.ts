import { DisplacedClueId } from '../../../src/domain/builder/DisplacedClueId';
import type { Rng } from '../../../src/domain/rng/Rng';

describe('DisplacedClueId', () => {
  it('DisplacedClueId.generate produces a 32-char lowercase hex string', () => {
    const rng: Rng = { nextInt: () => 0 };
    const id = DisplacedClueId.generate(rng);
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('DisplacedClueId.generate uses the injected rng', () => {
    const rng: Rng = { nextInt: () => 0xab };
    expect(DisplacedClueId.generate(rng)).toBe('ab'.repeat(16));
  });

  it('DisplacedClueId.generate produces unique values across consecutive calls', () => {
    let n = 0;
    const rng: Rng = { nextInt: () => n++ };
    const first = DisplacedClueId.generate(rng);
    const second = DisplacedClueId.generate(rng);
    expect(first).not.toBe(second);
  });
});
