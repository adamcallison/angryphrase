import { describe, it, expect } from 'vitest';
import { FakeClock } from './FakeClock';

describe('FakeClock', () => {
  it('now returns the initial value', () => {
    const clock = new FakeClock(1000);
    expect(clock.now()).toBe(1000);
  });

  it('advance increases the current time', () => {
    const clock = new FakeClock(1000);
    clock.advance(250);
    expect(clock.now()).toBe(1250);
  });

  it('setTo sets the current time', () => {
    const clock = new FakeClock(1000);
    clock.setTo(5000);
    expect(clock.now()).toBe(5000);
  });

  it('now can be bound to a () => number injection', () => {
    const clock = new FakeClock(100);
    const now = clock.now.bind(clock);
    expect(now()).toBe(100);
    clock.advance(50);
    expect(now()).toBe(150);
  });
});
