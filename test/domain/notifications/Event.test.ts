import { Result, confirmEvent } from '../../../src/domain/notifications/Event';
import type { DomainEvent, ConfirmableIntent } from '../../../src/domain/notifications/Event';
import type { ModalKind } from '../../../src/domain/notifications/Event';
import type { ModalRequest } from '../../../src/domain/notifications/Event';
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
      { kind: 'modal-request', modal: { kind: 'confirm-design-switch' } as ModalRequest, confirmIntent: { target: 'builder', kind: 'confirm-switch-to-design' } },
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

  it('confirmEvent builds a modal-request event for each guarded action pairing', () => {
    const cases: { modal: ModalKind; confirm: ConfirmableIntent }[] = [
      {
        modal: 'confirm-design-switch',
        confirm: { target: 'builder', kind: 'confirm-switch-to-design' },
      },
      {
        modal: 'confirm-import-puzzle',
        confirm: { target: 'builder', kind: 'confirm-import-puzzle', fileContent: 'puzzle-json' },
      },
      {
        modal: 'confirm-reset-builder',
        confirm: { target: 'builder', kind: 'confirm-reset-builder' },
      },
      {
        modal: 'confirm-reset-player',
        confirm: { target: 'player', kind: 'confirm-reset-player' },
      },
    ];

    for (const { modal, confirm } of cases) {
      expect(confirmEvent(modal, confirm)).toEqual({
        kind: 'modal-request',
        modal: { kind: modal },
        confirmIntent: confirm,
      });
    }
  });
});
