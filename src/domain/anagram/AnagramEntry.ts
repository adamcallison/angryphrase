import type { Letter } from '../letter/Letter';

export type AnagramEntry =
  | { fixed: true; letter: Letter }
  | { fixed: false; letter: Letter | null };
