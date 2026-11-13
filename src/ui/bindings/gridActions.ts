import type { GridInteractionIntent } from '../../domain/grid/GridInteraction';
import { Grid } from '../../domain/grid/Grid';
import { Letter } from '../../domain/letter/Letter';

type TargetedGridIntent = { target: 'builder' | 'player' } & GridInteractionIntent;

export type GridActions = {
  selectCell(row: number, col: number): void;
  typeLetter(letter: string): void;
  backspace(): void;
  moveCursor(direction: 'across' | 'down', sign: -1 | 1): void;
  escape(): void;
};

export function createGridActions(
  target: 'builder' | 'player',
  getGrid: () => Grid | null,
  dispatch: (intent: TargetedGridIntent) => void,
): GridActions {
  return {
    selectCell(row: number, col: number) {
      const g = getGrid();
      if (g === null) return;
      const cell = Grid.tryCoord(g, row, col);
      if (cell === null) return;
      dispatch({ target, kind: 'select-cell', cell });
    },
    typeLetter(letter: string) {
      const l = Letter.try(letter);
      if (l === null) return;
      dispatch({ target, kind: 'type-letter', letter: l });
    },
    backspace() {
      dispatch({ target, kind: 'backspace' });
    },
    moveCursor(direction: 'across' | 'down', sign: -1 | 1) {
      dispatch({ target, kind: 'move-cursor', direction, sign });
    },
    escape() {
      dispatch({ target, kind: 'escape' });
    },
  };
}
