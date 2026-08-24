import { WordLength } from '../../../src/domain/word/WordLength';
import type { WordLength as WordLengthType } from '../../../src/domain/word/WordLength';

describe('WordLength', () => {
  it('WordLength.try returns WordLength for valid input', () => {
    expect(WordLength.try(2)).toBe(2);
    expect(WordLength.try(5)).toBe(5);
    expect(WordLength.try(100)).toBe(100);
  });

  it('WordLength.try returns null for invalid input', () => {
    expect(WordLength.try(1)).toBeNull();
    expect(WordLength.try(0)).toBeNull();
    expect(WordLength.try(-1)).toBeNull();
    expect(WordLength.try(1.5)).toBeNull();
    expect(WordLength.try(Number.NaN)).toBeNull();
    expect(WordLength.try(Number.POSITIVE_INFINITY)).toBeNull();
    expect(WordLength.try(Number.NEGATIVE_INFINITY)).toBeNull();
  });

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

  it('WordLength.equals returns true for the same value, false for different', () => {
    const a = WordLength.of(5);
    const b = WordLength.of(5);
    const c = WordLength.of(8);

    expect(WordLength.equals(a, b)).toBe(true);
    expect(WordLength.equals(a, c)).toBe(false);
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
