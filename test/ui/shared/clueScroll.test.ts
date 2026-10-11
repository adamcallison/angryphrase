import { describe, it, expect } from 'vitest';
import { canonicalWordKeyId, scrollRowIntoView } from '../../../src/ui/shared/clueScroll';
import type { WordKey } from '../../../src/domain/word/WordKey';

describe('canonicalWordKeyId', () => {
  it('produces "<row>_<col>_<direction>"', () => {
    const key: WordKey = {
      startRow: 2 as never,
      startCol: 5 as never,
      direction: 'across',
    };
    expect(canonicalWordKeyId(key)).toBe('2_5_across');
  });
});

describe('scrollRowIntoView', () => {
  it('does nothing when panelEl is null', () => {
    expect(() =>
      scrollRowIntoView(null, { '0_0_across': {} as HTMLElement }, '0_0_across'),
    ).not.toThrow();
  });

  it('does nothing when id is missing from liRefs', () => {
    const panel = { scrollTop: 0 } as unknown as HTMLElement;
    expect(() => scrollRowIntoView(panel, {}, '0_0_across')).not.toThrow();
  });
});
