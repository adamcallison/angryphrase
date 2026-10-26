import { intBrand } from '../../src/domain/brand';

describe('intBrand', () => {
  it('intBrand.try returns the branded value for an integer within the range', () => {
    const Size = intBrand('Size', 1, 10);
    expect(Size.try(1)).toBe(1);
    expect(Size.try(5)).toBe(5);
    expect(Size.try(10)).toBe(10);
  });

  it('intBrand.try returns null below min and above max', () => {
    const Size = intBrand('Size', 1, 10);
    expect(Size.try(0)).toBeNull();
    expect(Size.try(11)).toBeNull();
  });

  it('intBrand.try returns null for fractional, NaN, and Infinity inputs', () => {
    const Size = intBrand('Size', 0);
    expect(Size.try(1.5)).toBeNull();
    expect(Size.try(Number.NaN)).toBeNull();
    expect(Size.try(Number.POSITIVE_INFINITY)).toBeNull();
    expect(Size.try(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('intBrand.of returns the branded value for a valid input', () => {
    const Size = intBrand('Size', 1, 10);
    expect(Size.of(1)).toBe(1);
    expect(Size.of(10)).toBe(10);
  });

  it('intBrand.of throws RangeError with the tag-derived message for invalid input', () => {
    const Size = intBrand('Size', 1, 10);
    expect(() => Size.of(0)).toThrow(RangeError);
    expect(() => Size.of(0)).toThrow('Invalid Size: 0');
    expect(() => Size.of(11)).toThrow('Invalid Size: 11');
    expect(() => Size.of(1.5)).toThrow(RangeError);
    expect(() => Size.of(Number.NaN)).toThrow(RangeError);
  });

  it('intBrand accepts the exact min and max boundaries', () => {
    const Size = intBrand('Size', 1, 10);
    expect(Size.try(1)).toBe(1);
    expect(Size.try(10)).toBe(10);
    expect(Size.of(1)).toBe(1);
    expect(Size.of(10)).toBe(10);
  });

  it('intBrand with no max accepts any non-negative integer', () => {
    const Count = intBrand('Count', 0);
    expect(Count.try(0)).toBe(0);
    expect(Count.try(1_000_000)).toBe(1_000_000);
    expect(Count.try(-1)).toBeNull();
    expect(Count.try(1.5)).toBeNull();
  });

  it('intBrand result is not assignable from a plain number', () => {
    const Count = intBrand('Count', 0);
    expect(Count.try(5)).toBe(5);
    type CountType = ReturnType<typeof Count.of>;

    function _check(c: CountType): CountType {
      return c;
    }

    const x: number = 5;
    // @ts-expect-error a plain number is not assignable to the branded type
    _check(x);
  });
});
