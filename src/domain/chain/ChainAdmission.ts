// Single source of truth for whether a chain link or displaced-clue reattachment is admissible.

import type { Word } from '../word/Word';
import { WordKey } from '../word/WordKey';
import type { DisplacedClue } from '../builder/DisplacedClue';
import { DisplacedClueId } from '../builder/DisplacedClueId';

export type AdmissionReason =
  | 'source-not-found'
  | 'target-not-found'
  | 'source-has-link'
  | 'target-already-linked'
  | 'clue-not-found'
  | 'target-has-clue'
  | 'target-non-head';

export type AdmissionResult =
  | { ok: true }
  | { ok: false; reason: AdmissionReason };

export const ChainAdmission: {
  canLink(words: readonly Word[], source: WordKey, target: WordKey): AdmissionResult;
  canReattach(
    words: readonly Word[],
    displacedClues: readonly DisplacedClue[],
    displacedClueId: DisplacedClueId,
    target: WordKey,
  ): AdmissionResult;
  message(result: AdmissionResult): string;
} = {
  canLink(words: readonly Word[], source: WordKey, target: WordKey): AdmissionResult {
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

    return { ok: true };
  },

  canReattach(
    words: readonly Word[],
    displacedClues: readonly DisplacedClue[],
    displacedClueId: DisplacedClueId,
    target: WordKey,
  ): AdmissionResult {
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

    return { ok: true };
  },

  message(result: AdmissionResult): string {
    if (result.ok) {
      return '';
    }

    switch (result.reason) {
      case 'source-not-found':
        return 'Source word not found.';
      case 'target-not-found':
        return 'Target word not found.';
      case 'source-has-link':
        return 'Source already has a chain link.';
      case 'target-already-linked':
        return 'Target is already linked to by another word.';
      case 'clue-not-found':
        return 'Displaced clue not found.';
      case 'target-has-clue':
        return 'Target already has a clue.';
      case 'target-non-head':
        return 'Target is a non-head chain word and cannot be given a clue.';
    }
  },
};
