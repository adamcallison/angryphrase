# angryphrase — Architectural Report: Store Singletons & Dependency Reaching

Status: problem statement, no fix attempted. Related: `code_smells.md` F9 (eager-init symptom of this broader pattern). AD refs: §4.4, §4.5, §9.3 (`ui/bindings/` module table).

---

## Problem

The bindings layer (`src/ui/bindings/`) implements five store modules as process-wide singletons. Components reach for them via bare `import { foo } from '../bindings/xStore.svelte'` — not via props or dependency injection. This creates hidden coupling, test-isolation fragility, and prevents multi-instance mounting. F9 names the eager-init symptom; this report names the architectural pattern that produces F9 and several other hazards.

## Detailed findings

### 1. Module-level singleton state

`src/ui/bindings/appStore.svelte.ts:18-20`:
```ts
let state: AppState = $state(AppStateCtor.blank(GridSizeCtor.of(15), PuzzleKeyCtor.generate(getPorts().rng)));
let deps: AppDeps = $state({ rng: getPorts().rng, now: () => Date.now() });
let scheduler!: PersistenceScheduler;
```

One `state` / `deps` / `scheduler` per JavaScript realm. `bootApp()` (line 22) re-assigns all three; every bare getter (`getAppState`, `getRoute`, `getToasts`, `getModal`, `getPendingConfirmIntent`, `getBuilder`, `getPlayer`, `getScheduler`) reads these module-level bindings. `dispatch` (line 60) mutates `state` in place. The `$state` rune makes the cell reactive, but the cell itself is singular and module-scoped — there is no way to construct a second, independent `AppState` without overwriting the one everyone reads.

### 2. Sub-store singleton satellites

`builderStore.svelte.ts`, `playerStore.svelte.ts`, `modalStore.svelte.ts`, `toastStore.svelte.ts` hold no state of their own. Each bare-imports `dispatch` / `getBuilder` / `getPlayer` / `getModal` / `getPendingConfirmIntent` / `getToasts` from `appStore.svelte` and re-exports convenience wrappers (`dispatchBuilder`, `playerShellVM`, `modalVM`, `toastVMs`, etc.). They are singleton satellites — their behavior is fully determined by `appStore`'s module-level cell. Importing `dispatchBuilder` from `builderStore` is indistinguishable from importing `dispatch` from `appStore` and wrapping it; no independence.

### 3. Bare-import reaching (hidden dependencies)

15 import sites across 13 components reach directly into the store modules:

| Component | Imports from |
|---|---|
| `App.svelte` | `appStore` (getRoute, getBuilder, getPlayer, getScheduler) |
| `Landing.svelte` | `appStore` (dispatch) |
| `BuilderShell.svelte` | `builderStore` (builderShellVM, getBuilderState, dispatchSelectCell, dispatchToggleDesignCell, dispatchTypeLetter, dispatchBackspace, dispatchMoveCursor, dispatchEscape) |
| `BuilderToolbar.svelte` | `builderStore` (10 dispatch helpers) |
| `ClueSection.svelte` | `builderStore` (dispatchBuilder) |
| `DisplacedCluesPanel.svelte` | `builderStore` (dispatchBuilder) |
| `JoinReattachBanner.svelte` | `builderStore` (dispatchEscape) |
| `PlayerShell.svelte` | `playerStore` (playerShellVM, 5 dispatch helpers) |
| `PlayerToolbar.svelte` | `playerStore` (5 dispatch helpers) |
| `ImportScreen.svelte` | `playerStore` (dispatchImportPuzzle) |
| `AnagramModal.svelte` | `playerStore` (3 dispatch helpers) |
| `PlayerCluePanel.svelte` | `playerStore` (dispatchPlayer) |
| `Modal.svelte` | `modalStore` (modalVM, confirmModal, cancelModal) |
| `ToastHost.svelte` | `toastStore` (toastVMs, dismissToast) + `appStore` (getToasts) |

A component's dependency on the store is invisible from its `$props()` interface. A reader must grep imports to know what a component touches. No prop declares "this component needs the builder store" or "this component needs `onSwitchToFill`." The component tree is coupled through a module-level back-channel, not through the prop graph.

### 4. Eager initialization at import time (F9)

`appStore.svelte.ts:18` initializes `state` with a full 15×15 grid (`AppStateCtor.blank(GridSizeCtor.of(15), ...)`) + freshly-minted `PuzzleKey` (`PuzzleKeyCtor.generate(getPorts().rng)`) + `getPorts()` warm at module import — before `bootApp` is ever called. `deps` (line 19) similarly warms `getPorts().rng` at import. `bootApp` (line 22) then overwrites both with caller-supplied values. Two full-state constructions per production boot; one wasted. Side effects at module top-level also fire before test `beforeEach` can call `vi.useFakeTimers()` or `setPorts(fakes)`, creating a real-timer + real-ports leak at import. `_resetAppStateForTests` (line 126) exists as the band-aid for mid-test state swaps. See `code_smells.md` F9.

### 5. Global ports register

`src/ui/bindings/ports.ts:19` holds a module-level `const ports: Ports = { ... }` (mutable properties). `setPorts(next)` / `resetPorts()` mutate it in place. Tests swap ports in `beforeEach` / `afterEach`. Combined with singleton `state`, any module-level code touching `getPorts()` at import (e.g. `appStore.svelte.ts:18`) reads whatever ports are registered at import time — real browser ports in prod, whatever the first test file to import left behind in test runs. Init-order-dependent.

## Consequences

- **Can't mount two app instances.** One `$state` cell, one scheduler, one ports register. No dual-pane, no parallel test apps, no component-preview tooling mounting isolated subtrees with their own state.
- **Component deps invisible.** No prop declares store dependency. Grep is the only way to discover what a component touches. Refactoring a component requires auditing its imports, not its interface.
- **Test isolation fragile.** All tests in a file share one singleton via `beforeEach` bootApp. Cross-file isolation depends on Vitest's module-cache isolation. `_resetAppStateForTests` is the mid-test band-aid. Init-order races possible because module-level `$state` initializer runs at import, before `beforeEach`.
- **Reaching is viral.** Sub-stores reach into `appStore`; components reach into sub-stores; no layer in the chain stops the reach. Adding a new component means choosing which store to bare-import from, not declaring a dependency.
- **Eager work at import.** 225-cell grid + UUID mint + ports warm per module load. Bounded cost, but the side-effect-at-import pattern is the root of the test-isolation hazard (F9).
- **No compiler enforcement.** Nothing prevents a `domain/` module from bare-importing a store (ESLint `no-restricted-imports` could, but currently does not route a rule for this edge). The boundary is convention.

## Principled fix: full dependency injection via props

### Construction (no module-level state)

`main.ts` calls `createAppStore(initial, deps, scheduler)` once — a factory returning `{ getState, getRoute, getBuilder, getPlayer, getScheduler, dispatch, replaceState }`. No `let state` at module scope. No `bootApp`. No `getAppStoreInstance`. No `_resetAppStateForTests`. The instance is threaded as a prop.

### Container shells receive store as prop

`App.svelte` declares `let { appStore }: { appStore: AppStore } = $props();`. It constructs sub-stores (`createBuilderStore(appStore)`, `createPlayerStore(appStore)`, `createModalStore(appStore)`, `createToastStore(appStore)`) and passes each as a prop to the corresponding shell:
- `<BuilderShell builderStore={builderStore} />`
- `<PlayerShell playerStore={playerStore} />`

Shells declare `let { builderStore }: { builderStore: BuilderStore } = $props();` — typed, visible dependency. The shell is the container: it owns the store reference and wires VM derivation + dispatch.

### Presentational leaves receive VM + callbacks, not a store

Leaf components (everything below the shells: `BuilderToolbar`, `BuilderGrid`, `BuilderCluePanel`, `ClueSection`, `DisplacedCluesPanel`, `JoinReattachBanner`, `PlayerToolbar`, `PlayerGrid`, `PlayerCluePanel`, `ImportScreen`, `AnagramModal`, `ActiveClueBanner`, `Landing`, `Modal`, `ToastHost`) take **view-models + callback props**:

Example — `BuilderToolbar` today:
```ts
import { dispatchSwitchToFill, dispatchExportComplete, ... } from '../bindings/builderStore.svelte';
```

Example — `BuilderToolbar` under DI:
```ts
let {
  vm,
  onSwitchToFill,
  onExportComplete,
  onExportIncomplete,
  onRequestResetBuilder,
  onEditTitle,
  onEditAuthor,
  onChangeGridSize,
  onToggleMarker,
  onRequestSwitchToDesign,
  onRequestImportPuzzle,
}: {
  vm: BuilderToolbarVM;
  onSwitchToFill: () => void;
  onExportComplete: () => void;
  // ...
} = $props();
```

The parent shell wires each callback to `builderStore.dispatch*`. Leaves become pure presentational components — testable by passing a VM + mock callbacks, no store construction needed. `Landing` takes `onBuild: () => void` + `onPlay: () => void`, not `appStore`. `ToastHost` takes `toasts: Toast[]` + `onDismiss: (id: ToastId) => void`, not `appStore` + `toastStore`.

### What this eliminates

- No module-level state in any store file.
- No bare-import reaching — every component declares its deps via `$props()`.
- No `setContext` / `getContext` service-locator pattern (context is a runtime back-channel with the same hidden-dep problem as bare imports).
- No `_resetAppStateForTests` — tests construct independent store instances per test.
- No init-at-import — factories construct lazily at call site.
- Multi-instance mounting becomes possible (each `App` mount gets its own store tree).
- Component deps visible from signatures — refactoring is interface-driven.

### Cost

~13 components touched (props interfaces change from "grabs store" to "declares VM + callbacks"). Parent shells gain callback wiring in markup. 5 store files lose bare exports (factories + types remain). 5 test files construct stores per-test (no shared singleton). Estimated 3-4 focused dispatches for the full split: (a) `createAppStore` factory + `App.svelte` prop wiring; (b) sub-store factories + shell prop wiring; (c) leaf callback-prop migration in 2-3 batches; (d) test migration + dead-code removal.

## Scope

This report is broader than `code_smells.md` F9. F9 = "side effects at module import" (the eager-init symptom). This report = "singleton stores + bare-import reaching as an architectural pattern." The DI fix for the latter also fixes F9; a narrow F9-only fix (null sentinel / lazy singleton) does not fix the reaching pattern — it leaves 15 bare-import sites and the singleton intact, merely deferring construction to `bootApp`.

## Open questions

1. **Header component** — currently takes no store. Confirm it stays store-free (static).
2. **TypingSurface** — currently takes `enabled: boolean` + `onDispatch: (intent: TypingIntent) => void` props. Already presentational. Confirm no change needed.
3. **Autosave `$effect`** — `App.svelte` currently reads `getScheduler()` / `getBuilder()` / `getPlayer()` in two `$effect`s (F8 split). Under DI, these read from the `appStore` prop. Confirm the effect stays at `App.svelte` level (not pushed into a store), since it crosses both builder + player slices.
4. **Callback explosion** — `BuilderToolbar` has ~10 dispatch actions. Passing 10 callbacks as props is verbose. Alternative: pass a single `actions: BuilderToolbarActions` object prop (typed bag of callbacks). Acceptable under DI as long as the bag is declared in `$props()`, not reached via import. Decision needed before dispatch.
5. **AD amendment** — AD §4.4 / §4.5 / §9.3 describe the bindings layer in terms that tolerate the current singleton pattern ("the bindings layer runs a `$effect`..."). A DI refactor likely needs AD §9.3 file-tree + §4.4 prose amendments to describe the factory + prop-threading shape. Flag for human approval before touching the AD.
