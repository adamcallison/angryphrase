import type { Word } from '../word/Word';
import type { Direction } from '../word/Direction';
import type { ChainIndex } from './ChainIndex';

export type DisplayClueFact =
  | { kind: 'head'; clue: string }
  | { kind: 'reference'; headNumber: number; headDirection: Direction };

export const DisplayClue: {
  forWord(index: ChainIndex, w: Word): DisplayClueFact;
} = {
  forWord(index: ChainIndex, w: Word): DisplayClueFact {
    if (index.isHead(w.key)) {
      return { kind: 'head', clue: w.clue };
    }

    const headKey = index.headOf(w.key);
    const head = index.word(headKey);
    if (head === undefined) {
      throw new Error('DisplayClue.forWord: head missing from word map');
    }

    return {
      kind: 'reference',
      headNumber: Number(head.number),
      headDirection: head.key.direction,
    };
  },
};
