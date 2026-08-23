import type { Rng } from '../rng/Rng';
import type { ToastId } from './ToastId';
import type { ToastKind } from './ToastKind';
import { ToastId as ToastIdFactory } from './ToastId';
import type { EpochMs } from '../time/EpochMs';
import { DurationMs } from '../time/DurationMs';

export type Toast = {
  id: ToastId;
  kind: ToastKind;
  message: string;
  createdAt: EpochMs;
  ttlMs: DurationMs;
};

export const Toast: {
  create(rng: Rng, kind: ToastKind, message: string, now: () => EpochMs, ttlMs?: DurationMs): Toast;
} = {
  create(rng: Rng, kind: ToastKind, message: string, now: () => EpochMs, ttlMs?: DurationMs): Toast {
    return {
      id: ToastIdFactory.generate(rng),
      kind,
      message,
      createdAt: now(),
      ttlMs: ttlMs ?? DurationMs.DEFAULT,
    };
  },
};
