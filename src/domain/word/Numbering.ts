import type { Grid } from '../grid/Grid';
import type { DerivedWord } from './DerivedWord';
import type { Word } from './Word';
import { WordKey } from './WordKey';
import { WordNumber } from './WordNumber';

export const Numbering: {
  assign(grid: Grid, words: DerivedWord[]): Word[];
} = {
  assign(grid: Grid, words: DerivedWord[]): Word[] {
    const startCellMap = new Map<string, DerivedWord[]>();
    for (const word of words) {
      const key = `${word.key.startRow},${word.key.startCol}`;
      const existing = startCellMap.get(key) ?? [];
      const canonical = WordKey.toCanonical(word.key);
      if (!existing.some((w) => WordKey.toCanonical(w.key) === canonical)) {
        existing.push(word);
      }
      startCellMap.set(key, existing);
    }

    const numberByCanonical = new Map<string, WordNumber>();
    let counter = 0;

    const size = grid.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const key = `${r},${c}`;
        const cellWords = startCellMap.get(key);
        if (cellWords !== undefined && cellWords.length > 0) {
          counter++;
          const number = WordNumber.of(counter);
          for (const word of cellWords) {
            numberByCanonical.set(WordKey.toCanonical(word.key), number);
          }
        }
      }
    }

    const result = words.map((word) => {
      const number = numberByCanonical.get(WordKey.toCanonical(word.key));
      if (number === undefined) {
        throw new Error(`Numbering.assign: word ${WordKey.toCanonical(word.key)} has no start cell in the grid`);
      }
      return { ...word, number };
    });

    result.sort((a, b) => {
      const aRow = Number(a.key.startRow);
      const aCol = Number(a.key.startCol);
      const bRow = Number(b.key.startRow);
      const bCol = Number(b.key.startCol);
      if (aRow !== bRow) return aRow - bRow;
      if (aCol !== bCol) return aCol - bCol;
      if (a.key.direction === 'across' && b.key.direction === 'down') return -1;
      if (a.key.direction === 'down' && b.key.direction === 'across') return 1;
      return 0;
    });

    return result;
  },
};
