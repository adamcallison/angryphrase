import { Position } from '../../../src/domain/anagram/Position';
import type { Position as PositionType } from '../../../src/domain/anagram/Position';

describe('Position', () => {
  it('Position.try returns Position for valid input', () => {
    expect(Position.try(0)).toBe(0);
    expect(Position.try(1)).toBe(1);
    expect(Position.try(50)).toBe(50);
  });

  it('Position.try returns null for invalid input', () => {
    expect(Position.try(-1)).toBeNull();
    expect(Position.try(-0.5)).toBeNull();
    expect(Position.try(Number.NaN)).toBeNull();
    expect(Position.try(Number.POSITIVE_INFINITY)).toBeNull();
    expect(Position.try(Number.NEGATIVE_INFINITY)).toBeNull();
  });

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

  it('Position.equals returns true for the same value, false for different', () => {
    const a = Position.of(5);
    const b = Position.of(5);
    const c = Position.of(8);

    expect(Position.equals(a, b)).toBe(true);
    expect(Position.equals(a, c)).toBe(false);
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
