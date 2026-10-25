import { Position } from '../../../src/domain/anagram/Position';
import type { Position as PositionType } from '../../../src/domain/anagram/Position';

describe('Position', () => {
  it('Position.of returns Position for valid input', () => {
    expect(Position.of(0)).toBe(0);
    expect(Position.of(3)).toBe(3);
  });

  it('Position.of throws RangeError for invalid input', () => {
    expect(() => Position.of(-1)).toThrow(RangeError);
    expect(() => Position.of(-0.5)).toThrow(RangeError);
    expect(() => Position.of(Number.NaN)).toThrow(RangeError);
    expect(() => Position.of(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => Position.of(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });

  it('Position brand is not assignable from plain number', () => {
    function _check(p: PositionType): PositionType {
      return p;
    }

    const x: number = 5;
    // @ts-expect-error Position is not assignable from plain number
    _check(x);
  });
});
