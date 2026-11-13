import type { PlayerIntent, PlayerIntentMinusTarget } from '../../player/state/intents';
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
  const d = (partial: PlayerIntentMinusTarget): void => {
    appStore.dispatch({ target: 'player', ...partial });
  };

  const filePick = createFilePickActions(
    appStore,
    'playerFacade',
    'player',
    (intent) => appStore.dispatch(intent),
    (text) => d({ kind: 'import-puzzle', fileContent: text }),
  );

  const toolbar: PlayerToolbarActions = {
    check() {
      d({ kind: 'check' });
    },
    clearErrors() {
      d({ kind: 'clear-errors' });
    },
    requestResetPlayer() {
      d({ kind: 'request-reset-player' });
    },
    importNewPuzzle() {
      d({ kind: 'import-new-puzzle' });
    },
    openAnagramHelper() {
      d({ kind: 'open-anagram-helper' });
    },
  };

  const grid: PlayerGridActions = createGridActions(
    'player',
    () => {
      const p = appStore.getPlayer();
      return p.phase === 'solving' ? p.puzzle.grid : null;
    },
    (intent) => appStore.dispatch(intent),
  );

  const cluePanel: PlayerCluePanelActions = {
    clickCluePanelWord(wordKey: WordKey) {
      d({ kind: 'click-clue-panel-word', wordKey });
    },
  };

  const importScreen: PlayerImportScreenActions = {
    importPuzzle(fileContent: string) {
      d({ kind: 'import-puzzle', fileContent });
    },
    async importDroppedFile(file: File) {
      await filePick.importDroppedFile(file);
    },
  };

  const anagram: PlayerAnagramActions = {
    input(input: string) {
      d({ kind: 'anagram-input', input });
    },
    scramble() {
      d({ kind: 'anagram-scramble' });
    },
    close() {
      d({ kind: 'close-anagram-helper' });
    },
  };

  const facade: PlayerFacade = {
    dispatch: appStore.dispatch,
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
