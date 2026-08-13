import type { Word } from './Word';
import type { Cursor } from '../grid/Cursor';

export const WordSelection: {
  findContainingWord(words: Word[], cursor: Cursor): Word | null;
} = {
  findContainingWord(words: Word[], cursor: Cursor): Word | null {
    if (cursor === null) return null;
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
