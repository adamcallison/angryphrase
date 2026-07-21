import type { ChainViolation } from '../../../src/domain/chain/ChainViolation';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import type { WordKey } from '../../../src/domain/word/WordKey';

describe('ChainViolation', () => {
  it('ChainViolation types are constructible', () => {
    const key: WordKey = { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' as const };

    const cycle: ChainViolation = { kind: 'cycle', involved: [key] };
    const branch: ChainViolation = { kind: 'branch', target: key, sources: [key] };
    const dangling: ChainViolation = { kind: 'dangling', source: key, missingTarget: key };
    const selfReference: ChainViolation = { kind: 'self-reference', word: key };

    expect(cycle.kind).toBe('cycle');
    expect(branch.kind).toBe('branch');
    expect(dangling.kind).toBe('dangling');
    expect(selfReference.kind).toBe('self-reference');
  });
});
