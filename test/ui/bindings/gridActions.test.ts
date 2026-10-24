import { describe, it, expect } from 'vitest';
import { createGridActions, type GridActions } from '../../../src/ui/bindings/gridActions';
import type { GridInteractionIntent } from '../../../src/domain/grid/GridInteraction';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { Letter } from '../../../src/domain/letter/Letter';

type TargetedGridIntent = { target: 'builder' | 'player' } & GridInteractionIntent;

describe('gridActions.ts', () => {
  function makeActions(): { actions: GridActions; dispatched: TargetedGridIntent[] } {
    const dispatched: TargetedGridIntent[] = [];
    const actions = createGridActions('builder', (intent) => dispatched.push(intent));
    return { actions, dispatched };
  }

  it('selectCell dispatches select-cell with branded row and col', () => {
    const { actions, dispatched } = makeActions();

    actions.selectCell(2, 3);

    expect(dispatched).toEqual([{ target: 'builder', kind: 'select-cell', row: Row.of(2), col: Col.of(3) }]);
  });

  it('typeLetter dispatches type-letter with branded letter for valid input', () => {
    const { actions, dispatched } = makeActions();

    actions.typeLetter('Z');

    expect(dispatched).toEqual([{ target: 'builder', kind: 'type-letter', letter: Letter.try('Z')! }]);
  });

  it('gridActions: typeLetter uppercases a lowercase letter before dispatching', () => {
    const { actions, dispatched } = makeActions();

    actions.typeLetter('a');

    expect(dispatched).toEqual([{ target: 'builder', kind: 'type-letter', letter: Letter.try('A') }]);
  });

  it('typeLetter silently drops invalid input', () => {
    const { actions, dispatched } = makeActions();

    actions.typeLetter('9');

    expect(dispatched).toEqual([]);
  });

  it('backspace dispatches backspace', () => {
    const { actions, dispatched } = makeActions();

    actions.backspace();

    expect(dispatched).toEqual([{ target: 'builder', kind: 'backspace' }]);
  });

  it('moveCursor dispatches move-cursor with direction and sign', () => {
    const { actions, dispatched } = makeActions();

    actions.moveCursor('down', -1);

    expect(dispatched).toEqual([{ target: 'builder', kind: 'move-cursor', direction: 'down', sign: -1 }]);
  });

  it('escape dispatches escape', () => {
    const { actions, dispatched } = makeActions();

    actions.escape();

    expect(dispatched).toEqual([{ target: 'builder', kind: 'escape' }]);
  });

  it('gridActions: selectCell ignores a negative row without dispatching', () => {
    const { actions, dispatched } = makeActions();

    expect(() => actions.selectCell(-1, 0)).not.toThrow();
    expect(dispatched).toEqual([]);
  });

  it('gridActions: selectCell ignores a non-integer column without dispatching', () => {
    const { actions, dispatched } = makeActions();

    expect(() => actions.selectCell(0, 1.5)).not.toThrow();
    expect(dispatched).toEqual([]);
  });
});
