import type { Direction } from '../../domain/word/Direction';

export type TypingIntent =
  | { kind: 'type-letter'; letter: string }
  | { kind: 'backspace' }
  | { kind: 'move-cursor'; direction: Direction; sign: -1 | 1 }
  | { kind: 'escape' };

export type TypingActions = {
  typeLetter(letter: string): void;
  backspace(): void;
  moveCursor(direction: 'across' | 'down', sign: -1 | 1): void;
  escape(): void;
};

export function applyTypingIntent(intent: TypingIntent, actions: TypingActions): void {
  switch (intent.kind) {
    case 'type-letter':
      actions.typeLetter(intent.letter);
      return;
    case 'backspace':
      actions.backspace();
      return;
    case 'move-cursor':
      actions.moveCursor(intent.direction, intent.sign);
      return;
    case 'escape':
      actions.escape();
      return;
  }
}
