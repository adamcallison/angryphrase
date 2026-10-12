import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import type { BuilderState } from '../../builder/state/state';
import { deriveBuilderShellVM } from './viewmodels/builderVM';
import type { BuilderShellVM } from './viewmodels/builderVM';
import type { AppStore } from './appStore.svelte';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';
import { GridSize } from '../../domain/grid/GridSize';
import { Title } from '../../domain/puzzle/Title';
import { Author } from '../../domain/puzzle/Author';
import type { CellMarkerFlag } from '../../domain/grid/CellMarkerFlag';
import type { WordKey } from '../../domain/word/WordKey';
import type { DisplacedClueId } from '../../domain/builder/DisplacedClueId';
import { createGridActions } from './gridActions';
import { createFilePickActions } from './filePickActions';

export type { BuilderShellVM };

export type BuilderToolbarActions = {
  switchToFill(): void;
  requestSwitchToDesign(): void;
  changeGridSize(size: number): void;
  toggleMarker(flag: CellMarkerFlag): void;
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
  toggleDesignCell(row: number, col: number): void;
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
  getBuilderState(): BuilderState;
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
  function dispatch(intent: BuilderIntent | PlayerIntent): void {
    appStore.dispatch(intent);
  }

  const filePick = createFilePickActions(
    appStore,
    'builderFacade',
    'builder',
    dispatch,
    (text) => dispatch({ target: 'builder', kind: 'request-import-puzzle', fileContent: text }),
  );

  const toolbar: BuilderToolbarActions = {
    switchToFill() {
      dispatch({ target: 'builder', kind: 'switch-to-fill' });
    },
    requestSwitchToDesign() {
      dispatch({ target: 'builder', kind: 'request-switch-to-design' });
    },
    changeGridSize(size: number) {
      dispatch({ target: 'builder', kind: 'change-grid-size', size: GridSize.of(size) });
    },
    toggleMarker(flag: CellMarkerFlag) {
      dispatch({ target: 'builder', kind: 'toggle-marker', flag });
    },
    exportIncomplete() {
      dispatch({ target: 'builder', kind: 'export-incomplete' });
    },
    exportComplete() {
      dispatch({ target: 'builder', kind: 'export-complete' });
    },
    requestResetBuilder() {
      dispatch({ target: 'builder', kind: 'request-reset-builder' });
    },
    editTitle(title: string) {
      const t = Title.try(title);
      if (t === null) return;
      dispatch({ target: 'builder', kind: 'edit-title', title: t });
    },
    editAuthor(author: string) {
      const a = Author.try(author);
      if (a === null) return;
      dispatch({ target: 'builder', kind: 'edit-author', author: a });
    },
    requestImportPuzzle(fileContent: string) {
      dispatch({ target: 'builder', kind: 'request-import-puzzle', fileContent });
    },
    async importDroppedFile(file: File) {
      await filePick.importDroppedFile(file);
    },
  };

  const grid: BuilderGridActions = {
    ...createGridActions('builder', dispatch),
    toggleDesignCell(row: number, col: number) {
      dispatch({ target: 'builder', kind: 'toggle-design-cell', row: Row.of(row), col: Col.of(col) });
    },
  };

  const cluePanel: BuilderCluePanelActions = {
    editClue(wordKey: WordKey, clue: string) {
      dispatch({ target: 'builder', kind: 'edit-clue', wordKey, clue });
    },
    beginJoin(source: WordKey) {
      dispatch({ target: 'builder', kind: 'begin-join', source });
    },
    unjoin(source: WordKey) {
      dispatch({ target: 'builder', kind: 'unjoin', source });
    },
    clickCluePanelWord(wordKey: WordKey) {
      dispatch({ target: 'builder', kind: 'click-clue-panel-word', wordKey });
    },
  };

  const displacedClues: DisplacedCluesPanelActions = {
    beginReattach(displacedClueId: DisplacedClueId) {
      dispatch({ target: 'builder', kind: 'begin-reattach', displacedClueId });
    },
    deleteDisplacedClue(id: DisplacedClueId) {
      dispatch({ target: 'builder', kind: 'delete-displaced-clue', id });
    },
  };

  const banner: BuilderBannerActions = {
    escape() {
      dispatch({ target: 'builder', kind: 'escape' });
    },
  };

  const facade: BuilderFacade = {
    dispatch,
    builderShellVM() {
      return deriveBuilderShellVM(appStore.getBuilder());
    },
    getBuilderState() {
      return appStore.getBuilder();
    },
    async pickFile() {
      return filePick.pickFile();
    },
    actions: { toolbar, grid, cluePanel, displacedClues, banner },
  };

  return facade;
}
