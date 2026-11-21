import { describe, it, expect } from 'vitest';
import { scrollRowIntoView } from '../../../../src/ui/shared/helpers/clueScroll';

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

  const fakeEl = (top: number, bottom: number, clientHeight: number, scrollTop = 0) =>
    ({
      getBoundingClientRect: () => ({ top, bottom }),
      clientHeight,
      scrollTop,
    }) as unknown as HTMLElement;

  it('does not scroll when the row is fully visible', () => {
    const panel = fakeEl(0, 400, 400);
    const row = fakeEl(50, 80, 30);
    scrollRowIntoView(panel, { '0_0_across': row }, '0_0_across');
    expect(panel.scrollTop).toBe(0);
  });

  it('scrolls minimally when the row is below the visible band', () => {
    const panel = fakeEl(0, 400, 400);
    const row = fakeEl(500, 530, 30);
    scrollRowIntoView(panel, { '0_0_across': row }, '0_0_across');
    expect(panel.scrollTop).toBe(130);
  });

  it('scrolls minimally when the row is above the visible band', () => {
    const panel = fakeEl(100, 500, 400, 60);
    const row = fakeEl(50, 90, 40);
    scrollRowIntoView(panel, { '0_0_across': row }, '0_0_across');
    expect(panel.scrollTop).toBe(10);
  });
});
