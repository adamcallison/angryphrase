import type { WordKey } from './WordKey';
import type { WordLength } from './WordLength';

export type DerivedWord = {
  key: WordKey;
  length: WordLength;
  clue: string;
  nextWord: WordKey | null;
};
