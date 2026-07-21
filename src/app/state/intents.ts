import type { ToastId } from '../../domain/notifications/ToastId';

export type AppIntent =
  | { kind: 'navigate'; route: 'landing' | 'build' | 'play' }
  | { kind: 'cancel-modal' }
  | { kind: 'dismiss-toast'; id: ToastId };
