import { describe, it, expect } from 'vitest';
import { deriveGridVM } from '../../../../src/ui/bindings/viewmodels/gridVM';
import { Grid } from '../../../../src/domain/grid/Grid';
import { WordTopology } from '../../../../src/domain/grid/WordTopology';
import { GridSize } from '../../../../src/domain/grid/GridSize';
import { Row } from '../../../../src/domain/grid/Row';
import { Col } from '../../../../src/domain/grid/Col';
import { Cell } from '../../../../src/domain/grid/Cell';
import { CellMarker } from '../../../../src/domain/grid/CellMarker';
import { Letter } from '../../../../src/domain/letter/Letter';
import { WordNumber } from '../../../../src/domain/word/WordNumber';
import { WordLength } from '../../../../src/domain/word/WordLength';
import type { Word } from '../../../../src/domain/word/Word';
import type { Cursor } from '../../../../src/domain/grid/Cursor';

function black2x2Grid(): Grid {
  const grid = Grid.blank(GridSize.of(2));
  return Grid.setCell(
    Grid.setCell(
      Grid.setCell(
        Grid.setCell(grid, Row.of(0), Col.of(0), Cell.black()),
        Row.of(0), Col.of(1), Cell.black()),
      Row.of(1), Col.of(0), Cell.black()),
    Row.of(1), Col.of(1), Cell.black());
}

function wordAt0(): Word {
  return {
    key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
    number: WordNumber.of(1),
    length: WordLength.of(2),
    clue: '',
    nextWord: null,
  };
}

function downWordAt0(): Word {
  return {
    key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'down' },
    number: WordNumber.of(1),
    length: WordLength.of(2),
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
        expect(cell.row).toBe(r);
        expect(cell.col).toBe(c);
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

  it('deriveGridVM: blank 2x2 grid (all white) → all cells white, no numbers, no separators, selectable per WordTopology.isSelectable', () => {
    const grid = Grid.blank(GridSize.of(2));
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
        expect(cell.selectable).toBe(WordTopology.isSelectable(grid, Row.of(r), Col.of(c)));
      }
    }
  });

  it('deriveGridVM: whichLetter=answer pulls answerLetter; whichLetter=player pulls playerLetter', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cell = Grid.cellAt(grid, Row.of(0), Col.of(0));
    const answerLetter = Letter.try('A');
    const playerLetter = Letter.try('Z');
    expect(answerLetter).not.toBeNull();
    expect(playerLetter).not.toBeNull();
    const updated = Cell.setAnswerLetter(Cell.setPlayerLetter(cell, playerLetter!), answerLetter!);
    const gridWithLetters = Grid.setCell(grid, Row.of(0), Col.of(0), updated);

    const answerVM = deriveGridVM({ grid: gridWithLetters, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(answerVM.cells[0]![0]!.letter).toBe('A');

    const playerVM = deriveGridVM({ grid: gridWithLetters, cursor: null, words: [], whichLetter: 'player', selectedWordCells: new Set() });
    expect(playerVM.cells[0]![0]!.letter).toBe('Z');
  });

  it('deriveGridVM: word-start cell receives WordNumber; cells not at a word start get null', () => {
    const grid = Grid.blank(GridSize.of(3));
    const words: Word[] = [wordAt0(), downWordAt0()];
    const vm = deriveGridVM({ grid, cursor: null, words, whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm.cells[0]![0]!.number).toBe(1);
    expect(vm.cells[0]![1]!.number).toBeNull();
    expect(vm.cells[1]![0]!.number).toBeNull();
    expect(vm.cells[1]![1]!.number).toBeNull();
  });

  it('deriveGridVM: cursor cell → hilite=selected', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cursor: Cursor = { row: Row.of(0), col: Col.of(1), direction: 'across' };
    const vm = deriveGridVM({ grid, cursor, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm.cells[0]![1]!.hilite).toBe('selected');
    expect(vm.cells[0]![0]!.hilite).toBe('none');
    expect(vm.cells[1]![0]!.hilite).toBe('none');
    expect(vm.cells[1]![1]!.hilite).toBe('none');
  });

  it('deriveGridVM: selectedWordCells (excluding cursor cell) → hilite=in-word', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cursor: Cursor = { row: Row.of(0), col: Col.of(0), direction: 'across' };
    const selectedWordCells = new Set(['0,1']);
    const vm = deriveGridVM({ grid, cursor, words: [], whichLetter: 'answer', selectedWordCells });
    expect(vm.cells[0]![0]!.hilite).toBe('selected');
    expect(vm.cells[0]![1]!.hilite).toBe('in-word');
    expect(vm.cells[1]![0]!.hilite).toBe('none');
    expect(vm.cells[1]![1]!.hilite).toBe('none');
  });

  it('deriveGridVM: cursor null, no selectedWordCells, no checkResult → all hilites none (Builder clean state)', () => {
    const grid = Grid.blank(GridSize.of(2));
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        expect(vm.cells[r]![c]!.hilite).toBe('none');
      }
    }
  });

  it('deriveGridVM: cells beyond selectedWordCells are hilite=none', () => {
    const grid = Grid.blank(GridSize.of(3));
    const selectedWordCells = new Set(['0,0']);
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'player', selectedWordCells });
    expect(vm.cells[0]![0]!.hilite).toBe('in-word');
    expect(vm.cells[1]![1]!.hilite).toBe('none');
  });

  it('deriveGridVM: separatorRight reflects marker.right', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cell = Grid.cellAt(grid, Row.of(0), Col.of(0));
    const markedSpace = Cell.setMarker(cell, CellMarker.write(cell.marker, 'right', 'space'));
    const gSpace = Grid.setCell(grid, Row.of(0), Col.of(0), markedSpace);
    const vmSpace = deriveGridVM({ grid: gSpace, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vmSpace.cells[0]![0]!.separatorRight).toBe('space');

    const cell2 = Cell.setMarker(cell, CellMarker.write(cell.marker, 'right', 'hyphen'));
    const gHyphen = Grid.setCell(grid, Row.of(0), Col.of(0), cell2);
    const vmHyphen = deriveGridVM({ grid: gHyphen, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vmHyphen.cells[0]![0]!.separatorRight).toBe('hyphen');
  });

  it('deriveGridVM: separatorBottom reflects marker.bottom', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cell = Grid.cellAt(grid, Row.of(0), Col.of(0));
    const markedSpace = Cell.setMarker(cell, CellMarker.write(cell.marker, 'bottom', 'space'));
    const gSpace = Grid.setCell(grid, Row.of(0), Col.of(0), markedSpace);
    const vmSpace = deriveGridVM({ grid: gSpace, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vmSpace.cells[0]![0]!.separatorBottom).toBe('space');

    const cell2 = Cell.setMarker(cell, CellMarker.write(cell.marker, 'bottom', 'hyphen'));
    const gHyphen = Grid.setCell(grid, Row.of(0), Col.of(0), cell2);
    const vmHyphen = deriveGridVM({ grid: gHyphen, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vmHyphen.cells[0]![0]!.separatorBottom).toBe('hyphen');
  });

  it('deriveGridVM: GridVM.size === grid.length; cells.length === size; cells[0].length === size (row-major)', () => {
    const grid = Grid.blank(GridSize.of(3));
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm.size).toBe(grid.length);
    expect(vm.cells.length).toBe(grid.length);
    for (let r = 0; r < grid.length; r++) {
      expect(vm.cells[r]!.length).toBe(grid.length);
    }
  });

  it('deriveGridVM: the cursor fields are plain numbers and null when there is no cursor', () => {
    const grid = Grid.blank(GridSize.of(2));
    const vm1 = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm1.cursorRow).toBeNull();
    expect(vm1.cursorCol).toBeNull();
    expect(vm1.cursorDirection).toBeNull();

    const cursor: Cursor = { row: Row.of(1), col: Col.of(0), direction: 'down' };
    const vm2 = deriveGridVM({ grid, cursor, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vm2.cursorRow).toBe(1);
    expect(vm2.cursorCol).toBe(0);
  });

  it('deriveGridVM: the cursor direction is carried through as a plain value', () => {
    const grid = Grid.blank(GridSize.of(2));
    const across: Cursor = { row: Row.of(0), col: Col.of(0), direction: 'across' };
    const vmAcross = deriveGridVM({ grid, cursor: across, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vmAcross.cursorDirection).toBe('across');

    const down: Cursor = { row: Row.of(0), col: Col.of(0), direction: 'down' };
    const vmDown = deriveGridVM({ grid, cursor: down, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    expect(vmDown.cursorDirection).toBe('down');
  });

  it('deriveGridVM: selectable matches WordTopology.isSelectable for white cells', () => {
    const grid = Grid.blank(GridSize.of(3));
    const g = Grid.setCell(grid, Row.of(1), Col.of(1), Cell.black());
    const vm = deriveGridVM({ grid: g, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const expected = WordTopology.isSelectable(g, Row.of(r), Col.of(c));
        expect(vm.cells[r]![c]!.selectable).toBe(expected);
      }
    }
  });

  it('deriveGridVM: selectable matches WordTopology.isSelectable for every cell', () => {
    const grid = Grid.blank(GridSize.of(3));
    const g = Grid.setCell(grid, Row.of(1), Col.of(1), Cell.black());
    const vm = deriveGridVM({ grid: g, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set() });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        expect(vm.cells[r]![c]!.selectable).toBe(WordTopology.isSelectable(g, Row.of(r), Col.of(c)));
      }
    }
  });
});
