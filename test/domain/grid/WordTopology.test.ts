import { describe, expect, it } from 'vitest';
import { Cell } from '../../../src/domain/grid/Cell';
import type { Cell as CellType } from '../../../src/domain/grid/Cell';
import { Col } from '../../../src/domain/grid/Col';
import { Grid } from '../../../src/domain/grid/Grid';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { Row } from '../../../src/domain/grid/Row';
import type { WordRun } from '../../../src/domain/grid/WordTopology';
import { WordTopology } from '../../../src/domain/grid/WordTopology';
import type { Direction } from '../../../src/domain/word/Direction';

describe('WordTopology', () => {
  function blankGrid(size: number): Grid {
    return Grid.blank(GridSize.of(size));
  }

  function setCell(g: Grid, row: number, col: number, cell: CellType): Grid {
    return Grid.setCell(g, Row.of(row), Col.of(col), cell);
  }

  function setBlack(g: Grid, row: number, col: number): Grid {
    return setCell(g, row, col, Cell.black());
  }

  describe('runs', () => {
    function run(
      startRow: number,
      startCol: number,
      length: number,
      direction: Direction
    ): WordRun {
      return {
        startRow: Row.of(startRow),
        startCol: Col.of(startCol),
        length,
        direction,
      };
    }

    describe('runs(g, "across")', () => {
      it('all-white 3x3 returns 3 runs, each length 3, starting at column 0', () => {
        const g = blankGrid(3);
        const runs = WordTopology.runs(g, 'across');
        expect(runs).toEqual([
          run(0, 0, 3, 'across'),
          run(1, 0, 3, 'across'),
          run(2, 0, 3, 'across'),
        ]);
      });

      it('all-black 3x3 returns 0 runs', () => {
        let g = blankGrid(3);
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            g = setBlack(g, r, c);
          }
        }
        expect(WordTopology.runs(g, 'across')).toEqual([]);
      });

      it('isolated single white cell at (1,1) returns one across run of length 1', () => {
        let g = blankGrid(3);
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if (r !== 1 || c !== 1) {
              g = setBlack(g, r, c);
            }
          }
        }
        expect(WordTopology.runs(g, 'across')).toEqual([run(1, 1, 1, 'across')]);
      });

      it('5-cell across row with neighbouring rows black returns one run of length 5', () => {
        let g = blankGrid(5);
        for (let r = 0; r < 5; r++) {
          if (r !== 2) {
            for (let c = 0; c < 5; c++) {
              g = setBlack(g, r, c);
            }
          }
        }
        expect(WordTopology.runs(g, 'across')).toEqual([run(2, 0, 5, 'across')]);
      });

      it('two separate runs on the same row separated by a black column returns 2 runs', () => {
        let g = blankGrid(5);
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            if (r !== 1 || c === 2) {
              g = setBlack(g, r, c);
            }
          }
        }
        const runs = WordTopology.runs(g, 'across');
        expect(runs).toEqual([run(1, 0, 2, 'across'), run(1, 3, 2, 'across')]);
      });

      it('a white run interrupted by a black cell mid-row returns 2 runs with expected lengths', () => {
        let g = blankGrid(5);
        g = setBlack(g, 1, 2);
        const runs = WordTopology.runs(g, 'across');
        expect(runs).toContainEqual(run(1, 0, 2, 'across'));
        expect(runs).toContainEqual(run(1, 3, 2, 'across'));
      });

      it('runs are maximal — bounded by black cells or grid edges', () => {
        let g = blankGrid(5);
        g = setBlack(g, 1, 0);
        g = setBlack(g, 1, 4);
        const runs = WordTopology.runs(g, 'across');
        expect(runs).toContainEqual(run(1, 1, 3, 'across'));
      });

      it('every returned across run has correct startRow, startCol, length, and direction', () => {
        let g = blankGrid(4);
        g = setBlack(g, 1, 0);
        g = setBlack(g, 1, 3);
        const runs = WordTopology.runs(g, 'across');
        for (const r of runs) {
          expect(r.direction).toBe('across');
          expect(r.length).toBeGreaterThanOrEqual(1);
          expect(Cell.isWhite(Grid.cellAt(g, r.startRow, r.startCol))).toBe(true);
          const leftCol = Number(r.startCol) - 1;
          if (leftCol >= 0) {
            expect(Cell.isWhite(Grid.cellAt(g, r.startRow, Col.of(leftCol)))).toBe(false);
          }
          let whites = 0;
          let c = Number(r.startCol);
          while (
            c < g.length &&
            Cell.isWhite(Grid.cellAt(g, r.startRow, Col.of(c)))
          ) {
            whites++;
            c++;
          }
          expect(r.length).toBe(whites);
          if (c < g.length) {
            expect(Cell.isWhite(Grid.cellAt(g, r.startRow, Col.of(c)))).toBe(false);
          }
        }
      });
    });

    describe('runs(g, "down")', () => {
      it('all-white 3x3 returns 3 down runs, each length 3', () => {
        const g = blankGrid(3);
        expect(WordTopology.runs(g, 'down')).toEqual([
          run(0, 0, 3, 'down'),
          run(0, 1, 3, 'down'),
          run(0, 2, 3, 'down'),
        ]);
      });

      it('vertical isolated white cell returns one down run of length 1', () => {
        let g = blankGrid(3);
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if (r !== 1 || c !== 1) {
              g = setBlack(g, r, c);
            }
          }
        }
        expect(WordTopology.runs(g, 'down')).toEqual([run(1, 1, 1, 'down')]);
      });

      it('5-cell down column returns one run of length 5', () => {
        let g = blankGrid(5);
        for (let c = 0; c < 5; c++) {
          if (c !== 2) {
            for (let r = 0; r < 5; r++) {
              g = setBlack(g, r, c);
            }
          }
        }
        expect(WordTopology.runs(g, 'down')).toEqual([run(0, 2, 5, 'down')]);
      });

      it('mixed grid contains only vertical down runs, not horizontal across runs', () => {
        let g = blankGrid(3);
        g = setBlack(g, 1, 2);
        for (let r = 0; r < 3; r++) {
          if (r !== 1) {
            for (let c = 0; c < 3; c++) {
              g = setBlack(g, r, c);
            }
          }
        }
        const runs = WordTopology.runs(g, 'down');
        expect(runs.every((r) => r.direction === 'down')).toBe(true);
        expect(runs.some((r) => r.length > 1)).toBe(false);
        expect(runs).toHaveLength(2);
      });
    });

    describe('runs immutability', () => {
      it('does not mutate the input grid or its row arrays', () => {
        const g = blankGrid(3);
        const rows = g.map((row) => row);
        const snapshot = structuredClone(g);
        WordTopology.runs(g, 'across');
        WordTopology.runs(g, 'down');
        expect(g).toEqual(snapshot);
        for (let i = 0; i < g.length; i++) {
          expect(g[i]).toBe(rows[i]);
        }
      });
    });
  });

  describe('partOfRun', () => {
    it('cell in an across run of length 3 with no vertical whites is true for across, false for down', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 0);
      g = setBlack(g, 0, 1);
      g = setBlack(g, 0, 2);
      g = setBlack(g, 2, 0);
      g = setBlack(g, 2, 1);
      g = setBlack(g, 2, 2);
      const r = Row.of(1);
      const c = Col.of(1);
      expect(WordTopology.partOfRun(g, r, c, 'across')).toBe(true);
      expect(WordTopology.partOfRun(g, r, c, 'down')).toBe(false);
    });

    it('cell in a down run of length 4 with no horizontal whites is true for down, false for across', () => {
      let g = blankGrid(4);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (c !== 1) {
            g = setBlack(g, r, c);
          }
        }
      }
      const r = Row.of(2);
      const c = Col.of(1);
      expect(WordTopology.partOfRun(g, r, c, 'down')).toBe(true);
      expect(WordTopology.partOfRun(g, r, c, 'across')).toBe(false);
    });

    it('cell that is part of both an across run and a down run of length at least 2 is true in both directions', () => {
      const g = blankGrid(3);
      const r = Row.of(1);
      const c = Col.of(1);
      expect(WordTopology.partOfRun(g, r, c, 'across')).toBe(true);
      expect(WordTopology.partOfRun(g, r, c, 'down')).toBe(true);
    });

    it('isolated single white cell with all orthogonal neighbours black is false in both directions', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 1);
      g = setBlack(g, 1, 0);
      g = setBlack(g, 1, 2);
      g = setBlack(g, 2, 1);
      const r = Row.of(1);
      const c = Col.of(1);
      expect(WordTopology.partOfRun(g, r, c, 'across')).toBe(false);
      expect(WordTopology.partOfRun(g, r, c, 'down')).toBe(false);
    });

    it('black cell returns false in both directions', () => {
      const g = setBlack(blankGrid(3), 1, 1);
      const r = Row.of(1);
      const c = Col.of(1);
      expect(WordTopology.partOfRun(g, r, c, 'across')).toBe(false);
      expect(WordTopology.partOfRun(g, r, c, 'down')).toBe(false);
    });

    it('out-of-bounds coords return false without throwing', () => {
      const g = blankGrid(3);
      expect(WordTopology.partOfRun(g, -1 as Row, Col.of(0), 'across')).toBe(false);
      expect(WordTopology.partOfRun(g, Row.of(0), -1 as Col, 'across')).toBe(false);
      expect(WordTopology.partOfRun(g, Row.of(3), Col.of(0), 'down')).toBe(false);
      expect(WordTopology.partOfRun(g, Row.of(0), Col.of(3), 'down')).toBe(false);
    });

    it('cell at the start of an across run returns true for across', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 0);
      g = setBlack(g, 0, 1);
      g = setBlack(g, 0, 2);
      g = setBlack(g, 2, 0);
      g = setBlack(g, 2, 1);
      g = setBlack(g, 2, 2);
      expect(WordTopology.partOfRun(g, Row.of(1), Col.of(0), 'across')).toBe(true);
    });

    it('cell at the end of an across run returns true for across', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 0);
      g = setBlack(g, 0, 1);
      g = setBlack(g, 0, 2);
      g = setBlack(g, 2, 0);
      g = setBlack(g, 2, 1);
      g = setBlack(g, 2, 2);
      expect(WordTopology.partOfRun(g, Row.of(1), Col.of(2), 'across')).toBe(true);
    });

    it('cell at the start of a down run returns true for down', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 0);
      g = setBlack(g, 0, 2);
      g = setBlack(g, 1, 0);
      g = setBlack(g, 1, 2);
      g = setBlack(g, 2, 0);
      g = setBlack(g, 2, 2);
      expect(WordTopology.partOfRun(g, Row.of(0), Col.of(1), 'down')).toBe(true);
    });

    it('both cells of a length-2 across run return true for across', () => {
      let g = blankGrid(3);
      g = setBlack(g, 1, 2);
      for (let r = 0; r < 3; r++) {
        if (r !== 1) {
          for (let c = 0; c < 3; c++) {
            g = setBlack(g, r, c);
          }
        }
      }
      expect(WordTopology.partOfRun(g, Row.of(1), Col.of(0), 'across')).toBe(true);
      expect(WordTopology.partOfRun(g, Row.of(1), Col.of(1), 'across')).toBe(true);
    });

    it('cell in a length-2 down run but a length-1 across run is false for across and true for down', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 0);
      g = setBlack(g, 0, 2);
      g = setBlack(g, 1, 0);
      g = setBlack(g, 1, 2);
      g = setBlack(g, 2, 0);
      g = setBlack(g, 2, 2);
      expect(WordTopology.partOfRun(g, Row.of(0), Col.of(1), 'across')).toBe(false);
      expect(WordTopology.partOfRun(g, Row.of(0), Col.of(1), 'down')).toBe(true);
    });
  });

  describe('isSelectable', () => {
    it('WordTopology.isSelectable returns false for a black cell', () => {
      const g = setBlack(blankGrid(3), 1, 1);
      expect(WordTopology.isSelectable(g, Row.of(1), Col.of(1))).toBe(false);
    });

    it('WordTopology.isSelectable returns false for an isolated white cell (no neighbours)', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 0);
      g = setBlack(g, 0, 1);
      g = setBlack(g, 0, 2);
      g = setBlack(g, 1, 0);
      g = setBlack(g, 1, 2);
      g = setBlack(g, 2, 0);
      g = setBlack(g, 2, 1);
      g = setBlack(g, 2, 2);

      expect(Cell.isWhite(Grid.cellAt(g, Row.of(1), Col.of(1)))).toBe(true);
      expect(WordTopology.isSelectable(g, Row.of(1), Col.of(1))).toBe(false);
    });

    it('WordTopology.isSelectable returns true for a white cell in a horizontal run of length 2', () => {
      let g = blankGrid(3);
      g = setBlack(g, 1, 0);
      g = setBlack(g, 1, 2);

      expect(WordTopology.isSelectable(g, Row.of(1), Col.of(1))).toBe(true);
    });

    it('WordTopology.isSelectable returns true for a white cell in a vertical run of length 2', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 1);
      g = setBlack(g, 2, 1);

      expect(WordTopology.isSelectable(g, Row.of(1), Col.of(1))).toBe(true);
    });

    it('WordTopology.isSelectable returns false for a white cell only in a 1-length (singleton)', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 1);
      g = setBlack(g, 1, 0);
      g = setBlack(g, 1, 2);
      g = setBlack(g, 2, 1);

      expect(Cell.isWhite(Grid.cellAt(g, Row.of(1), Col.of(1)))).toBe(true);
      expect(WordTopology.isSelectable(g, Row.of(1), Col.of(1))).toBe(false);
    });

    it('WordTopology.isSelectable returns true for the end cell of a run (still part of a length-≥2 run)', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 0);
      g = setBlack(g, 0, 1);
      g = setBlack(g, 0, 2);
      g = setBlack(g, 1, 1);
      g = setBlack(g, 1, 2);
      g = setBlack(g, 2, 1);
      g = setBlack(g, 2, 2);

      expect(WordTopology.isSelectable(g, Row.of(1), Col.of(0))).toBe(true);
      expect(WordTopology.isSelectable(g, Row.of(2), Col.of(0))).toBe(true);
    });

    it('WordTopology.isSelectable returns false for out-of-bounds coordinates without throwing', () => {
      const g = blankGrid(3);
      expect(WordTopology.isSelectable(g, -1 as Row, Col.of(0))).toBe(false);
      expect(WordTopology.isSelectable(g, Row.of(0), -1 as Col)).toBe(false);
      expect(WordTopology.isSelectable(g, Row.of(3), Col.of(0))).toBe(false);
      expect(WordTopology.isSelectable(g, Row.of(0), Col.of(3))).toBe(false);
    });
  });

  describe('partOfRunMask', () => {
    it('WordTopology.partOfRunMask returns a mask aligned with the grid', () => {
      const g = blankGrid(3);
      const mask = WordTopology.partOfRunMask(g);
      expect(mask.length).toBe(g.length);
      for (let r = 0; r < g.length; r++) {
        expect(mask[r]).toHaveLength(g[r]!.length);
      }
    });

    it('WordTopology.partOfRunMask agrees with partOfRun on every cell', () => {
      const allWhite3 = blankGrid(3);

      let withBlack = blankGrid(3);
      withBlack = setBlack(withBlack, 1, 1);

      let isolated = blankGrid(3);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (r !== 1 || c !== 1) {
            isolated = setBlack(isolated, r, c);
          }
        }
      }

      const grids = [allWhite3, withBlack, isolated];
      for (const g of grids) {
        const mask = WordTopology.partOfRunMask(g);
        for (let r = 0; r < g.length; r++) {
          for (let c = 0; c < g.length; c++) {
            const expected =
              WordTopology.partOfRun(g, Row.of(r), Col.of(c), 'across') ||
              WordTopology.partOfRun(g, Row.of(r), Col.of(c), 'down');
            expect(mask[r]![c]).toBe(expected);
          }
        }
      }
    });

    it('WordTopology.partOfRunMask marks the cells of a length-2 run', () => {
      let g = blankGrid(3);
      g = setBlack(g, 1, 2);
      for (let r = 0; r < 3; r++) {
        if (r !== 1) {
          for (let c = 0; c < 3; c++) {
            g = setBlack(g, r, c);
          }
        }
      }
      const mask = WordTopology.partOfRunMask(g);
      expect(mask[1]![0]).toBe(true);
      expect(mask[1]![1]).toBe(true);
    });

    it('WordTopology.partOfRunMask leaves black cells and isolated cells false', () => {
      let g = blankGrid(3);
      g = setBlack(g, 0, 1);
      g = setBlack(g, 1, 0);
      g = setBlack(g, 1, 2);
      g = setBlack(g, 2, 1);
      const mask = WordTopology.partOfRunMask(g);
      expect(mask[1]![1]).toBe(false);
      expect(mask[0]![0]).toBe(false);
      expect(mask[0]![2]).toBe(false);
      expect(mask[2]![0]).toBe(false);
      expect(mask[2]![2]).toBe(false);
    });
  });
});
