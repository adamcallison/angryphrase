import { deriveModalVM } from './viewmodels/modalVM';
import type { ModalVM } from './viewmodels/modalVM';
import type { ConfirmableIntent } from '../../domain/notifications/Event';
import type { AppStore } from './appStore.svelte';

export type { ModalVM };

export type ModalActions = {
  confirm(): void;
  cancel(): void;
};

export type ModalFacade = {
  modalVM(): ModalVM;
  getPendingConfirm(): ConfirmableIntent | null;
  actions: ModalActions;
};

export function createModalFacade(appStore: AppStore): ModalFacade {
  const actions: ModalActions = {
    confirm() {
      const intent = appStore.getPendingConfirmIntent();
      if (intent === null) return;
      appStore.dispatch(intent);
    },
    cancel() {
      appStore.dispatch({ kind: 'cancel-modal' });
    },
  };

  const facade: ModalFacade = {
    modalVM() {
      return deriveModalVM(appStore.getModal());
    },
    getPendingConfirm() {
      return appStore.getPendingConfirmIntent();
    },
    actions,
  };

  return facade;
}
