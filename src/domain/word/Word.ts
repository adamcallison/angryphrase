import type { WordKey } from './WordKey';
import type { WordLength } from './WordLength';
import type { WordNumber } from './WordNumber';

export type Word = {
  key: WordKey;
  number: WordNumber;
  length: WordLength;
  clue: string;
  nextWord: WordKey | null;
};
