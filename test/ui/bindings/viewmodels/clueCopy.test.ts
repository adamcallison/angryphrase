import { describe, it, expect } from 'vitest';
import { renderDisplayClue, renderLengthPatternLabel } from '../../../../src/ui/bindings/viewmodels/clueCopy';

describe('clueCopy', () => {
  it('renderDisplayClue: head fact returns the clue verbatim', () => {
    expect(renderDisplayClue({ kind: 'head', clue: 'Head clue' })).toBe('Head clue');
  });

  it('renderDisplayClue: head fact with an empty clue returns an empty string', () => {
    expect(renderDisplayClue({ kind: 'head', clue: '' })).toBe('');
  });

  it('renderDisplayClue: across reference renders "See 3 Across"', () => {
    expect(
      renderDisplayClue({ kind: 'reference', headNumber: 3, headDirection: 'across' }),
    ).toBe('See 3 Across');
  });

  it('renderDisplayClue: down reference renders "See 7 Down"', () => {
    expect(
      renderDisplayClue({ kind: 'reference', headNumber: 7, headDirection: 'down' }),
    ).toBe('See 7 Down');
  });

  it('renderLengthPatternLabel: a single run renders "(5)"', () => {
    expect(renderLengthPatternLabel([5])).toBe('(5)');
  });

  it("renderLengthPatternLabel: [2, 'space', 2, 'hyphen', 2] renders \"(2, 2-2)\"", () => {
    expect(renderLengthPatternLabel([2, 'space', 2, 'hyphen', 2])).toBe('(2, 2-2)');
  });

  it("renderLengthPatternLabel: a 'none' token renders as empty", () => {
    expect(renderLengthPatternLabel([2, 'none', 3])).toBe('(23)');
  });
});
