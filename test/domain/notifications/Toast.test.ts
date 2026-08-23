import { Toast } from '../../../src/domain/notifications/Toast';
import type { Rng } from '../../../src/domain/rng/Rng';
import { EpochMs } from '../../../src/domain/time/EpochMs';
import { DurationMs } from '../../../src/domain/time/DurationMs';

describe('Toast', () => {
  it('Toast.create sets all fields and a fresh id', () => {
    const rng: Rng = { nextInt: () => 0 };
    const toast = Toast.create(rng, 'info', 'hello', () => EpochMs.of(12345));
    expect(toast.kind).toBe('info');
    expect(toast.message).toBe('hello');
    expect(toast.createdAt).toBe(12345);
    expect(toast.ttlMs).toBe(3500);
    expect(toast.id).toHaveLength(32);
    expect(toast.id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('Toast.create accepts a custom ttlMs', () => {
    const rng: Rng = { nextInt: () => 0 };
    const toast = Toast.create(rng, 'success', 'saved', () => EpochMs.of(0), DurationMs.of(5000));
    expect(toast.ttlMs).toBe(5000);
  });

  it('Toast.create default ttlMs is 3500', () => {
    const rng: Rng = { nextInt: () => 0 };
    const toast = Toast.create(rng, 'warning', 'oops', () => EpochMs.of(0));
    expect(toast.ttlMs).toBe(3500);
  });

  it('Toast.create calls the rng and the clock', () => {
    let rngCalls = 0;
    const rng: Rng = {
      nextInt(n: number) {
        rngCalls += 1;
        return rngCalls % n;
      },
    };
    let nowCalls = 0;
    const now = () => {
      nowCalls += 1;
      return EpochMs.of(nowCalls * 1000);
    };
    const toast = Toast.create(rng, 'error', 'fail', now);
    expect(rngCalls).toBeGreaterThanOrEqual(16);
    expect(toast.createdAt).toBe(1000);
    expect(nowCalls).toBe(1);
  });
});
