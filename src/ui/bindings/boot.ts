import type { AppPorts, AppDeps } from './appStore.svelte';
import { AppState } from '../../app/state/state';
import { PlayerState } from '../../player/state/state';
import { parseBuilderSnapshot } from './persistenceCodec';
import { GridSize } from '../../domain/grid/GridSize';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';

export function createInitialAppState(ports: AppPorts, deps: AppDeps): AppState {
  const result = ports.storage.loadBuilder();
  if (result.kind !== 'loaded') {
    return freshBlank(deps);
  }
  const snapshot = parseBuilderSnapshot(result.value);
  if (snapshot === null) {
    return freshBlank(deps);
  }
  return {
    route: 'landing',
    builder: {
      puzzle: snapshot.puzzle,
      displacedClues: snapshot.displacedClues,
      mode: snapshot.mode,
      subMode: { kind: 'none' },
      cursor: null,
    },
    player: PlayerState.importScreen(),
    toasts: [],
    modal: null,
    pendingConfirmIntent: null,
  };
}

function freshBlank(deps: AppDeps): AppState {
  return {
    ...AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(deps.rng)),
    player: PlayerState.importScreen(),
    toasts: [],
    modal: null,
    pendingConfirmIntent: null,
  };
}
