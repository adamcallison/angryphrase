import type { GridSize } from '../../domain/grid/GridSize';
import type { Row } from '../../domain/grid/Row';
import type { Col } from '../../domain/grid/Col';
import type { Letter } from '../../domain/letter/Letter';
import type { Direction } from '../../domain/word/Direction';
import type { WordKey } from '../../domain/word/WordKey';

export type PlayerIntent =
  // import (NOT guarded — Player import has no existing work to overwrite; progress is keyed and retained)
  | { kind: 'import-puzzle'; fileContent: string }            // FR-67; complete format only; on reject sets lastImportError and emits toast; on success emits `load-player-progress` event (bindings layer then dispatches apply-loaded-progress)
  | { kind: 'apply-loaded-progress'; playerLetters: (Letter|null)[][]; savedGridSize: GridSize }  // dispatched by the bindings layer after observing `load-player-progress`; reducer applies FR-80 rules
  | { kind: 'import-new-puzzle' }                              // FR-78; returns to 'import' phase, retains autosaved progress in localStorage
  // solving — cell & cursor
  | { kind: 'select-cell'; row: Row; col: Col }
  | { kind: 'move-cursor'; direction: Direction; sign: -1 | 1 }
  | { kind: 'type-letter'; letter: Letter }
  | { kind: 'backspace' }
  | { kind: 'escape' }                                          // closes anagram modal (FR-89); no sub-modes in Player
  | { kind: 'click-clue-panel-word'; wordKey: WordKey }
  // checking
  | { kind: 'check' }                                          // FR-74; sets checkResult
  | { kind: 'clear-errors' }                                   // FR-75; only valid when checkResult has incorrectCells
  // lifecycle
  | { kind: 'request-reset-player' }                           // guarded (FR-77)
  | { kind: 'confirm-reset-player' }                            // dispatched by Modal Confirm; clears player letters, removes cursor,
                                                              //   emits `clear-player-storage { key }` event
  // anagram
  | { kind: 'open-anagram-helper' }
  | { kind: 'close-anagram-helper' }                          // FR-89
  | { kind: 'anagram-input'; input: string }                  // FR-83
  | { kind: 'anagram-scramble' };                              // FR-86 — reducer calls Anagram.scramble(deps.rng) directly and writes scrambledArrangement into PlayerState
