import type { Row } from '../../domain/grid/Row';
import type { Col } from '../../domain/grid/Col';
import type { GridSize } from '../../domain/grid/GridSize';
import type { CellMarkerFlag } from '../../domain/grid/CellMarkerFlag';
import type {
  SelectCellIntent,
  MoveCursorIntent,
  TypeLetterIntent,
  BackspaceIntent,
  EscapeIntent,
  ClickCluePanelWordIntent,
} from '../../domain/grid/GridInteraction';
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
  | SelectCellIntent
  | MoveCursorIntent
  // fill — typing
  | TypeLetterIntent
  | BackspaceIntent
  // fill — markers
  | { kind: 'toggle-marker'; flag: CellMarkerFlag }
  // fill — clues
  | { kind: 'edit-clue'; wordKey: WordKey; clue: string }
  // fill — chains
  | { kind: 'begin-join'; source: WordKey }
  | ClickCluePanelWordIntent
  | { kind: 'click-grid-word'; wordKey: WordKey }
  | { kind: 'unjoin'; source: WordKey }
  | EscapeIntent
  // displaced clues
  | { kind: 'begin-reattach'; displacedClueId: DisplacedClueId }
  | { kind: 'delete-displaced-clue'; id: DisplacedClueId }
  // metadata
  | { kind: 'edit-title'; title: Title }
  | { kind: 'edit-author'; author: Author }
  // import / export
  | { kind: 'request-import-puzzle'; fileContent: string }
  | { kind: 'confirm-import-puzzle'; fileContent: string }
  // dispatched by the Builder toolbar facade when FilePickPort.readDroppedFile returns { kind: 'failed' }; emits error toast, state unchanged (kind shared with PlayerIntent — routes via AMBIGUOUS_INTENT_KINDS)
  | { kind: 'report-import-read-failure' }
  // dispatched by the Builder toolbar facade when FilePickPort.pickFile returns { kind: 'failed' }; emits error toast, state unchanged (kind shared with PlayerIntent — routes via AMBIGUOUS_INTENT_KINDS)
  | { kind: 'report-pick-failure' }
  | { kind: 'export-incomplete' }
  | { kind: 'export-complete' }
  // lifecycle
  | { kind: 'request-reset-builder' }
  | { kind: 'confirm-reset-builder' };
