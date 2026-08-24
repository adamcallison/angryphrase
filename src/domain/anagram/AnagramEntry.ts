import type { Letter } from '../letter/Letter';
import type { Position } from './Position';

export type AnagramEntry =
  | { position: Position; fixed: true; letter: Letter }
  | { position: Position; fixed: false; letter: Letter | null };
