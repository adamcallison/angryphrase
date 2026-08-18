import type { PlayerState } from '../state';
import type { AnagramModalState } from '../state';
import type { PlayerIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import { WordMap } from '../../../domain/word/WordMap';
import { WordSelection } from '../../../domain/word/WordSelection';
import { Letter } from '../../../domain/letter/Letter';
import { Result } from '../../../domain/notifications/Event';
import { Anagram } from '../../../domain/anagram/Anagram';
import { Chain } from '../../../domain/chain/Chain';

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
  const wordMap = WordMap.fromWords(state.puzzle.words);
  const head = Chain.headOf(wordMap, word.key);
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
  const wordMap = WordMap.fromWords(state.puzzle.words);
  const head = WordMap.get(wordMap, state.anagram.openedForWord);
  if (head === undefined) {
    return Result.ok(state);
  }
  const members = Chain.fromHead(wordMap, head.key).members;
  const total = members.reduce((s, m) => s + m.length, 0);
  const filtered = Letter.from(intent.input);
  const clamped = filtered.slice(0, total);
  const clampedInput = clamped.map((l) => String(l)).join('');
  return Result.ok({
    ...state,
    anagram: {
      ...state.anagram,
      input: clampedInput,
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
  const wordMap = WordMap.fromWords(state.puzzle.words);
  const head = WordMap.get(wordMap, state.anagram.openedForWord);
  if (head === undefined) {
    return Result.ok(state);
  }
  const members = Chain.fromHead(wordMap, head.key).members;
  const { entries } = Anagram.buildChainModel(state.puzzle.grid, members);
  const scrambled = Anagram.scramble(entries, state.anagram.input, rng);
  const scrambledArrangement: Letter[] = scrambled
    .map((e) => e.letter)
    .filter((l): l is Letter => l !== null);
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
