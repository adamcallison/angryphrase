import type { Word } from '../word/Word';
import type { WordKey } from '../word/WordKey';
import type { WordMap } from '../word/WordMap';
import { WordMap as WordMapCtor } from '../word/WordMap';
import { WordKey as WordKeyCtor } from '../word/WordKey';

export type Chain = { head: WordKey; members: Word[] };

export type ChainIndex = {
  word(key: WordKey): Word | undefined;
  has(key: WordKey): boolean;
  isHead(key: WordKey): boolean;
  headOf(key: WordKey): WordKey;
  membersOf(key: WordKey): Word[];
  fromHead(head: WordKey): Chain;
};

export const ChainIndex: {
  build(words: Word[]): ChainIndex;
} = {
  build(words: Word[]): ChainIndex {
    const wordMap: WordMap = WordMapCtor.fromWords(words);
    const pointedAt = new Set<string>();
    const predecessors = new Map<string, Word>();

    for (const src of words) {
      if (src.nextWord !== null) {
        const targetCanonical = WordKeyCtor.toCanonical(src.nextWord);
        pointedAt.add(targetCanonical);
        predecessors.set(targetCanonical, src);
      }
    }

    const word = (key: WordKey): Word | undefined => WordMapCtor.get(wordMap, key);

    const has = (key: WordKey): boolean => WordMapCtor.has(wordMap, key);

    const isHead = (key: WordKey): boolean => !pointedAt.has(WordKeyCtor.toCanonical(key));

    const headOf = (key: WordKey): WordKey => {
      if (!has(key)) {
        throw new Error(`dangling nextWord in chain at: ${WordKeyCtor.toCanonical(key)}`);
      }

      if (isHead(key)) {
        return key;
      }

      const visited = new Set<string>();
      let current: WordKey = key;

      while (!isHead(current)) {
        const currentCanonical = WordKeyCtor.toCanonical(current);
        const pred = predecessors.get(currentCanonical);
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
    };

    const fromHead = (head: WordKey): Chain => {
      const members: Word[] = [];
      const visited = new Set<string>();
      let currentKey: WordKey | null = head;

      while (currentKey !== null) {
        const currentCanonical = WordKeyCtor.toCanonical(currentKey);

        if (visited.has(currentCanonical)) {
          throw new Error(`cycle detected in chain at: ${currentCanonical}`);
        }

        if (!has(currentKey)) {
          throw new Error(`dangling nextWord in chain at: ${currentCanonical}`);
        }

        const currentWord = word(currentKey);
        if (currentWord === undefined) {
          throw new Error(`dangling nextWord in chain at: ${currentCanonical}`);
        }

        members.push(currentWord);
        visited.add(currentCanonical);
        currentKey = currentWord.nextWord;
      }

      return { head, members };
    };

    const membersOf = (key: WordKey): Word[] => fromHead(key).members;

    return { word, has, isHead, headOf, membersOf, fromHead };
  },
};
