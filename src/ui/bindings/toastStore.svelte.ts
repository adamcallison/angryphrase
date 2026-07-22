import { deriveToastListVM } from './viewmodels/toastVM';
import type { ToastVM } from './viewmodels/toastVM';
import type { ToastId } from '../../domain/notifications/ToastId';
import { dispatch, getToasts } from './appStore.svelte';

export type { ToastVM };

export function toastVMs(): ToastVM[] {
  return deriveToastListVM(getToasts());
}

export function dismissToast(id: ToastId): void {
  dispatch({ kind: 'dismiss-toast', id });
}
