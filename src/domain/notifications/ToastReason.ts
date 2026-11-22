// The toast reason taxonomy: a fact union on `code`, never copy.
// Params are domain facts only; the one string exception is the blessed
// parse-failure list (domain/format/v1.ts diagnostics). Rendered only by
// ui/bindings/viewmodels/toastCopy (copy-home stage 3).

import type { WordNumber } from '../word/WordNumber';
import type { Direction } from '../word/Direction';
import type { CompletenessViolation } from '../puzzle/CompletenessCheck';
import type { LinkRejection, ReattachRejection } from '../chain/ChainAdmission';

export type ToastReason =
  | { code: 'word-reconciled'; number: WordNumber; direction: Direction; change: 'shortened' | 'lengthened' }
  | { code: 'import-parse-failures'; messages: string[] }
  | { code: 'import-read-failure' }
  | { code: 'import-pick-failure' }
  | { code: 'import-url-load-failure' }
  | { code: 'import-file-incomplete' }
  | { code: 'export-completeness-violation'; violation: CompletenessViolation }
  | { code: 'export-displaced-clues'; count: number }
  | { code: 'edit-clue-non-head' }
  | { code: 'chain-admission-rejected'; reason: LinkRejection | ReattachRejection }
  | { code: 'download-failure' }
  | { code: 'grid-size-invalid' };
