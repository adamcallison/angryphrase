import { WordNumber } from '../../../src/domain/word/WordNumber';
import type { WordNumber as WordNumberType } from '../../../src/domain/word/WordNumber';

describe('WordNumber', () => {
  it('WordNumber.try returns WordNumber for integers ≥ 1', () => {
    expect(WordNumber.try(1)).toBe(1);
    expect(WordNumber.try(5)).toBe(5);
    expect(WordNumber.try(100)).toBe(100);
  });

  it('WordNumber.try returns null for 0, negative, fractional, NaN, Infinity', () => {
    expect(WordNumber.try(0)).toBeNull();
    expect(WordNumber.try(-1)).toBeNull();
    expect(WordNumber.try(1.5)).toBeNull();
    expect(WordNumber.try(Number.NaN)).toBeNull();
    expect(WordNumber.try(Number.POSITIVE_INFINITY)).toBeNull();
    expect(WordNumber.try(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('WordNumber.of returns WordNumber for valid input', () => {
    expect(WordNumber.of(1)).toBe(1);
    expect(WordNumber.of(3)).toBe(3);
  });

  it('WordNumber.of throws RangeError for invalid input', () => {
    expect(() => WordNumber.of(0)).toThrow(RangeError);
    expect(() => WordNumber.of(-1)).toThrow(RangeError);
    expect(() => WordNumber.of(1.5)).toThrow(RangeError);
    expect(() => WordNumber.of(Number.NaN)).toThrow(RangeError);
    expect(() => WordNumber.of(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('WordNumber brand is not assignable from plain number', () => {
    function _check(w: WordNumberType): WordNumberType {
      return w;
    }

    const x: number = 5;
    // @ts-expect-error WordNumber is not assignable from plain number
    _check(x);
  });
});
