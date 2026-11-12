import type { Rng } from '../rng/Rng';
import { brand, type Brand } from '../brand';
import { uuidv4 } from '../uuid/uuidv4';
import type { EpochMs } from '../time/EpochMs';
import { DurationMs } from '../time/DurationMs';

export type ToastId = Brand<'ToastId', string>;

export const ToastId: {
  generate(rng: Rng): ToastId;
} = {
  generate(rng: Rng): ToastId {
    return brand<'ToastId', string>(uuidv4(rng));
  },
};

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export type Toast = {
  id: ToastId;
  kind: ToastKind;
  message: string;
  createdAt: EpochMs;
  ttlMs: DurationMs;
};

export const Toast: {
  create(rng: Rng, kind: ToastKind, message: string, now: () => EpochMs): Toast;
} = {
  create(rng: Rng, kind: ToastKind, message: string, now: () => EpochMs): Toast {
    return {
      id: ToastId.generate(rng),
      kind,
      message,
      createdAt: now(),
      ttlMs: DurationMs.DEFAULT,
    };
  },
};
