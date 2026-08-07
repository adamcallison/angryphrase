import { describe, it, expect } from 'vitest';
import {
  deriveBuilderToolbarVM,
  deriveDisplacedCluesPanelVM,
  deriveBuilderSubModeBannerVM,
  deriveBuilderShellVM,
} from '../../../../src/ui/bindings/viewmodels/builderVM';
import { BuilderState } from '../../../../src/builder/state/state';
import type { Cursor, BuilderMode, BuilderSubMode } from '../../../../src/builder/state/state';
import { GridSize } from '../../../../src/domain/grid/GridSize';
import { GridOps } from '../../../../src/domain/grid/GridOps';
import { Row } from '../../../../src/domain/grid/Row';
import { Col } from '../../../../src/domain/grid/Col';
import { Cell } from '../../../../src/domain/grid/Cell';
import { CellMarker, type CellMarker as CellMarkerType } from '../../../../src/domain/grid/CellMarker';
import { Letter } from '../../../../src/domain/letter/Letter';
import { CompletenessCheck } from '../../../../src/domain/puzzle/CompletenessCheck';
import { Puzzle } from '../../../../src/domain/puzzle/Puzzle';
import { PuzzleKey } from '../../../../src/domain/puzzle/PuzzleKey';
import { Title } from '../../../../src/domain/puzzle/Title';
import { Author } from '../../../../src/domain/puzzle/Author';
import { WordKey } from '../../../../src/domain/word/WordKey';
import { WordNumber } from '../../../../src/domain/word/WordNumber';
import type { Direction } from '../../../../src/domain/word/Direction';
import type { Word } from '../../../../src/domain/word/Word';
import { DisplacedClue } from '../../../../src/domain/builder/DisplacedClue';
import type { DisplacedClue as DisplacedClueType } from '../../../../src/domain/builder/DisplacedClue';
import { SeededRng } from '../../../fakes/SeededRng';
import type { Grid } from '../../../../src/domain/grid/Grid';

function makeKey(): PuzzleKey {
  return PuzzleKey.try('00000000-0000-4000-8000-000000000000')!;
}

function makeBlankState(size: number) {
  return BuilderState.blank(GridSize.of(size), makeKey());
}

function stateWithGrid(state: BuilderState, grid: Grid): BuilderState {
  return { ...state, puzzle: Puzzle.withGrid(state.puzzle, grid) };
}

function stateWithAnswerLetter(state: BuilderState, row: number, col: number, letter: string): BuilderState {
  const grid = state.puzzle.grid;
  const cell = GridOps.cellAt(grid, Row.of(row), Col.of(col));
  const l = Letter.try(letter);
  if (l === null) throw new Error(`Invalid letter: ${letter}`);
  const newGrid = GridOps.setCell(grid, Row.of(row), Col.of(col), Cell.setAnswerLetter(cell, l));
  return stateWithGrid(state, newGrid);
}

function stateWithCellMarker(state: BuilderState, row: number, col: number, marker: CellMarkerType): BuilderState {
  const grid = state.puzzle.grid;
  const cell = GridOps.cellAt(grid, Row.of(row), Col.of(col));
  const newGrid = GridOps.setCell(grid, Row.of(row), Col.of(col), Cell.setMarker(cell, marker));
  return stateWithGrid(state, newGrid);
}

function stateWithWords(state: BuilderState, words: Word[]): BuilderState {
  return { ...state, puzzle: Puzzle.withWords(state.puzzle, words) };
}

function stateWithCursor(state: BuilderState, cursor: Cursor): BuilderState {
  return { ...state, cursor };
}

function stateWithMode(state: BuilderState, mode: BuilderMode): BuilderState {
  return { ...state, mode };
}

function stateWithSubMode(state: BuilderState, subMode: BuilderSubMode): BuilderState {
  return { ...state, subMode };
}

function stateWithDisplacedClues(state: BuilderState, displacedClues: DisplacedClueType[]): BuilderState {
  return { ...state, displacedClues };
}

function stateWithMetadata(state: BuilderState, title: string, author: string): BuilderState {
  return {
    ...state,
    puzzle: Puzzle.withMetadata(state.puzzle, Title.try(title), Author.try(author)),
  };
}

function makeWord(opts: {
  startRow: number;
  startCol: number;
  direction: Direction;
  number: number;
  length: number;
  clue?: string;
  nextWord?: WordKey | null;
}): Word {
  return {
    key: {
      startRow: Row.of(opts.startRow),
      startCol: Col.of(opts.startCol),
      direction: opts.direction,
    },
    number: WordNumber.of(opts.number),
    length: opts.length,
    clue: opts.clue ?? '',
    nextWord: opts.nextWord ?? null,
  };
}

function makeDisplacedClue(rng: SeededRng, clue: string, direction: Direction): DisplacedClueType {
  return DisplacedClue.create(rng, clue, direction);
}

describe('deriveBuilderToolbarVM', () => {
  it('deriveBuilderToolbarVM: blank state — canSwitchToDesignWithoutConfirm=true, canChangeGridSize=true, canExportComplete=false (empty grid has missing letters)', () => {
    const state = makeBlankState(5);
    const vm = deriveBuilderToolbarVM(state);
    expect(vm.canSwitchToDesignWithoutConfirm).toBe(true);
    expect(vm.canChangeGridSize).toBe(true);
    expect(vm.canExportComplete).toBe(false);
  });

  it('deriveBuilderToolbarVM: state with answer letters, blank=false — canChangeGridSize=false, canSwitchToDesignWithoutConfirm=false', () => {
    let state = makeBlankState(3);
    state = stateWithAnswerLetter(state, 0, 0, 'A');
    const vm = deriveBuilderToolbarVM(state);
    expect(vm.canChangeGridSize).toBe(false);
    expect(vm.canSwitchToDesignWithoutConfirm).toBe(false);
  });

  it('deriveBuilderToolbarVM: mode echoed from state', () => {
    const designState = makeBlankState(3);
    expect(deriveBuilderToolbarVM(designState).mode).toBe('design');

    const fillState = stateWithMode(designState, 'fill');
    expect(deriveBuilderToolbarVM(fillState).mode).toBe('fill');
  });

  it('deriveBuilderToolbarVM: gridSizeInput === Number(state.puzzle.gridSize); minGridSize=2; maxGridSize=25', () => {
    const state = makeBlankState(7);
    const vm = deriveBuilderToolbarVM(state);
    expect(vm.gridSizeInput).toBe(Number(state.puzzle.gridSize));
    expect(vm.minGridSize).toBe(2);
    expect(vm.maxGridSize).toBe(25);
  });

  it('deriveBuilderToolbarVM: cursor null → cellSelected=false, markerFlags=CellMarker.EMPTY', () => {
    const state = makeBlankState(3);
    const vm = deriveBuilderToolbarVM(state);
    expect(vm.cellSelected).toBe(false);
    expect(vm.markerFlags).toEqual(CellMarker.EMPTY);
  });

  it('deriveBuilderToolbarVM: cursor set → cellSelected=true, markerFlags=selected cell marker', () => {
    let state = makeBlankState(3);
    const marked = CellMarker.toggle(CellMarker.EMPTY, 'space-right');
    state = stateWithCellMarker(state, 1, 2, marked);
    state = stateWithCursor(state, { row: Row.of(1), col: Col.of(2), direction: 'across' });
    const vm = deriveBuilderToolbarVM(state);
    expect(vm.cellSelected).toBe(true);
    expect(vm.markerFlags).toEqual(marked);
  });

  it('deriveBuilderToolbarVM: canExportComplete true when all cells filled and head clues present', () => {
    let state = makeBlankState(2);
    state = stateWithAnswerLetter(state, 0, 0, 'A');
    state = stateWithAnswerLetter(state, 0, 1, 'B');
    state = stateWithAnswerLetter(state, 1, 0, 'C');
    state = stateWithAnswerLetter(state, 1, 1, 'D');
    state = stateWithWords(state, [
      makeWord({ startRow: 0, startCol: 0, direction: 'across', number: 1, length: 2, clue: 'Head clue' }),
    ]);
    const vm = deriveBuilderToolbarVM(state);
    expect(vm.canExportComplete).toBe(true);
    expect(vm.exportCompleteViolations).toHaveLength(0);
  });

  it('deriveBuilderToolbarVM: exportCompleteViolations returned from CompletenessCheck.check', () => {
    const state = makeBlankState(2);
    const vm = deriveBuilderToolbarVM(state);
    expect(vm.exportCompleteViolations).toEqual(CompletenessCheck.check(state.puzzle));
    expect(vm.exportCompleteViolations.length).toBeGreaterThan(0);
  });
});

describe('deriveDisplacedCluesPanelVM', () => {
  it('deriveDisplacedCluesPanelVM: visible=true always; emptyMessage="No displaced clues"', () => {
    const state = makeBlankState(3);
    const vm = deriveDisplacedCluesPanelVM(state);
    expect(vm.visible).toBe(true);
    expect(vm.emptyMessage).toBe('No displaced clues');
  });

  it('deriveDisplacedCluesPanelVM: no displaced clues → entries=[]', () => {
    const state = makeBlankState(3);
    const vm = deriveDisplacedCluesPanelVM(state);
    expect(vm.entries).toHaveLength(0);
  });

  it('deriveDisplacedCluesPanelVM: entries map with isBeingReattached=true only for matching reattach sub-mode id', () => {
    const rng = new SeededRng(1);
    const dc1 = makeDisplacedClue(rng, 'First clue', 'across');
    const dc2 = makeDisplacedClue(rng, 'Second clue', 'down');
    let state = makeBlankState(3);
    state = stateWithDisplacedClues(state, [dc1, dc2]);
    state = stateWithSubMode(state, { kind: 'reattach', displacedClueId: dc2.id });
    const vm = deriveDisplacedCluesPanelVM(state);
    expect(vm.entries).toHaveLength(2);
    expect(vm.entries[0]!.id).toBe(dc1.id);
    expect(vm.entries[0]!.isBeingReattached).toBe(false);
    expect(vm.entries[1]!.id).toBe(dc2.id);
    expect(vm.entries[1]!.isBeingReattached).toBe(true);
  });

  it('deriveDisplacedCluesPanelVM: join sub-mode → all entries isBeingReattached=false', () => {
    const rng = new SeededRng(2);
    const dc = makeDisplacedClue(rng, 'Loose clue', 'across');
    let state = makeBlankState(3);
    state = stateWithDisplacedClues(state, [dc]);
    state = stateWithSubMode(state, { kind: 'join', source: makeWord({ startRow: 0, startCol: 0, direction: 'across', number: 1, length: 2 }).key });
    const vm = deriveDisplacedCluesPanelVM(state);
    expect(vm.entries[0]!.isBeingReattached).toBe(false);
  });
});

describe('deriveBuilderSubModeBannerVM', () => {
  it('deriveBuilderSubModeBannerVM: kind=none → { kind: "none" }', () => {
    const state = makeBlankState(3);
    const vm = deriveBuilderSubModeBannerVM(state);
    expect(vm).toEqual({ kind: 'none' });
  });

  it('deriveBuilderSubModeBannerVM: join sub-mode → sourceNumber / sourceDirection from source word', () => {
    const source = makeWord({ startRow: 0, startCol: 0, direction: 'down', number: 5, length: 3 });
    let state = makeBlankState(3);
    state = stateWithWords(state, [source]);
    state = stateWithSubMode(state, { kind: 'join', source: source.key });
    const vm = deriveBuilderSubModeBannerVM(state);
    expect(vm).toEqual({ kind: 'join', sourceNumber: WordNumber.of(5), sourceDirection: 'down' });
  });

  it('deriveBuilderSubModeBannerVM: join sub-mode with missing source word → fallback { kind: "none" } (defensive)', () => {
    let state = makeBlankState(3);
    state = stateWithSubMode(state, {
      kind: 'join',
      source: makeWord({ startRow: 1, startCol: 1, direction: 'across', number: 1, length: 2 }).key,
    });
    const vm = deriveBuilderSubModeBannerVM(state);
    expect(vm).toEqual({ kind: 'none' });
  });

  it('deriveBuilderSubModeBannerVM: reattach sub-mode → cluePreview / clueDirection from displaced clue', () => {
    const rng = new SeededRng(3);
    const dc = makeDisplacedClue(rng, 'Reattach me', 'down');
    let state = makeBlankState(3);
    state = stateWithDisplacedClues(state, [dc]);
    state = stateWithSubMode(state, { kind: 'reattach', displacedClueId: dc.id });
    const vm = deriveBuilderSubModeBannerVM(state);
    expect(vm).toEqual({ kind: 'reattach', cluePreview: 'Reattach me', clueDirection: 'down' });
  });

  it('deriveBuilderSubModeBannerVM: reattach sub-mode with missing displaced clue → fallback { kind: "none" }', () => {
    const rng = new SeededRng(4);
    const dc = makeDisplacedClue(rng, 'Present', 'across');
    let state = makeBlankState(3);
    state = stateWithDisplacedClues(state, [dc]);
    const missingId = makeDisplacedClue(rng, 'Other', 'across').id;
    state = stateWithSubMode(state, { kind: 'reattach', displacedClueId: missingId });
    const vm = deriveBuilderSubModeBannerVM(state);
    expect(vm).toEqual({ kind: 'none' });
  });
});

describe('deriveBuilderShellVM', () => {
  it('deriveBuilderShellVM: composes all four sub-VMs + grid VM (whichLetter=answer) + clue panel VM (isBuilder=true)', () => {
    let state = makeBlankState(3);
    state = stateWithAnswerLetter(state, 0, 0, 'A');
    state = stateWithWords(state, [
      makeWord({ startRow: 0, startCol: 0, direction: 'across', number: 1, length: 2, clue: 'Head clue' }),
    ]);
    const vm = deriveBuilderShellVM(state);
    expect(vm.toolbar).toEqual(deriveBuilderToolbarVM(state));
    expect(vm.displacedClues).toEqual(deriveDisplacedCluesPanelVM(state));
    expect(vm.subModeBanner).toEqual(deriveBuilderSubModeBannerVM(state));
    expect(vm.grid.cells[0]![0]!.letter).toBe('A');
    expect(vm.cluePanel.across).toHaveLength(1);
    expect(vm.cluePanel.across[0]!.isStartableJoinSource).toBe(true);
    expect(vm.cluePanel.across[0]!.isLinkableFromJoinSource).toBe(false);
    expect(vm.cluePanel.across[0]!.isUnjoinable).toBe(false);
  });

  it('deriveBuilderShellVM: cursor on a word → grid cells in that word get hilite=in-word; cursor cell hilite=selected', () => {
    let state = makeBlankState(3);
    state = stateWithWords(state, [
      makeWord({ startRow: 0, startCol: 0, direction: 'across', number: 1, length: 3, clue: 'Across' }),
    ]);
    state = stateWithCursor(state, { row: Row.of(0), col: Col.of(1), direction: 'across' });
    const vm = deriveBuilderShellVM(state);
    expect(vm.grid.cells[0]![0]!.hilite).toBe('in-word');
    expect(vm.grid.cells[0]![1]!.hilite).toBe('selected');
    expect(vm.grid.cells[0]![2]!.hilite).toBe('in-word');
    expect(vm.grid.cells[1]![0]!.hilite).toBe('none');
  });

  it('deriveBuilderShellVM: grid highlights all chain members when cursor on a chain member', () => {
    let state = makeBlankState(3);
    const tail = makeWord({ startRow: 1, startCol: 0, direction: 'across', number: 2, length: 2, clue: 'Tail' });
    const head = makeWord({
      startRow: 0,
      startCol: 0,
      direction: 'across',
      number: 1,
      length: 2,
      clue: 'Head',
      nextWord: tail.key,
    });
    state = stateWithWords(state, [head, tail]);
    state = stateWithCursor(state, { row: Row.of(1), col: Col.of(0), direction: 'across' });
    const vm = deriveBuilderShellVM(state);
    expect(vm.grid.cells[0]![0]!.hilite).toBe('in-word');
    expect(vm.grid.cells[0]![1]!.hilite).toBe('in-word');
    expect(vm.grid.cells[1]![0]!.hilite).toBe('selected');
    expect(vm.grid.cells[1]![1]!.hilite).toBe('in-word');
    expect(vm.grid.cells[2]![0]!.hilite).toBe('none');
  });

  it('deriveBuilderShellVM: cursor null → selectedWordCells empty, highlightedWordKey null, cluePanel has no isSelected entries', () => {
    const state = makeBlankState(3);
    const vm = deriveBuilderShellVM(state);
    expect(vm.grid.cursor).toBeNull();
    for (const row of vm.grid.cells) {
      for (const cell of row) {
        expect(cell.hilite).toBe('none');
      }
    }
    expect(vm.cluePanel.highlightedWordKey).toBeNull();
    for (const entry of [...vm.cluePanel.across, ...vm.cluePanel.down]) {
      expect(entry.isSelected).toBe(false);
    }
  });

  it('deriveBuilderShellVM: title and author are string projections of branded Title/Author', () => {
    let state = makeBlankState(3);
    state = stateWithMetadata(state, 'My Title', 'My Author');
    const vm = deriveBuilderShellVM(state);
    expect(vm.title).toBe('My Title');
    expect(vm.author).toBe('My Author');
  });
});
