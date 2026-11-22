// Single source of truth for whether a chain link or displaced-clue reattachment is admissible.

import type { Word } from '../word/Word';
import { WordKey } from '../word/WordKey';
import type { DisplacedClue } from '../builder/DisplacedClue';
import { DisplacedClueId } from '../builder/DisplacedClueId';

export type LinkRejection =
  | 'source-not-found'
  | 'target-not-found'
  | 'source-has-link'
  | 'target-already-linked';
export type ReattachRejection =
  | 'clue-not-found'
  | 'target-not-found'
  | 'target-has-clue'
  | 'target-non-head';
export type LinkAdmission =
  | { ok: true; source: Word; target: Word }
  | { ok: false; reason: LinkRejection };
export type ReattachAdmission =
  | { ok: true; clue: DisplacedClue; target: Word }
  | { ok: false; reason: ReattachRejection };

export const ChainAdmission: {
  canLink(words: readonly Word[], source: WordKey, target: WordKey): LinkAdmission;
  canReattach(
    words: readonly Word[],
    displacedClues: readonly DisplacedClue[],
    displacedClueId: DisplacedClueId,
    target: WordKey,
  ): ReattachAdmission;
} = {
  canLink(words: readonly Word[], source: WordKey, target: WordKey): LinkAdmission {
    const sourceWord = words.find(w => WordKey.equals(w.key, source));
    if (sourceWord === undefined) {
      return { ok: false, reason: 'source-not-found' };
    }

    const targetWord = words.find(w => WordKey.equals(w.key, target));
    if (targetWord === undefined) {
      return { ok: false, reason: 'target-not-found' };
    }

    if (sourceWord.nextWord !== null) {
      return { ok: false, reason: 'source-has-link' };
    }

    const targetAlreadyLinked = words.some(
      w => w.nextWord !== null && WordKey.equals(w.nextWord, target),
    );
    if (targetAlreadyLinked) {
      return { ok: false, reason: 'target-already-linked' };
    }

    return { ok: true, source: sourceWord, target: targetWord };
  },

  canReattach(
    words: readonly Word[],
    displacedClues: readonly DisplacedClue[],
    displacedClueId: DisplacedClueId,
    target: WordKey,
  ): ReattachAdmission {
    const displacedClue = displacedClues.find(d => DisplacedClueId.equals(d.id, displacedClueId));
    if (displacedClue === undefined) {
      return { ok: false, reason: 'clue-not-found' };
    }

    const targetWord = words.find(w => WordKey.equals(w.key, target));
    if (targetWord === undefined) {
      return { ok: false, reason: 'target-not-found' };
    }

    if (targetWord.clue !== '') {
      return { ok: false, reason: 'target-has-clue' };
    }

    const targetIsHead = !words.some(
      w => w.nextWord !== null && WordKey.equals(w.nextWord, target),
    );
    if (!targetIsHead) {
      return { ok: false, reason: 'target-non-head' };
    }

    return { ok: true, clue: displacedClue, target: targetWord };
  },
};
