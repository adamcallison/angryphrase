import type { WordKey } from './WordKey';
import type { WordLength } from './WordLength';
import type { Direction } from './Direction';
import { Row } from '../grid/Row';
import { Col } from '../grid/Col';

export type WordExtent = {
  key: WordKey;
  length: WordLength;
};

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

function extentOf(word: WordExtent): Extent {
  return {
    startRow: word.key.startRow,
    startCol: word.key.startCol,
    length: Number(word.length),
    direction: word.key.direction,
  };
}

function offsetCell(word: WordExtent, offset: number): WordCell {
  const dr = word.key.direction === 'down' ? 1 : 0;
  const dc = 1 - dr;
  return {
    row: Row.of(Number(word.key.startRow) + offset * dr),
    col: Col.of(Number(word.key.startCol) + offset * dc),
    offset,
  };
}

export const WordGeometry: {
  cells(word: WordExtent): readonly WordCell[];
  contains(word: WordExtent, row: Row, col: Col): boolean;
  lastCell(word: WordExtent): WordCell;
} = {
  cells(word: WordExtent): readonly WordCell[] {
    const length = Number(word.length);
    const cells: WordCell[] = [];

    for (let offset = 0; offset < length; offset += 1) {
      cells.push(offsetCell(word, offset));
    }

    return cells;
  },

  contains(word: WordExtent, row: Row, col: Col): boolean {
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

  lastCell(word: WordExtent): WordCell {
    return offsetCell(word, Number(word.length) - 1);
  },
};
