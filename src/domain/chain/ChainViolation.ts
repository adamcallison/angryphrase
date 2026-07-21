import type { WordKey } from '../word/WordKey';

export type ChainViolation =
  | { kind: 'cycle'; involved: WordKey[] }
  | { kind: 'branch'; target: WordKey; sources: WordKey[] }
  | { kind: 'dangling'; source: WordKey; missingTarget: WordKey }
  | { kind: 'self-reference'; word: WordKey };
