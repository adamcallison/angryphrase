import { WordNumber } from '../../../src/domain/word/WordNumber';
import type { WordNumber as WordNumberType } from '../../../src/domain/word/WordNumber';

describe('WordNumber', () => {
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
