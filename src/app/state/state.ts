import { BuilderState } from '../../builder/state/state';
import { PlayerState } from '../../player/state/state';
import type { GridSize } from '../../domain/grid/GridSize';
import type { PuzzleKey } from '../../domain/puzzle/PuzzleKey';
import type { Toast } from '../../domain/notifications/Toast';
import type { ModalRequest } from '../../domain/notifications/ModalRequest';
import type { ConfirmableIntent } from '../../domain/notifications/Event';

export type AppState = {
  route: 'landing' | 'build' | 'play';
  builder: BuilderState;
  player: PlayerState;
  toasts: Toast[];
  modal: ModalRequest | null;
  pendingConfirmIntent: ConfirmableIntent | null;
};

export const AppState: {
  blank(size: GridSize, key: PuzzleKey): AppState;
} = {
  blank(size, key) {
    return {
      route: 'landing',
      builder: BuilderState.blank(size, key),
      player: PlayerState.importScreen(),
      toasts: [],
      modal: null,
      pendingConfirmIntent: null,
    };
  },
};
