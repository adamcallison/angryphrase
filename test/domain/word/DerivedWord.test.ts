import { describe, expect, it } from 'vitest';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { WordLength } from '../../../src/domain/word/WordLength';
import type { DerivedWord } from '../../../src/domain/word/DerivedWord';

describe('DerivedWord', () => {
  it('DerivedWord type compiles', () => {
    const word: DerivedWord = {
      key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
      length: WordLength.of(3),
      clue: '',
      nextWord: null,
    };

    expect(word.length).toBe(3);
    expect(word.clue).toBe('');
    expect(word.nextWord).toBeNull();
  });
});
