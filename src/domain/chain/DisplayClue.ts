import type { Word } from '../word/Word';
import type { WordMap } from '../word/WordMap';
import { Chain } from './Chain';
import { WordMap as WordMapCtor } from '../word/WordMap';

export const DisplayClue: {
  forWord(words: WordMap, w: Word): string;
} = {
  forWord(words: WordMap, w: Word): string {
    if (Chain.isHead(words, w.key)) {
      return w.clue;
    }

    const headKey = Chain.headOf(words, w.key);
    const head = WordMapCtor.get(words, headKey);
    if (head === undefined) {
      throw new Error('DisplayClue.forWord: head missing from word map');
    }

    const directionName = head.key.direction.charAt(0).toUpperCase() + head.key.direction.slice(1);
    return `See ${Number(head.number)} ${directionName}`;
  },
};
