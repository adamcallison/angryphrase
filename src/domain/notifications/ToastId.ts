import { brand, type Brand } from '../brand';
import { uuidv4 } from '../uuid/uuidv4';
import type { Rng } from '../rng/Rng';

export type ToastId = Brand<'ToastId', string>;

export const ToastId: {
  generate(rng: Rng): ToastId;
} = {
  generate(rng: Rng): ToastId {
    return brand<'ToastId', string>(uuidv4(rng));
  },
};
