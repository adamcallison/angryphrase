import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
import { deriveBuilderShellVM } from './viewmodels/builderVM';
import type { BuilderShellVM } from './viewmodels/builderVM';
import type { AppStore } from './appStore.svelte';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';
import { GridSize } from '../../domain/grid/GridSize';
import { GridOps } from '../../domain/grid/GridOps';
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
      const s = GridSize.try(size);
      if (s === null) {
        appStore.dispatch({ kind: 'report-grid-size-failure' });
        return false;
      }
      dispatch({ target: 'builder', kind: 'change-grid-size', size: s });
      return true;
    },
    setMarker(axis: CellMarkerAxis, separator: CellSeparator) {
      const state = appStore.getBuilder();
      const cursor = state.cursor;
      if (cursor === null || state.mode !== 'fill') {
        dispatch({ target: 'builder', kind: 'set-marker', axis, separator: 'none' });
        return;
      }
      const cell = GridOps.cellAt(state.puzzle.grid, cursor.row, cursor.col);
      const current = CellMarker.read(cell.marker, axis);
      const newSeparator = current === separator ? 'none' : separator;
      dispatch({ target: 'builder', kind: 'set-marker', axis, separator: newSeparator });
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

  const sharedGrid = createGridActions('builder', dispatch);
  const grid: BuilderGridActions = {
    ...sharedGrid,
    clickCell(row: number, col: number) {
      const mode = appStore.getBuilder().mode;
      if (mode === 'design') {
        const r = Row.try(row);
        const c = Col.try(col);
        if (r === null || c === null) return;
        dispatch({ target: 'builder', kind: 'toggle-design-cell', row: r, col: c });
      } else {
        sharedGrid.selectCell(row, col);
      }
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
    async pickFile() {
      return filePick.pickFile();
    },
    actions: { toolbar, grid, cluePanel, displacedClues, banner },
  };

  return facade;
}
