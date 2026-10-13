import { describe, expect, it } from 'vitest';
import { CellMarker } from '../../../src/domain/grid/CellMarker';
import type { CellMarker as CellMarkerType } from '../../../src/domain/grid/CellMarker';

describe('CellMarker', () => {
  it('CellMarker.EMPTY has right and bottom set to none and is frozen', () => {
    expect(CellMarker.EMPTY).toEqual({ right: 'none', bottom: 'none' });
    expect(Object.isFrozen(CellMarker.EMPTY)).toBe(true);
  });

  it('CellMarker.read returns the separator for the requested axis', () => {
    const marker: CellMarkerType = { right: 'space', bottom: 'hyphen' };
    expect(CellMarker.read(marker, 'right')).toBe('space');
    expect(CellMarker.read(marker, 'bottom')).toBe('hyphen');
  });

  it('CellMarker.write returns a new object and leaves the input unchanged', () => {
    const marker: CellMarkerType = { right: 'none', bottom: 'none' };
    const written = CellMarker.write(marker, 'right', 'space');

    expect(written).not.toBe(marker);
    expect(marker).toEqual({ right: 'none', bottom: 'none' });
  });

  it('CellMarker.write updates only the specified axis', () => {
    const marker: CellMarkerType = { right: 'none', bottom: 'hyphen' };
    const written = CellMarker.write(marker, 'right', 'space');

    expect(written).toEqual({ right: 'space', bottom: 'hyphen' });
  });

  it('CellMarker.write returns a new object even when the value is unchanged', () => {
    const marker: CellMarkerType = { right: 'space', bottom: 'none' };
    const written = CellMarker.write(marker, 'right', 'space');

    expect(written).not.toBe(marker);
    expect(written).toEqual({ right: 'space', bottom: 'none' });
  });

  it('CellMarker.isEmpty returns true iff the axis separator is none', () => {
    const marker: CellMarkerType = { right: 'none', bottom: 'space' };
    expect(CellMarker.isEmpty(marker, 'right')).toBe(true);
    expect(CellMarker.isEmpty(marker, 'bottom')).toBe(false);
  });
});
