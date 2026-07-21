import type { Rng } from '../rng/Rng';
import type { ToastId } from './ToastId';
import type { ToastKind } from './ToastKind';
import { ToastId as ToastIdFactory } from './ToastId';

export type Toast = {
  id: ToastId;
  kind: ToastKind;
  message: string;
  createdAt: number;
  ttlMs: number;
};

export const Toast: {
  create(rng: Rng, kind: ToastKind, message: string, now: () => number, ttlMs?: number): Toast;
} = {
  create(rng: Rng, kind: ToastKind, message: string, now: () => number, ttlMs?: number): Toast {
    return {
      id: ToastIdFactory.generate(rng),
      kind,
      message,
      createdAt: now(),
      ttlMs: ttlMs ?? 3500,
    };
  },
};
