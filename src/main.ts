import './app.css';
import faviconUrl from './assets/favicon.png';

const link = document.createElement('link');
link.rel = 'icon';
link.type = 'image/png';
link.href = faviconUrl;
document.head.appendChild(link);
import { mount } from 'svelte';
import App from './ui/app/App.svelte';
import { bootApp } from './ui/bindings/appStore.svelte';
import { getPorts } from './ui/bindings/ports';
import { parseBuilderSnapshot } from './ui/bindings/persistenceCodec';
import { createPersistenceScheduler } from './ui/bindings/persistenceScheduler';
import { AppState } from './app/state/state';
import { PlayerState } from './player/state/state';
import type { BuilderState } from './builder/state/state';
import { GridSize } from './domain/grid/GridSize';
import { PuzzleKey } from './domain/puzzle/PuzzleKey';

/**
 * Build the initial AppState per FR-65 / FR-64 / C6 / NFR-9:
 * 1. Try to load saved Builder snapshot from localStorage via the storage port.
 * 2. If present and parseable: restore puzzle/displacedClues/mode but force
 *    subMode = 'none' (FR-64) and cursor = null (C6).
 * 3. If absent or corrupt: log a warning and start with a fresh blank Builder
 *    (blank 15×15 puzzle, freshly generated PuzzleKey via the injected rng).
 * 4. Player always starts in the import phase (FR-67).
 * 5. Route always starts at 'landing' (FR-1 — choice of Build/Play is NOT persisted across sessions).
 */
function loadInitialAppState(): AppState {
  const ports = getPorts();
  const rng = ports.rng;

  // No choice persistence across sessions — FR-1.
  const freshBlank = (): AppState =>
    AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(rng));

  // NFR-9: corrupt / missing storage degrades gracefully.
  let savedBuilderBlob: string | null = null;
  try {
    savedBuilderBlob = ports.storage.loadBuilder();
  } catch (err) {
    console.warn('main: storage.loadBuilder threw; starting fresh.', err);
    return freshBlank();
  }

  if (savedBuilderBlob === null) {
    return freshBlank();
  }

  // Parse the saved snapshot; null ⇒ corrupt → fall back to blank.
  const snapshot = parseBuilderSnapshot(savedBuilderBlob);
  if (snapshot === null) {
    console.warn('main: parseBuilderSnapshot returned null; starting fresh.');
    return freshBlank();
  }

  // Restore: FR-64 (subMode 'none'), C6 (cursor null).
  const builder: BuilderState = {
    puzzle: snapshot.puzzle,
    displacedClues: snapshot.displacedClues,
    mode: snapshot.mode,
    subMode: { kind: 'none' },
    cursor: null,
  };

  return {
    route: 'landing',
    builder,
    player: PlayerState.importScreen(),
    toasts: [],
    modal: null,
    pendingConfirmIntent: null,
  };
}

const initial = loadInitialAppState();
const deps = { rng: getPorts().rng, now: () => Date.now() };
const scheduler = createPersistenceScheduler(getPorts().storage);

bootApp(initial, deps, scheduler);

const app = mount(App, { target: document.getElementById('app')! });

export default app;
