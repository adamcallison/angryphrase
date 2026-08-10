import { uuidv4 } from '../../../src/domain/uuid/uuidv4';
import type { Rng } from '../../../src/domain/rng/Rng';

describe('uuidv4', () => {
  it('uuidv4 produces a lowercase UUID v4 string matching the RFC 4122 regex', () => {
    const rng: Rng = { nextInt: () => 0xab };
    const result = uuidv4(rng);
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result)).toBe(true);
    expect(result.length).toBe(36);
  });

  it('uuidv4 uses the injected rng for randomness', () => {
    let calls = 0;
    const rng: Rng = {
      nextInt(n: number) {
        calls += 1;
        return calls % n;
      },
    };
    const result = uuidv4(rng);
    expect(calls).toBeGreaterThanOrEqual(16);
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result)).toBe(true);
  });

  it('uuidv4 sets the version nibble to 4 even when rng would produce a different value', () => {
    const rng: Rng = { nextInt: () => 0xff };
    const result = uuidv4(rng);
    expect(result.charAt(14)).toBe('4');
    expect('89ab'.includes(result.charAt(19))).toBe(true);
  });

  it('uuidv4 output is lowercase hex with dashes only', () => {
    const rng: Rng = { nextInt: () => 0xab };
    const result = uuidv4(rng);
    expect(result).toBe(result.toLowerCase());
    expect(/^[0-9a-f-]+$/.test(result)).toBe(true);
    expect(result.length).toBe(36);
    expect(result.split('-').length).toBe(5);
  });
});
