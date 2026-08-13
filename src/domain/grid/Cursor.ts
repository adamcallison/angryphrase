import type { Row } from './Row';
import type { Col } from './Col';
import type { Direction } from '../word/Direction';

export type Cursor = {
  row: Row;
  col: Col;
  direction: Direction;
} | null;
