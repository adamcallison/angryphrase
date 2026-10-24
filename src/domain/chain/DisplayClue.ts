import type { Word } from '../word/Word';
import type { ChainIndex } from './ChainIndex';

export const DisplayClue: {
  forWord(index: ChainIndex, w: Word): string;
} = {
  forWord(index: ChainIndex, w: Word): string {
    if (index.isHead(w.key)) {
      return w.clue;
    }

    const headKey = index.headOf(w.key);
    const head = index.word(headKey);
    if (head === undefined) {
      throw new Error('DisplayClue.forWord: head missing from word map');
    }

    const directionName = head.key.direction.charAt(0).toUpperCase() + head.key.direction.slice(1);
    return `See ${Number(head.number)} ${directionName}`;
  },
};
