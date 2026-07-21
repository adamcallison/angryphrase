import type { BuilderState } from '../state';
import type { BuilderIntent } from '../intents';
import type { ReducerResult } from '../../../domain/notifications/Event';
import type { Rng } from '../../../domain/rng/Rng';
import { Result } from '../../../domain/notifications/Event';
import { Puzzle } from '../../../domain/puzzle/Puzzle';
import { WordKey } from '../../../domain/word/WordKey';
import { DisplacedClue } from '../../../domain/builder/DisplacedClue';

export function handleBeginJoin(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'begin-join' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void _deps;

  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const source = state.puzzle.words.find(w => WordKey.equals(w.key, intent.source));
  if (source === undefined) {
    return Result.ok(state);
  }

  if (source.nextWord !== null) {
    return Result.ok(state);
  }

  return Result.ok({
    ...state,
    subMode: { kind: 'join', source: intent.source },
  });
}

export function handleUnjoin(
  state: BuilderState,
  intent: Extract<BuilderIntent, { kind: 'unjoin' }>,
  _deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  void _deps;

  if (state.mode !== 'fill') {
    return Result.ok(state);
  }

  const sourceIdx = state.puzzle.words.findIndex(w => WordKey.equals(w.key, intent.source));
  if (sourceIdx === -1) {
    return Result.ok(state);
  }
  const source = state.puzzle.words[sourceIdx]!;
  if (source.nextWord === null) {
    return Result.ok(state);
  }

  const downstreamKey = source.nextWord;
  const newWords = state.puzzle.words.map(w => {
    if (WordKey.equals(w.key, intent.source)) return { ...w, nextWord: null };
    if (WordKey.equals(w.key, downstreamKey)) return { ...w, clue: '' };
    return w;
  });

  return Result.ok({
    ...state,
    puzzle: Puzzle.withWords(state.puzzle, newWords),
  });
}

export function resolveJoin(
  state: BuilderState,
  sourceKey: WordKey,
  targetKey: WordKey,
  deps: { rng: Rng; now: () => number },
): ReducerResult<BuilderState> {
  if (WordKey.equals(sourceKey, targetKey)) {
    // FR-34: clicking the source again cancels the join.
    return Result.ok({ ...state, subMode: { kind: 'none' } });
  }

  const words = state.puzzle.words;
  const source = words.find(w => WordKey.equals(w.key, sourceKey));
  const target = words.find(w => WordKey.equals(w.key, targetKey));
  if (source === undefined || target === undefined) {
    return Result.ok(state); // defensive — both should exist
  }

  // FR-35(b): source must not already have a nextWord link.
  if (source.nextWord !== null) {
    return Result.withEvents(state, [{
      kind: 'toast',
      toastKind: 'error',
      message: 'Source already has a chain link.',
    }]);
  }

  // FR-35(c): target must not be pointed to by any other word.
  const targetAlreadyLinked = words.some(w =>
    w.nextWord !== null && WordKey.equals(w.nextWord, targetKey),
  );
  if (targetAlreadyLinked) {
    return Result.withEvents(state, [{
      kind: 'toast',
      toastKind: 'error',
      message: 'Target is already linked to by another word.',
    }]);
  }

  // FR-36: success. Set source.nextWord = target.key; if target had a non-empty clue, displace it.
  const newDisplacedClues = target.clue !== ''
    ? [...state.displacedClues, DisplacedClue.create(deps.rng, target.clue, target.key.direction)]
    : state.displacedClues;
  const newWords = words.map(w => {
    if (WordKey.equals(w.key, sourceKey)) return { ...w, nextWord: targetKey };
    if (WordKey.equals(w.key, targetKey)) return { ...w, clue: '' };
    return w;
  });

  return Result.ok({
    ...state,
    puzzle: Puzzle.withWords(state.puzzle, newWords),
    displacedClues: newDisplacedClues,
    subMode: { kind: 'none' },
  });
}
