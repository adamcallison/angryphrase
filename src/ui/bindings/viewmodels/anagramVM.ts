import type { Grid } from '../../../domain/grid/Grid';
import type { Word } from '../../../domain/word/Word';
import type { Letter } from '../../../domain/letter/Letter';
import type { CellSeparator } from '../../../domain/grid/CellSeparator';
import type { AnagramModalState } from '../../../player/state/state';
import { Anagram } from '../../../domain/anagram/Anagram';
import { WordKey as WordKeyCtor } from '../../../domain/word/WordKey';

export type { CellSeparator, Letter };

export type AnagramTileVM = {
  position: number;
  fixed: boolean;
  letter: string | null;
};

export type AnagramModalVM = {
  open: boolean;
  wordLength: number;
  tiles: AnagramTileVM[];
  separators: CellSeparator[];
  input: string;
  inputLength: number;
  expectedUniqueLetterCounts: { letter: Letter; count: number }[];
  inputValid: boolean;
  scrambleEnabled: boolean;
  errorMessage: string | null;
};

const CLOSED_BASELINE: AnagramModalVM = {
  open: false,
  wordLength: 0,
  tiles: [],
  separators: [],
  input: '',
  inputLength: 0,
  expectedUniqueLetterCounts: [],
  inputValid: false,
  scrambleEnabled: false,
  errorMessage: null,
};

export function deriveAnagramModalVM(input: {
  anagramModal: AnagramModalState | null;
  grid: Grid;
  words: Word[];
}): AnagramModalVM {
  const { anagramModal, grid, words } = input;
  if (anagramModal === null) {
    return CLOSED_BASELINE;
  }

  const word = words.find((w) => WordKeyCtor.equals(w.key, anagramModal.openedForWord));
  if (word === undefined) {
    return CLOSED_BASELINE;
  }

  const { entries, separators } = Anagram.buildWordModel(grid, word);
  const validation = Anagram.validateInput(word, entries, anagramModal.input);
  const inputValid = validation.ok;
  const errorMessage = validation.ok ? null : validation.reason;
  const inputLength = anagramModal.input.length;

  const counts = new Map<string, { letter: Letter; count: number }>();
  for (const e of entries) {
    if (e.fixed && e.letter !== null) {
      const key = String(e.letter);
      const cur = counts.get(key);
      if (cur) cur.count++;
      else counts.set(key, { letter: e.letter, count: 1 });
    }
  }

  const expectedUniqueLetterCounts = Array.from(counts.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.letter < b.letter ? -1 : 1;
  });

  const scrambled = anagramModal.scrambledArrangement;
  const tiles = entries.map((entry, i) => {
    const letter = entry.fixed
      ? String(entry.letter!)
      : scrambled !== null && i < scrambled.length
        ? String(scrambled[i]!)
        : null;
    return {
      position: i,
      fixed: entry.fixed,
      letter,
    };
  });

  const scrambleEnabled = inputValid && entries.some((e) => !e.fixed);

  return {
    open: true,
    wordLength: word.length,
    tiles,
    separators,
    input: anagramModal.input,
    inputLength,
    expectedUniqueLetterCounts,
    inputValid,
    scrambleEnabled,
    errorMessage,
  };
}
