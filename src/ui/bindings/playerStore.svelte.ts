import type { PlayerIntent } from '../../player/state/intents';
import type { PlayerState } from '../../player/state/state';
import { derivePlayerShellVM } from './viewmodels/playerVM';
import type { PlayerShellVM } from './viewmodels/playerVM';
import { dispatch, getPlayer } from './appStore.svelte';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';
import { Letter } from '../../domain/letter/Letter';

export type { PlayerShellVM };

export function playerShellVM(): PlayerShellVM {
  return derivePlayerShellVM(getPlayer());
}

export function dispatchPlayer(intent: PlayerIntent): void {
  dispatch(intent);
}

export function getPlayerState(): PlayerState {
  return getPlayer();
}

export function dispatchSelectCell(row: number, col: number): void {
  dispatchPlayer({ kind: 'select-cell', row: Row.of(row), col: Col.of(col) });
}

export function dispatchTypeLetter(letter: string): void {
  const l = Letter.try(letter);
  if (l === null) return;
  dispatchPlayer({ kind: 'type-letter', letter: l });
}

export function dispatchBackspace(): void {
  dispatchPlayer({ kind: 'backspace' });
}

export function dispatchEscape(): void {
  dispatchPlayer({ kind: 'escape' });
}

export function dispatchMoveCursor(direction: 'across' | 'down'): void {
  dispatchPlayer({ kind: 'move-cursor', direction });
}

export function dispatchImportPuzzle(fileContent: string): void {
  dispatchPlayer({ kind: 'import-puzzle', fileContent });
}

export function dispatchImportNewPuzzle(): void {
  dispatchPlayer({ kind: 'import-new-puzzle' });
}

export function dispatchCheck(): void {
  dispatchPlayer({ kind: 'check' });
}

export function dispatchClearErrors(): void {
  dispatchPlayer({ kind: 'clear-errors' });
}

export function dispatchRequestResetPlayer(): void {
  dispatchPlayer({ kind: 'request-reset-player' });
}

export function dispatchOpenAnagramHelper(): void {
  dispatchPlayer({ kind: 'open-anagram-helper' });
}

export function dispatchCloseAnagramHelper(): void {
  dispatchPlayer({ kind: 'close-anagram-helper' });
}

export function dispatchAnagramInput(input: string): void {
  dispatchPlayer({ kind: 'anagram-input', input });
}

export function dispatchAnagramScramble(): void {
  dispatchPlayer({ kind: 'anagram-scramble' });
}
