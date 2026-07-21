import type { ToastKind } from './ToastKind';
import type { ModalRequest } from './ModalRequest';
import type { PuzzleKey } from '../puzzle/PuzzleKey';

export type DomainEvent =
  | { kind: 'toast'; toastKind: ToastKind; message: string }
  | { kind: 'modal-request'; modal: ModalRequest; confirmIntent: ConfirmableIntent }
  | { kind: 'load-player-progress'; key: PuzzleKey }
  | { kind: 'download'; filename: string; content: string }
  | { kind: 'clear-builder-storage' }
  | { kind: 'clear-player-storage'; key: PuzzleKey };

export type ConfirmableIntent =
  | { kind: 'confirm-switch-to-design' }
  | { kind: 'confirm-import-puzzle'; fileContent: string }
  | { kind: 'confirm-reset-builder' }
  | { kind: 'confirm-reset-player' };

export type ReducerResult<S> = { state: S; events: DomainEvent[] };

export const Result: {
  ok<S>(state: S): ReducerResult<S>;
  withEvents<S>(state: S, events: DomainEvent[]): ReducerResult<S>;
} = {
  ok<S>(state: S): ReducerResult<S> {
    return { state, events: [] };
  },

  withEvents<S>(state: S, events: DomainEvent[]): ReducerResult<S> {
    return { state, events };
  },
};
