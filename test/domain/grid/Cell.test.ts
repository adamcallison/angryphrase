import { describe, expect, it } from 'vitest';
import { Cell } from '../../../src/domain/grid/Cell';
import type { Cell as CellType } from '../../../src/domain/grid/Cell';
import { CellMarker } from '../../../src/domain/grid/CellMarker';
import { Letter } from '../../../src/domain/letter/Letter';

describe('Cell', () => {
  it('Cell.white returns { black:false, answerLetter:null, playerLetter:null, marker: EMPTY }', () => {
    const cell = Cell.white();
    expect(cell).toEqual({
      black: false,
      answerLetter: null,
      playerLetter: null,
      marker: CellMarker.EMPTY,
    });
  });

  it('Cell.black returns { black:true, answerLetter:null, playerLetter:null, marker: EMPTY }', () => {
    const cell = Cell.black();
    expect(cell).toEqual({
      black: true,
      answerLetter: null,
      playerLetter: null,
      marker: CellMarker.EMPTY,
    });
  });

  it('Cell.isWhite returns true for white, false for black', () => {
    const white: CellType = Cell.white();
    const black: CellType = Cell.black();
    expect(Cell.isWhite(white)).toBe(true);
    expect(Cell.isWhite(black)).toBe(false);
  });

  it('Cell.setAnswerLetter sets answerLetter on a white cell', () => {
    const nonNull = Letter.try('A');
    expect(nonNull).not.toBeNull();
    const A = nonNull!;
    const cell = Cell.white();
    const updated = Cell.setAnswerLetter(cell, A);
    expect(updated.answerLetter).toBe(A);
  });

  it('Cell.setAnswerLetter(null) clears the answerLetter', () => {
    const nonNull = Letter.try('A');
    expect(nonNull).not.toBeNull();
    const A = nonNull!;
    const cell = Cell.setAnswerLetter(Cell.white(), A);
    const cleared = Cell.setAnswerLetter(cell, null);
    expect(cleared.answerLetter).toBeNull();
  });

  it('Cell.setAnswerLetter is a no-op on black cells (returns same black cell with null letters)', () => {
    const nonNull = Letter.try('A');
    expect(nonNull).not.toBeNull();
    const A = nonNull!;
    const cell = Cell.black();
    const updated = Cell.setAnswerLetter(cell, A);
    expect(updated.black).toBe(true);
    expect(updated.answerLetter).toBeNull();
    expect(updated.playerLetter).toBeNull();
  });

  it('Cell.setAnswerLetter returns a new object; input cell is unchanged', () => {
    const nonNull = Letter.try('A');
    expect(nonNull).not.toBeNull();
    const A = nonNull!;
    const cell = Cell.white();
    const updated = Cell.setAnswerLetter(cell, A);
    expect(updated).not.toBe(cell);
    expect(cell.answerLetter).toBeNull();
  });

  it('Cell.setAnswerLetter trusts the branded Letter (does not re-validate)', () => {
    const nonNull = Letter.try('A');
    expect(nonNull).not.toBeNull();
    const A = nonNull!;
    const updated = Cell.setAnswerLetter(Cell.white(), A);
    expect(updated.answerLetter).toBe(A);
  });

  it('Cell.setPlayerLetter sets playerLetter on a white cell', () => {
    const nonNull = Letter.try('A');
    expect(nonNull).not.toBeNull();
    const A = nonNull!;
    const cell = Cell.white();
    const updated = Cell.setPlayerLetter(cell, A);
    expect(updated.playerLetter).toBe(A);
  });

  it('Cell.setPlayerLetter null clears playerLetter', () => {
    const nonNull = Letter.try('A');
    expect(nonNull).not.toBeNull();
    const A = nonNull!;
    const cell = Cell.setPlayerLetter(Cell.white(), A);
    const cleared = Cell.setPlayerLetter(cell, null);
    expect(cleared.playerLetter).toBeNull();
  });

  it('Cell.setPlayerLetter is a no-op on black cells', () => {
    const nonNull = Letter.try('A');
    expect(nonNull).not.toBeNull();
    const A = nonNull!;
    const cell = Cell.black();
    const updated = Cell.setPlayerLetter(cell, A);
    expect(updated.black).toBe(true);
    expect(updated.answerLetter).toBeNull();
    expect(updated.playerLetter).toBeNull();
  });

  it('Cell.setPlayerLetter returns a new object; input cell is unchanged', () => {
    const nonNull = Letter.try('A');
    expect(nonNull).not.toBeNull();
    const A = nonNull!;
    const cell = Cell.white();
    const updated = Cell.setPlayerLetter(cell, A);
    expect(updated).not.toBe(cell);
    expect(cell.playerLetter).toBeNull();
  });

  it('Cell.setMarker sets marker on a white cell', () => {
    const marker = CellMarker.toggle(CellMarker.EMPTY, 'space-right');
    const cell = Cell.white();
    const updated = Cell.setMarker(cell, marker);
    expect(updated.marker).toEqual(marker);
  });

  it('Cell.setMarker is a no-op on black cells (invariant holds)', () => {
    const marker = CellMarker.toggle(CellMarker.EMPTY, 'space-right');
    const cell = Cell.black();
    const updated = Cell.setMarker(cell, marker);
    expect(updated.black).toBe(true);
    expect(updated.marker).toEqual(CellMarker.EMPTY);
  });

  it('Cell.setMarker returns a new object; input cell is unchanged', () => {
    const marker = CellMarker.toggle(CellMarker.EMPTY, 'space-right');
    const cell = Cell.white();
    const updated = Cell.setMarker(cell, marker);
    expect(updated).not.toBe(cell);
    expect(cell.marker).toBe(CellMarker.EMPTY);
  });

  it('setAnswerLetter / setPlayerLetter / setMarker are independently composable', () => {
    const nonNull = Letter.try('A');
    expect(nonNull).not.toBeNull();
    const A = nonNull!;
    const marker = CellMarker.toggle(CellMarker.EMPTY, 'hyphen-bottom');

    const cell = Cell.white();
    const withAnswer = Cell.setAnswerLetter(cell, A);
    const withPlayer = Cell.setPlayerLetter(withAnswer, A);
    const final = Cell.setMarker(withPlayer, marker);

    expect(final).toEqual({
      black: false,
      answerLetter: A,
      playerLetter: A,
      marker,
    });
  });
});
