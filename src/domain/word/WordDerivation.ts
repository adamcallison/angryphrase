import type { Grid } from '../grid/Grid';
import type { DerivedWord } from './DerivedWord';
import type { WordKey } from './WordKey';
import type { Direction } from './Direction';
import { Row as RowCtor } from '../grid/Row';
import { Col as ColCtor } from '../grid/Col';
import { Cell as CellCtor } from '../grid/Cell';

function isWhite(g: Grid, r: number, c: number): boolean {
  const row = g[r];
  if (row === undefined) return false;
  const cell = row[c];
  if (cell === undefined) return false;
  return CellCtor.isWhite(cell);
}

function deriveDirection(g: Grid, direction: Direction): DerivedWord[] {
  const size = g.length;
  const words: DerivedWord[] = [];

  for (let i = 0; i < size; i++) {
    let j = 0;
    while (j < size) {
      const r = direction === 'across' ? i : j;
      const c = direction === 'across' ? j : i;

      const startsRun =
        isWhite(g, r, c) &&
        (direction === 'across'
          ? c === 0 || !isWhite(g, r, c - 1)
          : r === 0 || !isWhite(g, r - 1, c));

      if (startsRun) {
        let length = 0;
        let cr = r;
        let cc = c;
        while (isWhite(g, cr, cc)) {
          length++;
          if (direction === 'across') {
            cc++;
          } else {
            cr++;
          }
        }
        if (length >= 2) {
          const key: WordKey = {
            startRow: RowCtor.of(r),
            startCol: ColCtor.of(c),
            direction,
          };
          words.push({
            key,
            length,
            clue: '',
            nextWord: null,
          });
        }
        j += length;
      } else {
        j++;
      }
    }
  }

  return words;
}

export const WordDerivation: {
  derive(grid: Grid): DerivedWord[];
} = {
  derive(grid: Grid): DerivedWord[] {
    return [...deriveDirection(grid, 'across'), ...deriveDirection(grid, 'down')];
  },
};
