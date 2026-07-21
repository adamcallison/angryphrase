import type { CellMarkerFlag } from './CellMarkerFlag';

export type CellMarker = {
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
};

export const CellMarker: {
  EMPTY: CellMarker;
  toggle(marker: CellMarker, flag: CellMarkerFlag): CellMarker;
} = {
  EMPTY: Object.freeze({
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
  }),

  toggle(marker: CellMarker, flag: CellMarkerFlag): CellMarker {
    switch (flag) {
      case 'space-right': {
        const spaceRight = !marker.spaceRight;
        return {
          ...marker,
          spaceRight,
          hyphenRight: spaceRight ? false : marker.hyphenRight,
        };
      }
      case 'hyphen-right': {
        const hyphenRight = !marker.hyphenRight;
        return {
          ...marker,
          hyphenRight,
          spaceRight: hyphenRight ? false : marker.spaceRight,
        };
      }
      case 'space-bottom': {
        const spaceBottom = !marker.spaceBottom;
        return {
          ...marker,
          spaceBottom,
          hyphenBottom: spaceBottom ? false : marker.hyphenBottom,
        };
      }
      case 'hyphen-bottom': {
        const hyphenBottom = !marker.hyphenBottom;
        return {
          ...marker,
          hyphenBottom,
          spaceBottom: hyphenBottom ? false : marker.spaceBottom,
        };
      }
    }
  },
};
