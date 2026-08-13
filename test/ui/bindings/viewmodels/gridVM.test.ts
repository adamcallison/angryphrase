import { describe, it, expect } from 'vitest';
import { deriveGridVM } from '../../../../src/ui/bindings/viewmodels/gridVM';
import { GridOps } from '../../../../src/domain/grid/GridOps';
import { GridSize } from '../../../../src/domain/grid/GridSize';
import { Row } from '../../../../src/domain/grid/Row';
import { Col } from '../../../../src/domain/grid/Col';
import { Cell } from '../../../../src/domain/grid/Cell';
import { CellMarker } from '../../../../src/domain/grid/CellMarker';
import { Letter } from '../../../../src/domain/letter/Letter';
import { WordNumber } from '../../../../src/domain/word/WordNumber';
import type { Word } from '../../../../src/domain/word/Word';
import type { Cursor } from '../../../../src/domain/grid/Cursor';
import type { Grid } from '../../../../src/domain/grid/Grid';

function black2x2Grid(): Grid {
  const grid = GridOps.blank(GridSize.of(2));
  return GridOps.setCell(
    GridOps.setCell(
      GridOps.setCell(
        GridOps.setCell(grid, Row.of(0), Col.of(0), Cell.black()),
        Row.of(0), Col.of(1), Cell.black()),
      Row.of(1), Col.of(0), Cell.black()),
    Row.of(1), Col.of(1), Cell.black());
}

function wordAt0(): Word {
  return {
    key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
    number: WordNumber.of(1),
    length: 2,
    clue: '',
    nextWord: null,
  };
}

function downWordAt0(): Word {
  return {
    key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'down' },
    number: WordNumber.of(1),
    length: 2,
    clue: '',
    nextWord: null,
  };
}

describe('deriveGridVM', () => {
  it('deriveGridVM: all-black custom grid — every cell black=true, letter=null, number=null, hilite=none, separators=none, selectable=false', () => {
    const grid = black2x2Grid();
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm.size).toBe(grid.length);
    expect(vm.cells).toHaveLength(2);
    for (let r = 0; r < 2; r++) {
      expect(vm.cells[r]).toHaveLength(2);
      for (let c = 0; c < 2; c++) {
        const cell = vm.cells[r]![c]!;
        expect(cell.row).toBe(Row.of(r));
        expect(cell.col).toBe(Col.of(c));
        expect(cell.black).toBe(true);
        expect(cell.letter).toBeNull();
        expect(cell.number).toBeNull();
        expect(cell.hilite).toBe('none');
        expect(cell.separatorRight).toBe('none');
        expect(cell.separatorBottom).toBe('none');
        expect(cell.selectable).toBe(false);
      }
    }
  });

  it('deriveGridVM: blank 2x2 grid (all white) → all cells white, no numbers, no separators, selectable per GridOps.isSelectable', () => {
    const grid = GridOps.blank(GridSize.of(2));
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm.cells).toHaveLength(2);
    for (let r = 0; r < 2; r++) {
      expect(vm.cells[r]).toHaveLength(2);
      for (let c = 0; c < 2; c++) {
        const cell = vm.cells[r]![c]!;
        expect(cell.black).toBe(false);
        expect(cell.letter).toBeNull();
        expect(cell.number).toBeNull();
        expect(cell.hilite).toBe('none');
        expect(cell.separatorRight).toBe('none');
        expect(cell.separatorBottom).toBe('none');
        expect(cell.selectable).toBe(GridOps.isSelectable(grid, Row.of(r), Col.of(c)));
      }
    }
  });

  it('deriveGridVM: whichLetter=answer pulls answerLetter; whichLetter=player pulls playerLetter', () => {
    const grid = GridOps.blank(GridSize.of(2));
    const cell = GridOps.cellAt(grid, Row.of(0), Col.of(0));
    const answerLetter = Letter.try('A');
    const playerLetter = Letter.try('Z');
    expect(answerLetter).not.toBeNull();
    expect(playerLetter).not.toBeNull();
    const updated = Cell.setAnswerLetter(Cell.setPlayerLetter(cell, playerLetter!), answerLetter!);
    const gridWithLetters = GridOps.setCell(grid, Row.of(0), Col.of(0), updated);

    const answerVM = deriveGridVM({ grid: gridWithLetters, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(answerVM.cells[0]![0]!.letter).toBe('A');

    const playerVM = deriveGridVM({ grid: gridWithLetters, cursor: null, words: [], whichLetter: 'player', selectedWordCells: new Set() });
    expect(playerVM.cells[0]![0]!.letter).toBe('Z');
  });

  it('deriveGridVM: word-start cell receives WordNumber; cells not at a word start get null', () => {
    const grid = GridOps.blank(GridSize.of(3));
    const words: Word[] = [wordAt0(), downWordAt0()];
    const vm = deriveGridVM({ grid, cursor: null, words, whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm.cells[0]![0]!.number).toBe(WordNumber.of(1));
    expect(vm.cells[0]![1]!.number).toBeNull();
    expect(vm.cells[1]![0]!.number).toBeNull();
    expect(vm.cells[1]![1]!.number).toBeNull();
  });

  it('deriveGridVM: cursor cell → hilite=selected', () => {
    const grid = GridOps.blank(GridSize.of(2));
    const cursor: Cursor = { row: Row.of(0), col: Col.of(1), direction: 'across' };
    const vm = deriveGridVM({ grid, cursor, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm.cells[0]![1]!.hilite).toBe('selected');
    expect(vm.cells[0]![0]!.hilite).toBe('none');
    expect(vm.cells[1]![0]!.hilite).toBe('none');
    expect(vm.cells[1]![1]!.hilite).toBe('none');
  });

  it('deriveGridVM: selectedWordCells (excluding cursor cell) → hilite=in-word', () => {
    const grid = GridOps.blank(GridSize.of(2));
    const cursor: Cursor = { row: Row.of(0), col: Col.of(0), direction: 'across' };
    const selectedWordCells = new Set(['0,1']);
    const vm = deriveGridVM({ grid, cursor, words: [], whichLetter: 'answer', selectedWordCells });
    expect(vm.cells[0]![0]!.hilite).toBe('selected');
    expect(vm.cells[0]![1]!.hilite).toBe('in-word');
    expect(vm.cells[1]![0]!.hilite).toBe('none');
    expect(vm.cells[1]![1]!.hilite).toBe('none');
  });

  it('deriveGridVM: cursor null, no selectedWordCells, no checkResult → all hilites none (Builder clean state)', () => {
    const grid = GridOps.blank(GridSize.of(2));
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        expect(vm.cells[r]![c]!.hilite).toBe('none');
      }
    }
  });

  it('deriveGridVM: cells beyond selectedWordCells are hilite=none', () => {
    const grid = GridOps.blank(GridSize.of(3));
    const selectedWordCells = new Set(['0,0']);
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'player', selectedWordCells });
    expect(vm.cells[0]![0]!.hilite).toBe('in-word');
    expect(vm.cells[1]![1]!.hilite).toBe('none');
  });

  it('deriveGridVM: separatorRight reflects marker.spaceRight and marker.hyphenRight (space takes priority)', () => {
    const grid = GridOps.blank(GridSize.of(2));
    const cell = GridOps.cellAt(grid, Row.of(0), Col.of(0));
    const markedSpace = Cell.setMarker(cell, CellMarker.toggle(cell.marker, 'space-right'));
    const gSpace = GridOps.setCell(grid, Row.of(0), Col.of(0), markedSpace);
    const vmSpace = deriveGridVM({ grid: gSpace, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vmSpace.cells[0]![0]!.separatorRight).toBe('space');

    const cell2 = Cell.setMarker(cell, CellMarker.toggle(cell.marker, 'hyphen-right'));
    const gHyphen = GridOps.setCell(grid, Row.of(0), Col.of(0), cell2);
    const vmHyphen = deriveGridVM({ grid: gHyphen, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vmHyphen.cells[0]![0]!.separatorRight).toBe('hyphen');
  });

  it('deriveGridVM: separatorBottom reflects marker.spaceBottom and marker.hyphenBottom', () => {
    const grid = GridOps.blank(GridSize.of(2));
    const cell = GridOps.cellAt(grid, Row.of(0), Col.of(0));
    const markedSpace = Cell.setMarker(cell, CellMarker.toggle(cell.marker, 'space-bottom'));
    const gSpace = GridOps.setCell(grid, Row.of(0), Col.of(0), markedSpace);
    const vmSpace = deriveGridVM({ grid: gSpace, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vmSpace.cells[0]![0]!.separatorBottom).toBe('space');

    const cell2 = Cell.setMarker(cell, CellMarker.toggle(cell.marker, 'hyphen-bottom'));
    const gHyphen = GridOps.setCell(grid, Row.of(0), Col.of(0), cell2);
    const vmHyphen = deriveGridVM({ grid: gHyphen, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vmHyphen.cells[0]![0]!.separatorBottom).toBe('hyphen');
  });

  it('deriveGridVM: GridVM.size === grid.length; cells.length === size; cells[0].length === size (row-major)', () => {
    const grid = GridOps.blank(GridSize.of(3));
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm.size).toBe(grid.length);
    expect(vm.cells.length).toBe(grid.length);
    for (let r = 0; r < grid.length; r++) {
      expect(vm.cells[r]!.length).toBe(grid.length);
    }
  });

  it('deriveGridVM: cursor echoed unchanged in returned VM (null, and a non-null sample)', () => {
    const grid = GridOps.blank(GridSize.of(2));
    const nullCursor: Cursor = null;
    const vm1 = deriveGridVM({ grid, cursor: nullCursor, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm1.cursor).toBeNull();

    const cursor: Cursor = { row: Row.of(1), col: Col.of(0), direction: 'down' };
    const vm2 = deriveGridVM({ grid, cursor, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm2.cursor).toEqual(cursor);
  });

  it('deriveGridVM: selectable matches GridOps.isSelectable for white cells', () => {
    const grid = GridOps.blank(GridSize.of(3));
    const g = GridOps.setCell(grid, Row.of(1), Col.of(1), Cell.black());
    const vm = deriveGridVM({ grid: g, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const expected = GridOps.isSelectable(g, Row.of(r), Col.of(c));
        expect(vm.cells[r]![c]!.selectable).toBe(expected);
      }
    }
  });
});
