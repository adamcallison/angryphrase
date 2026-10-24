import type { Word } from '../word/Word';
import { WordGeometry } from '../word/WordGeometry';
import { ChainIndex } from './ChainIndex';

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
    const index = ChainIndex.build(words);
    const head = index.headOf(cursorWord.key);
    const members = index.fromHead(head).members;
    const set = new Set<string>();
    for (const m of members) {
      for (const cell of ChainCells.cellsOfWord(m)) {
        set.add(cell);
      }
    }
    return set;
  },
};
