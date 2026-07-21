import { ToastId } from '../../../src/domain/notifications/ToastId';
import type { Rng } from '../../../src/domain/rng/Rng';

describe('ToastId', () => {
  it('ToastId.generate produces a 32-char lowercase hex string', () => {
    const rng: Rng = { nextInt: () => 0 };
    const id = ToastId.generate(rng);
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('ToastId.generate uses the injected rng', () => {
    const rng: Rng = { nextInt: () => 0xab };
    expect(ToastId.generate(rng)).toBe('ab'.repeat(16));
  });
});
