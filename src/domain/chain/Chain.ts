import type { Word } from '../word/Word';
import type { WordKey } from '../word/WordKey';
import type { WordMap } from '../word/WordMap';
import { WordMap as WordMapCtor } from '../word/WordMap';
import { WordKey as WordKeyCtor } from '../word/WordKey';

export type Chain = { head: WordKey; members: Word[] };

export const Chain: {
  fromHead(words: WordMap, head: WordKey): Chain;
  headOf(words: WordMap, k: WordKey): WordKey;
  isHead(words: WordMap, k: WordKey): boolean;
  isNonHead(words: WordMap, k: WordKey): boolean;
  membersOf(words: WordMap, k: WordKey): Word[];
} = {
  fromHead(words: WordMap, head: WordKey): Chain {
    const members: Word[] = [];
    const visited = new Set<string>();
    let currentKey: WordKey | null = head;

    while (currentKey !== null) {
      const currentCanonical = WordKeyCtor.toCanonical(currentKey);

      if (visited.has(currentCanonical)) {
        throw new Error(`cycle detected in chain at: ${currentCanonical}`);
      }

      if (!WordMapCtor.has(words, currentKey)) {
        throw new Error(`dangling nextWord in chain at: ${currentCanonical}`);
      }

      const currentWord: Word = WordMapCtor.get(words, currentKey)!;
      members.push(currentWord);
      visited.add(currentCanonical);
      currentKey = currentWord.nextWord;
    }

    return { head, members };
  },

  headOf(words: WordMap, k: WordKey): WordKey {
    if (!WordMapCtor.has(words, k)) {
      throw new Error(`dangling nextWord in chain at: ${WordKeyCtor.toCanonical(k)}`);
    }

    if (Chain.isHead(words, k)) {
      return k;
    }

    const reverse = new Map<string, Word>();
    for (const src of words.values()) {
      if (src.nextWord !== null) {
        reverse.set(WordKeyCtor.toCanonical(src.nextWord), src);
      }
    }

    const visited = new Set<string>();
    let current: WordKey = k;

    while (!Chain.isHead(words, current)) {
      const currentCanonical = WordKeyCtor.toCanonical(current);
      const pred = reverse.get(currentCanonical);
      if (pred === undefined) {
        throw new Error(`dangling nextWord in chain at: ${currentCanonical}`);
      }
      if (visited.has(currentCanonical)) {
        throw new Error(`cycle detected in chain at: ${currentCanonical}`);
      }
      visited.add(currentCanonical);
      current = pred.key;
    }

    return current;
  },

  isHead(words: WordMap, k: WordKey): boolean {
    for (const w of words.values()) {
      if (w.nextWord !== null && WordKeyCtor.equals(w.nextWord, k)) {
        return false;
      }
    }
    return true;
  },

  isNonHead(words: WordMap, k: WordKey): boolean {
    return !Chain.isHead(words, k);
  },

  membersOf(words: WordMap, k: WordKey): Word[] {
    return Chain.fromHead(words, k).members;
  },
};
