// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalStoragePort } from '../../src/ports/localStoragePort';
import { PuzzleKey } from '../../src/domain/puzzle/PuzzleKey.ts';

const KEY_A = PuzzleKey.try('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')!;
const KEY_B = PuzzleKey.try('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')!;

function createInMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string): string | null {
      return store.get(String(key)) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(String(key), String(value));
    },
    removeItem(key: string): void {
      store.delete(String(key));
    },
    clear(): void {
      store.clear();
    },
  } as unknown as Storage;
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = createInMemoryStorage();
  localStorage.clear();
});

describe('localStoragePort', () => {
  it('localStoragePort: loadBuilder returns null when nothing saved', () => {
    const port = createLocalStoragePort();
    expect(port.loadBuilder()).toBeNull();
  });

  it('localStoragePort: saveBuilder then loadBuilder returns the saved blob', () => {
    const port = createLocalStoragePort();
    port.saveBuilder('snapshot-v1');
    expect(port.loadBuilder()).toBe('snapshot-v1');
  });

  it('localStoragePort: clearBuilder removes the saved blob', () => {
    const port = createLocalStoragePort();
    port.saveBuilder('snapshot-v1');
    port.clearBuilder();
    expect(port.loadBuilder()).toBeNull();
  });

  it('localStoragePort: loadPlayerProgress returns null when nothing saved for that key', () => {
    const port = createLocalStoragePort();
    expect(port.loadPlayerProgress(KEY_A)).toBeNull();
  });

  it('localStoragePort: savePlayerProgress then loadPlayerProgress returns the saved blob', () => {
    const port = createLocalStoragePort();
    port.savePlayerProgress(KEY_A, 'progress-v1');
    expect(port.loadPlayerProgress(KEY_A)).toBe('progress-v1');
  });

  it('localStoragePort: savePlayerProgress with different keys produces different slots', () => {
    const port = createLocalStoragePort();
    port.savePlayerProgress(KEY_A, 'progress-a');
    port.savePlayerProgress(KEY_B, 'progress-b');
    expect(port.loadPlayerProgress(KEY_A)).toBe('progress-a');
    expect(port.loadPlayerProgress(KEY_B)).toBe('progress-b');
  });

  it('localStoragePort: clearPlayerProgress removes only that key (other keys preserved)', () => {
    const port = createLocalStoragePort();
    port.savePlayerProgress(KEY_A, 'progress-a');
    port.savePlayerProgress(KEY_B, 'progress-b');
    port.clearPlayerProgress(KEY_A);
    expect(port.loadPlayerProgress(KEY_A)).toBeNull();
    expect(port.loadPlayerProgress(KEY_B)).toBe('progress-b');
  });

  it('localStoragePort: clearBuilder does not affect player progress; clearPlayerProgress does not affect builder', () => {
    const port = createLocalStoragePort();
    port.saveBuilder('snapshot-v1');
    port.savePlayerProgress(KEY_A, 'progress-a');
    port.clearBuilder();
    expect(port.loadBuilder()).toBeNull();
    expect(port.loadPlayerProgress(KEY_A)).toBe('progress-a');
    port.saveBuilder('snapshot-v2');
    port.clearPlayerProgress(KEY_A);
    expect(port.loadBuilder()).toBe('snapshot-v2');
    expect(port.loadPlayerProgress(KEY_A)).toBeNull();
  });

  it('localStoragePort: saveBuilder does not throw when localStorage.setItem throws (graceful failure)', () => {
    const port = createLocalStoragePort();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => port.saveBuilder('snapshot-v1')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('localStoragePort: loadBuilder returns null when localStorage.getItem throws (graceful failure)', () => {
    const port = createLocalStoragePort();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const getItemSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(port.loadBuilder()).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
    getItemSpy.mockRestore();
  });
});
