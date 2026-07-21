import { Direction } from '../../../src/domain/word/Direction';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { brand } from '../../../src/domain/brand';

describe('Direction', () => {
  it('Direction.opposite across ↔ down', () => {
    expect(Direction.opposite('across')).toBe('down');
    expect(Direction.opposite('down')).toBe('across');
  });

  it('Direction.isAcross returns true only for across', () => {
    expect(Direction.isAcross('across')).toBe(true);
    expect(Direction.isAcross('down')).toBe(false);
  });

  it('Direction.advance across advances col by n', () => {
    const coord = { row: Row.of(0), col: Col.of(2) };
    const result = Direction.advance(coord, 'across', 3);
    expect(result).toEqual({ row: Row.of(0), col: Col.of(5) });
  });

  it('Direction.advance down advances row by n', () => {
    const coord = { row: Row.of(1), col: Col.of(0) };
    const result = Direction.advance(coord, 'down', 4);
    expect(result).toEqual({ row: Row.of(5), col: Col.of(0) });
  });

  it('Direction.advance returns a new object, does not mutate input', () => {
    const coord = { row: Row.of(0), col: Col.of(0) };
    const result = Direction.advance(coord, 'across', 1);
    expect(result).not.toBe(coord);
    expect(coord).toEqual({ row: Row.of(0), col: Col.of(0) });
  });

  it('Direction.advance across preserves row, only changes col', () => {
    const coord = { row: Row.of(3), col: Col.of(1) };
    const result = Direction.advance(coord, 'across', 2);
    expect(result.row).toBe(coord.row);
    expect(result.row).toBe(Row.of(3));
    expect(result.col).toBe(Col.of(3));
  });

  it('Direction.advance down preserves col, only changes row', () => {
    const coord = { row: Row.of(2), col: Col.of(4) };
    const result = Direction.advance(coord, 'down', 3);
    expect(result.col).toBe(coord.col);
    expect(result.col).toBe(Col.of(4));
    expect(result.row).toBe(Row.of(5));
  });

  it('Direction.advance negative n moves backwards', () => {
    const coord = { row: Row.of(0), col: Col.of(2) };
    const result = Direction.advance(coord, 'across', -1);
    expect(result).toEqual({ row: brand(0), col: brand(1) });
  });
});
