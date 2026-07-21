import { Result } from '../../../src/domain/notifications/Event';
import type { DomainEvent } from '../../../src/domain/notifications/Event';
import type { ModalRequest } from '../../../src/domain/notifications/ModalRequest';
import type { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';

describe('Event', () => {
  it('Result.ok returns { state, events: [] }', () => {
    const result = Result.ok({ count: 42 });
    expect(result.state).toEqual({ count: 42 });
    expect(result.events).toEqual([]);
  });

  it('Result.withEvents returns { state, events }', () => {
    const toast: DomainEvent = { kind: 'toast', toastKind: 'success', message: 'saved' };
    const result = Result.withEvents({ mode: 'edit' }, [toast]);
    expect(result.state).toEqual({ mode: 'edit' });
    expect(result.events).toEqual([toast]);
  });

  it('DomainEvent discriminated union narrows correctly on kind', () => {
    const events: DomainEvent[] = [
      { kind: 'toast', toastKind: 'info', message: 'hi' },
      { kind: 'modal-request', modal: { kind: 'confirm-design-switch' } as ModalRequest, confirmIntent: { kind: 'confirm-switch-to-design' } },
      { kind: 'load-player-progress', key: 'puzzle-key' as PuzzleKey },
      { kind: 'download', filename: 'foo.txt', content: 'bar' },
      { kind: 'clear-builder-storage' },
      { kind: 'clear-player-storage', key: 'puzzle-key' as PuzzleKey },
    ];

    const kinds = events.map((event) => {
      switch (event.kind) {
        case 'toast':
          return event.kind;
        case 'modal-request':
          return event.kind;
        case 'load-player-progress':
          return event.kind;
        case 'download':
          return event.kind;
        case 'clear-builder-storage':
          return event.kind;
        case 'clear-player-storage':
          return event.kind;
        default:
          return 'unknown';
      }
    });

    expect(kinds).toEqual([
      'toast',
      'modal-request',
      'load-player-progress',
      'download',
      'clear-builder-storage',
      'clear-player-storage',
    ]);
  });
});
