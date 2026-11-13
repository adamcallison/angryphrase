import type { Brand } from '../brand';
import type { Row } from './Row';
import type { Col } from './Col';

export type CellCoord = Brand<'CellCoord', { row: Row; col: Col }>;
