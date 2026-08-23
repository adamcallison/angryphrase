import { EpochMs } from '../../../src/domain/time/EpochMs';
import type { EpochMs as EpochMsType } from '../../../src/domain/time/EpochMs';

describe('EpochMs', () => {
  it('EpochMs.try returns EpochMs for valid input', () => {
    expect(EpochMs.try(0)).toBe(0);
    expect(EpochMs.try(1000)).toBe(1000);
    expect(EpochMs.try(1700000000000)).toBe(1700000000000);
  });

  it('EpochMs.try returns null for invalid input', () => {
    expect(EpochMs.try(-1)).toBeNull();
    expect(EpochMs.try(-0.5)).toBeNull();
    expect(EpochMs.try(1.5)).toBeNull();
    expect(EpochMs.try(Number.NaN)).toBeNull();
    expect(EpochMs.try(Number.POSITIVE_INFINITY)).toBeNull();
    expect(EpochMs.try(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('EpochMs.of returns EpochMs for valid input', () => {
    expect(EpochMs.of(0)).toBe(0);
    expect(EpochMs.of(1)).toBe(1);
  });

  it('EpochMs.of throws RangeError for invalid input', () => {
    expect(() => EpochMs.of(-1)).toThrow(RangeError);
    expect(() => EpochMs.of(-0.5)).toThrow(RangeError);
    expect(() => EpochMs.of(1.5)).toThrow(RangeError);
    expect(() => EpochMs.of(Number.NaN)).toThrow(RangeError);
    expect(() => EpochMs.of(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => EpochMs.of(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });

  it('EpochMs brand is not assignable from plain number', () => {
    function _check(e: EpochMsType): EpochMsType {
      return e;
    }

    const x: number = 5;
    // @ts-expect-error EpochMs is not assignable from plain number
    _check(x);
  });
});
