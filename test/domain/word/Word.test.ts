import type { Word } from '../../../src/domain/word/Word';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';

describe('Word', () => {
  it('Word type is an immutable record', () => {
    const word: Word = {
      key: { startRow: Row.of(0), startCol: Col.of(1), direction: 'across' as const },
      number: WordNumber.of(1),
      length: 3,
      clue: 'A test clue',
      nextWord: null,
    };

    expect(word.key.startRow).toBe(0);
    expect(word.key.startCol).toBe(1);
    expect(word.key.direction).toBe('across');
    expect(word.number).toBe(1);
    expect(word.length).toBe(3);
    expect(word.clue).toBe('A test clue');
    expect(word.nextWord).toBeNull();
  });
});
