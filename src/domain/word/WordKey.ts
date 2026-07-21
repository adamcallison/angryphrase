import type { Row } from '../grid/Row';
import type { Col } from '../grid/Col';
import type { Direction } from './Direction';

export type WordKey = {
  startRow: Row;
  startCol: Col;
  direction: Direction;
};

export const WordKey: {
  equals(a: WordKey, b: WordKey): boolean;
  toCanonical(k: WordKey): string;
} = {
  equals(a: WordKey, b: WordKey): boolean {
    return a.startRow === b.startRow && a.startCol === b.startCol && a.direction === b.direction;
  },
  toCanonical(k: WordKey): string {
    return `${k.startRow},${k.startCol},${k.direction}`;
  },
};
