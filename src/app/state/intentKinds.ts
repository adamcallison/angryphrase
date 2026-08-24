import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import type { ConfirmableIntent } from '../../domain/notifications/Event';

export type BuilderIntentKind = BuilderIntent extends { kind: infer K } ? K : never;
export type PlayerIntentKind = PlayerIntent extends { kind: infer K } ? K : never;
export type ConfirmableIntentKind = ConfirmableIntent extends { kind: infer K } ? K : never;

const builderKindRecord = {
  'switch-to-fill': null,
  'request-switch-to-design': null,
  'confirm-switch-to-design': null,
  'toggle-design-cell': null,
  'change-grid-size': null,
  'select-cell': null,
  'move-cursor': null,
  'type-letter': null,
  'backspace': null,
  'toggle-marker': null,
  'edit-clue': null,
  'begin-join': null,
  'click-clue-panel-word': null,
  'click-grid-word': null,
  'unjoin': null,
  'escape': null,
  'begin-reattach': null,
  'delete-displaced-clue': null,
  'edit-title': null,
  'edit-author': null,
  'request-import-puzzle': null,
  'confirm-import-puzzle': null,
  'export-incomplete': null,
  'export-complete': null,
  'request-reset-builder': null,
  'confirm-reset-builder': null,
} satisfies Record<BuilderIntentKind, null>;

const playerKindRecord = {
  'import-puzzle': null,
  'apply-loaded-progress': null,
  'import-new-puzzle': null,
  'select-cell': null,
  'move-cursor': null,
  'type-letter': null,
  'backspace': null,
  'escape': null,
  'click-clue-panel-word': null,
  'check': null,
  'clear-errors': null,
  'request-reset-player': null,
  'confirm-reset-player': null,
  'open-anagram-helper': null,
  'close-anagram-helper': null,
  'anagram-input': null,
  'anagram-scramble': null,
} satisfies Record<PlayerIntentKind, null>;

const confirmableKindRecord = {
  'confirm-switch-to-design': null,
  'confirm-import-puzzle': null,
  'confirm-reset-builder': null,
  'confirm-reset-player': null,
} satisfies Record<ConfirmableIntentKind, null>;

export const BUILDER_INTENT_KINDS: ReadonlySet<string> = new Set(Object.keys(builderKindRecord));
export const PLAYER_INTENT_KINDS: ReadonlySet<string> = new Set(Object.keys(playerKindRecord));
export const CONFIRMABLE_INTENT_KINDS: ReadonlySet<string> = new Set(Object.keys(confirmableKindRecord));

export const AMBIGUOUS_INTENT_KINDS: ReadonlySet<string> =
  new Set([...BUILDER_INTENT_KINDS].filter(k => PLAYER_INTENT_KINDS.has(k)));
