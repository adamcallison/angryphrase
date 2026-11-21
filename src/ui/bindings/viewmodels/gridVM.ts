import type { Grid } from '../../../domain/grid/Grid';
import { CellMarker } from '../../../domain/grid/CellMarker';
import type { CellSeparator } from '../../../domain/grid/CellSeparator';
import { cellKey } from '../../../domain/grid/CellKey';
import { WordTopology } from '../../../domain/grid/WordTopology';
import type { Word } from '../../../domain/word/Word';
import type { Cursor } from '../../../domain/grid/Cursor';

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
  label: string;
};

export type GridVM = {
  size: number;
  cells: GridCellVM[][];
  typingFocusSeq: number;
  cursorAnnouncement: string;
};

export function deriveGridVM(input: {
  grid: Grid;
  cursor: Cursor;
  words: Word[];
  whichLetter: 'answer' | 'player';
  selectedWordCells: ReadonlySet<string>;
  typingFocusSeq: number;
}): GridVM {
  const { grid, cursor, words, whichLetter, selectedWordCells, typingFocusSeq } = input;
  const runCells = WordTopology.partOfRunCells(grid);
  const size = grid.length;
  const wordStartNumber = new Map<string, number>();
  for (const word of words) {
    const key = cellKey(Number(word.key.startRow), Number(word.key.startCol));
    wordStartNumber.set(key, Number(word.number));
  }

  let cursorAnnouncement = '';

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

      const isCursorCell =
        cursor !== null && Number(cursor.row) === r && Number(cursor.col) === c;

      const hilite: CellHilite = black
        ? 'none'
        : isCursorCell
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

      const selectable = black ? false : runCells.has(key);

      const content = black ? 'blocked' : letter !== null ? `letter ${letter}` : 'empty';
      if (isCursorCell) cursorAnnouncement = `row ${r + 1}, column ${c + 1}, ${content}`;
      const labelParts: string[] = [`Row ${r + 1}, column ${c + 1}, ${content}`];
      if (number !== null) labelParts.push(`word ${number} start`);
      if (separatorRight === 'space') labelParts.push('space after');
      else if (separatorRight === 'hyphen') labelParts.push('hyphen after');
      if (separatorBottom === 'space') labelParts.push('space below');
      else if (separatorBottom === 'hyphen') labelParts.push('hyphen below');
      if (hilite === 'selected') labelParts.push('selected');

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
        label: labelParts.join(', '),
      };
    }),
  );

  return { size, cells, typingFocusSeq, cursorAnnouncement };
}
