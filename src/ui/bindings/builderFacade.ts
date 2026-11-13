import type { BuilderIntent, BuilderIntentMinusTarget } from '../../builder/state/intents';
import { deriveBuilderShellVM } from './viewmodels/builderVM';
import type { BuilderShellVM } from './viewmodels/builderVM';
import type { AppStore } from './appStore.svelte';
import { GridSize } from '../../domain/grid/GridSize';
import { Grid } from '../../domain/grid/Grid';
import { Title } from '../../domain/puzzle/Title';
import { Author } from '../../domain/puzzle/Author';
import { CellMarker } from '../../domain/grid/CellMarker';
import type { CellMarkerAxis } from '../../domain/grid/CellMarker';
import type { CellSeparator } from '../../domain/grid/CellSeparator';
import type { WordKey } from '../../domain/word/WordKey';
import type { DisplacedClueId } from '../../domain/builder/DisplacedClueId';
import { createGridActions } from './gridActions';
import { createFilePickActions } from './filePickActions';

export type { BuilderShellVM };

export type BuilderToolbarActions = {
  switchToFill(): void;
  requestSwitchToDesign(): void;
  changeGridSize(size: number): boolean;
  setMarker(axis: CellMarkerAxis, separator: CellSeparator): void;
  exportIncomplete(): void;
  exportComplete(): void;
  requestResetBuilder(): void;
  editTitle(title: string): void;
  editAuthor(author: string): void;
  requestImportPuzzle(fileContent: string): void;
  importDroppedFile(file: File): void;
};

export type BuilderGridActions = {
  selectCell(row: number, col: number): void;
  clickCell(row: number, col: number): void;
  typeLetter(letter: string): void;
  backspace(): void;
  moveCursor(direction: 'across' | 'down', sign: -1 | 1): void;
  escape(): void;
};

export type BuilderCluePanelActions = {
  editClue(wordKey: WordKey, clue: string): void;
  beginJoin(source: WordKey): void;
  unjoin(source: WordKey): void;
  clickCluePanelWord(wordKey: WordKey): void;
};

export type DisplacedCluesPanelActions = {
  beginReattach(displacedClueId: DisplacedClueId): void;
  deleteDisplacedClue(id: DisplacedClueId): void;
};

export type BuilderBannerActions = {
  escape(): void;
};

export type BuilderFacade = {
  dispatch(intent: BuilderIntent): void;
  builderShellVM(): BuilderShellVM;
  pickFile(): Promise<string | null>;
  actions: {
    toolbar: BuilderToolbarActions;
    grid: BuilderGridActions;
    cluePanel: BuilderCluePanelActions;
    displacedClues: DisplacedCluesPanelActions;
    banner: BuilderBannerActions;
  };
};

export function createBuilderFacade(appStore: AppStore): BuilderFacade {
  const d = (partial: BuilderIntentMinusTarget): void => {
    appStore.dispatch({ target: 'builder', ...partial });
  };

  const filePick = createFilePickActions(
    appStore,
    'builderFacade',
    'builder',
    (intent) => appStore.dispatch(intent),
    (text) => d({ kind: 'request-import-puzzle', fileContent: text }),
  );

  const toolbar: BuilderToolbarActions = {
    switchToFill() {
      d({ kind: 'switch-to-fill' });
    },
    requestSwitchToDesign() {
      d({ kind: 'request-switch-to-design' });
    },
    changeGridSize(size: number) {
      const s = GridSize.try(size);
      if (s === null) {
        appStore.dispatch({ kind: 'report-grid-size-failure' });
        return false;
      }
      d({ kind: 'change-grid-size', size: s });
      return true;
    },
    setMarker(axis: CellMarkerAxis, separator: CellSeparator) {
      const state = appStore.getBuilder();
      const cursor = state.cursor;
      if (cursor === null || state.mode !== 'fill') {
        d({ kind: 'set-marker', axis, separator: 'none' });
        return;
      }
      const cell = Grid.cellAt(state.puzzle.grid, cursor.row, cursor.col);
      const current = CellMarker.read(cell.marker, axis);
      const newSeparator = current === separator ? 'none' : separator;
      d({ kind: 'set-marker', axis, separator: newSeparator });
    },
    exportIncomplete() {
      d({ kind: 'export-incomplete' });
    },
    exportComplete() {
      d({ kind: 'export-complete' });
    },
    requestResetBuilder() {
      d({ kind: 'request-reset-builder' });
    },
    editTitle(title: string) {
      d({ kind: 'edit-title', title: Title.of(title) });
    },
    editAuthor(author: string) {
      d({ kind: 'edit-author', author: Author.of(author) });
    },
    requestImportPuzzle(fileContent: string) {
      d({ kind: 'request-import-puzzle', fileContent });
    },
    async importDroppedFile(file: File) {
      await filePick.importDroppedFile(file);
    },
  };

  const sharedGrid = createGridActions(
    'builder',
    () => appStore.getBuilder().puzzle.grid,
    (intent) => appStore.dispatch(intent),
  );
  const grid: BuilderGridActions = {
    ...sharedGrid,
    clickCell(row: number, col: number) {
      const mode = appStore.getBuilder().mode;
      if (mode === 'design') {
        const cell = Grid.tryCoord(appStore.getBuilder().puzzle.grid, row, col);
        if (cell === null) return;
        d({ kind: 'toggle-design-cell', cell });
      } else {
        sharedGrid.selectCell(row, col);
      }
    },
  };

  const cluePanel: BuilderCluePanelActions = {
    editClue(wordKey: WordKey, clue: string) {
      d({ kind: 'edit-clue', wordKey, clue });
    },
    beginJoin(source: WordKey) {
      d({ kind: 'begin-join', source });
    },
    unjoin(source: WordKey) {
      d({ kind: 'unjoin', source });
    },
    clickCluePanelWord(wordKey: WordKey) {
      d({ kind: 'click-clue-panel-word', wordKey });
    },
  };

  const displacedClues: DisplacedCluesPanelActions = {
    beginReattach(displacedClueId: DisplacedClueId) {
      d({ kind: 'begin-reattach', displacedClueId });
    },
    deleteDisplacedClue(id: DisplacedClueId) {
      d({ kind: 'delete-displaced-clue', id });
    },
  };

  const banner: BuilderBannerActions = {
    escape() {
      d({ kind: 'escape' });
    },
  };

  const facade: BuilderFacade = {
    dispatch: appStore.dispatch,
    builderShellVM() {
      return deriveBuilderShellVM(appStore.getBuilder());
    },
    async pickFile() {
      return filePick.pickFile();
    },
    actions: { toolbar, grid, cluePanel, displacedClues, banner },
  };

  return facade;
}
