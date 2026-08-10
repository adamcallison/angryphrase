import type { Word } from './Word';
import type { Row } from '../grid/Row';
import type { Col } from '../grid/Col';
import type { Direction } from './Direction';

export const WordSelection: {
  findContainingWord(words: Word[], cursor: { row: Row; col: Col; direction: Direction }): Word | null;
} = {
  findContainingWord(words: Word[], cursor: { row: Row; col: Col; direction: Direction }): Word | null {
    const r = Number(cursor.row);
    const c = Number(cursor.col);
    for (const w of words) {
      if (w.key.direction !== cursor.direction) continue;
      const sr = Number(w.key.startRow);
      const sc = Number(w.key.startCol);
      if (cursor.direction === 'across') {
        if (sr === r && c >= sc && c < sc + w.length) return w;
      } else {
        if (sc === c && r >= sr && r < sr + w.length) return w;
      }
    }
    return null;
  },
};
