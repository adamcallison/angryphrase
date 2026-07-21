import type { Word } from '../word/Word';
import type { WordMap } from '../word/WordMap';
import { Chain } from './Chain';
import { WordKey } from '../word/WordKey';

export const DisplayClue: {
  forWord(words: WordMap, w: Word): string;
} = {
  forWord(words: WordMap, w: Word): string {
    if (Chain.isHead(words, w.key)) {
      return w.clue;
    }

    const reverse = new Map<string, Word>();
    for (const src of words.values()) {
      if (src.nextWord !== null) {
        reverse.set(WordKey.toCanonical(src.nextWord), src);
      }
    }

    const visited = new Set<string>();
    let current: Word = w;

    while (!Chain.isHead(words, current.key)) {
      const pred = reverse.get(WordKey.toCanonical(current.key));
      if (pred === undefined) {
        throw new Error('DisplayClue.forWord: non-head word has no reachable head');
      }
      if (visited.has(WordKey.toCanonical(current.key))) {
        throw new Error('DisplayClue.forWord: non-head word has no reachable head');
      }
      visited.add(WordKey.toCanonical(current.key));
      current = pred;
    }

    const directionName = current.key.direction.charAt(0).toUpperCase() + current.key.direction.slice(1);
    return `See ${Number(current.number)} ${directionName}`;
  },
};
