import { brand, type Brand } from '../brand';
import { uuidv4 } from '../uuid/uuidv4';
import type { Rng } from '../rng/Rng';

export type DisplacedClueId = Brand<'DisplacedClueId', string>;

export const DisplacedClueId: {
  generate(rng: Rng): DisplacedClueId;
  try(s: string): DisplacedClueId | null;
} = {
  generate(rng: Rng): DisplacedClueId {
    return brand<'DisplacedClueId', string>(uuidv4(rng));
  },

  try(s: string): DisplacedClueId | null {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s)) {
      return brand<'DisplacedClueId', string>(s);
    }
    return null;
  },
};
