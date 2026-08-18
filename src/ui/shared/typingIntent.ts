import type { Direction } from '../../domain/word/Direction';

export type TypingIntent =
  | { kind: 'type-letter'; letter: string }
  | { kind: 'backspace' }
  | { kind: 'move-cursor'; direction: Direction; sign: -1 | 1 }
  | { kind: 'escape' };
