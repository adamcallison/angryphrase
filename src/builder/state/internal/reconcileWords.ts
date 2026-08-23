import type { Grid } from '../../../domain/grid/Grid';
import type { Word } from '../../../domain/word/Word';
import type { DerivedWord } from '../../../domain/word/DerivedWord';
import type { DisplacedClue } from '../../../domain/builder/DisplacedClue';
import type { DomainEvent } from '../../../domain/notifications/Event';
import type { Direction } from '../../../domain/word/Direction';
import type { Rng } from '../../../domain/rng/Rng';
import type { ChainViolation } from '../../../domain/chain/ChainViolation';
import { WordKey } from '../../../domain/word/WordKey';
import { Numbering } from '../../../domain/word/Numbering';
import { ChainValidation } from '../../../domain/chain/ChainValidation';
import { DisplacedClue as DisplacedClueCtor } from '../../../domain/builder/DisplacedClue';

type LengthChange = {
  wordKey: string;
  direction: Direction;
  change: 'shortened' | 'lengthened';
};

export function reconcileWords(
  grid: Grid,
  oldWords: Word[],
  newWords: DerivedWord[],
  oldDisplacedClues: DisplacedClue[],
  rng: Rng,
): { words: Word[]; displacedClues: DisplacedClue[]; events: DomainEvent[] } {
  const oldByCanonical = new Map<string, Word>();
  for (const word of oldWords) {
    oldByCanonical.set(WordKey.toCanonical(word.key), word);
  }

  const newByCanonical = new Map<string, DerivedWord>();
  for (const word of newWords) {
    newByCanonical.set(WordKey.toCanonical(word.key), word);
  }

  const lengthChanges: LengthChange[] = [];
  const survivingByCanonical = new Map<string, DerivedWord>();

  for (const [canonical, newWord] of newByCanonical) {
    const oldWord = oldByCanonical.get(canonical);
    if (oldWord === undefined) continue;

    if (newWord.length !== oldWord.length) {
      lengthChanges.push({
        wordKey: canonical,
        direction: newWord.key.direction,
        change: newWord.length < oldWord.length ? 'shortened' : 'lengthened',
      });
    }

    survivingByCanonical.set(canonical, {
      key: newWord.key,
      length: newWord.length,
      clue: oldWord.clue,
      nextWord: oldWord.nextWord,
    });
  }

  const destroyedCanonicals = new Set<string>();
  const displacedClues: DisplacedClue[] = [...oldDisplacedClues];

  for (const [canonical, oldWord] of oldByCanonical) {
    if (newByCanonical.has(canonical)) continue;

    destroyedCanonicals.add(canonical);

    if (oldWord.clue.trim() !== '') {
      displacedClues.push(DisplacedClueCtor.create(rng, oldWord.clue, oldWord.key.direction));
    }
  }

  for (const [canonical, survivor] of survivingByCanonical) {
    if (survivor.nextWord !== null && destroyedCanonicals.has(WordKey.toCanonical(survivor.nextWord))) {
      survivingByCanonical.set(canonical, { ...survivor, nextWord: null });
    }
  }

  for (const destroyedCanonical of destroyedCanonicals) {
    const destroyedWord = oldByCanonical.get(destroyedCanonical);
    if (destroyedWord === undefined) continue;

    let currentKey = destroyedWord.nextWord;
    while (currentKey !== null) {
      const currentCanonical = WordKey.toCanonical(currentKey);
      if (destroyedCanonicals.has(currentCanonical)) break;

      const currentSurvivor = survivingByCanonical.get(currentCanonical);
      if (currentSurvivor === undefined) break;

      survivingByCanonical.set(currentCanonical, { ...currentSurvivor, clue: '' });
      currentKey = currentSurvivor.nextWord;
    }
  }

  for (const [canonical, newWord] of newByCanonical) {
    if (oldByCanonical.has(canonical)) continue;
    survivingByCanonical.set(canonical, {
      key: newWord.key,
      length: newWord.length,
      clue: '',
      nextWord: null,
    });
  }

  const derivedWords: DerivedWord[] = [];
  for (const newWord of newWords) {
    const canonical = WordKey.toCanonical(newWord.key);
    const reconciled = survivingByCanonical.get(canonical);
    if (reconciled === undefined) {
      throw new Error(`reconcileWords: unreachable: new word ${canonical} missing from reconciled set`);
    }
    derivedWords.push(reconciled);
  }

  const words = Numbering.assign(grid, derivedWords);
  const wordsByCanonical = new Map<string, Word>();
  for (const word of words) {
    wordsByCanonical.set(WordKey.toCanonical(word.key), word);
  }

  const lengthChangeEvents: DomainEvent[] = [];
  for (const { wordKey, direction, change } of lengthChanges) {
    const numbered = wordsByCanonical.get(wordKey);
    if (numbered === undefined) continue;
    lengthChangeEvents.push({
      kind: 'toast',
      toastKind: 'info',
      message: `Word ${Number(numbered.number)} ${direction} was ${change}.`,
    });
  }

  const violations = ChainValidation.validate(words);
  if (violations.length > 0) {
    throw new Error(
      `reconcileWords: post-reconciliation invariant violated: ${violations.map(describeViolation).join('; ')}`,
    );
  }

  return { words, displacedClues, events: lengthChangeEvents };
}

function describeViolation(violation: ChainViolation): string {
  switch (violation.kind) {
    case 'cycle':
      return `cycle involving ${violation.involved.map(WordKey.toCanonical).join(', ')}`;
    case 'branch':
      return `branch targeting ${WordKey.toCanonical(violation.target)} from ${violation.sources.map(WordKey.toCanonical).join(', ')}`;
    case 'dangling':
      return `dangling link from ${WordKey.toCanonical(violation.source)} to ${WordKey.toCanonical(violation.missingTarget)}`;
    case 'self-reference':
      return `self-reference at ${WordKey.toCanonical(violation.word)}`;
    default:
      return JSON.stringify(violation);
  }
}
