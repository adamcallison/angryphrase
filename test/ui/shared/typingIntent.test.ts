import { describe, it, expect, vi } from 'vitest';
import { applyTypingIntent } from '../../../src/ui/shared/typingIntent';
import type { TypingActions, TypingIntent } from '../../../src/ui/shared/typingIntent';

function makeBag(): TypingActions & Record<keyof TypingActions, ReturnType<typeof vi.fn>> {
  return {
    typeLetter: vi.fn(),
    backspace: vi.fn(),
    moveCursor: vi.fn(),
    escape: vi.fn(),
  };
}

function assertOnlyCalled(
  bag: TypingActions,
  method: keyof TypingActions,
  args: unknown[],
): void {
  for (const key of Object.keys(bag) as (keyof TypingActions)[]) {
    const spy = bag[key] as ReturnType<typeof vi.fn>;
    if (key === method) {
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(...args);
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  }
}

describe('applyTypingIntent', () => {
  it('type-letter intent calls typeLetter with the letter', () => {
    const bag = makeBag();
    const intent: TypingIntent = { kind: 'type-letter', letter: 'Q' };
    applyTypingIntent(intent, bag);
    assertOnlyCalled(bag, 'typeLetter', ['Q']);
  });

  it('backspace intent calls backspace once', () => {
    const bag = makeBag();
    const intent: TypingIntent = { kind: 'backspace' };
    applyTypingIntent(intent, bag);
    assertOnlyCalled(bag, 'backspace', []);
  });

  it('move-cursor intent calls moveCursor with direction and sign', () => {
    const bag = makeBag();
    const intent: TypingIntent = { kind: 'move-cursor', direction: 'down', sign: -1 };
    applyTypingIntent(intent, bag);
    assertOnlyCalled(bag, 'moveCursor', ['down', -1]);
  });

  it('escape intent calls escape once', () => {
    const bag = makeBag();
    const intent: TypingIntent = { kind: 'escape' };
    applyTypingIntent(intent, bag);
    assertOnlyCalled(bag, 'escape', []);
  });
});
