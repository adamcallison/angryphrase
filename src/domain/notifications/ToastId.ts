import { brand, type Brand } from '../brand';
import type { Rng } from '../rng/Rng';

export type ToastId = Brand<'ToastId', string>;

export const ToastId: {
  generate(rng: Rng): ToastId;
} = {
  generate(rng: Rng): ToastId {
    const hex = Array.from({ length: 16 }, () => rng.nextInt(256).toString(16).padStart(2, '0')).join('');
    return brand<'ToastId', string>(hex);
  },
};
