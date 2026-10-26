import { brand, type Brand } from '../brand';
import { isUuidV4, uuidv4 } from '../uuid/uuidv4';
import type { Rng } from '../rng/Rng';

export type DisplacedClueId = Brand<'DisplacedClueId', string>;

export const DisplacedClueId: {
  generate(rng: Rng): DisplacedClueId;
  try(s: string): DisplacedClueId | null;
  equals(a: DisplacedClueId, b: DisplacedClueId): boolean;
} = {
  generate(rng: Rng): DisplacedClueId {
    return brand<'DisplacedClueId', string>(uuidv4(rng));
  },

  try(s: string): DisplacedClueId | null {
    return isUuidV4(s) ? brand<'DisplacedClueId', string>(s) : null;
  },

  equals(a: DisplacedClueId, b: DisplacedClueId): boolean {
    return a === b;
  },
};
