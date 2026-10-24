import type { PlayerState } from '../state';
import type { AnagramModalState } from '../state';
import type { PlayerIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import { WordSelection } from '../../../domain/word/WordSelection';
import type { Letter } from '../../../domain/letter/Letter';
import { Result } from '../../../domain/notifications/Event';
import { Anagram } from '../../../domain/anagram/Anagram';
import { ChainIndex } from '../../../domain/chain/ChainIndex';

export function handleOpenAnagramHelper(
  state: PlayerState,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving' || state.cursor === null) {
    return Result.ok(state);
  }
  const word = WordSelection.findContainingWord(state.puzzle.words, state.cursor);
  if (word === null) {
    return Result.ok(state);
  }
  const index = ChainIndex.build(state.puzzle.words);
  const head = index.headOf(word.key);
  const newAnagram: AnagramModalState = {
    openedForWord: head,
    input: '',
    scrambledArrangement: null,
  };
  return Result.ok({ ...state, anagram: newAnagram });
}

export function handleAnagramInput(
  state: PlayerState,
  intent: Extract<PlayerIntent, { kind: 'anagram-input' }>,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving' || state.anagram === null) {
    return Result.ok(state);
  }
  const index = ChainIndex.build(state.puzzle.words);
  const head = index.word(state.anagram.openedForWord);
  if (head === undefined) {
    return Result.ok(state);
  }
  const members = index.fromHead(head.key).members;
  const total = members.reduce((s, m) => s + m.length, 0);
  const sanitised = Anagram.sanitizeInput(intent.input, total);
  return Result.ok({
    ...state,
    anagram: {
      ...state.anagram,
      input: sanitised,
      scrambledArrangement: null,
    },
  });
}

export function handleAnagramScramble(
  state: PlayerState,
  rng: Rng,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving' || state.anagram === null) {
    return Result.ok(state);
  }
  const index = ChainIndex.build(state.puzzle.words);
  const head = index.word(state.anagram.openedForWord);
  if (head === undefined) {
    return Result.ok(state);
  }
  const members = index.fromHead(head.key).members;
  const { entries } = Anagram.buildChainModel(state.puzzle.grid, members);
  const scrambled = Anagram.scramble(entries, state.anagram.input, rng);
  const scrambledArrangement: (Letter | null)[] = scrambled.map((e) => e.letter);
  return Result.ok({
    ...state,
    anagram: {
      ...state.anagram,
      scrambledArrangement,
    },
  });
}

export function handleCloseAnagramHelper(
  state: PlayerState,
): ReducerResult<PlayerState> {
  if (state.phase !== 'solving' || state.anagram === null) {
    return Result.ok(state);
  }
  return Result.ok({ ...state, anagram: null });
}

export function handleEscape(
  state: PlayerState,
): ReducerResult<PlayerState> {
  if (state.phase === 'solving' && state.anagram !== null) {
    return Result.ok({ ...state, anagram: null });
  }
  return Result.ok(state);
}
