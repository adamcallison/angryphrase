import type { Word } from './Word';
import type { Cursor } from '../grid/Cursor';
import { WordGeometry } from './WordGeometry';

export const WordSelection: {
  findContainingWord(words: Word[], cursor: Cursor): Word | null;
} = {
  findContainingWord(words: Word[], cursor: Cursor): Word | null {
    if (cursor === null) return null;
    for (const w of words) {
      if (w.key.direction !== cursor.direction) continue;
      if (WordGeometry.contains(w, cursor.row, cursor.col)) return w;
    }
    return null;
  },
};
