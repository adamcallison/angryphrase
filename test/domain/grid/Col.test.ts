import { Col } from '../../../src/domain/grid/Col';
import type { Col as ColType } from '../../../src/domain/grid/Col';

describe('Col', () => {
  it('Col.try returns a Col for non-negative integers', () => {
    expect(Col.try(0)).toBe(0);
    expect(Col.try(5)).toBe(5);
    expect(Col.try(100)).toBe(100);
  });

  it('Col.try returns null for negative, fractional, NaN, and Infinity', () => {
    expect(Col.try(-1)).toBeNull();
    expect(Col.try(1.5)).toBeNull();
    expect(Col.try(Number.NaN)).toBeNull();
    expect(Col.try(Number.POSITIVE_INFINITY)).toBeNull();
    expect(Col.try(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('Col.of returns a Col for valid input', () => {
    expect(Col.of(0)).toBe(0);
    expect(Col.of(3)).toBe(3);
  });

  it('Col.of throws RangeError for invalid input', () => {
    expect(() => Col.of(-1)).toThrow(RangeError);
    expect(() => Col.of(1.5)).toThrow(RangeError);
    expect(() => Col.of(Number.NaN)).toThrow(RangeError);
    expect(() => Col.of(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('Col brand is not assignable from plain number', () => {
    function _check(c: ColType): ColType {
      return c;
    }

    const x: number = 5;
    // @ts-expect-error Col is not assignable from plain number
    _check(x);
  });
});
