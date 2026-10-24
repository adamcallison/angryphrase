import type { BuilderIntent } from '../../builder/state/intents';
import type { PlayerIntent } from '../../player/state/intents';
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
  function dispatch(intent: BuilderIntent | PlayerIntent): void {
    appStore.dispatch(intent);
  }

  const filePick = createFilePickActions(
    appStore,
    'playerFacade',
    'player',
    dispatch,
    (text) => dispatch({ kind: 'import-puzzle', target: 'player', fileContent: text }),
  );

  const toolbar: PlayerToolbarActions = {
    check() {
      dispatch({ kind: 'check', target: 'player' });
    },
    clearErrors() {
      dispatch({ kind: 'clear-errors', target: 'player' });
    },
    requestResetPlayer() {
      dispatch({ kind: 'request-reset-player', target: 'player' });
    },
    importNewPuzzle() {
      dispatch({ kind: 'import-new-puzzle', target: 'player' });
    },
    openAnagramHelper() {
      dispatch({ kind: 'open-anagram-helper', target: 'player' });
    },
  };

  const grid: PlayerGridActions = createGridActions('player', dispatch);

  const cluePanel: PlayerCluePanelActions = {
    clickCluePanelWord(wordKey: WordKey) {
      dispatch({ kind: 'click-clue-panel-word', target: 'player', wordKey });
    },
  };

  const importScreen: PlayerImportScreenActions = {
    importPuzzle(fileContent: string) {
      dispatch({ kind: 'import-puzzle', target: 'player', fileContent });
    },
    async importDroppedFile(file: File) {
      await filePick.importDroppedFile(file);
    },
  };

  const anagram: PlayerAnagramActions = {
    input(input: string) {
      dispatch({ kind: 'anagram-input', target: 'player', input });
    },
    scramble() {
      dispatch({ kind: 'anagram-scramble', target: 'player' });
    },
    close() {
      dispatch({ kind: 'close-anagram-helper', target: 'player' });
    },
  };

  const facade: PlayerFacade = {
    dispatch,
    playerShellVM() {
      return derivePlayerShellVM(appStore.getPlayer());
    },
    async pickFile() {
      return filePick.pickFile();
    },
    actions: { toolbar, grid, cluePanel, importScreen, anagram },
  };

  return facade;
}
