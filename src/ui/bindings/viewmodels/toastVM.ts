import type { Toast } from '../../../domain/notifications/Toast';
import type { ToastId } from '../../../domain/notifications/Toast';
import type { ToastKind } from '../../../domain/notifications/Toast';

export type ToastVM = { id: ToastId; kind: ToastKind; message: string; ttlMs: number };

export function deriveToastVM(toast: Toast): ToastVM {
  return { id: toast.id, kind: toast.kind, message: toast.message, ttlMs: toast.ttlMs };
}

export function deriveToastListVM(toasts: Toast[]): ToastVM[] {
  return toasts.map(deriveToastVM);
}
