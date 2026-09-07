import { deriveToastListVM } from './viewmodels/toastVM';
import type { ToastVM } from './viewmodels/toastVM';
import type { ToastId } from '../../domain/notifications/ToastId';
import type { AppStore } from './appStore.svelte';

export type { ToastVM };

export type ToastHostActions = {
  dismiss(id: ToastId): void;
};

export type ToastFacade = {
  toastVMs(): ToastVM[];
  actions: ToastHostActions;
};

export function createToastFacade(appStore: AppStore): ToastFacade {
  const actions: ToastHostActions = {
    dismiss(id: ToastId) {
      appStore.dispatch({ kind: 'dismiss-toast', id });
    },
  };

  const facade: ToastFacade = {
    toastVMs() {
      return deriveToastListVM(appStore.getToasts());
    },
    actions,
  };

  return facade;
}
