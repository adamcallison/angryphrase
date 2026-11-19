import { describe, expect, it } from 'vitest';
import { cellKey } from '../../../src/domain/grid/CellKey';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';

describe('cellKey', () => {
  it('cellKey formats a row/col pair as `row,col`', () => {
    expect(cellKey(1, 2)).toBe('1,2');
  });

  it('cellKey accepts branded Row/Col values', () => {
    expect(cellKey(Row.of(1), Col.of(2))).toBe('1,2');
  });

  it('cellKey makes different cells produce different keys', () => {
    expect(cellKey(0, 1)).not.toBe(cellKey(1, 0));
  });
});
