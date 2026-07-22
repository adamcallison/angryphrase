import type { ModalRequest } from '../../../domain/notifications/ModalRequest';
import type { ModalKind } from '../../../domain/notifications/ModalKind';

export type ModalVM = { kind: ModalKind; title: string; body: string; confirmLabel: string; cancelLabel: string } | null;

export function deriveModalVM(modal: ModalRequest | null): ModalVM {
  if (modal === null) {
    return null;
  }

  switch (modal.kind) {
    case 'confirm-design-switch':
      return {
        kind: modal.kind,
        title: 'Switch to Design mode?',
        body: 'Switching to Design mode will discard unsaved changes. Continue?',
        confirmLabel: 'Switch',
        cancelLabel: 'Cancel',
      };
    case 'confirm-import-puzzle':
      return {
        kind: modal.kind,
        title: 'Import puzzle?',
        body: 'Importing will replace the current puzzle. Continue?',
        confirmLabel: 'Import',
        cancelLabel: 'Cancel',
      };
    case 'confirm-reset-builder':
      return {
        kind: modal.kind,
        title: 'Reset builder?',
        body: 'This will clear the current puzzle and start a blank one. Continue?',
        confirmLabel: 'Reset',
        cancelLabel: 'Cancel',
      };
    case 'confirm-reset-player':
      return {
        kind: modal.kind,
        title: 'Reset player?',
        body: 'This will reset your solving progress on this device. Continue?',
        confirmLabel: 'Reset',
        cancelLabel: 'Cancel',
      };
  }
}
