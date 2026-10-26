import { ToastId } from '../../../src/domain/notifications/ToastId';
import type { Rng } from '../../../src/domain/rng/Rng';

describe('ToastId', () => {
  it('ToastId.generate produces a UUID v4 string', () => {
    const rng: Rng = { nextInt: () => 0 };
    const id = ToastId.generate(rng);
    expect(id).toHaveLength(36);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('ToastId.generate uses the injected rng', () => {
    const rng: Rng = { nextInt: () => 0xab };
    expect(ToastId.generate(rng)).toBe('abababab-abab-4bab-abab-abababababab');
  });
});
