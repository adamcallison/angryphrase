import { Grid } from '../grid/Grid';
import { Cell } from '../grid/Cell';
import { CellMarker } from '../grid/CellMarker';
import type { CellSeparator } from '../grid/CellSeparator';
import { Direction } from '../word/Direction';
import { WordGeometry } from '../word/WordGeometry';
import type { WordExtent } from '../word/WordGeometry';

export const ChainMarker: {
  boundarySeparatorAt(grid: Grid, word: WordExtent): CellSeparator | null;
  writeBoundarySeparator(grid: Grid, word: WordExtent, sep: CellSeparator): Grid;
  materializeDefaultBoundary(grid: Grid, word: WordExtent): Grid;
} = {
  boundarySeparatorAt(grid: Grid, word: WordExtent): CellSeparator | null {
    const end = WordGeometry.lastCell(word);
    const axis = Direction.markerAxis(word.key.direction);

    if (!Grid.withinBounds(grid, end.row, end.col)) {
      return null;
    }

    const cell = Grid.cellAt(grid, end.row, end.col);
    if (!Cell.isWhite(cell)) {
      return null;
    }

    return CellMarker.read(cell.marker, axis);
  },

  writeBoundarySeparator(grid: Grid, word: WordExtent, sep: CellSeparator): Grid {
    const end = WordGeometry.lastCell(word);
    const axis = Direction.markerAxis(word.key.direction);

    if (!Grid.withinBounds(grid, end.row, end.col)) {
      return grid;
    }

    const cell = Grid.cellAt(grid, end.row, end.col);
    if (!Cell.isWhite(cell)) {
      return grid;
    }

    const nextMarker = CellMarker.write(cell.marker, axis, sep);
    return Grid.setCell(grid, end.row, end.col, Cell.setMarker(cell, nextMarker));
  },

  materializeDefaultBoundary(grid: Grid, word: WordExtent): Grid {
    const end = WordGeometry.lastCell(word);
    const axis = Direction.markerAxis(word.key.direction);

    if (!Grid.withinBounds(grid, end.row, end.col)) {
      return grid;
    }

    const cell = Grid.cellAt(grid, end.row, end.col);
    if (!Cell.isWhite(cell) || !CellMarker.isEmpty(cell.marker, axis)) {
      return grid;
    }

    const nextMarker = CellMarker.write(cell.marker, axis, 'space');
    return Grid.setCell(grid, end.row, end.col, Cell.setMarker(cell, nextMarker));
  },
};
