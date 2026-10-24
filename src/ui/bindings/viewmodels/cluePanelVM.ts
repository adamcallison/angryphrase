import type { Grid } from '../../../domain/grid/Grid';
import type { Word } from '../../../domain/word/Word';
import type { Direction } from '../../../domain/word/Direction';
import type { BuilderSubMode } from '../../../builder/state/state';
import { DisplayClue } from '../../../domain/chain/DisplayClue';
import { LengthPattern } from '../../../domain/chain/LengthPattern';
import { WordKey } from '../../../domain/word/WordKey';
import { ChainIndex } from '../../../domain/chain/ChainIndex';

export type { LengthPattern };

export type ClueEntryVM = {
  id: string;
  wordKey: WordKey;
  number: number;
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
  highlightedId: string | null;
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

  const index = ChainIndex.build(words);

  const selectedChainMemberKeys: Set<string> = (() => {
    if (highlightedWordKey === null) return new Set<string>();
    const head = index.headOf(highlightedWordKey);
    const members = index.fromHead(head).members;
    return new Set(members.map((m) => WordKey.toCanonical(m.key)));
  })();

  const across: ClueEntryVM[] = [];
  const down: ClueEntryVM[] = [];

  for (const w of words) {
    const isChainHead = index.isHead(w.key);
    const hasOutgoingNextWord = w.nextWord !== null;
    const isSelected = selectedChainMemberKeys.has(WordKey.toCanonical(w.key));

    let isStartableJoinSource = false;
    let isLinkableFromJoinSource = false;
    let isUnjoinable = false;

    if (isBuilder) {
      isUnjoinable = hasOutgoingNextWord;
      isStartableJoinSource = !hasOutgoingNextWord;
      isLinkableFromJoinSource =
        subMode.kind === 'join' &&
        !WordKey.equals(w.key, subMode.source) &&
        index.isHead(w.key);
    }

    const entry: ClueEntryVM = {
      id: WordKey.toCanonical(w.key),
      wordKey: w.key,
      number: Number(w.number),
      direction: w.key.direction,
      displayClue: DisplayClue.forWord(index, w),
      lengthPattern: isChainHead ? LengthPattern.forWord(grid, index, w) : null,
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

  const byNumber = (a: ClueEntryVM, b: ClueEntryVM) => a.number - b.number;
  across.sort(byNumber);
  down.sort(byNumber);

  return {
    across,
    down,
    highlightedId: highlightedWordKey === null ? null : WordKey.toCanonical(highlightedWordKey),
  };
}
