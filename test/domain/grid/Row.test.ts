import { Row } from '../../../src/domain/grid/Row';
import type { Row as RowType } from '../../../src/domain/grid/Row';

describe('Row', () => {
  it('Row.try returns a Row for non-negative integers', () => {
    expect(Row.try(0)).toBe(0);
    expect(Row.try(5)).toBe(5);
    expect(Row.try(100)).toBe(100);
  });

  it('Row.try returns null for negative, fractional, NaN, and Infinity', () => {
    expect(Row.try(-1)).toBeNull();
    expect(Row.try(1.5)).toBeNull();
    expect(Row.try(Number.NaN)).toBeNull();
    expect(Row.try(Number.POSITIVE_INFINITY)).toBeNull();
    expect(Row.try(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('Row.of returns a Row for valid input', () => {
    expect(Row.of(0)).toBe(0);
    expect(Row.of(3)).toBe(3);
  });

  it('Row.of throws RangeError for invalid input', () => {
    expect(() => Row.of(-1)).toThrow(RangeError);
    expect(() => Row.of(1.5)).toThrow(RangeError);
    expect(() => Row.of(Number.NaN)).toThrow(RangeError);
    expect(() => Row.of(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('Row brand is not assignable from plain number', () => {
    function _check(r: RowType): RowType {
      return r;
    }

    const x: number = 5;
    // @ts-expect-error Row is not assignable from plain number
    _check(x);
  });
});
