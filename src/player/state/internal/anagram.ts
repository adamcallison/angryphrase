import type { PlayerState } from '../state';
import type { AnagramModalState } from '../state';
import type { PlayerIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import type { Word } from '../../../domain/word/Word';
import { WordMap } from '../../../domain/word/WordMap';
import { Letter } from '../../../domain/letter/Letter';
import { Result } from '../../../domain/notifications/Event';
import { Anagram } from '../../../domain/anagram/Anagram';
import { Chain } from '../../../domain/chain/Chain';
import type { Puzzle } from '../../../domain/puzzle/Puzzle';
import type { Row } from '../../../domain/grid/Row';
import type { Col } from '../../../domain/grid/Col';
import type { Direction } from '../../../domain/word/Direction';

function findWordContaining(
  puzzle: Puzzle,
  cursor: { row: Row; col: Col; direction: Direction },
): Word | undefined {
  const r = Number(cursor.row);
  const c = Number(cursor.col);
  return puzzle.words.find((w) => {
    if (w.key.direction !== cursor.direction) return false;
    const sr = Number(w.key.startRow);
    const sc = Number(w.key.startCol);
    if (cursor.direction === 'across') {
      return sr === r && c >= sc && c < sc + w.length;
    }
    return sc === c && r >= sr && r < sr + w.length;
  });
}

export function handleOpenAnagramHelper(
  state: PlayerState,
  _intent: Extract<PlayerIntent, { kind: 'open-anagram-helper' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  void _deps;

  if (state.phase !== 'solving' || state.cursor === null) {
    return Result.ok(state);
  }
  const word = findWordContaining(state.puzzle, state.cursor);
  if (word === undefined) {
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
  _deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  void _deps;

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
  _intent: Extract<PlayerIntent, { kind: 'anagram-scramble' }>,
  deps: { rng: Rng; now: () => number },
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
  const scrambled = Anagram.scramble(entries, state.anagram.input, deps.rng);
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
  _intent: Extract<PlayerIntent, { kind: 'close-anagram-helper' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  void _deps;
  void _intent;

  if (state.phase !== 'solving' || state.anagram === null) {
    return Result.ok(state);
  }
  return Result.ok({ ...state, anagram: null });
}

export function handleEscape(
  state: PlayerState,
  _intent: Extract<PlayerIntent, { kind: 'escape' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<PlayerState> {
  void _deps;
  void _intent;

  if (state.phase === 'solving' && state.anagram !== null) {
    return Result.ok({ ...state, anagram: null });
  }
  return Result.ok(state);
}
