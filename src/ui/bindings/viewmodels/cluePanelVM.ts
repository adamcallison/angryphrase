import type { Grid } from '../../../domain/grid/Grid';
import type { Word } from '../../../domain/word/Word';
import type { WordNumber } from '../../../domain/word/WordNumber';
import type { Direction } from '../../../domain/word/Direction';
import type { BuilderSubMode } from '../../../builder/state/state';
import { WordMap } from '../../../domain/word/WordMap';
import { DisplayClue } from '../../../domain/chain/DisplayClue';
import { LengthPattern } from '../../../domain/chain/LengthPattern';
import { WordKey } from '../../../domain/word/WordKey';

export type { LengthPattern };

export type ClueEntryVM = {
  wordKey: WordKey;
  number: WordNumber;
  direction: Direction;
  displayClue: string;
  lengthPattern: LengthPattern | null;
  isChainHead: boolean;
  hasOutgoingNextWord: boolean;
  isSelected: boolean;
  isStartableJoinSource: boolean;
  isLinkableFromJoinSource: boolean;
  isUnjoinable: boolean;
};

export type CluePanelVM = {
  across: ClueEntryVM[];
  down: ClueEntryVM[];
  highlightedWordKey: WordKey | null;
};

export function deriveCluePanelVM(input: {
  grid: Grid;
  words: Word[];
  highlightedWordKey: WordKey | null;
  isBuilder: boolean;
  builderSubMode?: BuilderSubMode | null;
}): CluePanelVM {
  const { grid, words, highlightedWordKey, isBuilder } = input;
  const subMode = input.builderSubMode ?? { kind: 'none' };

  const wordMap = WordMap.fromWords(words);

  const pointedAtKeys = new Set<string>();
  const nonHeadKeys = new Set<string>();
  for (const w of words) {
    if (w.nextWord !== null) {
      const canonical = WordKey.toCanonical(w.nextWord);
      pointedAtKeys.add(canonical);
      nonHeadKeys.add(canonical);
    }
  }

  const across: ClueEntryVM[] = [];
  const down: ClueEntryVM[] = [];

  for (const w of words) {
    const isChainHead = !nonHeadKeys.has(WordKey.toCanonical(w.key));
    const hasOutgoingNextWord = w.nextWord !== null;
    const isSelected = highlightedWordKey !== null && WordKey.equals(highlightedWordKey, w.key);

    let isStartableJoinSource = false;
    let isLinkableFromJoinSource = false;
    let isUnjoinable = false;

    if (isBuilder) {
      isUnjoinable = hasOutgoingNextWord;
      isStartableJoinSource = !hasOutgoingNextWord;
      isLinkableFromJoinSource =
        subMode.kind === 'join' &&
        !WordKey.equals(w.key, subMode.source) &&
        !pointedAtKeys.has(WordKey.toCanonical(w.key));
    }

    const entry: ClueEntryVM = {
      wordKey: w.key,
      number: w.number,
      direction: w.key.direction,
      displayClue: DisplayClue.forWord(wordMap, w),
      lengthPattern: isChainHead ? LengthPattern.forWord(grid, wordMap, w) : null,
      isChainHead,
      hasOutgoingNextWord,
      isSelected,
      isStartableJoinSource,
      isLinkableFromJoinSource,
      isUnjoinable,
    };

    if (w.key.direction === 'across') {
      across.push(entry);
    } else {
      down.push(entry);
    }
  }

  const byNumber = (a: ClueEntryVM, b: ClueEntryVM) => Number(a.number) - Number(b.number);
  across.sort(byNumber);
  down.sort(byNumber);

  return { across, down, highlightedWordKey };
}
