import type { Rng } from '../rng/Rng';
import { brand, type Brand } from '../brand';
import { uuidv4 } from '../uuid/uuidv4';
import type { EpochMs } from '../time/EpochMs';
import { DurationMs } from '../time/DurationMs';
import type { ToastReason } from './ToastReason';

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
  reason: ToastReason;
  createdAt: EpochMs;
  ttlMs: DurationMs;
};

export const Toast: {
  create(rng: Rng, kind: ToastKind, reason: ToastReason, now: () => EpochMs): Toast;
} = {
  create(rng: Rng, kind: ToastKind, reason: ToastReason, now: () => EpochMs): Toast {
    return {
      id: ToastId.generate(rng),
      kind,
      reason,
      createdAt: now(),
      ttlMs: DurationMs.DEFAULT,
    };
  },
};
