import type { Word } from './Word';
import { WordKey } from './WordKey';

export type WordMap = ReadonlyMap<string, Word>;

export const WordMap: {
  fromWords(ws: Word[]): WordMap;
  get(m: WordMap, k: WordKey): Word | undefined;
  has(m: WordMap, k: WordKey): boolean;
  set(m: WordMap, w: Word): WordMap;
  remove(m: WordMap, k: WordKey): WordMap;
} = {
  fromWords(ws: Word[]): WordMap {
    const map = new Map<string, Word>();
    for (const w of ws) {
      map.set(WordKey.toCanonical(w.key), w);
    }
    return map as WordMap;
  },

  get(m: WordMap, k: WordKey): Word | undefined {
    return m.get(WordKey.toCanonical(k));
  },

  has(m: WordMap, k: WordKey): boolean {
    return m.has(WordKey.toCanonical(k));
  },

  set(m: WordMap, w: Word): WordMap {
    const next = new Map(m);
    next.set(WordKey.toCanonical(w.key), w);
    return next as WordMap;
  },

  remove(m: WordMap, k: WordKey): WordMap {
    const next = new Map(m);
    next.delete(WordKey.toCanonical(k));
    return next as WordMap;
  },
};
