import type { ToastReason } from '../../../domain/notifications/ToastReason';
import { GridSize } from '../../../domain/grid/GridSize';

export function renderToastReason(reason: ToastReason): string {
  switch (reason.code) {
    case 'word-reconciled':
      return `Word ${Number(reason.number)} ${reason.direction} was ${reason.change}.`;
    case 'import-parse-failures':
      return reason.messages.join('\n');
    case 'import-read-failure':
      return 'Could not read that file. Please try again.';
    case 'import-pick-failure':
      return 'Could not open or read that file. Please try again.';
    case 'import-file-incomplete':
      return 'Only complete puzzle files can be loaded into the Player.';
    case 'export-completeness-violation':
      switch (reason.violation.kind) {
        case 'missing-answer-letter':
          return `Missing answer letter at row ${Number(reason.violation.row)}, col ${Number(reason.violation.col)}.`;
        case 'missing-clue':
          return `Missing clue for word ${Number(reason.violation.wordNumber)} ${reason.violation.direction}.`;
        case 'non-head-clue':
          return `Word ${Number(reason.violation.wordNumber)} ${reason.violation.direction} is a non-head chain word with a non-empty clue.`;
      }
      break;
    case 'export-displaced-clues':
      return `Exported without ${reason.count} displaced clue${reason.count === 1 ? '' : 's'}. They remain in the Displaced Clues panel.`;
    case 'edit-clue-non-head':
      return 'Cannot edit clue of a non-head chain word.';
    case 'chain-admission-rejected':
      switch (reason.reason) {
        case 'source-not-found':
          return 'Source word not found.';
        case 'target-not-found':
          return 'Target word not found.';
        case 'source-has-link':
          return 'Source already has a chain link.';
        case 'target-already-linked':
          return 'Target is already linked to by another word.';
        case 'clue-not-found':
          return 'Displaced clue not found.';
        case 'target-has-clue':
          return 'Target already has a clue.';
        case 'target-non-head':
          return 'Target is a non-head chain word and cannot be given a clue.';
      }
      break;
    case 'download-failure':
      return 'Download failed. Please try again.';
    case 'grid-size-invalid':
      return `Grid size must be a whole number between ${Number(GridSize.MIN)} and ${Number(GridSize.MAX)}.`;
  }
}
