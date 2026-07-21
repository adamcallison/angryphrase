import type { Letter } from '../letter/Letter';

export type AnagramEntry = {
  position: number;
  fixed: boolean;
  letter: Letter | null;
};
