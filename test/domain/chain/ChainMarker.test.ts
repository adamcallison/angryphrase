import { describe, it, expect } from 'vitest';
import { ChainMarker } from '../../../src/domain/chain/ChainMarker';
import { Grid } from '../../../src/domain/grid/Grid';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Cell } from '../../../src/domain/grid/Cell';
import { CellMarker } from '../../../src/domain/grid/CellMarker';
import type { CellSeparator } from '../../../src/domain/grid/CellSeparator';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { WordGeometry } from '../../../src/domain/word/WordGeometry';
import { WordLength } from '../../../src/domain/word/WordLength';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import type { Word } from '../../../src/domain/word/Word';
import type { WordKey } from '../../../src/domain/word/WordKey';
import type { Direction as DirectionType } from '../../../src/domain/word/Direction';

function makeWord(
  row: number,
  col: number,
  direction: DirectionType,
  length = 2,
  next: WordKey | null = null,
): Word {
  return {
    key: {
      startRow: Row.of(row),
      startCol: Col.of(col),
      direction,
    },
    number: WordNumber.of(1),
    length: WordLength.of(length),
    clue: '',
    nextWord: next,
  };
}

function setCellMarker(grid: Grid, row: number, col: number, marker: CellMarker): Grid {
  const cell = Grid.cellAt(grid, Row.of(row), Col.of(col));
  return Grid.setCell(grid, Row.of(row), Col.of(col), Cell.setMarker(cell, marker));
}

describe('ChainMarker', () => {
  it('boundarySeparatorAt returns the separator on the direction axis (across→right, down→bottom)', () => {
    const cases: { direction: DirectionType; axis: 'right' | 'bottom'; sep: CellSeparator }[] = [
      { direction: 'across', axis: 'right', sep: 'none' },
      { direction: 'across', axis: 'right', sep: 'space' },
      { direction: 'across', axis: 'right', sep: 'hyphen' },
      { direction: 'down', axis: 'bottom', sep: 'none' },
      { direction: 'down', axis: 'bottom', sep: 'space' },
      { direction: 'down', axis: 'bottom', sep: 'hyphen' },
    ];

    for (const { direction, axis, sep } of cases) {
      const grid = Grid.blank(GridSize.of(5));
      const word = makeWord(1, 1, direction, 3);
      const end = WordGeometry.lastCell(word);
      let marked = CellMarker.write(CellMarker.EMPTY, 'right', 'none');
      marked = CellMarker.write(marked, 'bottom', 'none');
      marked = CellMarker.write(marked, axis, sep);
      const gridWithMarker = setCellMarker(grid, Number(end.row), Number(end.col), marked);

      expect(ChainMarker.boundarySeparatorAt(gridWithMarker, word)).toBe(sep);
    }
  });

  it('boundarySeparatorAt returns null when the end cell is black', () => {
    const across = makeWord(0, 1, 'across', 2);
    const down = makeWord(1, 0, 'down', 2);
    let grid = Grid.blank(GridSize.of(3));
    grid = Grid.setCell(grid, Row.of(0), Col.of(2), Cell.black());
    grid = Grid.setCell(grid, Row.of(2), Col.of(0), Cell.black());

    expect(ChainMarker.boundarySeparatorAt(grid, across)).toBeNull();
    expect(ChainMarker.boundarySeparatorAt(grid, down)).toBeNull();
  });

  it('boundarySeparatorAt returns null when the end cell is out of bounds', () => {
    const across = makeWord(0, 0, 'across', 3);
    const down = makeWord(0, 0, 'down', 3);
    const grid = Grid.blank(GridSize.of(2));

    expect(ChainMarker.boundarySeparatorAt(grid, across)).toBeNull();
    expect(ChainMarker.boundarySeparatorAt(grid, down)).toBeNull();
  });

  it('writeBoundarySeparator writes only the target axis', () => {
    const across = makeWord(0, 0, 'across', 3);
    const down = makeWord(0, 0, 'down', 3);

    let acrossGrid = Grid.blank(GridSize.of(4));
    acrossGrid = setCellMarker(
      acrossGrid,
      0,
      2,
      CellMarker.write(CellMarker.write(CellMarker.EMPTY, 'right', 'hyphen'), 'bottom', 'hyphen'),
    );
    const acrossWritten = ChainMarker.writeBoundarySeparator(acrossGrid, across, 'space');
    expect(Grid.cellAt(acrossWritten, Row.of(0), Col.of(2)).marker).toEqual(
      CellMarker.write(CellMarker.write(CellMarker.EMPTY, 'right', 'space'), 'bottom', 'hyphen'),
    );

    let downGrid = Grid.blank(GridSize.of(4));
    downGrid = setCellMarker(
      downGrid,
      2,
      0,
      CellMarker.write(CellMarker.write(CellMarker.EMPTY, 'right', 'hyphen'), 'bottom', 'hyphen'),
    );
    const downWritten = ChainMarker.writeBoundarySeparator(downGrid, down, 'space');
    expect(Grid.cellAt(downWritten, Row.of(2), Col.of(0)).marker).toEqual(
      CellMarker.write(CellMarker.write(CellMarker.EMPTY, 'right', 'hyphen'), 'bottom', 'space'),
    );
  });

  it('writeBoundarySeparator is a no-op on a black end cell', () => {
    const word = makeWord(0, 1, 'across', 2);
    let grid = Grid.blank(GridSize.of(3));
    grid = Grid.setCell(grid, Row.of(0), Col.of(2), Cell.black());
    const before = grid;

    const after = ChainMarker.writeBoundarySeparator(grid, word, 'space');

    expect(after).toBe(before);
    expect(Grid.cellAt(after, Row.of(0), Col.of(2)).black).toBe(true);
  });

  it('writeBoundarySeparator is a no-op when out of bounds', () => {
    const word = makeWord(0, 0, 'across', 3);
    const grid = Grid.blank(GridSize.of(2));
    const before = grid;

    const after = ChainMarker.writeBoundarySeparator(grid, word, 'space');

    expect(after).toBe(before);
  });

  it('materializeDefaultBoundary writes space when the pair is empty', () => {
    const across = makeWord(0, 0, 'across', 2);
    const down = makeWord(0, 0, 'down', 2);
    const grid = Grid.blank(GridSize.of(3));

    const acrossWritten = ChainMarker.materializeDefaultBoundary(grid, across);
    expect(CellMarker.read(Grid.cellAt(acrossWritten, Row.of(0), Col.of(1)).marker, 'right')).toBe('space');
    expect(CellMarker.read(Grid.cellAt(acrossWritten, Row.of(0), Col.of(1)).marker, 'bottom')).toBe('none');

    const downWritten = ChainMarker.materializeDefaultBoundary(grid, down);
    expect(CellMarker.read(Grid.cellAt(downWritten, Row.of(1), Col.of(0)).marker, 'bottom')).toBe('space');
    expect(CellMarker.read(Grid.cellAt(downWritten, Row.of(1), Col.of(0)).marker, 'right')).toBe('none');
  });

  it('materializeDefaultBoundary preserves a non-empty pair', () => {
    const across = makeWord(0, 0, 'across', 2);
    const down = makeWord(0, 0, 'down', 2);

    for (const sep of ['space', 'hyphen'] as const) {
      let acrossGrid = Grid.blank(GridSize.of(3));
      acrossGrid = setCellMarker(
        acrossGrid,
        0,
        1,
        CellMarker.write(CellMarker.EMPTY, 'right', sep),
      );
      const acrossWritten = ChainMarker.materializeDefaultBoundary(acrossGrid, across);
      expect(CellMarker.read(Grid.cellAt(acrossWritten, Row.of(0), Col.of(1)).marker, 'right')).toBe(sep);

      let downGrid = Grid.blank(GridSize.of(3));
      downGrid = setCellMarker(
        downGrid,
        1,
        0,
        CellMarker.write(CellMarker.EMPTY, 'bottom', sep),
      );
      const downWritten = ChainMarker.materializeDefaultBoundary(downGrid, down);
      expect(CellMarker.read(Grid.cellAt(downWritten, Row.of(1), Col.of(0)).marker, 'bottom')).toBe(sep);
    }
  });

  it('materializeDefaultBoundary writes space over none when the pair is empty', () => {
    const across = makeWord(0, 0, 'across', 2);
    const grid = Grid.blank(GridSize.of(3));

    const written = ChainMarker.materializeDefaultBoundary(grid, across);

    expect(CellMarker.read(Grid.cellAt(written, Row.of(0), Col.of(1)).marker, 'right')).toBe('space');
  });

  it('materializeDefaultBoundary is a no-op on a black end cell', () => {
    const word = makeWord(0, 1, 'across', 2);
    let grid = Grid.blank(GridSize.of(3));
    grid = Grid.setCell(grid, Row.of(0), Col.of(2), Cell.black());
    const before = grid;

    const after = ChainMarker.materializeDefaultBoundary(grid, word);

    expect(after).toBe(before);
    expect(Grid.cellAt(after, Row.of(0), Col.of(2)).black).toBe(true);
  });

  it('materializeDefaultBoundary is a no-op when out of bounds', () => {
    const word = makeWord(0, 0, 'across', 3);
    const grid = Grid.blank(GridSize.of(2));
    const before = grid;

    const after = ChainMarker.materializeDefaultBoundary(grid, word);

    expect(after).toBe(before);
  });

  it('does not mutate the input grid', () => {
    const word = makeWord(0, 0, 'across', 2);
    const grid = Grid.blank(GridSize.of(3));
    const snapshot = structuredClone(grid);

    ChainMarker.writeBoundarySeparator(grid, word, 'hyphen');
    ChainMarker.materializeDefaultBoundary(grid, word);

    expect(grid).toEqual(snapshot);
    expect(grid).toHaveLength(snapshot.length);
    for (let r = 0; r < grid.length; r += 1) {
      expect(grid[r]).toEqual(snapshot[r]);
    }
  });
});
