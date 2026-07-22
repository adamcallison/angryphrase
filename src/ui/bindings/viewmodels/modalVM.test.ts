import { describe, it, expect } from 'vitest';
import { deriveModalVM } from './modalVM';
import type { ModalRequest } from '../../../domain/notifications/ModalRequest';

describe('deriveModalVM', () => {
  it('deriveModalVM: null input → null', () => {
    expect(deriveModalVM(null)).toBeNull();
  });

  it('deriveModalVM: confirm-design-switch yields the exact title/body/confirmLabel/cancelLabel copy', () => {
    const modal: ModalRequest = { kind: 'confirm-design-switch' };
    const vm = deriveModalVM(modal);
    expect(vm).toEqual({
      kind: 'confirm-design-switch',
      title: 'Switch to Design mode?',
      body: 'Switching to Design mode will discard unsaved changes. Continue?',
      confirmLabel: 'Switch',
      cancelLabel: 'Cancel',
    });
  });

  it('deriveModalVM: confirm-import-puzzle yields exact copy', () => {
    const modal: ModalRequest = { kind: 'confirm-import-puzzle' };
    const vm = deriveModalVM(modal);
    expect(vm).toEqual({
      kind: 'confirm-import-puzzle',
      title: 'Import puzzle?',
      body: 'Importing will replace the current puzzle. Continue?',
      confirmLabel: 'Import',
      cancelLabel: 'Cancel',
    });
  });

  it('deriveModalVM: confirm-reset-builder yields exact copy', () => {
    const modal: ModalRequest = { kind: 'confirm-reset-builder' };
    const vm = deriveModalVM(modal);
    expect(vm).toEqual({
      kind: 'confirm-reset-builder',
      title: 'Reset builder?',
      body: 'This will clear the current puzzle and start a blank one. Continue?',
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel',
    });
  });

  it('deriveModalVM: confirm-reset-player yields exact copy', () => {
    const modal: ModalRequest = { kind: 'confirm-reset-player' };
    const vm = deriveModalVM(modal);
    expect(vm).toEqual({
      kind: 'confirm-reset-player',
      title: 'Reset player?',
      body: 'This will reset your solving progress on this device. Continue?',
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel',
    });
  });

  it('deriveModalVM: returned kind matches the input ModalRequest.kind', () => {
    const design: ModalRequest = { kind: 'confirm-design-switch' };
    expect(deriveModalVM(design)!.kind).toBe('confirm-design-switch');

    const importPuzzle: ModalRequest = { kind: 'confirm-import-puzzle' };
    expect(deriveModalVM(importPuzzle)!.kind).toBe('confirm-import-puzzle');

    const resetBuilder: ModalRequest = { kind: 'confirm-reset-builder' };
    expect(deriveModalVM(resetBuilder)!.kind).toBe('confirm-reset-builder');

    const resetPlayer: ModalRequest = { kind: 'confirm-reset-player' };
    expect(deriveModalVM(resetPlayer)!.kind).toBe('confirm-reset-player');
  });
});
