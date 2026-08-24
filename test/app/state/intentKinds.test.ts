import { describe, it, expect } from 'vitest';
import {
  BUILDER_INTENT_KINDS,
  PLAYER_INTENT_KINDS,
  CONFIRMABLE_INTENT_KINDS,
  AMBIGUOUS_INTENT_KINDS,
} from '../../../src/app/state/intentKinds';

const BUILDER_KINDS = [
  'switch-to-fill',
  'request-switch-to-design',
  'confirm-switch-to-design',
  'toggle-design-cell',
  'change-grid-size',
  'select-cell',
  'move-cursor',
  'type-letter',
  'backspace',
  'toggle-marker',
  'edit-clue',
  'begin-join',
  'click-clue-panel-word',
  'click-grid-word',
  'unjoin',
  'escape',
  'begin-reattach',
  'delete-displaced-clue',
  'edit-title',
  'edit-author',
  'request-import-puzzle',
  'confirm-import-puzzle',
  'export-incomplete',
  'export-complete',
  'request-reset-builder',
  'confirm-reset-builder',
];

const PLAYER_KINDS = [
  'import-puzzle',
  'apply-loaded-progress',
  'import-new-puzzle',
  'select-cell',
  'move-cursor',
  'type-letter',
  'backspace',
  'escape',
  'click-clue-panel-word',
  'check',
  'clear-errors',
  'request-reset-player',
  'confirm-reset-player',
  'open-anagram-helper',
  'close-anagram-helper',
  'anagram-input',
  'anagram-scramble',
];

const CONFIRMABLE_KINDS = [
  'confirm-switch-to-design',
  'confirm-import-puzzle',
  'confirm-reset-builder',
  'confirm-reset-player',
];

describe('intentKinds', () => {
  it('BUILDER_INTENT_KINDS contains exactly every BuilderIntent kind', () => {
    expect([...BUILDER_INTENT_KINDS].sort()).toEqual([...BUILDER_KINDS].sort());
  });

  it('PLAYER_INTENT_KINDS contains exactly every PlayerIntent kind', () => {
    expect([...PLAYER_INTENT_KINDS].sort()).toEqual([...PLAYER_KINDS].sort());
  });

  it('CONFIRMABLE_INTENT_KINDS contains exactly the ConfirmableIntent kinds', () => {
    expect([...CONFIRMABLE_INTENT_KINDS].sort()).toEqual([...CONFIRMABLE_KINDS].sort());
  });

  it('AMBIGUOUS_INTENT_KINDS equals the intersection of Builder and Player kinds', () => {
    const expected = BUILDER_KINDS.filter(k => PLAYER_KINDS.includes(k)).sort();
    expect([...AMBIGUOUS_INTENT_KINDS].sort()).toEqual(expected);
  });

  it('every ConfirmableIntent kind is a Builder or Player kind', () => {
    for (const kind of CONFIRMABLE_KINDS) {
      expect(BUILDER_INTENT_KINDS.has(kind) || PLAYER_INTENT_KINDS.has(kind)).toBe(true);
    }
  });

  it('AppIntent kinds (navigate, cancel-modal, dismiss-toast, report-download-failure) are not in any of the four intent sets', () => {
    for (const kind of ['navigate', 'cancel-modal', 'dismiss-toast', 'report-download-failure']) {
      expect(BUILDER_INTENT_KINDS.has(kind)).toBe(false);
      expect(PLAYER_INTENT_KINDS.has(kind)).toBe(false);
      expect(CONFIRMABLE_INTENT_KINDS.has(kind)).toBe(false);
      expect(AMBIGUOUS_INTENT_KINDS.has(kind)).toBe(false);
    }
  });
});
