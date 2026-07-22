import { deriveModalVM } from './viewmodels/modalVM';
import type { ModalVM } from './viewmodels/modalVM';
import type { ConfirmableIntent } from '../../domain/notifications/Event';
import { dispatch, getModal, getPendingConfirmIntent } from './appStore.svelte';

export type { ModalVM };

export function modalVM(): ModalVM {
  return deriveModalVM(getModal());
}

export function getPendingConfirm(): ConfirmableIntent | null {
  return getPendingConfirmIntent();
}

export function confirmModal(): void {
  const intent = getPendingConfirmIntent();
  if (intent === null) return;
  dispatch(intent);
}

export function cancelModal(): void {
  dispatch({ kind: 'cancel-modal' });
}
