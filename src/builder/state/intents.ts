import type { Row } from '../../domain/grid/Row';
import type { Col } from '../../domain/grid/Col';
import type { GridSize } from '../../domain/grid/GridSize';
import type { CellSeparator } from '../../domain/grid/CellSeparator';
import type { CellMarkerAxis } from '../../domain/grid/CellMarker';
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
  | { target: 'builder'; kind: 'switch-to-fill' }
  | { target: 'builder'; kind: 'request-switch-to-design' }
  | { target: 'builder'; kind: 'confirm-switch-to-design' }
  // design
  | { target: 'builder'; kind: 'toggle-design-cell'; row: Row; col: Col }
  | { target: 'builder'; kind: 'change-grid-size'; size: GridSize }
  // fill — cell selection & cursor
  | ({ target: 'builder' } & SelectCellIntent)
  | ({ target: 'builder' } & MoveCursorIntent)
  // fill — typing
  | ({ target: 'builder' } & TypeLetterIntent)
  | ({ target: 'builder' } & BackspaceIntent)
  // fill — markers
  | { target: 'builder'; kind: 'set-marker'; axis: CellMarkerAxis; separator: CellSeparator }
  // fill — clues
  | { target: 'builder'; kind: 'edit-clue'; wordKey: WordKey; clue: string }
  // fill — chains
  | { target: 'builder'; kind: 'begin-join'; source: WordKey }
  | ({ target: 'builder' } & ClickCluePanelWordIntent)
  | { target: 'builder'; kind: 'click-grid-word'; wordKey: WordKey }
  | { target: 'builder'; kind: 'unjoin'; source: WordKey }
  | ({ target: 'builder' } & EscapeIntent)
  // displaced clues
  | { target: 'builder'; kind: 'begin-reattach'; displacedClueId: DisplacedClueId }
  | { target: 'builder'; kind: 'delete-displaced-clue'; id: DisplacedClueId }
  // metadata
  | { target: 'builder'; kind: 'edit-title'; title: Title }
  | { target: 'builder'; kind: 'edit-author'; author: Author }
  // import / export
  | { target: 'builder'; kind: 'request-import-puzzle'; fileContent: string }
  | { target: 'builder'; kind: 'confirm-import-puzzle'; fileContent: string }
  // dispatched by the Builder toolbar facade when FilePickPort.readDroppedFile returns { kind: 'failed' }; emits error toast, state unchanged (kind shared with PlayerIntent — routes via AMBIGUOUS_INTENT_KINDS)
  | { target: 'builder'; kind: 'report-import-read-failure' }
  // dispatched by the Builder toolbar facade when FilePickPort.pickFile returns { kind: 'failed' }; emits error toast, state unchanged (kind shared with PlayerIntent — routes via AMBIGUOUS_INTENT_KINDS)
  | { target: 'builder'; kind: 'report-pick-failure' }
  | { target: 'builder'; kind: 'export-incomplete' }
  | { target: 'builder'; kind: 'export-complete' }
  // lifecycle
  | { target: 'builder'; kind: 'request-reset-builder' }
  | { target: 'builder'; kind: 'confirm-reset-builder' };
