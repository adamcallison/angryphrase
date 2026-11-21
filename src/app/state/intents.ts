import type { ToastId } from '../../domain/notifications/Toast';
import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';

export type AppIntent =
  | { kind: 'navigate'; route: 'landing' | 'build' | 'play' }
  | { kind: 'cancel-modal' }
  | { kind: 'dismiss-toast'; id: ToastId }
  | { kind: 'report-download-failure' }
  | { kind: 'report-builder-save-result'; ok: boolean }
  | { kind: 'report-player-save-result'; ok: boolean }
  | { kind: 'report-grid-size-failure' };

export type AnyIntent = AppIntent | BuilderIntent | PlayerIntent;

