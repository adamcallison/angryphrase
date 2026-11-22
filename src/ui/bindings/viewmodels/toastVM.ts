import type { Toast } from '../../../domain/notifications/Toast';
import type { ToastId } from '../../../domain/notifications/Toast';
import type { ToastKind } from '../../../domain/notifications/Toast';
import { renderToastReason } from './toastCopy';

// `kind` is colour-only in the visual toast, so the announcement prefix is its
// only encoding for assistive tech. Exhaustive Record: a fifth ToastKind fails
// to compile here instead of announcing undefined.
const KIND_WORD: Record<ToastKind, string> = {
  info: 'Info:',
  success: 'Success:',
  warning: 'Warning:',
  error: 'Error:',
};

export type ToastVM = {
  id: ToastId;
  kind: ToastKind;
  message: string;
  ttlMs: number;
  announcement: string;
};

export function deriveToastVM(toast: Toast): ToastVM {
  const message = renderToastReason(toast.reason);
  return {
    id: toast.id,
    kind: toast.kind,
    message,
    ttlMs: toast.ttlMs,
    announcement: `${KIND_WORD[toast.kind]} ${message}`,
  };
}

export function deriveToastListVM(toasts: Toast[]): ToastVM[] {
  return toasts.map(deriveToastVM);
}
