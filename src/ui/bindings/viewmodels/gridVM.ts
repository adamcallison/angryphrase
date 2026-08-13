import type { Grid } from '../../../domain/grid/Grid';
import { GridSize } from '../../../domain/grid/GridSize';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import type { Cell } from '../../../domain/grid/Cell';
import type { CellSeparator } from '../../../domain/grid/CellSeparator';
import { GridOps } from '../../../domain/grid/GridOps';
import type { Word } from '../../../domain/word/Word';
import type { WordNumber } from '../../../domain/word/WordNumber';
import type { Cursor } from '../../../domain/grid/Cursor';

export type { CellSeparator };

export type CellHilite = 'none' | 'selected' | 'in-word';

export type GridCellVM = {
  row: Row;
  col: Col;
  black: boolean;
  letter: string | null;
  number: WordNumber | null;
  hilite: CellHilite;
  separatorRight: CellSeparator;
  separatorBottom: CellSeparator;
  selectable: boolean;
};

export type GridVM = {
  size: GridSize;
  cells: GridCellVM[][];
  cursor: Cursor;
};

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function deriveSeparatorRight(cell: Cell): CellSeparator {
  if (cell.marker.spaceRight) return 'space';
  if (cell.marker.hyphenRight) return 'hyphen';
  return 'none';
}

function deriveSeparatorBottom(cell: Cell): CellSeparator {
  if (cell.marker.spaceBottom) return 'space';
  if (cell.marker.hyphenBottom) return 'hyphen';
  return 'none';
}

export function deriveGridVM(input: {
  grid: Grid;
  cursor: Cursor;
  words: Word[];
  whichLetter: 'answer' | 'player';
  selectedWordCells: ReadonlySet<string>;
}): GridVM {
  const { grid, cursor, words, whichLetter, selectedWordCells } = input;
  const size = GridSize.of(grid.length);
  const wordStartNumber = new Map<string, WordNumber>();
  for (const word of words) {
    const key = cellKey(Number(word.key.startRow), Number(word.key.startCol));
    wordStartNumber.set(key, word.number);
  }

  const cells: GridCellVM[][] = [];
  for (let r = 0; r < grid.length; r++) {
    const rowVms: GridCellVM[] = [];
    for (let c = 0; c < grid.length; c++) {
      const row = Row.of(r);
      const col = Col.of(c);
      const cell = GridOps.cellAt(grid, row, col);
      if (cell.black) {
        rowVms.push({
          row,
          col,
          black: true,
          letter: null,
          number: null,
          hilite: 'none',
          separatorRight: 'none',
          separatorBottom: 'none',
          selectable: false,
        });
      } else {
        const letter =
          whichLetter === 'answer'
            ? cell.answerLetter
              ? String(cell.answerLetter)
              : null
            : cell.playerLetter
              ? String(cell.playerLetter)
              : null;
        const number = wordStartNumber.get(cellKey(r, c)) ?? null;

        let hilite: CellHilite = 'none';
        if (cursor && cursor.row === row && cursor.col === col) {
          hilite = 'selected';
        } else if (selectedWordCells.has(cellKey(r, c))) {
          hilite = 'in-word';
        }

        rowVms.push({
          row,
          col,
          black: false,
          letter,
          number,
          hilite,
          separatorRight: deriveSeparatorRight(cell),
          separatorBottom: deriveSeparatorBottom(cell),
          selectable: GridOps.isSelectable(grid, row, col),
        });
      }
    }
    cells.push(rowVms);
  }

  return { size, cells, cursor };
}
