import { BuilderState } from '../../../builder/state/state';
import type { BuilderMode } from '../../../builder/state/state';
import { GridOps } from '../../../domain/grid/GridOps';
import { CellMarker } from '../../../domain/grid/CellMarker';
import { CompletenessCheck, type CompletenessViolation } from '../../../domain/puzzle/CompletenessCheck';
import { WordKey } from '../../../domain/word/WordKey';
import { WordSelection } from '../../../domain/word/WordSelection';
import type { Direction } from '../../../domain/word/Direction';
import { ChainCells } from '../../../domain/chain/ChainCells';
import type { WordNumber } from '../../../domain/word/WordNumber';
import type { DisplacedClueId } from '../../../domain/builder/DisplacedClueId';
import { deriveGridVM, type GridVM } from './gridVM';
import { deriveCluePanelVM, type CluePanelVM } from './cluePanelVM';

export type BuilderToolbarVM = {
  mode: BuilderMode;
  canSwitchToDesignWithoutConfirm: boolean;
  canChangeGridSize: boolean;
  gridSizeInput: number;
  minGridSize: 2;
  maxGridSize: 25;
  cellSelected: boolean;
  markerFlags: CellMarker;
  canExportComplete: boolean;
  exportCompleteViolations: CompletenessViolation[];
};

export type DisplacedClueEntryVM = {
  id: DisplacedClueId;
  clue: string;
  direction: Direction;
  isBeingReattached: boolean;
};
export type DisplacedCluesPanelVM = {
  visible: true;
  entries: DisplacedClueEntryVM[];
  emptyMessage: 'No displaced clues';
};

export type BuilderSubModeBannerVM =
  | { kind: 'none' }
  | { kind: 'join'; sourceNumber: WordNumber; sourceDirection: Direction }
  | { kind: 'reattach'; cluePreview: string; clueDirection: Direction };

export type BuilderShellVM = {
  toolbar: BuilderToolbarVM;
  grid: GridVM;
  cluePanel: CluePanelVM;
  displacedClues: DisplacedCluesPanelVM;
  subModeBanner: BuilderSubModeBannerVM;
  title: string;
  author: string;
};

export function deriveBuilderToolbarVM(state: BuilderState): BuilderToolbarVM {
  const isBlank = BuilderState.isBlank(state);
  const markerFlags = state.cursor
    ? GridOps.cellAt(state.puzzle.grid, state.cursor.row, state.cursor.col).marker
    : CellMarker.EMPTY;
  const exportCompleteViolations = CompletenessCheck.check(state.puzzle);
  return {
    mode: state.mode,
    canSwitchToDesignWithoutConfirm: isBlank,
    canChangeGridSize: isBlank,
    gridSizeInput: Number(state.puzzle.gridSize),
    minGridSize: 2,
    maxGridSize: 25,
    cellSelected: state.cursor !== null,
    markerFlags,
    canExportComplete: exportCompleteViolations.length === 0,
    exportCompleteViolations,
  };
}

export function deriveDisplacedCluesPanelVM(state: BuilderState): DisplacedCluesPanelVM {
  const entries = state.displacedClues.map((d) => ({
    id: d.id,
    clue: d.clue,
    direction: d.direction,
    isBeingReattached: state.subMode.kind === 'reattach' ? state.subMode.displacedClueId === d.id : false,
  }));
  return { visible: true, entries, emptyMessage: 'No displaced clues' };
}

export function deriveBuilderSubModeBannerVM(state: BuilderState): BuilderSubModeBannerVM {
  const { subMode } = state;
  if (subMode.kind === 'none') {
    return { kind: 'none' };
  }
  if (subMode.kind === 'join') {
    const sourceWord = state.puzzle.words.find((w) => WordKey.equals(w.key, subMode.source));
    if (sourceWord === undefined) {
      return { kind: 'none' };
    }
    return { kind: 'join', sourceNumber: sourceWord.number, sourceDirection: sourceWord.key.direction };
  }
  const displacedClue = state.displacedClues.find((dc) => dc.id === subMode.displacedClueId);
  if (displacedClue === undefined) {
    return { kind: 'none' };
  }
  return { kind: 'reattach', cluePreview: displacedClue.clue, clueDirection: displacedClue.direction };
}

export function deriveBuilderShellVM(state: BuilderState): BuilderShellVM {
  const toolbar = deriveBuilderToolbarVM(state);
  const displacedClues = deriveDisplacedCluesPanelVM(state);
  const subModeBanner = deriveBuilderSubModeBannerVM(state);

  const cursorWord = state.cursor ? WordSelection.findContainingWord(state.puzzle.words, state.cursor) : null;
  const highlightedWordKey = cursorWord ? cursorWord.key : null;
  const selectedWordCells = ChainCells.cellsOfChain(state.puzzle.words, cursorWord);

  const grid = deriveGridVM({
    grid: state.puzzle.grid,
    cursor: state.cursor,
    words: state.puzzle.words,
    whichLetter: 'answer',
    selectedWordCells,
  });
  const cluePanel = deriveCluePanelVM({
    grid: state.puzzle.grid,
    words: state.puzzle.words,
    highlightedWordKey,
    isBuilder: true,
    builderSubMode: state.subMode,
  });

  return {
    toolbar,
    grid,
    cluePanel,
    displacedClues,
    subModeBanner,
    title: String(state.puzzle.title),
    author: String(state.puzzle.author),
  };
}

