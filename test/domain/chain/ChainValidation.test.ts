import { ChainValidation } from '../../../src/domain/chain/ChainValidation';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import type { Word } from '../../../src/domain/word/Word';
import type { WordKey as WordKeyType } from '../../../src/domain/word/WordKey';
import type { Direction } from '../../../src/domain/word/Direction';

function makeWord(
  row: number,
  col: number,
  direction: Direction,
  next: WordKeyType | null = null,
): Word {
  return {
    key: { startRow: Row.of(row), startCol: Col.of(col), direction },
    number: WordNumber.of(1),
    length: 2,
    clue: '',
    nextWord: next,
  };
}

describe('ChainValidation', () => {
  it('validate returns empty for empty words', () => {
    expect(ChainValidation.validate([])).toStrictEqual([]);
  });

  it('validate returns no violations for words with all null nextWord', () => {
    const a = makeWord(0, 0, 'across');
    const b = makeWord(0, 2, 'across');
    expect(ChainValidation.validate([a, b])).toStrictEqual([]);
  });

  it('validate returns no violations for a clean 2-word chain A→B (A.nextWord=B, B.nextWord=null)', () => {
    const b = makeWord(0, 2, 'across');
    const a = makeWord(0, 0, 'across', b.key);
    expect(ChainValidation.validate([a, b])).toStrictEqual([]);
  });

  it('validate returns no violations for a clean 3-word chain A→B→C', () => {
    const c = makeWord(0, 4, 'across');
    const b = makeWord(0, 2, 'across', c.key);
    const a = makeWord(0, 0, 'across', b.key);
    expect(ChainValidation.validate([a, b, c])).toStrictEqual([]);
  });

  it('validate detects self-reference', () => {
    const a = makeWord(0, 0, 'across');
    const broken = { ...a, nextWord: a.key };
    expect(ChainValidation.validate([broken])).toStrictEqual([
      { kind: 'self-reference', word: broken.key },
    ]);
  });

  it('validate detects dangling', () => {
    const missing: WordKeyType = { startRow: Row.of(9), startCol: Col.of(9), direction: 'down' as const };
    const a = makeWord(0, 0, 'across', missing);
    expect(ChainValidation.validate([a])).toStrictEqual([
      { kind: 'dangling', source: a.key, missingTarget: missing },
    ]);
  });

  it('validate detects a cycle of length 2: A→B→A', () => {
    const a = makeWord(0, 0, 'across');
    const b = makeWord(0, 2, 'across', a.key);
    const aa = { ...a, nextWord: b.key };
    expect(ChainValidation.validate([aa, b])).toStrictEqual([
      { kind: 'cycle', involved: [aa.key, b.key] },
    ]);
  });

  it('validate detects a cycle of length 3: A→B→C→A', () => {
    const a = makeWord(0, 0, 'across');
    const c = makeWord(0, 4, 'across', a.key);
    const b = makeWord(0, 2, 'across', c.key);
    const aa = { ...a, nextWord: b.key };
    expect(ChainValidation.validate([aa, b, c])).toStrictEqual([
      { kind: 'cycle', involved: [aa.key, b.key, c.key] },
    ]);
  });

  it('validate detects a branch: two words pointing at the same target', () => {
    const c = makeWord(0, 4, 'across');
    const a = makeWord(0, 0, 'across', c.key);
    const b = makeWord(0, 2, 'across', c.key);
    expect(ChainValidation.validate([a, b, c])).toStrictEqual([
      { kind: 'branch', target: c.key, sources: [a.key, b.key] },
    ]);
  });

  it('validate detects multiple separate violations in the same input', () => {
    const a = makeWord(0, 0, 'across');
    const brokenA = { ...a, nextWord: a.key };
    const missing: WordKeyType = { startRow: Row.of(9), startCol: Col.of(9), direction: 'down' as const };
    const b = makeWord(0, 2, 'across', missing);
    expect(ChainValidation.validate([brokenA, b])).toStrictEqual([
      { kind: 'self-reference', word: brokenA.key },
      { kind: 'dangling', source: b.key, missingTarget: missing },
    ]);
  });
});
