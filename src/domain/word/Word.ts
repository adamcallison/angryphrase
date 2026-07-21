import type { WordKey } from './WordKey';
import type { WordNumber } from './WordNumber';

export type Word = {
  key: WordKey;
  number: WordNumber;
  length: number;
  clue: string;
  nextWord: WordKey | null;
};
