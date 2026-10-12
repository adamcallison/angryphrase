import type { GridInteractionIntent } from '../../domain/grid/GridInteraction';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';
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
  dispatch: (intent: TargetedGridIntent) => void,
): GridActions {
  return {
    selectCell(row: number, col: number) {
      dispatch({ target, kind: 'select-cell', row: Row.of(row), col: Col.of(col) });
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
