import type { AppPorts, AppDeps } from './appStore.svelte';
import { AppState } from '../../app/state/state';
import { PlayerState } from '../../player/state/state';
import { parseBuilderSnapshot } from './persistenceCodec';
import { GridSize } from '../../domain/grid/GridSize';
import { PuzzleKey } from '../../domain/puzzle/PuzzleKey';

export function createInitialAppState(ports: AppPorts, deps: AppDeps): AppState {
  const result = ports.storage.loadBuilder();
  const snapshot = result.kind === 'loaded' ? parseBuilderSnapshot(result.value) : null;
  if (snapshot === null) {
    return AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(deps.rng));
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
