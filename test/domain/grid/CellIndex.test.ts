import { CellIndex } from '../../../src/domain/grid/CellIndex';
import type { CellIndex as CellIndexType } from '../../../src/domain/grid/CellIndex';

describe('CellIndex', () => {
  it('CellIndex.try returns a CellIndex for non-negative integers', () => {
    expect(CellIndex.try(0)).toBe(0);
    expect(CellIndex.try(5)).toBe(5);
    expect(CellIndex.try(100)).toBe(100);
  });

  it('CellIndex.try returns null for negative, fractional, NaN, and Infinity', () => {
    expect(CellIndex.try(-1)).toBeNull();
    expect(CellIndex.try(1.5)).toBeNull();
    expect(CellIndex.try(Number.NaN)).toBeNull();
    expect(CellIndex.try(Number.POSITIVE_INFINITY)).toBeNull();
    expect(CellIndex.try(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('CellIndex.of returns a CellIndex for valid input', () => {
    expect(CellIndex.of(0)).toBe(0);
    expect(CellIndex.of(3)).toBe(3);
  });

  it('CellIndex.of throws RangeError for invalid input', () => {
    expect(() => CellIndex.of(-1)).toThrow(RangeError);
    expect(() => CellIndex.of(1.5)).toThrow(RangeError);
    expect(() => CellIndex.of(Number.NaN)).toThrow(RangeError);
    expect(() => CellIndex.of(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('CellIndex brand is not assignable from plain number', () => {
    function _check(i: CellIndexType): CellIndexType {
      return i;
    }

    const x: number = 5;
    // @ts-expect-error CellIndex is not assignable from plain number
    _check(x);
  });
});
