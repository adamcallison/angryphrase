import { describe, it, expect } from 'vitest';
import { renderToastReason } from '../../../../src/ui/bindings/viewmodels/toastCopy';
import { WordNumber } from '../../../../src/domain/word/WordNumber';
import { Row } from '../../../../src/domain/grid/Row';
import { Col } from '../../../../src/domain/grid/Col';

describe('toastCopy', () => {
  it('word-reconciled: renders the word number, direction, and change', () => {
    expect(
      renderToastReason({ code: 'word-reconciled', number: WordNumber.of(5), direction: 'across', change: 'shortened' }),
    ).toBe('Word 5 across was shortened.');
  });

  it('import-parse-failures: renders a single message verbatim', () => {
    expect(
      renderToastReason({ code: 'import-parse-failures', messages: ['File is not valid JSON.'] }),
    ).toBe('File is not valid JSON.');
  });

  it('import-parse-failures: joins two messages with a newline', () => {
    expect(
      renderToastReason({ code: 'import-parse-failures', messages: ['File is not valid JSON.', 'Puzzle must have a grid.'] }),
    ).toBe('File is not valid JSON.\nPuzzle must have a grid.');
  });

  it('import-read-failure: renders the read-failure copy', () => {
    expect(renderToastReason({ code: 'import-read-failure' })).toBe('Could not read that file. Please try again.');
  });

  it('import-pick-failure: renders the pick-failure copy', () => {
    expect(renderToastReason({ code: 'import-pick-failure' })).toBe('Could not open or read that file. Please try again.');
  });

  it('import-url-load-failure: renders the url-load-failure copy', () => {
    expect(renderToastReason({ code: 'import-url-load-failure' })).toBe(
      'Could not load that URL. It may be mistyped, unreachable, or the server may not permit cross-site requests.',
    );
  });

  it('import-file-incomplete: renders the incomplete-file copy', () => {
    expect(renderToastReason({ code: 'import-file-incomplete' })).toBe('Only complete puzzle files can be loaded into the Player.');
  });

  it('export-completeness-violation: missing-answer-letter renders row and col', () => {
    expect(
      renderToastReason({
        code: 'export-completeness-violation',
        violation: { kind: 'missing-answer-letter', row: Row.of(2), col: Col.of(3) },
      }),
    ).toBe('Missing answer letter at row 2, col 3.');
  });

  it('export-completeness-violation: missing-clue renders word number and direction', () => {
    expect(
      renderToastReason({
        code: 'export-completeness-violation',
        violation: { kind: 'missing-clue', wordNumber: WordNumber.of(4), direction: 'down' },
      }),
    ).toBe('Missing clue for word 4 down.');
  });

  it('export-completeness-violation: non-head-clue renders word number and direction', () => {
    expect(
      renderToastReason({
        code: 'export-completeness-violation',
        violation: { kind: 'non-head-clue', wordNumber: WordNumber.of(9), direction: 'across' },
      }),
    ).toBe('Word 9 across is a non-head chain word with a non-empty clue.');
  });

  it('export-displaced-clues: a single displaced clue renders the singular form', () => {
    expect(renderToastReason({ code: 'export-displaced-clues', count: 1 })).toBe(
      'Exported without 1 displaced clue. They remain in the Displaced Clues panel.',
    );
  });

  it('export-displaced-clues: multiple displaced clues render the plural form', () => {
    expect(renderToastReason({ code: 'export-displaced-clues', count: 3 })).toBe(
      'Exported without 3 displaced clues. They remain in the Displaced Clues panel.',
    );
  });

  it('edit-clue-non-head: renders the non-head clue rejection copy', () => {
    expect(renderToastReason({ code: 'edit-clue-non-head' })).toBe('Cannot edit clue of a non-head chain word.');
  });

  it('chain-admission-rejected: source-not-found renders its copy', () => {
    expect(renderToastReason({ code: 'chain-admission-rejected', reason: 'source-not-found' })).toBe('Source word not found.');
  });

  it('chain-admission-rejected: target-not-found renders its copy', () => {
    expect(renderToastReason({ code: 'chain-admission-rejected', reason: 'target-not-found' })).toBe('Target word not found.');
  });

  it('chain-admission-rejected: source-has-link renders its copy', () => {
    expect(renderToastReason({ code: 'chain-admission-rejected', reason: 'source-has-link' })).toBe('Source already has a chain link.');
  });

  it('chain-admission-rejected: target-already-linked renders its copy', () => {
    expect(renderToastReason({ code: 'chain-admission-rejected', reason: 'target-already-linked' })).toBe(
      'Target is already linked to by another word.',
    );
  });

  it('chain-admission-rejected: clue-not-found renders its copy', () => {
    expect(renderToastReason({ code: 'chain-admission-rejected', reason: 'clue-not-found' })).toBe('Displaced clue not found.');
  });

  it('chain-admission-rejected: target-has-clue renders its copy', () => {
    expect(renderToastReason({ code: 'chain-admission-rejected', reason: 'target-has-clue' })).toBe('Target already has a clue.');
  });

  it('chain-admission-rejected: target-non-head renders its copy', () => {
    expect(renderToastReason({ code: 'chain-admission-rejected', reason: 'target-non-head' })).toBe(
      'Target is a non-head chain word and cannot be given a clue.',
    );
  });

  it('download-failure: renders the download-failure copy', () => {
    expect(renderToastReason({ code: 'download-failure' })).toBe('Download failed. Please try again.');
  });

  it('grid-size-invalid: renders the bounds from GridSize.MIN and GridSize.MAX', () => {
    expect(renderToastReason({ code: 'grid-size-invalid' })).toBe(
      'Grid size must be a whole number between 2 and 25.',
    );
  });
});
