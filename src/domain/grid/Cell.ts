import type { Letter } from '../letter/Letter';
import { CellMarker } from './CellMarker';
import type { CellMarker as CellMarkerType } from './CellMarker';

export type Cell = {
  black: boolean;
  answerLetter: Letter | null;
  playerLetter: Letter | null;
  marker: CellMarkerType;
};

export const Cell: {
  white(): Cell;
  black(): Cell;
  isWhite(c: Cell): boolean;
  setAnswerLetter(c: Cell, l: Letter | null): Cell;
  setPlayerLetter(c: Cell, l: Letter | null): Cell;
  setMarker(c: Cell, marker: CellMarkerType): Cell;
} = {
  white(): Cell {
    return {
      black: false,
      answerLetter: null,
      playerLetter: null,
      marker: CellMarker.EMPTY,
    };
  },

  black(): Cell {
    return {
      black: true,
      answerLetter: null,
      playerLetter: null,
      marker: CellMarker.EMPTY,
    };
  },

  isWhite(c: Cell): boolean {
    return !c.black;
  },

  setAnswerLetter(c: Cell, l: Letter | null): Cell {
    if (c.black) return c;
    return { ...c, answerLetter: l };
  },

  setPlayerLetter(c: Cell, l: Letter | null): Cell {
    if (c.black) return c;
    return { ...c, playerLetter: l };
  },

  setMarker(c: Cell, marker: CellMarkerType): Cell {
    if (c.black) return c;
    return { ...c, marker };
  },
};
