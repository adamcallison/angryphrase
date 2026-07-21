import { WordKey } from '../../../src/domain/word/WordKey';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';

describe('WordKey', () => {
  it('WordKey.equals returns true for identical keys, false for any field difference', () => {
    const a = { startRow: Row.of(0), startCol: Col.of(3), direction: 'across' as const };
    const b = { startRow: Row.of(0), startCol: Col.of(3), direction: 'across' as const };
    const differentRow = { startRow: Row.of(1), startCol: Col.of(3), direction: 'across' as const };
    const differentCol = { startRow: Row.of(0), startCol: Col.of(4), direction: 'across' as const };
    const differentDirection = { startRow: Row.of(0), startCol: Col.of(3), direction: 'down' as const };

    expect(WordKey.equals(a, b)).toBe(true);
    expect(WordKey.equals(a, differentRow)).toBe(false);
    expect(WordKey.equals(a, differentCol)).toBe(false);
    expect(WordKey.equals(a, differentDirection)).toBe(false);
  });

  it('WordKey.toCanonical produces "<row>,<col>,<direction>" form', () => {
    const key = { startRow: Row.of(0), startCol: Col.of(3), direction: 'across' as const };
    expect(WordKey.toCanonical(key)).toBe('0,3,across');
  });

  it('WordKey.toCanonical distinguishes directions at same start', () => {
    const across = { startRow: Row.of(2), startCol: Col.of(5), direction: 'across' as const };
    const down = { startRow: Row.of(2), startCol: Col.of(5), direction: 'down' as const };
    expect(WordKey.toCanonical(across)).toBe('2,5,across');
    expect(WordKey.toCanonical(down)).toBe('2,5,down');
    expect(WordKey.toCanonical(across)).not.toBe(WordKey.toCanonical(down));
  });
});
