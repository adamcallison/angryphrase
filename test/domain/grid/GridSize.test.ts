import { GridSize } from '../../../src/domain/grid/GridSize';

describe('GridSize', () => {
  it('GridSize.try returns GridSize for integers 2..25', () => {
    for (let n = 2; n <= 25; n++) {
      expect(GridSize.try(n)).toBe(n);
    }
  });

  it('GridSize.try returns null for 0, 1, 26, negative, fractional, NaN, and Infinity', () => {
    expect(GridSize.try(0)).toBeNull();
    expect(GridSize.try(1)).toBeNull();
    expect(GridSize.try(26)).toBeNull();
    expect(GridSize.try(-1)).toBeNull();
    expect(GridSize.try(1.5)).toBeNull();
    expect(GridSize.try(Number.NaN)).toBeNull();
    expect(GridSize.try(Number.POSITIVE_INFINITY)).toBeNull();
    expect(GridSize.try(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('GridSize.of throws RangeError on invalid input', () => {
    expect(() => GridSize.of(1)).toThrow(RangeError);
    expect(() => GridSize.of(26)).toThrow(RangeError);
  });

  it('GridSize.MIN === 2, GridSize.MAX === 25, GridSize.DEFAULT === 15', () => {
    expect(Number(GridSize.MIN)).toBe(2);
    expect(Number(GridSize.MAX)).toBe(25);
    expect(Number(GridSize.DEFAULT)).toBe(15);
  });
});
