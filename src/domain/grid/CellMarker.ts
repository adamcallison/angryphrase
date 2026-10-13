import type { CellSeparator } from './CellSeparator';

export type CellMarkerAxis = 'right' | 'bottom';

export type CellMarker = {
  right: CellSeparator;
  bottom: CellSeparator;
};

export const CellMarker: {
  EMPTY: CellMarker;
  read(marker: CellMarker, axis: CellMarkerAxis): CellSeparator;
  write(marker: CellMarker, axis: CellMarkerAxis, separator: CellSeparator): CellMarker;
  isEmpty(marker: CellMarker, axis: CellMarkerAxis): boolean;
} = {
  EMPTY: Object.freeze({ right: 'none', bottom: 'none' }),

  read(marker: CellMarker, axis: CellMarkerAxis): CellSeparator {
    return marker[axis];
  },

  write(marker: CellMarker, axis: CellMarkerAxis, separator: CellSeparator): CellMarker {
    return axis === 'right'
      ? { ...marker, right: separator }
      : { ...marker, bottom: separator };
  },

  isEmpty(marker: CellMarker, axis: CellMarkerAxis): boolean {
    return marker[axis] === 'none';
  },
};
