import type { Grid } from '../../../domain/grid/Grid';
import { CellMarker } from '../../../domain/grid/CellMarker';
import type { CellSeparator } from '../../../domain/grid/CellSeparator';
import { WordTopology } from '../../../domain/grid/WordTopology';
import type { Word } from '../../../domain/word/Word';
import type { Cursor } from '../../../domain/grid/Cursor';
import type { Direction } from '../../../domain/word/Direction';

export type { CellSeparator };

export type CellHilite = 'none' | 'selected' | 'in-word';

export type GridCellVM = {
  row: number;
  col: number;
  black: boolean;
  letter: string | null;
  number: number | null;
  hilite: CellHilite;
  separatorRight: CellSeparator;
  separatorBottom: CellSeparator;
  selectable: boolean;
};

export type GridVM = {
  size: number;
  cells: GridCellVM[][];
  cursorRow: number | null;
  cursorCol: number | null;
  cursorDirection: Direction | null;
};

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

export function deriveGridVM(input: {
  grid: Grid;
  cursor: Cursor;
  words: Word[];
  whichLetter: 'answer' | 'player';
  selectedWordCells: ReadonlySet<string>;
}): GridVM {
  const { grid, cursor, words, whichLetter, selectedWordCells } = input;
  const mask = WordTopology.partOfRunMask(grid);
  const size = grid.length;
  const cursorRow = cursor ? Number(cursor.row) : null;
  const cursorCol = cursor ? Number(cursor.col) : null;
  const cursorDirection = cursor ? cursor.direction : null;
  const wordStartNumber = new Map<string, number>();
  for (const word of words) {
    const key = cellKey(Number(word.key.startRow), Number(word.key.startCol));
    wordStartNumber.set(key, Number(word.number));
  }

  const cells: GridCellVM[][] = grid.map((rowCells, r): GridCellVM[] =>
    rowCells.map((cell, c): GridCellVM => {
      const black = cell.black;
      const key = cellKey(r, c);

      const letter = black
        ? null
        : whichLetter === 'answer'
          ? cell.answerLetter
            ? String(cell.answerLetter)
            : null
          : cell.playerLetter
            ? String(cell.playerLetter)
            : null;

      const number = black ? null : wordStartNumber.get(key) ?? null;

      const hilite: CellHilite = black
        ? 'none'
        : cursor && Number(cursor.row) === r && Number(cursor.col) === c
          ? 'selected'
          : selectedWordCells.has(key)
            ? 'in-word'
            : 'none';

      const separatorRight: CellSeparator = black
        ? 'none'
        : CellMarker.read(cell.marker, 'right');

      const separatorBottom: CellSeparator = black
        ? 'none'
        : CellMarker.read(cell.marker, 'bottom');

      const selectable = black ? false : mask[r]?.[c] === true;

      return {
        row: r,
        col: c,
        black,
        letter,
        number,
        hilite,
        separatorRight,
        separatorBottom,
        selectable,
      };
    }),
  );

  return { size, cells, cursorRow, cursorCol, cursorDirection };
}
