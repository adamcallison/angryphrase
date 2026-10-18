import type { Word } from './Word';
import { Row } from '../grid/Row';
import { Col } from '../grid/Col';

export type WordCell = {
  row: Row;
  col: Col;
  offset: number;
};

export const WordGeometry: {
  cells(word: Word): readonly WordCell[];
} = {
  cells(word: Word): readonly WordCell[] {
    const length = Number(word.length);
    const startRow = Number(word.key.startRow);
    const startCol = Number(word.key.startCol);
    const cells: WordCell[] = [];

    if (word.key.direction === 'across') {
      for (let offset = 0; offset < length; offset += 1) {
        cells.push({
          row: Row.of(startRow),
          col: Col.of(startCol + offset),
          offset,
        });
      }
    } else {
      for (let offset = 0; offset < length; offset += 1) {
        cells.push({
          row: Row.of(startRow + offset),
          col: Col.of(startCol),
          offset,
        });
      }
    }

    return cells;
  },
};
