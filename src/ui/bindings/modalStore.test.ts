import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppState } from '../../app/state/state';
import type { AppState as AppStateType } from '../../app/state/state';
import { bootApp, _resetAppStateForTests, getAppState, getModal, getPendingConfirmIntent } from './appStore.svelte';
import { modalVM, getPendingConfirm, confirmModal, cancelModal } from './modalStore.svelte';
import { setPorts, resetPorts } from './ports';
import { createPersistenceScheduler } from './persistenceScheduler';
import { InMemoryStoragePort } from '../../../test/fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../../test/fakes/StubDownloadPort';
import { SeededRng } from '../../../test/fakes/SeededRng';
import { FakeClock } from '../../../test/fakes/FakeClock';
import { GridSize } from '../../domain/grid/GridSize';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';
import { Letter } from '../../domain/letter/Letter';
import { dispatch } from './appStore.svelte';
import type { ModalRequest } from '../../domain/notifications/ModalRequest';

function makeRng(seed: number): SeededRng {
  return new SeededRng(seed);
}

function makeBlankAppState(seed: number): AppStateType {
  const rng = makeRng(seed);
  const key = PuzzleKey.generate(rng);
  return AppState.blank(GridSize.of(15), key);
}

function populateDesignSwitchModal(): void {
  dispatch({ kind: 'switch-to-fill' });
  dispatch({ kind: 'select-cell', row: Row.of(0), col: Col.of(0) });
  dispatch({ kind: 'type-letter', letter: Letter.try('A')! });
  dispatch({ kind: 'request-switch-to-design' });
}

describe('modalStore.svelte.ts', () => {
  let inMemoryStorage: InMemoryStoragePort;
  let stubDownload: StubDownloadPort;
  let seededRng: SeededRng;
  let fakeClock: FakeClock;

  beforeEach(() => {
    inMemoryStorage = new InMemoryStoragePort();
    stubDownload = new StubDownloadPort();
    seededRng = makeRng(42);
    fakeClock = new FakeClock(0);

    setPorts({ storage: inMemoryStorage, download: stubDownload });

    const initial = makeBlankAppState(42);
    bootApp(initial, { rng: seededRng, now: () => fakeClock.now() }, createPersistenceScheduler(inMemoryStorage));
  });

  afterEach(() => {
    resetPorts();
  });

  it('modalStore: modalVM() returns null when AppState.modal is null', () => {
    expect(getModal()).toBeNull();
    expect(modalVM()).toBeNull();
  });

  it('modalStore: modalVM() returns the ModalVM (kind, title, body, confirmLabel, cancelLabel) when modal is set', () => {
    populateDesignSwitchModal();

    const vm = modalVM();
    expect(vm).not.toBeNull();
    expect(vm).toEqual({
      kind: 'confirm-design-switch',
      title: 'Switch to Design mode?',
      body: 'Switching to Design mode will discard unsaved changes. Continue?',
      confirmLabel: 'Switch',
      cancelLabel: 'Cancel',
    });
  });

  it('modalStore: getPendingConfirm() returns AppState.pendingConfirmIntent (null by default)', () => {
    expect(getPendingConfirmIntent()).toBeNull();
    expect(getPendingConfirm()).toBeNull();

    populateDesignSwitchModal();

    expect(getPendingConfirm()).toEqual({ kind: 'confirm-switch-to-design' });
  });

  it('modalStore: confirmModal() with pending confirm intent dispatches the corresponding confirm-* intent; verify modal cleared after', () => {
    populateDesignSwitchModal();
    expect(getModal()).not.toBeNull();
    expect(getPendingConfirm()).toEqual({ kind: 'confirm-switch-to-design' });

    confirmModal();

    expect(getModal()).toBeNull();
    expect(getPendingConfirmIntent()).toBeNull();
  });

  it('modalStore: confirmModal() when no pending confirm intent is a no-op (modal stays null, no throw)', () => {
    expect(getModal()).toBeNull();
    expect(getPendingConfirmIntent()).toBeNull();

    expect(() => confirmModal()).not.toThrow();

    expect(getModal()).toBeNull();
    expect(getPendingConfirmIntent()).toBeNull();
  });

  it('modalStore: cancelModal() dispatches { kind: "cancel-modal" }; modal cleared, pendingConfirm null', () => {
    populateDesignSwitchModal();
    expect(getModal()).not.toBeNull();
    expect(getPendingConfirmIntent()).not.toBeNull();

    cancelModal();

    expect(getModal()).toBeNull();
    expect(getPendingConfirmIntent()).toBeNull();
  });

  it('modalStore: modalVM reflects changes after _resetAppStateForTests mutates state.modal', () => {
    expect(modalVM()).toBeNull();

    const modal: ModalRequest = { kind: 'confirm-reset-player' };
    _resetAppStateForTests({ ...getAppState(), modal });

    const vm = modalVM();
    expect(vm).not.toBeNull();
    expect(vm!.kind).toBe('confirm-reset-player');
    expect(vm!.title).toBe('Reset player?');
  });
});
