import type { Row } from '../../domain/grid/Row';
import type { Col } from '../../domain/grid/Col';
import type { GridSize } from '../../domain/grid/GridSize';
import type { Direction } from '../../domain/word/Direction';
import type { Letter } from '../../domain/letter/Letter';
import type { CellMarkerFlag } from '../../domain/grid/CellMarkerFlag';
import type { WordKey } from '../../domain/word/WordKey';
import type { DisplacedClueId } from '../../domain/builder/DisplacedClueId';
import type { Title } from '../../domain/puzzle/Title';
import type { Author } from '../../domain/puzzle/Author';

export type BuilderIntent =
  // mode
  | { kind: 'switch-to-fill' }
  | { kind: 'request-switch-to-design' }
  | { kind: 'confirm-switch-to-design' }
  // design
  | { kind: 'toggle-design-cell'; row: Row; col: Col }
  | { kind: 'change-grid-size'; size: GridSize }
  // fill — cell selection & cursor
  | { kind: 'select-cell'; row: Row; col: Col }
  | { kind: 'move-cursor'; direction: Direction }
  // fill — typing
  | { kind: 'type-letter'; letter: Letter }
  | { kind: 'backspace' }
  // fill — markers
  | { kind: 'toggle-marker'; flag: CellMarkerFlag }
  // fill — clues
  | { kind: 'edit-clue'; wordKey: WordKey; clue: string }
  // fill — chains
  | { kind: 'begin-join'; source: WordKey }
  | { kind: 'click-clue-panel-word'; wordKey: WordKey }
  | { kind: 'click-grid-word'; wordKey: WordKey }
  | { kind: 'unjoin'; source: WordKey }
  | { kind: 'escape' }
  // displaced clues
  | { kind: 'begin-reattach'; displacedClueId: DisplacedClueId }
  | { kind: 'delete-displaced-clue'; id: DisplacedClueId }
  // metadata
  | { kind: 'edit-title'; title: Title }
  | { kind: 'edit-author'; author: Author }
  // import / export
  | { kind: 'request-import-puzzle'; fileContent: string }
  | { kind: 'confirm-import-puzzle'; fileContent: string }
  | { kind: 'export-incomplete' }
  | { kind: 'export-complete' }
  // lifecycle
  | { kind: 'request-reset-builder' }
  | { kind: 'confirm-reset-builder' };
