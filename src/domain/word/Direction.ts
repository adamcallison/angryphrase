import { Row } from '../grid/Row';
import { Col } from '../grid/Col';

export type Direction = 'across' | 'down';

export const Direction: {
  advance(coord: { row: Row; col: Col }, d: Direction, n: number): { row: Row; col: Col };
} = {
  advance(coord: { row: Row; col: Col }, d: Direction, n: number): { row: Row; col: Col } {
    return d === 'across'
      ? { row: coord.row, col: Col.of(coord.col + n) }
      : { row: Row.of(coord.row + n), col: coord.col };
  },
};
