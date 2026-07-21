import type { AppState } from './state';
import type { DomainEvent } from '../../domain/notifications/Event';
import type { Rng } from '../../domain/rng/Rng';
import { Toast } from '../../domain/notifications/Toast';

export function applyEventsToApp(
  state: AppState,
  events: DomainEvent[],
  deps: { rng: Rng; now: () => number },
): { state: AppState; leftoverEvents: DomainEvent[] } {
  let next = state;
  const leftover: DomainEvent[] = [];
  for (const e of events) {
    switch (e.kind) {
      case 'toast': {
        const toast = Toast.create(deps.rng, e.toastKind, e.message, deps.now);
        next = { ...next, toasts: [...next.toasts, toast] };
        break;
      }
      case 'modal-request':
        next = { ...next, modal: e.modal, pendingConfirmIntent: e.confirmIntent };
        break;
      case 'download':
      case 'clear-builder-storage':
      case 'clear-player-storage':
      case 'load-player-progress':
        leftover.push(e);
        break;
    }
  }
  return { state: next, leftoverEvents: leftover };
}
