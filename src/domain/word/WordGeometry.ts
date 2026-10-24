import type { Word } from './Word';
import type { Direction } from './Direction';
import { Row } from '../grid/Row';
import { Col } from '../grid/Col';

export type WordCell = {
  row: Row;
  col: Col;
  offset: number;
};

type Extent = {
  startRow: Row;
  startCol: Col;
  length: number;
  direction: Direction;
};

function extentOf(word: Word): Extent {
  return {
    startRow: word.key.startRow,
    startCol: word.key.startCol,
    length: Number(word.length),
    direction: word.key.direction,
  };
}

export const WordGeometry: {
  cells(word: Word): readonly WordCell[];
  contains(word: Word, row: Row, col: Col): boolean;
  lastCell(word: Word): WordCell;
} = {
  cells(word: Word): readonly WordCell[] {
    const extent = extentOf(word);
    const length = extent.length;
    const startRow = Number(extent.startRow);
    const startCol = Number(extent.startCol);
    const cells: WordCell[] = [];

    if (extent.direction === 'across') {
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

  contains(word: Word, row: Row, col: Col): boolean {
    const extent = extentOf(word);
    const r = Number(row);
    const c = Number(col);
    const startRow = Number(extent.startRow);
    const startCol = Number(extent.startCol);
    const length = extent.length;

    if (extent.direction === 'across') {
      return r === startRow && c >= startCol && c < startCol + length;
    }

    return c === startCol && r >= startRow && r < startRow + length;
  },

  lastCell(word: Word): WordCell {
    const extent = extentOf(word);
    const offset = extent.length - 1;
    const startRow = Number(extent.startRow);
    const startCol = Number(extent.startCol);

    if (extent.direction === 'across') {
      return {
        row: Row.of(startRow),
        col: Col.of(startCol + offset),
        offset,
      };
    }

    return {
      row: Row.of(startRow + offset),
      col: Col.of(startCol),
      offset,
    };
  },
};
