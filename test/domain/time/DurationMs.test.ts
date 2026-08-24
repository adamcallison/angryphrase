import { DurationMs } from '../../../src/domain/time/DurationMs';
import type { DurationMs as DurationMsType } from '../../../src/domain/time/DurationMs';

describe('DurationMs', () => {
  it('DurationMs.try returns DurationMs for valid input', () => {
    expect(DurationMs.try(1)).toBe(1);
    expect(DurationMs.try(3500)).toBe(3500);
    expect(DurationMs.try(10000)).toBe(10000);
  });

  it('DurationMs.try returns null for invalid input', () => {
    expect(DurationMs.try(0)).toBeNull();
    expect(DurationMs.try(-1)).toBeNull();
    expect(DurationMs.try(1.5)).toBeNull();
    expect(DurationMs.try(Number.NaN)).toBeNull();
    expect(DurationMs.try(Number.POSITIVE_INFINITY)).toBeNull();
    expect(DurationMs.try(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('DurationMs.of returns DurationMs for valid input', () => {
    expect(DurationMs.of(1)).toBe(1);
    expect(DurationMs.of(3500)).toBe(3500);
  });

  it('DurationMs.of throws RangeError for invalid input', () => {
    expect(() => DurationMs.of(0)).toThrow(RangeError);
    expect(() => DurationMs.of(-1)).toThrow(RangeError);
    expect(() => DurationMs.of(1.5)).toThrow(RangeError);
    expect(() => DurationMs.of(Number.NaN)).toThrow(RangeError);
    expect(() => DurationMs.of(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => DurationMs.of(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });

  it('DurationMs.DEFAULT is 3500', () => {
    expect(DurationMs.DEFAULT).toBe(3500);
  });

  it('DurationMs brand is not assignable from plain number', () => {
    function _check(d: DurationMsType): DurationMsType {
      return d;
    }

    const x: number = 5;
    // @ts-expect-error DurationMs is not assignable from plain number
    _check(x);
  });
});
