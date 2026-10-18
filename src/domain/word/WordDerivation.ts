import type { Grid } from '../grid/Grid';
import type { DerivedWord } from './DerivedWord';
import { WordLength } from './WordLength';
import { WordTopology } from '../grid/WordTopology';

export const WordDerivation: {
  derive(grid: Grid): DerivedWord[];
} = {
  derive(grid: Grid): DerivedWord[] {
    return [...WordTopology.runs(grid, 'across'), ...WordTopology.runs(grid, 'down')]
      .filter((run) => run.length >= 2)
      .map((run) => ({
        key: {
          startRow: run.startRow,
          startCol: run.startCol,
          direction: run.direction,
        },
        length: WordLength.of(run.length),
        clue: '',
        nextWord: null,
      }));
  },
};
