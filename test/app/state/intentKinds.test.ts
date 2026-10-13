import { describe, it, expect } from 'vitest';
import type { BuilderIntent } from '../../../src/builder/state/intents';
import type { PlayerIntent } from '../../../src/player/state/intents';
import {
  BUILDER_INTENT_KINDS,
  PLAYER_INTENT_KINDS,
  CONFIRMABLE_INTENT_KINDS,
} from '../../../src/app/state/intentKinds';

type AssertTarget<T, Expected extends 'builder' | 'player'> = T extends { target: Expected } ? true : false;
type _BuilderTargetCheck = AssertTarget<BuilderIntent, 'builder'> extends true ? true : never;
type _PlayerTargetCheck = AssertTarget<PlayerIntent, 'player'> extends true ? true : never;

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
  'set-marker',
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
  'report-import-read-failure',
  'report-pick-failure',
  'export-incomplete',
  'export-complete',
  'request-reset-builder',
  'confirm-reset-builder',
];

const PLAYER_KINDS = [
  'import-puzzle',
  'report-import-read-failure',
  'report-pick-failure',
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

  it('every BuilderIntent variant carries target: "builder"', () => {
    const assertion: _BuilderTargetCheck = true;
    expect(assertion).toBe(true);
  });

  it('every PlayerIntent variant carries target: "player"', () => {
    const assertion: _PlayerTargetCheck = true;
    expect(assertion).toBe(true);
  });

  it('every ConfirmableIntent kind is a Builder or Player kind', () => {
    for (const kind of CONFIRMABLE_KINDS) {
      expect(BUILDER_INTENT_KINDS.has(kind) || PLAYER_INTENT_KINDS.has(kind)).toBe(true);
    }
  });

  it('AppIntent kinds (navigate, cancel-modal, dismiss-toast, report-download-failure, report-builder-save-failure, report-player-save-failure) are not in any of the four intent sets', () => {
    for (const kind of ['navigate', 'cancel-modal', 'dismiss-toast', 'report-download-failure', 'report-builder-save-failure', 'report-player-save-failure']) {
      expect(BUILDER_INTENT_KINDS.has(kind)).toBe(false);
      expect(PLAYER_INTENT_KINDS.has(kind)).toBe(false);
      expect(CONFIRMABLE_INTENT_KINDS.has(kind)).toBe(false);
    }
  });
});
