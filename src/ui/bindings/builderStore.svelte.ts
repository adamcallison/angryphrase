import type { BuilderIntent } from '../../builder/state/intents';
import type { BuilderState } from '../../builder/state/state';
import { deriveBuilderShellVM } from './viewmodels/builderVM';
import type { BuilderShellVM } from './viewmodels/builderVM';
import { dispatch, getBuilder } from './appStore.svelte';
import { Row } from '../../domain/grid/Row';
import { Col } from '../../domain/grid/Col';
import { GridSize } from '../../domain/grid/GridSize';
import { Letter } from '../../domain/letter/Letter';
import { Title } from '../../domain/puzzle/Title';
import { Author } from '../../domain/puzzle/Author';

export type { BuilderShellVM };

export function builderShellVM(): BuilderShellVM {
  return deriveBuilderShellVM(getBuilder());
}

export function dispatchBuilder(intent: BuilderIntent): void {
  dispatch(intent);
}

export function getBuilderState(): BuilderState {
  return getBuilder();
}

export function dispatchSelectCell(row: number, col: number): void {
  dispatchBuilder({ kind: 'select-cell', row: Row.of(row), col: Col.of(col) });
}

export function dispatchToggleDesignCell(row: number, col: number): void {
  dispatchBuilder({ kind: 'toggle-design-cell', row: Row.of(row), col: Col.of(col) });
}

export function dispatchChangeGridSize(size: number): void {
  dispatchBuilder({ kind: 'change-grid-size', size: GridSize.of(size) });
}

export function dispatchTypeLetter(letter: string): void {
  const l = Letter.try(letter);
  if (l === null) return;
  dispatchBuilder({ kind: 'type-letter', letter: l });
}

export function dispatchBackspace(): void {
  dispatchBuilder({ kind: 'backspace' });
}

export function dispatchEscape(): void {
  dispatchBuilder({ kind: 'escape' });
}

export function dispatchSwitchToFill(): void {
  dispatchBuilder({ kind: 'switch-to-fill' });
}

export function dispatchRequestSwitchToDesign(): void {
  dispatchBuilder({ kind: 'request-switch-to-design' });
}

export function dispatchExportIncomplete(): void {
  dispatchBuilder({ kind: 'export-incomplete' });
}

export function dispatchExportComplete(): void {
  dispatchBuilder({ kind: 'export-complete' });
}

export function dispatchRequestResetBuilder(): void {
  dispatchBuilder({ kind: 'request-reset-builder' });
}

export function dispatchMoveCursor(direction: 'across' | 'down', sign: -1 | 1): void {
  dispatchBuilder({ kind: 'move-cursor', direction, sign });
}

export function dispatchToggleMarker(
  flag: 'space-right' | 'space-bottom' | 'hyphen-right' | 'hyphen-bottom',
): void {
  dispatchBuilder({ kind: 'toggle-marker', flag });
}

export function dispatchEditTitle(title: string): void {
  const t = Title.try(title);
  if (t === null) return;
  dispatchBuilder({ kind: 'edit-title', title: t });
}

export function dispatchEditAuthor(author: string): void {
  const a = Author.try(author);
  if (a === null) return;
  dispatchBuilder({ kind: 'edit-author', author: a });
}

export function dispatchRequestImportPuzzle(fileContent: string): void {
  dispatchBuilder({ kind: 'request-import-puzzle', fileContent });
}
