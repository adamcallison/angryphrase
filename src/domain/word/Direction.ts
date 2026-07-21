import { brand } from '../brand';
import type { Row } from '../grid/Row';
import type { Col } from '../grid/Col';

export type Direction = 'across' | 'down';

export const Direction: {
  opposite(d: Direction): Direction;
  isAcross(d: Direction): boolean;
  advance(coord: { row: Row; col: Col }, d: Direction, n: number): { row: Row; col: Col };
} = {
  opposite(d: Direction): Direction {
    return d === 'across' ? 'down' : 'across';
  },
  isAcross(d: Direction): boolean {
    return d === 'across';
  },
  advance(coord: { row: Row; col: Col }, d: Direction, n: number): { row: Row; col: Col } {
    return d === 'across'
      ? { row: coord.row, col: brand<'Col', number>(coord.col + n) }
      : { row: brand<'Row', number>(coord.row + n), col: coord.col };
  },
};
