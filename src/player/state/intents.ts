import type { GridSize } from '../../domain/grid/GridSize';
import type { Letter } from '../../domain/letter/Letter';
import type {
  SelectCellIntent,
  MoveCursorIntent,
  TypeLetterIntent,
  BackspaceIntent,
  EscapeIntent,
  ClickCluePanelWordIntent,
} from '../../domain/grid/GridInteraction';


export type PlayerIntent =
  // import (NOT guarded — Player import has no existing work to overwrite; progress is keyed and retained)
  | { kind: 'import-puzzle'; target: 'player'; fileContent: string }            // FR-67; complete format only; on reject sets lastImportError and emits toast; on success emits `load-player-progress` event (bindings layer then dispatches apply-loaded-progress)
  // dispatched by the Player import screen facade when FilePickPort.readDroppedFile returns { kind: 'failed' }; sets lastImportError + emits error toast (kind shared with BuilderIntent)
  | { kind: 'report-import-read-failure'; target: 'player' }
  // dispatched by the Player import screen facade when FilePickPort.pickFile returns { kind: 'failed' }; sets lastImportError + emits error toast (kind shared with BuilderIntent)
  | { kind: 'report-pick-failure'; target: 'player' }
  | { kind: 'apply-loaded-progress'; target: 'player'; playerLetters: (Letter|null)[][]; savedGridSize: GridSize }  // dispatched by the bindings layer after observing `load-player-progress`; reducer applies FR-80 rules
  | { kind: 'import-new-puzzle'; target: 'player' }                              // FR-78; returns to 'import' phase, retains autosaved progress in localStorage
  // solving — cell & cursor
  | ({ target: 'player' } & SelectCellIntent)
  | ({ target: 'player' } & MoveCursorIntent)
  | ({ target: 'player' } & TypeLetterIntent)
  | ({ target: 'player' } & BackspaceIntent)
  | ({ target: 'player' } & EscapeIntent)                                               // closes anagram modal (FR-89); no sub-modes in Player
  | ({ target: 'player' } & ClickCluePanelWordIntent)
  // checking
  | { kind: 'check'; target: 'player' }                                          // FR-74; sets checkResult
  | { kind: 'clear-errors'; target: 'player' }                                   // FR-75; only valid when checkResult has incorrectCells
  // lifecycle
  | { kind: 'request-reset-player'; target: 'player' }                           // guarded (FR-77)
  | { kind: 'confirm-reset-player'; target: 'player' }                            // dispatched by Modal Confirm; clears player letters, removes cursor,
                                                              //   emits `clear-player-storage { key }` event
  // anagram
  | { kind: 'open-anagram-helper'; target: 'player' }
  | { kind: 'close-anagram-helper'; target: 'player' }                          // FR-89
  | { kind: 'anagram-input'; target: 'player'; input: string }                  // FR-83
  | { kind: 'anagram-scramble'; target: 'player' };                              // FR-86 — reducer calls Anagram.scramble(deps.rng) directly and writes scrambledArrangement into PlayerState
