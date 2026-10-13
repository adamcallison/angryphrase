import { describe, it, expect } from 'vitest';
import { ChainAdmission } from '../../../src/domain/chain/ChainAdmission';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import { WordLength } from '../../../src/domain/word/WordLength';
import { DisplacedClue } from '../../../src/domain/builder/DisplacedClue';
import { SeededRng } from '../../fakes/SeededRng';
import type { Word } from '../../../src/domain/word/Word';
import type { Direction } from '../../../src/domain/word/Direction';


function makeWord(
  row: number,
  col: number,
  direction: Direction,
  number: number,
  clue: string,
  next: Word['key'] | null = null,
): Word {
  return {
    key: { startRow: Row.of(row), startCol: Col.of(col), direction },
    number: WordNumber.of(number),
    length: WordLength.of(2),
    clue,
    nextWord: next,
  };
}

describe('ChainAdmission', () => {
  describe('canLink', () => {
    it('canLink: returns ok when source and target are distinct unlinked words', () => {
      const source = makeWord(0, 0, 'across', 1, 'source clue');
      const target = makeWord(1, 0, 'down', 2, 'target clue');

      expect(ChainAdmission.canLink([source, target], source.key, target.key)).toStrictEqual({
        ok: true,
      });
    });

    it('canLink: returns source-not-found when source key is not in words', () => {
      const target = makeWord(0, 0, 'across', 1, 'target clue');
      const missing = makeWord(2, 2, 'down', 9, 'missing').key;

      expect(ChainAdmission.canLink([target], missing, target.key)).toStrictEqual({
        ok: false,
        reason: 'source-not-found',
      });
    });

    it('canLink: returns target-not-found when target key is not in words', () => {
      const source = makeWord(0, 0, 'across', 1, 'source clue');
      const missing = makeWord(2, 2, 'down', 9, 'missing').key;

      expect(ChainAdmission.canLink([source], source.key, missing)).toStrictEqual({
        ok: false,
        reason: 'target-not-found',
      });
    });

    it('canLink: returns source-has-link when source already has a nextWord (FR-35b)', () => {
      const tail = makeWord(0, 2, 'across', 2, 'tail clue');
      const source = makeWord(0, 0, 'across', 1, 'source clue', tail.key);
      const target = makeWord(1, 0, 'down', 3, 'target clue');

      expect(ChainAdmission.canLink([source, tail, target], source.key, target.key)).toStrictEqual({
        ok: false,
        reason: 'source-has-link',
      });
    });

    it('canLink: returns target-already-linked when another word points to target (FR-35c)', () => {
      const target = makeWord(0, 2, 'across', 2, 'target clue');
      const other = makeWord(0, 0, 'across', 1, 'other clue', target.key);
      const source = makeWord(1, 0, 'down', 3, 'source clue');

      expect(ChainAdmission.canLink([other, target, source], source.key, target.key)).toStrictEqual({
        ok: false,
        reason: 'target-already-linked',
      });
    });

    it('canLink: returns ok even when target has a non-empty clue (clue displacement is Builder policy, not admission)', () => {
      const source = makeWord(0, 0, 'across', 1, 'source clue');
      const target = makeWord(1, 0, 'down', 2, 'target clue');

      expect(ChainAdmission.canLink([source, target], source.key, target.key)).toStrictEqual({
        ok: true,
      });
    });

    it('canLink: returns ok when target is a non-head chain word (chain-head is reattach concern, not link concern)', () => {
      const source = makeWord(0, 0, 'across', 1, 'source clue');
      const target = makeWord(1, 0, 'down', 2, 'target clue');
      const chainTail = makeWord(2, 0, 'down', 3, 'tail clue');
      const targetWithOutgoing = { ...target, nextWord: chainTail.key };

      expect(
        ChainAdmission.canLink([source, targetWithOutgoing, chainTail], source.key, target.key),
      ).toStrictEqual({ ok: true });
    });
  });

  describe('canReattach', () => {
    it('canReattach: returns ok when target is a chain head with empty clue', () => {
      const rng = new SeededRng(42);
      const target = makeWord(0, 0, 'across', 1, '');
      const other = makeWord(1, 0, 'down', 2, '');
      const clue = DisplacedClue.create(rng, 'displaced', 'across');

      expect(ChainAdmission.canReattach([target, other], [clue], clue.id, target.key)).toStrictEqual(
        { ok: true },
      );
    });

    it('canReattach: returns clue-not-found when displacedClueId is not in displacedClues', () => {
      const rng = new SeededRng(1);
      const target = makeWord(0, 0, 'across', 1, '');
      const existing = DisplacedClue.create(rng, 'existing', 'across');
      const missing = DisplacedClue.create(new SeededRng(2), 'missing', 'down').id;

      expect(
        ChainAdmission.canReattach([target], [existing], missing, target.key),
      ).toStrictEqual({ ok: false, reason: 'clue-not-found' });
    });

    it('canReattach: returns target-not-found when target key is not in words', () => {
      const rng = new SeededRng(3);
      const clue = DisplacedClue.create(rng, 'clue', 'across');
      const target = makeWord(0, 0, 'across', 1, '').key;

      expect(ChainAdmission.canReattach([], [clue], clue.id, target)).toStrictEqual({
        ok: false,
        reason: 'target-not-found',
      });
    });

    it('canReattach: returns target-has-clue when target clue is non-empty (FR-42b)', () => {
      const rng = new SeededRng(4);
      const target = makeWord(0, 0, 'across', 1, 'already has clue');
      const clue = DisplacedClue.create(rng, 'clue', 'across');

      expect(ChainAdmission.canReattach([target], [clue], clue.id, target.key)).toStrictEqual({
        ok: false,
        reason: 'target-has-clue',
      });
    });

    it('canReattach: returns target-non-head when target is pointed to by another word (FR-42c)', () => {
      const rng = new SeededRng(5);
      const target = makeWord(1, 0, 'down', 2, '');
      const head = makeWord(0, 0, 'across', 1, 'head clue', target.key);
      const clue = DisplacedClue.create(rng, 'clue', 'across');

      expect(ChainAdmission.canReattach([head, target], [clue], clue.id, target.key)).toStrictEqual(
        { ok: false, reason: 'target-non-head' },
      );
    });

    it('canReattach: returns ok when displaced clue is on a different direction than the target', () => {
      const rng = new SeededRng(6);
      const target = makeWord(0, 0, 'across', 1, '');
      const clue = DisplacedClue.create(rng, 'down clue', 'down');

      expect(ChainAdmission.canReattach([target], [clue], clue.id, target.key)).toStrictEqual({
        ok: true,
      });
    });
  });

  describe('message', () => {
    it('message: returns exact string for source-not-found', () => {
      expect(ChainAdmission.message({ ok: false, reason: 'source-not-found' })).toBe(
        'Source word not found.',
      );
    });

    it('message: returns exact string for target-not-found', () => {
      expect(ChainAdmission.message({ ok: false, reason: 'target-not-found' })).toBe(
        'Target word not found.',
      );
    });

    it('message: returns exact string for source-has-link', () => {
      expect(ChainAdmission.message({ ok: false, reason: 'source-has-link' })).toBe(
        'Source already has a chain link.',
      );
    });

    it('message: returns exact string for target-already-linked', () => {
      expect(ChainAdmission.message({ ok: false, reason: 'target-already-linked' })).toBe(
        'Target is already linked to by another word.',
      );
    });

    it('message: returns exact string for clue-not-found', () => {
      expect(ChainAdmission.message({ ok: false, reason: 'clue-not-found' })).toBe(
        'Displaced clue not found.',
      );
    });

    it('message: returns exact string for target-has-clue', () => {
      expect(ChainAdmission.message({ ok: false, reason: 'target-has-clue' })).toBe(
        'Target already has a clue.',
      );
    });

    it('message: returns exact string for target-non-head', () => {
      expect(ChainAdmission.message({ ok: false, reason: 'target-non-head' })).toBe(
        'Target is a non-head chain word and cannot be given a clue (FR-31).',
      );
    });

    it('message: returns empty string for ok result', () => {
      expect(ChainAdmission.message({ ok: true })).toBe('');
    });
  });
});
