import { DisplacedClueId } from './DisplacedClueId';
import type { Direction } from '../word/Direction';
import type { Rng } from '../rng/Rng';

export type DisplacedClue = {
  id: DisplacedClueId;
  clue: string;
  direction: Direction;
};

export const DisplacedClue: {
  create(rng: Rng, clue: string, direction: Direction): DisplacedClue;
  withText(d: DisplacedClue, clue: string): DisplacedClue;
} = {
  create(rng: Rng, clue: string, direction: Direction): DisplacedClue {
    return {
      id: DisplacedClueId.generate(rng),
      clue,
      direction,
    };
  },

  withText(d: DisplacedClue, clue: string): DisplacedClue {
    return { ...d, clue };
  },
};
