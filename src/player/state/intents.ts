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
  | { kind: 'import-puzzle'; target: 'player'; fileContent: string }            // complete format only; on reject sets lastImportError and emits toast; on success emits `load-player-progress` event (bindings layer then dispatches apply-loaded-progress)
  // dispatched by the Player import screen facade when FilePickPort.readDroppedFile returns { kind: 'failed' }; sets lastImportError + emits error toast (kind shared with BuilderIntent)
  | { kind: 'report-import-read-failure'; target: 'player' }
  // dispatched by the Player import screen facade when FilePickPort.pickFile returns { kind: 'failed' }; sets lastImportError + emits error toast (kind shared with BuilderIntent)
  | { kind: 'report-pick-failure'; target: 'player' }
  | { kind: 'apply-loaded-progress'; target: 'player'; playerLetters: (Letter|null)[][]; savedGridSize: GridSize }  // dispatched by the bindings layer after observing `load-player-progress`; the reducer applies the saved letters only to white cells of a matching grid size
  | { kind: 'import-new-puzzle'; target: 'player' }                              // returns to 'import' phase, retains autosaved progress in localStorage
  // solving — cell & cursor
  | ({ target: 'player' } & SelectCellIntent)
  | ({ target: 'player' } & MoveCursorIntent)
  | ({ target: 'player' } & TypeLetterIntent)
  | ({ target: 'player' } & BackspaceIntent)
  | ({ target: 'player' } & EscapeIntent)                                               // closes anagram modal; no sub-modes in Player
  | ({ target: 'player' } & ClickCluePanelWordIntent)
  // checking
  | { kind: 'check'; target: 'player' }                                          // sets checkResult
  | { kind: 'clear-errors'; target: 'player' }                                   // only valid when checkResult has incorrectCells
  // lifecycle
  | { kind: 'request-reset-player'; target: 'player' }                           // guarded
  | { kind: 'confirm-reset-player'; target: 'player' }                            // dispatched by Modal Confirm; clears player letters, removes cursor,
                                                              //   emits `clear-player-storage { key }` event
  // anagram
  | { kind: 'open-anagram-helper'; target: 'player' }
  | { kind: 'close-anagram-helper'; target: 'player' }                          // closes the anagram modal
  | { kind: 'anagram-input'; target: 'player'; input: string }                  // the reducer filters to A-Z, uppercases, and clamps to the word length
  | { kind: 'anagram-scramble'; target: 'player' };                              // reducer calls Anagram.scramble(deps.rng) directly and writes scrambledArrangement into PlayerState
