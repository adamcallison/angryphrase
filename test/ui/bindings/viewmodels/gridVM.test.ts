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
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
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
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
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

    const answerVM = deriveGridVM({ grid: gridWithLetters, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(answerVM.cells[0]![0]!.letter).toBe('A');

    const playerVM = deriveGridVM({ grid: gridWithLetters, cursor: null, words: [], whichLetter: 'player', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(playerVM.cells[0]![0]!.letter).toBe('Z');
  });

  it('deriveGridVM: word-start cell receives WordNumber; cells not at a word start get null', () => {
    const grid = Grid.blank(GridSize.of(3));
    const words: Word[] = [wordAt0(), downWordAt0()];
    const vm = deriveGridVM({ grid, cursor: null, words, whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vm.cells[0]![0]!.number).toBe(1);
    expect(vm.cells[0]![1]!.number).toBeNull();
    expect(vm.cells[1]![0]!.number).toBeNull();
    expect(vm.cells[1]![1]!.number).toBeNull();
  });

  it('deriveGridVM: cursor cell → hilite=selected', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cursor: Cursor = { row: Row.of(0), col: Col.of(1), direction: 'across' };
    const vm = deriveGridVM({ grid, cursor, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vm.cells[0]![1]!.hilite).toBe('selected');
    expect(vm.cells[0]![0]!.hilite).toBe('none');
    expect(vm.cells[1]![0]!.hilite).toBe('none');
    expect(vm.cells[1]![1]!.hilite).toBe('none');
  });

  it('deriveGridVM: selectedWordCells (excluding cursor cell) → hilite=in-word', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cursor: Cursor = { row: Row.of(0), col: Col.of(0), direction: 'across' };
    const selectedWordCells = new Set(['0,1']);
    const vm = deriveGridVM({ grid, cursor, words: [], whichLetter: 'answer', selectedWordCells, typingFocusSeq: 0 });
    expect(vm.cells[0]![0]!.hilite).toBe('selected');
    expect(vm.cells[0]![1]!.hilite).toBe('in-word');
    expect(vm.cells[1]![0]!.hilite).toBe('none');
    expect(vm.cells[1]![1]!.hilite).toBe('none');
  });

  it('deriveGridVM: cursor null, no selectedWordCells, no checkResult → all hilites none (Builder clean state)', () => {
    const grid = Grid.blank(GridSize.of(2));
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        expect(vm.cells[r]![c]!.hilite).toBe('none');
      }
    }
  });

  it('deriveGridVM: cells beyond selectedWordCells are hilite=none', () => {
    const grid = Grid.blank(GridSize.of(3));
    const selectedWordCells = new Set(['0,0']);
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'player', selectedWordCells, typingFocusSeq: 0 });
    expect(vm.cells[0]![0]!.hilite).toBe('in-word');
    expect(vm.cells[1]![1]!.hilite).toBe('none');
  });

  it('deriveGridVM: separatorRight reflects marker.right', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cell = Grid.cellAt(grid, Row.of(0), Col.of(0));
    const markedSpace = Cell.setMarker(cell, CellMarker.write(cell.marker, 'right', 'space'));
    const gSpace = Grid.setCell(grid, Row.of(0), Col.of(0), markedSpace);
    const vmSpace = deriveGridVM({ grid: gSpace, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vmSpace.cells[0]![0]!.separatorRight).toBe('space');

    const cell2 = Cell.setMarker(cell, CellMarker.write(cell.marker, 'right', 'hyphen'));
    const gHyphen = Grid.setCell(grid, Row.of(0), Col.of(0), cell2);
    const vmHyphen = deriveGridVM({ grid: gHyphen, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vmHyphen.cells[0]![0]!.separatorRight).toBe('hyphen');
  });

  it('deriveGridVM: separatorBottom reflects marker.bottom', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cell = Grid.cellAt(grid, Row.of(0), Col.of(0));
    const markedSpace = Cell.setMarker(cell, CellMarker.write(cell.marker, 'bottom', 'space'));
    const gSpace = Grid.setCell(grid, Row.of(0), Col.of(0), markedSpace);
    const vmSpace = deriveGridVM({ grid: gSpace, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vmSpace.cells[0]![0]!.separatorBottom).toBe('space');

    const cell2 = Cell.setMarker(cell, CellMarker.write(cell.marker, 'bottom', 'hyphen'));
    const gHyphen = Grid.setCell(grid, Row.of(0), Col.of(0), cell2);
    const vmHyphen = deriveGridVM({ grid: gHyphen, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vmHyphen.cells[0]![0]!.separatorBottom).toBe('hyphen');
  });

  it('deriveGridVM: GridVM.size === grid.length; cells.length === size; cells[0].length === size (row-major)', () => {
    const grid = Grid.blank(GridSize.of(3));
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vm.size).toBe(grid.length);
    expect(vm.cells.length).toBe(grid.length);
    for (let r = 0; r < grid.length; r++) {
      expect(vm.cells[r]!.length).toBe(grid.length);
    }
  });

  it('deriveGridVM: typingFocusSeq passed through unchanged', () => {
    const grid = Grid.blank(GridSize.of(2));
    const vm0 = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vm0.typingFocusSeq).toBe(0);

    const vm7 = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 7 });
    expect(vm7.typingFocusSeq).toBe(7);
  });

  it('deriveGridVM: selectable matches WordTopology.isSelectable for white cells', () => {
    const grid = Grid.blank(GridSize.of(3));
    const g = Grid.setCell(grid, Row.of(1), Col.of(1), Cell.black());
    const vm = deriveGridVM({ grid: g, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
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
    const vm = deriveGridVM({ grid: g, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        expect(vm.cells[r]![c]!.selectable).toBe(WordTopology.isSelectable(g, Row.of(r), Col.of(c)));
      }
    }
  });

  it('deriveGridVM: white cell with letter → label "Row R, column C, letter X"', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cell = Grid.cellAt(grid, Row.of(0), Col.of(0));
    const answerLetter = Letter.try('C');
    expect(answerLetter).not.toBeNull();
    const gridWithLetter = Grid.setCell(grid, Row.of(0), Col.of(0), Cell.setAnswerLetter(cell, answerLetter!));
    const vm = deriveGridVM({ grid: gridWithLetter, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vm.cells[0]![0]!.label).toBe('Row 1, column 1, letter C');
  });

  it('deriveGridVM: white empty cell → label content clause "empty"', () => {
    const grid = Grid.blank(GridSize.of(2));
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vm.cells[0]![0]!.label).toBe('Row 1, column 1, empty');
  });

  it('deriveGridVM: black cell → label content clause "blocked" with no number/separator suffixes', () => {
    const grid = black2x2Grid();
    const vm = deriveGridVM({ grid, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vm.cells[0]![0]!.label).toBe('Row 1, column 1, blocked');
    expect(vm.cells[1]![1]!.label).toBe('Row 2, column 2, blocked');
  });

  it('deriveGridVM: cursor cell → label ends ", selected"; non-cursor cells do not contain "selected"', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cursor: Cursor = { row: Row.of(0), col: Col.of(1), direction: 'across' };
    const vm = deriveGridVM({ grid, cursor, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vm.cells[0]![1]!.label.endsWith(', selected')).toBe(true);
    expect(vm.cells[0]![1]!.label).toBe('Row 1, column 2, empty, selected');
    expect(vm.cells[0]![0]!.label.includes('selected')).toBe(false);
    expect(vm.cells[1]![0]!.label.includes('selected')).toBe(false);
    expect(vm.cells[1]![1]!.label.includes('selected')).toBe(false);
  });

  it('deriveGridVM: word-start cell → label contains ", word N start"', () => {
    const grid = Grid.blank(GridSize.of(3));
    const words: Word[] = [wordAt0()];
    const vm = deriveGridVM({ grid, cursor: null, words, whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vm.cells[0]![0]!.label.includes(', word 1 start')).toBe(true);
    expect(vm.cells[0]![0]!.label).toBe('Row 1, column 1, empty, word 1 start');
    expect(vm.cells[0]![1]!.label.includes('word')).toBe(false);
    expect(vm.cells[1]![1]!.label.includes('word')).toBe(false);
  });

  it('deriveGridVM: separatorRight space → ", space after"; hyphen → ", hyphen after"; separatorBottom space → ", space below"; hyphen → ", hyphen below"', () => {
    const grid = Grid.blank(GridSize.of(2));
    const cell = Grid.cellAt(grid, Row.of(0), Col.of(0));

    const gRightSpace = Grid.setCell(grid, Row.of(0), Col.of(0), Cell.setMarker(cell, CellMarker.write(cell.marker, 'right', 'space')));
    const vmRightSpace = deriveGridVM({ grid: gRightSpace, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vmRightSpace.cells[0]![0]!.label).toBe('Row 1, column 1, empty, space after');

    const gRightHyphen = Grid.setCell(grid, Row.of(0), Col.of(0), Cell.setMarker(cell, CellMarker.write(cell.marker, 'right', 'hyphen')));
    const vmRightHyphen = deriveGridVM({ grid: gRightHyphen, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vmRightHyphen.cells[0]![0]!.label).toBe('Row 1, column 1, empty, hyphen after');

    const gBottomSpace = Grid.setCell(grid, Row.of(0), Col.of(0), Cell.setMarker(cell, CellMarker.write(cell.marker, 'bottom', 'space')));
    const vmBottomSpace = deriveGridVM({ grid: gBottomSpace, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vmBottomSpace.cells[0]![0]!.label).toBe('Row 1, column 1, empty, space below');

    const gBottomHyphen = Grid.setCell(grid, Row.of(0), Col.of(0), Cell.setMarker(cell, CellMarker.write(cell.marker, 'bottom', 'hyphen')));
    const vmBottomHyphen = deriveGridVM({ grid: gBottomHyphen, cursor: null, words: [], whichLetter: 'answer', selectedWordCells: new Set(), typingFocusSeq: 0 });
    expect(vmBottomHyphen.cells[0]![0]!.label).toBe('Row 1, column 1, empty, hyphen below');
  });
});
