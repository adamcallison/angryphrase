import type { ToastId } from '../../domain/notifications/ToastId';
import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';

export type AppIntent =
  | { kind: 'navigate'; route: 'landing' | 'build' | 'play' }
  | { kind: 'cancel-modal' }
  | { kind: 'dismiss-toast'; id: ToastId }
  | { kind: 'report-download-failure' }
  | { kind: 'report-builder-save-failure' }
  | { kind: 'report-player-save-failure' }
  | { kind: 'report-grid-size-failure' };

export type AnyIntent = AppIntent | BuilderIntent | PlayerIntent;

