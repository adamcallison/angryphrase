import { describe, expect, it } from 'vitest';
import { CellMarker } from '../../../src/domain/grid/CellMarker';
import type { CellMarker as CellMarkerType } from '../../../src/domain/grid/CellMarker';

describe('CellMarker', () => {
  it('CellMarker.EMPTY has all four booleans false', () => {
    expect(CellMarker.EMPTY).toEqual({
      spaceRight: false,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    });
  });

  it('CellMarker.toggle turns space-right off → on (with hyphenRight staying false)', () => {
    const marker: CellMarkerType = {
      spaceRight: false,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    };
    const toggled = CellMarker.toggle(marker, 'space-right');
    expect(toggled.spaceRight).toBe(true);
    expect(toggled.hyphenRight).toBe(false);
  });

  it('CellMarker.toggle turns space-right on → off', () => {
    const marker: CellMarkerType = {
      spaceRight: true,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    };
    const toggled = CellMarker.toggle(marker, 'space-right');
    expect(toggled.spaceRight).toBe(false);
  });

  it('CellMarker.toggle(space-right) flips hyphenRight off when turning space-right on (FR-27 mutual exclusion)', () => {
    const marker: CellMarkerType = {
      spaceRight: false,
      spaceBottom: false,
      hyphenRight: true,
      hyphenBottom: false,
    };
    const toggled = CellMarker.toggle(marker, 'space-right');
    expect(toggled.spaceRight).toBe(true);
    expect(toggled.hyphenRight).toBe(false);
  });

  it('CellMarker.toggle(space-bottom) flips hyphenBottom off when turning space-bottom on (FR-27 mutual exclusion, bottom axis)', () => {
    const marker: CellMarkerType = {
      spaceRight: false,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: true,
    };
    const toggled = CellMarker.toggle(marker, 'space-bottom');
    expect(toggled.spaceBottom).toBe(true);
    expect(toggled.hyphenBottom).toBe(false);
  });

  it('CellMarker.toggle(hyphen-right) flips spaceRight off when turning hyphen-right on', () => {
    const marker: CellMarkerType = {
      spaceRight: true,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    };
    const toggled = CellMarker.toggle(marker, 'hyphen-right');
    expect(toggled.hyphenRight).toBe(true);
    expect(toggled.spaceRight).toBe(false);
  });

  it('CellMarker.toggle(hyphen-bottom) flips spaceBottom off when turning hyphen-bottom on', () => {
    const marker: CellMarkerType = {
      spaceRight: false,
      spaceBottom: true,
      hyphenRight: false,
      hyphenBottom: false,
    };
    const toggled = CellMarker.toggle(marker, 'hyphen-bottom');
    expect(toggled.hyphenBottom).toBe(true);
    expect(toggled.spaceBottom).toBe(false);
  });

  it('CellMarker.toggle returning off leaves the same-axis opposite as-is', () => {
    const marker: CellMarkerType = {
      spaceRight: true,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    };
    const toggled = CellMarker.toggle(marker, 'space-right');
    expect(toggled.spaceRight).toBe(false);
    expect(toggled.hyphenRight).toBe(false);
  });

  it('CellMarker.toggle on a right flag never affects the bottom axis, and vice versa', () => {
    const rightToggled = CellMarker.toggle(CellMarker.EMPTY, 'space-right');
    expect(rightToggled.spaceBottom).toBe(false);
    expect(rightToggled.hyphenBottom).toBe(false);

    const bottomToggled = CellMarker.toggle(CellMarker.EMPTY, 'space-bottom');
    expect(bottomToggled.spaceRight).toBe(false);
    expect(bottomToggled.hyphenRight).toBe(false);
  });

  it('CellMarker.toggle immutably returns a new marker; input is unchanged', () => {
    const marker: CellMarkerType = {
      spaceRight: false,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    };
    const toggled = CellMarker.toggle(marker, 'space-right');
    expect(toggled).not.toBe(marker);
    expect(marker).toEqual({
      spaceRight: false,
      spaceBottom: false,
      hyphenRight: false,
      hyphenBottom: false,
    });
  });

  it('CellMarker.EMPTY is frozen (cannot be mutated)', () => {
    const m = CellMarker.EMPTY;
    try {
      (m as unknown as Record<string, boolean>).spaceRight = true;
    } catch {
      // Object.freeze throws in strict mode (ESM); the field remains unchanged.
    }
    expect(m.spaceRight).toBe(false);
  });
});
