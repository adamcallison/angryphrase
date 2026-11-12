import { BuilderState } from '../../../builder/state/state';
import type { BuilderMode } from '../../../builder/state/state';
import { Grid } from '../../../domain/grid/Grid';
import { GridSize } from '../../../domain/grid/GridSize';
import { CellMarker } from '../../../domain/grid/CellMarker';
import {
  CompletenessCheck,
  type CompletenessViolation,
  type CompletenessViolationKind,
} from '../../../domain/puzzle/CompletenessCheck';
import { WordKey } from '../../../domain/word/WordKey';
import { WordSelection } from '../../../domain/word/WordSelection';
import type { Direction } from '../../../domain/word/Direction';
import { ChainCells } from '../../../domain/chain/ChainCells';
import type { DisplacedClueId } from '../../../domain/builder/DisplacedClueId';
import { deriveGridVM, type GridVM } from './gridVM';
import { deriveCluePanelVM, type CluePanelVM } from './cluePanelVM';

const VIOLATION_LABELS: Record<CompletenessViolationKind, { singular: string; plural: string }> = {
  'missing-answer-letter': { singular: 'missing answer letter', plural: 'missing answer letters' },
  'missing-clue': { singular: 'missing clue', plural: 'missing clues' },
  'non-head-clue': { singular: 'non-head word with stray clue text', plural: 'non-head words with stray clue text' },
};

function violationSummary(violations: CompletenessViolation[]): Array<{ count: number; label: string }> {
  const counts: Record<CompletenessViolationKind, number> = {
    'missing-answer-letter': 0,
    'missing-clue': 0,
    'non-head-clue': 0,
  };
  for (const v of violations) {
    counts[v.kind]++;
  }

  const out: Array<{ count: number; label: string }> = [];
  const kinds: CompletenessViolationKind[] = ['missing-answer-letter', 'missing-clue', 'non-head-clue'];
  for (const kind of kinds) {
    const count = counts[kind];
    if (count === 0) continue;
    const noun = count === 1 ? VIOLATION_LABELS[kind].singular : VIOLATION_LABELS[kind].plural;
    out.push({ count, label: `${count} ${noun}` });
  }
  return out;
}

export type BuilderToolbarVM = {
  mode: BuilderMode;
  canSwitchToDesignWithoutConfirm: boolean;
  canChangeGridSize: boolean;
  gridSizeInput: number;
  minGridSize: number;
  maxGridSize: number;
  cellSelected: boolean;
  markerFlags: CellMarker;
  canExportComplete: boolean;
  violationSummary: Array<{ count: number; label: string }>;
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
  | { kind: 'join'; sourceNumber: number; sourceDirection: Direction }
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
    ? Grid.cellAt(state.puzzle.grid, state.cursor.row, state.cursor.col).marker
    : CellMarker.EMPTY;
  const violations = CompletenessCheck.check(state.puzzle);
  const summary = violationSummary(violations);
  return {
    mode: state.mode,
    canSwitchToDesignWithoutConfirm: isBlank,
    canChangeGridSize: isBlank,
    gridSizeInput: Number(state.puzzle.gridSize),
    minGridSize: Number(GridSize.MIN),
    maxGridSize: Number(GridSize.MAX),
    cellSelected: state.cursor !== null,
    markerFlags,
    canExportComplete: violations.length === 0,
    violationSummary: summary,
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
    return { kind: 'join', sourceNumber: Number(sourceWord.number), sourceDirection: sourceWord.key.direction };
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

