import { describe, expect, it } from 'vitest';
import { Cell } from '../../../src/domain/grid/Cell';
import { Col } from '../../../src/domain/grid/Col';
import type { Grid } from '../../../src/domain/grid/Grid';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Row } from '../../../src/domain/grid/Row';
import { WordKey } from '../../../src/domain/word/WordKey';
import { WordDerivation } from '../../../src/domain/word/WordDerivation';

function blank(size: number): Grid {
  return GridOps.blank(GridSize.of(size));
}

function blackAt(g: Grid, r: number, c: number): Grid {
  return GridOps.setCell(g, Row.of(r), Col.of(c), Cell.black());
}

function whiteAt(g: Grid, r: number, c: number): Grid {
  return GridOps.setCell(g, Row.of(r), Col.of(c), Cell.white());
}

describe('WordDerivation', () => {
  it('derive returns 2 across + 2 down for an all-white 2x2 grid', () => {
    const grid = blank(2);
    const words = WordDerivation.derive(grid);

    expect(words).toHaveLength(4);
    const keys = words.map((w) => WordKey.toCanonical(w.key)).sort();
    expect(keys).toEqual(['0,0,across', '0,0,down', '0,1,down', '1,0,across'].sort());
  });

  it('derive returns no words for an all-black grid', () => {
    let grid = blank(3);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        grid = blackAt(grid, r, c);
      }
    }
    expect(WordDerivation.derive(grid)).toEqual([]);
  });

  it('derive returns no words for a grid of isolated white cells', () => {
    let grid = blank(3);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        grid = blackAt(grid, r, c);
      }
    }
    grid = whiteAt(grid, 0, 0);
    grid = whiteAt(grid, 1, 1);
    grid = whiteAt(grid, 2, 2);

    expect(WordDerivation.derive(grid)).toEqual([]);
  });

  it('derive finds horizontal runs of varying lengths', () => {
    let grid = blank(5);
    // Row 0: run length 3 at (0,0), then black.
    grid = blackAt(grid, 0, 3);
    grid = blackAt(grid, 0, 4);
    // Row 1: run length 2 at (1,0), then black.
    grid = blackAt(grid, 1, 2);
    grid = blackAt(grid, 1, 3);
    grid = blackAt(grid, 1, 4);
    // Row 2: run length 4 at (2,1).
    grid = blackAt(grid, 2, 0);
    // Row 3: run length 2 at (3,2).
    grid = blackAt(grid, 3, 0);
    grid = blackAt(grid, 3, 1);
    grid = blackAt(grid, 3, 4);
    // Row 4: run length 2 at (4,3).
    grid = blackAt(grid, 4, 0);
    grid = blackAt(grid, 4, 1);
    grid = blackAt(grid, 4, 2);

    const words = WordDerivation.derive(grid);
    const across = words.filter((w) => w.key.direction === 'across');
    expect(across).toHaveLength(5);
    const keys = across.map((w) => WordKey.toCanonical(w.key)).sort();
    expect(keys).toEqual(
      ['0,0,across', '1,0,across', '2,1,across', '3,2,across', '4,3,across'].sort()
    );
    expect(across.map((w) => w.length).sort((a, b) => a - b)).toEqual([2, 2, 2, 3, 4]);
  });

  it('derive finds vertical runs of varying lengths', () => {
    let grid = blank(5);
    // Col 0: run length 3 at (0,0), then black.
    grid = blackAt(grid, 3, 0);
    grid = blackAt(grid, 4, 0);
    // Col 1: run length 2 at (0,1), then black.
    grid = blackAt(grid, 2, 1);
    grid = blackAt(grid, 3, 1);
    grid = blackAt(grid, 4, 1);
    // Col 2: run length 4 at (1,2).
    grid = blackAt(grid, 0, 2);
    // Col 3: run length 2 at (2,3).
    grid = blackAt(grid, 0, 3);
    grid = blackAt(grid, 1, 3);
    grid = blackAt(grid, 4, 3);
    // Col 4: run length 2 at (3,4).
    grid = blackAt(grid, 0, 4);
    grid = blackAt(grid, 1, 4);
    grid = blackAt(grid, 2, 4);

    const words = WordDerivation.derive(grid);
    const down = words.filter((w) => w.key.direction === 'down');
    expect(down).toHaveLength(5);
    const keys = down.map((w) => WordKey.toCanonical(w.key)).sort();
    expect(keys).toEqual(
      ['0,0,down', '0,1,down', '1,2,down', '2,3,down', '3,4,down'].sort()
    );
    expect(down.map((w) => w.length).sort((a, b) => a - b)).toEqual([2, 2, 2, 3, 4]);
  });

  it('derive assigns direction across for horizontal runs, down for vertical', () => {
    let grid = blank(3);
    // Row 1: across length 3.
    grid = whiteAt(grid, 1, 0);
    grid = whiteAt(grid, 1, 1);
    grid = whiteAt(grid, 1, 2);
    // Col 1: down length 3.
    grid = whiteAt(grid, 0, 1);
    grid = whiteAt(grid, 2, 1);
    // All other cells black.
    grid = blackAt(grid, 0, 0);
    grid = blackAt(grid, 0, 2);
    grid = blackAt(grid, 2, 0);
    grid = blackAt(grid, 2, 2);

    const words = WordDerivation.derive(grid);
    expect(words).toHaveLength(2);
    const keys = words.map((w) => WordKey.toCanonical(w.key)).sort();
    expect(keys).toEqual(['0,1,down', '1,0,across'].sort());
    expect(words.every((w) => w.key.direction === 'across' || w.key.direction === 'down')).toBe(
      true
    );
  });

  it('derive does not emit words for length-1 runs', () => {
    let grid = blank(3);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        grid = blackAt(grid, r, c);
      }
    }
    grid = whiteAt(grid, 1, 1);

    expect(WordDerivation.derive(grid)).toEqual([]);
  });

  it('derive sets clue to empty string and nextWord to null', () => {
    const grid = blank(2);
    const words = WordDerivation.derive(grid);

    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.clue === '')).toBe(true);
    expect(words.every((w) => w.nextWord === null)).toBe(true);
  });

  it('derive handles a grid with both across and down words sharing a start cell', () => {
    let grid = blank(3);
    // Row 1: across length 3.
    grid = whiteAt(grid, 1, 0);
    grid = whiteAt(grid, 1, 1);
    grid = whiteAt(grid, 1, 2);
    // Col 1: down length 3.
    grid = whiteAt(grid, 0, 1);
    grid = whiteAt(grid, 1, 1);
    grid = whiteAt(grid, 2, 1);
    // All other cells black.
    grid = blackAt(grid, 0, 0);
    grid = blackAt(grid, 0, 2);
    grid = blackAt(grid, 2, 0);
    grid = blackAt(grid, 2, 2);

    const words = WordDerivation.derive(grid);
    expect(words).toHaveLength(2);
    const keys = words.map((w) => WordKey.toCanonical(w.key)).sort();
    expect(keys).toEqual(['0,1,down', '1,0,across'].sort());
  });

  it('derive is maximal: does not extend a run past a black cell', () => {
    let grid = blank(5);
    // Row 0: [W,W,B,W,W] -> two runs, both length 2.
    grid = blackAt(grid, 0, 2);
    // Row 1: all black to prevent down runs from row 0.
    for (let c = 0; c < 5; c++) {
      grid = blackAt(grid, 1, c);
    }

    const words = WordDerivation.derive(grid);
    const row0 = words.filter((w) => w.key.direction === 'across' && Number(w.key.startRow) === 0);
    expect(row0).toHaveLength(2);
    const keys = row0.map((w) => WordKey.toCanonical(w.key)).sort();
    expect(keys).toEqual(['0,0,across', '0,3,across'].sort());
    expect(row0.map((w) => w.length)).toEqual([2, 2]);
  });

  it('derive is maximal: does not start a run mid-way (only at black→white transitions or column 0/row 0)', () => {
    let grid = blank(5);
    // Row 0: [B,W,W,W,B] -> single run at (0,1) length 3.
    grid = blackAt(grid, 0, 0);
    grid = blackAt(grid, 0, 4);
    // Row 1: all black to prevent down runs from row 0.
    for (let c = 0; c < 5; c++) {
      grid = blackAt(grid, 1, c);
    }

    const words = WordDerivation.derive(grid);
    const row0 = words.filter((w) => w.key.direction === 'across' && Number(w.key.startRow) === 0);
    expect(row0).toHaveLength(1);
    expect(row0[0]!.length).toBe(3);
    expect(WordKey.toCanonical(row0[0]!.key)).toBe('0,1,across');
  });
});
