import type { Grid } from '../../../domain/grid/Grid';
import type { Word } from '../../../domain/word/Word';
import type { CellSeparator } from '../../../domain/grid/CellSeparator';
import type { AnagramModalState } from '../../../player/state/state';
import { Anagram } from '../../../domain/anagram/Anagram';
import { ChainIndex } from '../../../domain/chain/ChainIndex';

export type AnagramTileVM = {
  position: number;
  fixed: boolean;
  letter: string | null;
};

export type AnagramModalVM = {
  wordLength: number;
  tiles: AnagramTileVM[];
  separators: CellSeparator[];
  input: string;
  expectedUniqueLetterCounts: { letter: string; count: number }[];
  inputValid: boolean;
  scrambleEnabled: boolean;
  errorMessage: string | null;
};

export function deriveAnagramModalVM(input: {
  anagramModal: AnagramModalState | null;
  grid: Grid;
  words: Word[];
}): AnagramModalVM | null {
  const { anagramModal, grid, words } = input;
  if (anagramModal === null) {
    return null;
  }

  const index = ChainIndex.build(words);

  const head = index.word(anagramModal.openedForWord);
  if (head === undefined) {
    return null;
  }

  const members = index.fromHead(head.key).members;
  const totalLength = members.reduce((sum, member) => sum + member.length, 0);

  const { entries, separators } = Anagram.buildChainModel(grid, members);
  const validation = Anagram.validateChainInput(totalLength, entries, anagramModal.input);
  const inputValid = validation.ok;
  const errorMessage = validation.ok ? null : validation.reason;

  const counts = new Map<string, { letter: string; count: number }>();
  for (const e of entries) {
    if (e.fixed && e.letter !== null) {
      const key = String(e.letter);
      const cur = counts.get(key);
      if (cur) cur.count++;
      else counts.set(key, { letter: key, count: 1 });
    }
  }

  const expectedUniqueLetterCounts = Array.from(counts.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.letter < b.letter ? -1 : 1;
  });

  const scrambled = anagramModal.scrambledArrangement;
  const tiles = entries.map((entry, i) => ({
    position: i,
    fixed: entry.fixed,
    letter: entry.fixed
      ? String(entry.letter)
      : scrambled !== null
        ? (scrambled[i] == null ? null : String(scrambled[i]))
        : null,
  }));

  const scrambleEnabled = inputValid && entries.some((e) => !e.fixed);

  return {
    wordLength: totalLength,
    tiles,
    separators,
    input: anagramModal.input,
    expectedUniqueLetterCounts,
    inputValid,
    scrambleEnabled,
    errorMessage,
  };
}
