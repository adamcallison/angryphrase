import { brand, type Brand } from '../brand';
import type { Rng } from '../rng/Rng';

export type DisplacedClueId = Brand<'DisplacedClueId', string>;

export const DisplacedClueId: {
  generate(rng: Rng): DisplacedClueId;
} = {
  generate(rng: Rng): DisplacedClueId {
    const hex = Array.from({ length: 16 }, () => rng.nextInt(256).toString(16).padStart(2, '0')).join('');
    return brand<'DisplacedClueId', string>(hex);
  },
};
