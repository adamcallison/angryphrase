import type { Grid } from '../../../domain/grid/Grid';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import type { Cell } from '../../../domain/grid/Cell';
import { CellMarker } from '../../../domain/grid/CellMarker';
import type { CellSeparator } from '../../../domain/grid/CellSeparator';
import { GridOps } from '../../../domain/grid/GridOps';
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

function deriveSeparatorRight(cell: Cell): CellSeparator {
  return CellMarker.read(cell.marker, 'right');
}

function deriveSeparatorBottom(cell: Cell): CellSeparator {
  return CellMarker.read(cell.marker, 'bottom');
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

  const cells: GridCellVM[][] = [];
  for (let r = 0; r < grid.length; r++) {
    const rowVms: GridCellVM[] = [];
    for (let c = 0; c < grid.length; c++) {
      const row = Row.of(r);
      const col = Col.of(c);
      const cell = GridOps.cellAt(grid, row, col);
      if (cell.black) {
        rowVms.push({
          row: r,
          col: c,
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
          row: r,
          col: c,
          black: false,
          letter,
          number,
          hilite,
          separatorRight: deriveSeparatorRight(cell),
          separatorBottom: deriveSeparatorBottom(cell),
          selectable: mask[r]?.[c] === true,
        });
      }
    }
    cells.push(rowVms);
  }

  return { size, cells, cursorRow, cursorCol, cursorDirection };
}
