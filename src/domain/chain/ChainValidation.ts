import type { Word } from '../word/Word';
import type { WordKey } from '../word/WordKey';
import type { ChainViolation } from './ChainViolation';
import { WordKey as WordKeyCtor } from '../word/WordKey';

export const ChainValidation: {
  validate(words: Word[]): ChainViolation[];
} = {
  validate(words: Word[]): ChainViolation[] {
    const wordMap = new Map<string, Word>();
    for (const w of words) {
      wordMap.set(WordKeyCtor.toCanonical(w.key), w);
    }

    const violations: ChainViolation[] = [];
    const processed = new Set<string>();
    const cycleKnown = new Set<string>();

    // Self-reference.
    for (const w of words) {
      if (w.nextWord !== null && WordKeyCtor.equals(w.nextWord, w.key)) {
        violations.push({ kind: 'self-reference', word: w.key });
        const canonical = WordKeyCtor.toCanonical(w.key);
        processed.add(canonical);
        cycleKnown.add(canonical);
      }
    }

    // Branch: group sources by target.
    const targetToSources = new Map<string, { target: WordKey; sources: WordKey[] }>();
    for (const w of words) {
      if (w.nextWord !== null) {
        const targetCanonical = WordKeyCtor.toCanonical(w.nextWord);
        const entry = targetToSources.get(targetCanonical);
        if (entry === undefined) {
          targetToSources.set(targetCanonical, { target: w.nextWord, sources: [w.key] });
        } else {
          entry.sources.push(w.key);
        }
      }
    }
    for (const entry of targetToSources.values()) {
      if (entry.sources.length > 1) {
        violations.push({ kind: 'branch', target: entry.target, sources: [...entry.sources] });
        if (!wordMap.has(WordKeyCtor.toCanonical(entry.target))) {
          // A branch to a missing target is still a branch; do not also report
          // each source as a dangling link.
          for (const source of entry.sources) {
            processed.add(WordKeyCtor.toCanonical(source));
          }
        }
      }
    }

    // Dangling: single source pointing to a missing target.
    for (const w of words) {
      if (w.nextWord === null) continue;
      const sourceCanonical = WordKeyCtor.toCanonical(w.key);
      if (processed.has(sourceCanonical)) continue;
      const targetCanonical = WordKeyCtor.toCanonical(w.nextWord);
      if (wordMap.has(targetCanonical)) continue;
      const entry = targetToSources.get(targetCanonical);
      if (entry !== undefined && entry.sources.length > 1) continue;
      violations.push({ kind: 'dangling', source: w.key, missingTarget: w.nextWord });
      processed.add(sourceCanonical);
    }

    // Cycle detection: walk from every word not yet classified.
    for (const w of words) {
      const startCanonical = WordKeyCtor.toCanonical(w.key);
      if (processed.has(startCanonical)) continue;

      const path: string[] = [];
      const seenInPath = new Set<string>();
      let currentCanonical = startCanonical;

      for (;;) {
        if (cycleKnown.has(currentCanonical)) {
          for (const key of path) {
            processed.add(key);
          }
          break;
        }

        if (processed.has(currentCanonical)) {
          for (const key of path) {
            processed.add(key);
          }
          break;
        }

        if (seenInPath.has(currentCanonical)) {
          const cycleStartIndex = path.indexOf(currentCanonical);
          const cycleCanonicals = path.slice(cycleStartIndex);
          const involved = cycleCanonicals.map((canonical) => wordMap.get(canonical)!.key);
          violations.push({ kind: 'cycle', involved });
          for (const key of cycleCanonicals) {
            cycleKnown.add(key);
            processed.add(key);
          }
          for (const key of path) {
            processed.add(key);
          }
          break;
        }

        const currentWord = wordMap.get(currentCanonical);
        if (currentWord === undefined) {
          // Dangling link; stop walking this chain.
          for (const key of path) {
            processed.add(key);
          }
          break;
        }

        if (currentWord.nextWord === null) {
          for (const key of path) {
            processed.add(key);
          }
          processed.add(currentCanonical);
          break;
        }

        path.push(currentCanonical);
        seenInPath.add(currentCanonical);
        currentCanonical = WordKeyCtor.toCanonical(currentWord.nextWord);
      }
    }

    return violations;
  },
};
