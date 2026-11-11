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

function offsetCell(word: Word, offset: number): WordCell {
  const dr = word.key.direction === 'down' ? 1 : 0;
  const dc = 1 - dr;
  return {
    row: Row.of(Number(word.key.startRow) + offset * dr),
    col: Col.of(Number(word.key.startCol) + offset * dc),
    offset,
  };
}

export const WordGeometry: {
  cells(word: Word): readonly WordCell[];
  contains(word: Word, row: Row, col: Col): boolean;
  lastCell(word: Word): WordCell;
} = {
  cells(word: Word): readonly WordCell[] {
    const length = Number(word.length);
    const cells: WordCell[] = [];

    for (let offset = 0; offset < length; offset += 1) {
      cells.push(offsetCell(word, offset));
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
    return offsetCell(word, Number(word.length) - 1);
  },
};
