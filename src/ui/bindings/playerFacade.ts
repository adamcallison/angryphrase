import type { PlayerIntent } from '../../player/state/intents';
import type { PlayerState } from '../../player/state/state';
import { derivePlayerShellVM } from './viewmodels/playerVM';
import type { PlayerShellVM } from './viewmodels/playerVM';
import type { AppStore } from './appStore.svelte';
import type { WordKey } from '../../domain/word/WordKey';
import { createGridActions } from './gridActions';
import { createFilePickActions } from './filePickActions';

export type { PlayerShellVM };

export type PlayerToolbarActions = {
  check(): void;
  clearErrors(): void;
  requestResetPlayer(): void;
  importNewPuzzle(): void;
  openAnagramHelper(): void;
};

export type PlayerGridActions = {
  selectCell(row: number, col: number): void;
  typeLetter(letter: string): void;
  backspace(): void;
  moveCursor(direction: 'across' | 'down', sign: -1 | 1): void;
  escape(): void;
};

export type PlayerCluePanelActions = {
  clickCluePanelWord(wordKey: WordKey): void;
};

export type PlayerImportScreenActions = {
  importPuzzle(fileContent: string): void;
  importDroppedFile(file: File): void;
};

export type PlayerAnagramActions = {
  input(input: string): void;
  scramble(): void;
  close(): void;
};

export type PlayerFacade = {
  dispatch(intent: PlayerIntent): void;
  playerShellVM(): PlayerShellVM;
  getPlayerState(): PlayerState;
  pickFile(): Promise<string | null>;
  actions: {
    toolbar: PlayerToolbarActions;
    grid: PlayerGridActions;
    cluePanel: PlayerCluePanelActions;
    importScreen: PlayerImportScreenActions;
    anagram: PlayerAnagramActions;
  };
};

export function createPlayerFacade(appStore: AppStore): PlayerFacade {
  function dispatch(intent: PlayerIntent): void {
    appStore.dispatch(intent);
  }

  const filePick = createFilePickActions(
    appStore,
    'playerFacade',
    dispatch,
    (text) => dispatch({ kind: 'import-puzzle', fileContent: text }),
  );

  const toolbar: PlayerToolbarActions = {
    check() {
      dispatch({ kind: 'check' });
    },
    clearErrors() {
      dispatch({ kind: 'clear-errors' });
    },
    requestResetPlayer() {
      dispatch({ kind: 'request-reset-player' });
    },
    importNewPuzzle() {
      dispatch({ kind: 'import-new-puzzle' });
    },
    openAnagramHelper() {
      dispatch({ kind: 'open-anagram-helper' });
    },
  };

  const grid: PlayerGridActions = createGridActions(dispatch);

  const cluePanel: PlayerCluePanelActions = {
    clickCluePanelWord(wordKey: WordKey) {
      dispatch({ kind: 'click-clue-panel-word', wordKey });
    },
  };

  const importScreen: PlayerImportScreenActions = {
    importPuzzle(fileContent: string) {
      dispatch({ kind: 'import-puzzle', fileContent });
    },
    async importDroppedFile(file: File) {
      await filePick.importDroppedFile(file);
    },
  };

  const anagram: PlayerAnagramActions = {
    input(input: string) {
      dispatch({ kind: 'anagram-input', input });
    },
    scramble() {
      dispatch({ kind: 'anagram-scramble' });
    },
    close() {
      dispatch({ kind: 'close-anagram-helper' });
    },
  };

  const facade: PlayerFacade = {
    dispatch,
    playerShellVM() {
      return derivePlayerShellVM(appStore.getPlayer());
    },
    getPlayerState() {
      return appStore.getPlayer();
    },
    async pickFile() {
      return filePick.pickFile();
    },
    actions: { toolbar, grid, cluePanel, importScreen, anagram },
  };

  return facade;
}
