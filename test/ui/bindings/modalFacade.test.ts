import { describe, it, expect, beforeEach } from 'vitest';
import { AppState } from '../../../src/app/state/state';
import type { AppState as AppStateType } from '../../../src/app/state/state';
import { createAppStore, type AppPorts, type AppStore } from '../../../src/ui/bindings/appStore.svelte';
import { createModalFacade, type ModalFacade } from '../../../src/ui/bindings/modalFacade';
import { InMemoryStoragePort } from '../../fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../fakes/StubDownloadPort';
import { SeededRng } from '../../fakes/SeededRng';
import { FakeClock } from '../../fakes/FakeClock';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { Letter } from '../../../src/domain/letter/Letter';
import type { ModalRequest } from '../../../src/domain/notifications/ModalRequest';

function makeRng(seed: number): SeededRng {
  return new SeededRng(seed);
}

function makeBlankAppState(seed: number): AppStateType {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  return AppState.blank(GridSize.of(15), key);
}

describe('modalFacade.ts', () => {
  let inMemoryStorage: InMemoryStoragePort;
  let stubDownload: StubDownloadPort;
  let seededRng: SeededRng;
  let fakeClock: FakeClock;
  let store: AppStore;
  let modalFacade: ModalFacade;

  function makePorts(): AppPorts {
    return { storage: inMemoryStorage, download: stubDownload, filePick: { pickFile: async () => '', readDroppedFile: async () => '' } };
  }

  function populateDesignSwitchModal(): void {
    store.dispatch({ kind: 'switch-to-fill' });
    store.dispatch({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });
    store.dispatch({ kind: 'type-letter', letter: Letter.try('A')! });
    store.dispatch({ kind: 'request-switch-to-design' });
  }

  beforeEach(() => {
    inMemoryStorage = new InMemoryStoragePort();
    stubDownload = new StubDownloadPort();
    seededRng = makeRng(42);
    fakeClock = new FakeClock(0);

    const initial = makeBlankAppState(42);
    store = createAppStore(
      initial,
      { rng: seededRng, now: () => fakeClock.now() },
      makePorts(),
    );
    modalFacade = createModalFacade(store);
    store.dispatch({ kind: 'navigate', route: 'build' });
  });

  it('modalFacade: modalVM() returns null when AppState.modal is null', () => {
    expect(store.getState().modal).toBeNull();
    expect(modalFacade.modalVM()).toBeNull();
  });

  it('modalFacade: modalVM() returns the ModalVM (kind, title, body, confirmLabel, cancelLabel) when modal is set', () => {
    populateDesignSwitchModal();

    const vm = modalFacade.modalVM();
    expect(vm).not.toBeNull();
    expect(vm).toEqual({
      kind: 'confirm-design-switch',
      title: 'Switch to Design mode?',
      body: 'Switching to Design mode will discard unsaved changes. Continue?',
      confirmLabel: 'Switch',
      cancelLabel: 'Cancel',
    });
  });

  it('modalFacade: getPendingConfirm() returns AppState.pendingConfirmIntent (null by default)', () => {
    expect(store.getState().pendingConfirmIntent).toBeNull();
    expect(modalFacade.getPendingConfirm()).toBeNull();

    populateDesignSwitchModal();

    expect(modalFacade.getPendingConfirm()).toEqual({ kind: 'confirm-switch-to-design' });
  });

  it('modalFacade: confirmModal() with pending confirm intent dispatches the corresponding confirm-* intent; verify modal cleared after', () => {
    populateDesignSwitchModal();
    expect(store.getState().modal).not.toBeNull();
    expect(modalFacade.getPendingConfirm()).toEqual({ kind: 'confirm-switch-to-design' });

    modalFacade.actions.confirm();

    expect(store.getState().modal).toBeNull();
    expect(store.getState().pendingConfirmIntent).toBeNull();
  });

  it('modalFacade: confirmModal() when no pending confirm intent is a no-op (modal stays null, no throw)', () => {
    expect(store.getState().modal).toBeNull();
    expect(store.getState().pendingConfirmIntent).toBeNull();

    expect(() => modalFacade.actions.confirm()).not.toThrow();

    expect(store.getState().modal).toBeNull();
    expect(store.getState().pendingConfirmIntent).toBeNull();
  });

  it('modalFacade: cancelModal() dispatches { kind: "cancel-modal" }; modal cleared, pendingConfirm null', () => {
    populateDesignSwitchModal();
    expect(store.getState().modal).not.toBeNull();
    expect(store.getState().pendingConfirmIntent).not.toBeNull();

    modalFacade.actions.cancel();

    expect(store.getState().modal).toBeNull();
    expect(store.getState().pendingConfirmIntent).toBeNull();
  });

  it('modalFacade: modalVM reflects changes after fresh createAppStore mutates state.modal', () => {
    expect(modalFacade.modalVM()).toBeNull();

    const modal: ModalRequest = { kind: 'confirm-reset-player' };
    const freshStore = createAppStore(
      { ...store.getState(), modal },
      { rng: seededRng, now: () => fakeClock.now() },
      makePorts(),
    );
    const freshModalFacade = createModalFacade(freshStore);

    const vm = freshModalFacade.modalVM();
    expect(vm).not.toBeNull();
    expect(vm!.kind).toBe('confirm-reset-player');
    expect(vm!.title).toBe('Reset player?');
  });

  it('modalFacade: two createModalFacade instances over two appStores are independent', () => {
    function triggerModal(target: AppStore): void {
      target.dispatch({ kind: 'navigate', route: 'build' });
      target.dispatch({ kind: 'switch-to-fill' });
      target.dispatch({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });
      target.dispatch({ kind: 'type-letter', letter: Letter.try('A')! });
      target.dispatch({ kind: 'request-switch-to-design' });
    }

    const storeA = createAppStore(
      makeBlankAppState(1),
      { rng: makeRng(1), now: () => fakeClock.now() },
      makePorts(),
    );
    const a = createModalFacade(storeA);
    triggerModal(storeA);

    const storeB = createAppStore(
      makeBlankAppState(2),
      { rng: makeRng(2), now: () => fakeClock.now() },
      makePorts(),
    );
    const b = createModalFacade(storeB);
    triggerModal(storeB);

    a.actions.confirm();

    expect(a.modalVM()).toBeNull();
    expect(b.modalVM()).not.toBeNull();
    expect(b.getPendingConfirm()).toEqual({ kind: 'confirm-switch-to-design' });
  });
});
