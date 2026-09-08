import type { BuilderIntent } from '../../builder/state/intents';
import type { BuilderState } from '../../builder/state/state';
import { deriveBuilderShellVM } from './viewmodels/builderVM';
import type { BuilderShellVM } from './viewmodels/builderVM';
import type { AppStore } from './appStore.svelte';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';
import { GridSize } from '../../domain/grid/GridSize';
import { Letter } from '../../domain/letter/Letter';
import { Title } from '../../domain/puzzle/Title';
import { Author } from '../../domain/puzzle/Author';
import type { CellMarkerFlag } from '../../domain/grid/CellMarkerFlag';
import type { WordKey } from '../../domain/word/WordKey';
import type { DisplacedClueId } from '../../domain/builder/DisplacedClueId';

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
  function dispatch(intent: BuilderIntent): void {
    appStore.dispatch(intent);
  }

  const toolbar: BuilderToolbarActions = {
    switchToFill() {
      dispatch({ kind: 'switch-to-fill' });
    },
    requestSwitchToDesign() {
      dispatch({ kind: 'request-switch-to-design' });
    },
    changeGridSize(size: number) {
      dispatch({ kind: 'change-grid-size', size: GridSize.of(size) });
    },
    toggleMarker(flag: CellMarkerFlag) {
      dispatch({ kind: 'toggle-marker', flag });
    },
    exportIncomplete() {
      dispatch({ kind: 'export-incomplete' });
    },
    exportComplete() {
      dispatch({ kind: 'export-complete' });
    },
    requestResetBuilder() {
      dispatch({ kind: 'request-reset-builder' });
    },
    editTitle(title: string) {
      const t = Title.try(title);
      if (t === null) return;
      dispatch({ kind: 'edit-title', title: t });
    },
    editAuthor(author: string) {
      const a = Author.try(author);
      if (a === null) return;
      dispatch({ kind: 'edit-author', author: a });
    },
    requestImportPuzzle(fileContent: string) {
      dispatch({ kind: 'request-import-puzzle', fileContent });
    },
    async importDroppedFile(file: File) {
      const text = await appStore.getPorts().filePick.readDroppedFile(file);
      if (text === null) {
        dispatch({ kind: 'report-import-read-failure' });
        return;
      }
      dispatch({ kind: 'request-import-puzzle', fileContent: text });
    },
  };

  const grid: BuilderGridActions = {
    selectCell(row: number, col: number) {
      dispatch({ kind: 'select-cell', row: Row.of(row), col: Col.of(col) });
    },
    toggleDesignCell(row: number, col: number) {
      dispatch({ kind: 'toggle-design-cell', row: Row.of(row), col: Col.of(col) });
    },
    typeLetter(letter: string) {
      const l = Letter.try(letter);
      if (l === null) return;
      dispatch({ kind: 'type-letter', letter: l });
    },
    backspace() {
      dispatch({ kind: 'backspace' });
    },
    moveCursor(direction: 'across' | 'down', sign: -1 | 1) {
      dispatch({ kind: 'move-cursor', direction, sign });
    },
    escape() {
      dispatch({ kind: 'escape' });
    },
  };

  const cluePanel: BuilderCluePanelActions = {
    editClue(wordKey: WordKey, clue: string) {
      dispatch({ kind: 'edit-clue', wordKey, clue });
    },
    beginJoin(source: WordKey) {
      dispatch({ kind: 'begin-join', source });
    },
    unjoin(source: WordKey) {
      dispatch({ kind: 'unjoin', source });
    },
    clickCluePanelWord(wordKey: WordKey) {
      dispatch({ kind: 'click-clue-panel-word', wordKey });
    },
  };

  const displacedClues: DisplacedCluesPanelActions = {
    beginReattach(displacedClueId: DisplacedClueId) {
      dispatch({ kind: 'begin-reattach', displacedClueId });
    },
    deleteDisplacedClue(id: DisplacedClueId) {
      dispatch({ kind: 'delete-displaced-clue', id });
    },
  };

  const banner: BuilderBannerActions = {
    escape() {
      dispatch({ kind: 'escape' });
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
      return appStore.getPorts().filePick.pickFile();
    },
    actions: { toolbar, grid, cluePanel, displacedClues, banner },
  };

  return facade;
}
