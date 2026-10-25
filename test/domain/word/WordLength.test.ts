import { WordLength } from '../../../src/domain/word/WordLength';
import type { WordLength as WordLengthType } from '../../../src/domain/word/WordLength';

describe('WordLength', () => {
  it('WordLength.of returns WordLength for valid input', () => {
    expect(WordLength.of(2)).toBe(2);
    expect(WordLength.of(3)).toBe(3);
  });

  it('WordLength.of throws RangeError for invalid input', () => {
    expect(() => WordLength.of(1)).toThrow(RangeError);
    expect(() => WordLength.of(0)).toThrow(RangeError);
    expect(() => WordLength.of(-1)).toThrow(RangeError);
    expect(() => WordLength.of(1.5)).toThrow(RangeError);
    expect(() => WordLength.of(Number.NaN)).toThrow(RangeError);
    expect(() => WordLength.of(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => WordLength.of(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });

  it('WordLength brand is not assignable from plain number', () => {
    function _check(w: WordLengthType): WordLengthType {
      return w;
    }

    const x: number = 5;
    // @ts-expect-error WordLength is not assignable from plain number
    _check(x);
  });
});
