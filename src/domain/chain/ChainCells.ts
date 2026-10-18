import type { Word } from '../word/Word';
import { WordMap } from '../word/WordMap';
import { WordGeometry } from '../word/WordGeometry';
import { Chain } from './Chain';

export const ChainCells: {
  cellsOfWord(w: Word): Set<string>;
  cellsOfChain(words: Word[], cursorWord: Word | null): Set<string>;
} = {
  cellsOfWord(w: Word): Set<string> {
    const set = new Set<string>();
    for (const cell of WordGeometry.cells(w)) {
      set.add(`${Number(cell.row)},${Number(cell.col)}`);
    }
    return set;
  },

  cellsOfChain(words: Word[], cursorWord: Word | null): Set<string> {
    if (cursorWord === null) {
      return new Set<string>();
    }
    const wordMap = WordMap.fromWords(words);
    const head = Chain.headOf(wordMap, cursorWord.key);
    const members = Chain.fromHead(wordMap, head).members;
    const set = new Set<string>();
    for (const m of members) {
      for (const cell of ChainCells.cellsOfWord(m)) {
        set.add(cell);
      }
    }
    return set;
  },
};
