import type { WordKey } from './WordKey';

export type DerivedWord = {
  key: WordKey;
  length: number;
  clue: string;
  nextWord: WordKey | null;
};
