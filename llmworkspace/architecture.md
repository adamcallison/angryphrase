# angryphrase — Architecture

This document describes the system **as it is built**. Where it disagrees with the code, the code wins. It is a map for navigating the codebase, not a specification to implement.

This document is self-contained. Its companion is `llmworkspace/future_considerations.md` — extension points and anticipated future work. Two sibling documents — `llmworkspace/architecture_smells.md` and `llmworkspace/architecture_smell_resolutions.md` — are *audit records* describing how the architecture reached its current shape; they are not part of the live set and are never cited from it. The rules governing the doc set and the citations that may point into it are in §14.

---

## 1. System Overview

`angryphrase` is a client-only web application for building and solving cryptic-style crossword puzzles. It runs entirely in the browser, persists to `localStorage`, and ships as a single self-contained HTML file via `vite-plugin-singlefile` (all JS/CSS/favicon inlined into `dist/index.html`; no external runtime fetches). There is no backend, no accounts, no multi-user anything.

There are exactly two top-level experiences — **Builder** and **Player** — connected only via puzzle JSON files exported to and imported from the user's file system. In-app routing is a `route: 'landing' | 'build' | 'play'` enum on `AppState` (no router library); the landing page is always shown on load.

Stack: Svelte 5 (runes), TypeScript, Tailwind (build-time only), Vitest. Node ≥ 22 pinned via `.nvmrc`.

## 2. Architectural Principles

Four principles shape the whole codebase:

1. **Thin UI.** The UI layer is as thin as possible. All logic lives in pure logic modules with no knowledge of Svelte, HTML, DOM, or rendering. Components render view-models and invoke action bags — nothing else.
2. **Domain-Driven Design.** The domain model is the centre; persistence, format, and UI are adapters at the edges. Pure functions over immutable domain objects are the unit of behaviour. Reducers never mutate inputs; a small `clone` helper handles the few deep structures (grid). No Immer.
3. **Explicit types.** Data bundles have named types; field types are precise (`Letter | null`, not `string`); illegal states are unrepresentable where feasible (range-checked branded constructors).
4. **No primitive obsession.** `Row`, `Col`, `Letter`, `PuzzleKey`, `Direction`, `GridSize`, `WordNumber`, `DisplacedClueId`, `ToastId`, `CellIndex`, `WordLength`, `Position`, `EpochMs`, `DurationMs` are branded types or discriminated unions. Plain `string`/`number` do not appear in domain signatures. One deliberate exception: the `Rng` interface (`domain/rng/Rng.ts`) uses plain `number` (`nextInt(n)`) — branding a count→index operation cascades nonsense.

## 3. Layers

```
                            ┌─────────────────────────────────────────────────┐
                            │                  AppState                       │
                            │   route: 'landing' | 'build' | 'play'           │
                            │   builder: BuilderState                        │
                            │   player:  PlayerState                          │
                            │   toasts:  Toast[]                              │
                            │   modal:    ModalRequest | null                 │
                            │   pendingConfirmIntent: ConfirmableIntent|null │
                            └─────────────────────────────────────────────────┘
                                              ▲ intents
                                              │ view-models
              ┌───────────────────────────────┴──────────────────────────────┐
              │                    ui/bindings (the seam)                    │
              │  - createAppStore factory ($state cell in closure)           │
              │  - dispatch(intent) → reduceApp → event fold → ports         │
              │  - experience facades (builder/player/modal/toast)           │
              │  - view-model derivation; persistence scheduling             │
              └──────────────────┬─────────────────────────────┬─────────────┘
                                 │                             │
                                 ▼                             ▼
          ┌──────────────────────────────┐      ┌──────────────────────────────┐
          │       Svelte components      │      │          Reducers            │
          │ (ui/app, ui/builder,         │─────▶│ reduceApp, reduceBuilder,   │
          │  ui/player, ui/shared)       │ VMs+ │ reducePlayer — pure          │
          │ presentational; no logic     │ bags │ (state,intent,deps) →        │
          └──────────────────────────────┘      │  { state, DomainEvent[] }   │
                                                └──────────────┬───────────────┘
                                                               │ calls
                                                               ▼
        ┌─────────────────────────────────────────────────────────────────────┐
        │                                domain/                                │
        │  pure TS, zero framework imports, immutable value objects,          │
        │  branded types, port *interfaces*                                    │
        └────────────────────────────────────────────┬────────────────────────┘
                                                     │ implements
                                                     ▼
        ┌─────────────────────────────────────────────────────────────────────┐
        │                                ports/                                 │
        │  localStoragePort, downloadPort, filePickPort, rngPort                │
        │  side-effectful browser adapters; swappable with test fakes          │
        └─────────────────────────────────────────────────────────────────────┘
```

### Layer 0 — `src/domain/` (pure, framework-free)

Owns the entire domain model: value objects, branded types, pure functions, and port *interfaces*. Imports only from itself. Every module is unit-tested.

| Module | Owns |
|---|---|
| `domain/grid/` | `GridSize` (2..25), `Row`, `Col`, `Cursor` (`{row, col, direction} \| null`; `null` = no selection, not persisted across reload), `Cell`, `CellMarker` (`{ right: CellSeparator, bottom: CellSeparator }` — structural mutual exclusion; API `CellMarker.read(marker, axis)` / `.write(marker, axis, separator)` / `.isEmpty(marker, axis)`; `EMPTY` is the canonical no-marker value), `CellSeparator` (`'none' \| 'space' \| 'hyphen'`), `Grid` (`Cell[][]`), `GridAccess` (the raw-indexing leaf — `blank`, `cellAt`, `setCell`, `updateCells`, `withinBounds`; the sanctioned site for non-null indexing on `Cell[][]`, see `eslint.config.js`), `WordTopology` (the single source of grid-level word geometry: `WordRun` (`{ startRow, startCol, length, direction }`), `runs(grid, direction)` enumerates maximal white runs on a single axis including length-1 runs, `partOfRun(grid, row, col, direction)` is the single-cell "part of a length-≥-2 run" predicate used by `GridOps.isSelectable` and `GridInteraction.select`; depends only on `GridAccess`), `GridOps` (structural grid operations: `neighbours`, `neighboursInDirection`, `isSelectable`, `clone`, `equals`; re-exports the leaf accessors `blank`/`cellAt`/`setCell`/`updateCells`/`withinBounds` for back-compat with 88 call sites that don't need to know about `GridAccess`; `isSelectable` delegates to `WordTopology.partOfRun`), `GridInteraction` (the shared cursor/typing transitions used by both experiences — `select`/`move`/`typeLetter`/`backspace` over `(grid, cursor)` with an injected `LetterSlot` policy for the answer-vs-player field — plus the shared intent payload variants, see §3 Layer 1), `CellIndex` |
| `domain/word/` | `Word`, `WordKey` (`{startRow, startCol, direction}`), `WordLength` (≥2), `Direction` + helpers, `DerivedWord` (pre-numbering shape), `WordDerivation` (`grid → DerivedWord[]`, expressed as `WordTopology.runs` over both directions filtered to length ≥ 2), `Numbering` (assigns word numbers), `WordMap` (canonical-string-keyed O(1) lookup), `WordSelection` (`findContainingWord` — scans the word list for the word containing the cursor, delegating the per-word "does this word cover this cell" test to `WordGeometry.contains`; the cursor's direction filter stays here, since it selects *which* word), `WordGeometry` (the single owner of word extent and word-coordinate walking: `cells(word)` iterates a word's coordinates in order, `contains(word, row, col)` answers "does this word cover this cell" in O(1), `lastCell(word)` returns the word's final cell; every coordinate it returns is minted and validated through `Row.of` / `Col.of`, never handed back from the input word; consumed by `ChainCells`, `LengthPattern`, the `Anagram` word/chain builders, and `WordSelection`) |
| `domain/letter/` | `Letter` brand + `try`/`from`/`equals` (case-folds, validates A–Z) |
| `domain/chain/` | `Chain` traversal, `ChainValidation` (cycle/branch/dangling/self-reference), `ChainViolation`, `ChainAdmission` — the single owner of the chain-link admission rules (`canLink` / `canReattach` / `message(result)`); both `Builder` join and reattach handlers consume it, and any future caller (Player-side chain feature, import path, scripting API) shares the same admission policy, `DisplayClue`, `LengthPattern`, `ChainCells` (cell-coord sets shared by builder/player VMs) |
| `domain/anagram/` | `AnagramEntry` (discriminated by `fixed`: `fixed: true ⇒ letter: Letter`), `Position` (≥0), `Anagram` (`buildWordModel`, `buildChainModel`, `validateInput`, `validateChainInput`, `scramble`) |
| `domain/puzzle/` | `Puzzle` aggregate, `PuzzleKey` (UUID-v4 brand; `generate(rng)`), `Title`, `Author`, `CompletenessCheck` + `CompletenessViolation` — the single owner of the complete-puzzle clue rules (`clueViolations`: head clue non-empty, non-head clue empty; `check` = letter scan + clue rules; `message(v)` renders a violation as user-facing text). Both the export gate and the parser's complete-file validation consume it; `domain/format/` owns only byte-shape rules |
| `domain/builder/` | `DisplacedClue`, `DisplacedClueId` (UUID-v4 brand) — Builder-only concepts |
| `domain/notifications/` | `Toast`, `ToastId`, `ToastKind`, `ModalRequest`, `ModalKind`, `DomainEvent`, `ConfirmableIntent`, `ReducerResult` + `Result` helper |
| `domain/format/` | Split into a structural layer and a JSON-I/O layer, with the structural layer as the single source of truth shared by the file format and the `localStorage` blob. `v1.ts` — **structural layer**, the canonical wire shape: `parsePuzzleShape(parsed: unknown) → Result` (validates both accepted versions), `serializeIncompleteShape(p, clues) → object`, `serializeCompleteShape(p) → object`, `ParseFailure`, `PuzzleFileType`. Operates on structured values end-to-end; no `JSON.parse` / `JSON.stringify`. Complete-file clue validation delegates to `CompletenessCheck.clueViolations` (byte-identical failure messages), so the import gate and the export gate share one definition of "complete". `v1Json.ts` — **JSON I/O adapters**: `parsePuzzle(json: string)` (delegates to `parsePuzzleShape` after `JSON.parse`; `JSON.parse` failures land as a `ParseFailure`), `serializeIncomplete(p, clues)` / `serializeComplete(p)` (each calls the structural shape function and `JSON.stringify`s the result), `Filename` helper. Callers whose I/O is genuinely string-shaped (file import/export, player lifecycle) use `v1Json`; the `persistenceCodec` uses `v1` directly so the localStorage blob and the file format share one structured form. |
| `domain/ports/` | Port *interfaces* only: `StoragePort`, `DownloadPort`, `FilePickPort` |
| `domain/rng/` | `Rng` interface — a deps-injection abstraction, **not** a port; reducers call it directly |
| `domain/time/` | `EpochMs` (≥0), `DurationMs` (>0; `DEFAULT` = 3500 ms toast ttl) |
| `domain/uuid/` | `uuidv4(rng)` — pure UUID minting, shared by `PuzzleKey.generate` and `DisplacedClueId.generate` |
| `domain/brand.ts` | The `brand<Tag, T>()` escaper — an unsound cast, internal to the 15 branded-type owner modules (see §4) |

### Layer 1 — `src/builder/state/`, `src/player/state/`, `src/app/state/` (pure reducers)

Each module publishes its API at the folder root (`state.ts`, `intents.ts`, `reducer.ts`; `app/state/` additionally `effects.ts` and `intentKinds.ts`) and keeps implementation helpers under its own `internal/` subfolder. All three import `domain/` freely.

Module boundary rules (ESLint-enforced):

- `app/state` is a client of the other two: it imports their **root files only** (value and type), never their `internal/` files.
- `builder/state` and `player/state` do **not** import each other at all — no path resolving into the sibling `state/` tree is allowed. Shared concepts (e.g. `Cursor`, `GridInteraction` and its shared intent payload variants `GridInteractionIntent`) live in `domain/`. Both `intents.ts` files define their unions using the shared payload variants for the six shared kinds (`select-cell`, `move-cursor`, `type-letter`, `backspace`, `escape`, `click-clue-panel-word`); the six grid-interaction kinds and the two `report-*` failure kinds (`report-import-read-failure`, `report-pick-failure`) therefore appear with the same `kind` string in both unions. To make routing unambiguous, every Builder/Player intent variant carries a `target: 'builder' | 'player'` literal discriminator — exported as `IntentTarget` from `src/domain/notifications/Event.ts` (which both `intents.ts` files import). `ConfirmableIntent` carries `target` too. Routing is by discriminator, not by kind string; see §5.
- Neither imports `app/state` (no cycles).
- Tests import from `internal/` freely; the rule constrains only cross-module imports within `src/`.

`builder/state/internal/` contains `designMode.ts` (design-mode intents + reconciliation orchestration), `fillMode.ts` (thin policy adapters over `GridInteraction` for the typing/cursor intents — gating on `mode`, the `answerLetter` slot — plus markers, clue edits, metadata), `joinSubMode.ts`, `reattachSubMode.ts`, `importExport.ts`, `lifecycle.ts` (reset), `reconcileWords.ts` (the reconciliation algorithm).

`player/state/internal/` contains `solving.ts` (thin policy adapters over `GridInteraction` — gating on `phase`, the `playerLetter` slot, the check-clear and anagram re-eval rules — plus check, clear-errors), `lifecycle.ts` (import flows, reset, apply-loaded-progress), `anagram.ts`.

### Layer 2 — `src/ui/bindings/` (the seam; the only Svelte-aware logic module)

The only module that imports from all other layers plus Svelte. Everything here is a **factory** — no file holds module-level mutable state, nothing runs at import time. Contains:

| Module | Owns |
|---|---|
| `appStore.svelte.ts` | `createAppStore(initial, deps, ports, options?)` + `AppStore`/`AppDeps`/`AppPorts`/`LandingActions` types. Sole `$state` cell (factory-closure scope). Dispatch work-queue, event fold, external-event performance, save-failure latches. Only rune-using file in the layer. |
| `builderFacade.ts` / `playerFacade.ts` | `createBuilderFacade(appStore)` / `createPlayerFacade(appStore)` — typed dispatch narrowing, VM getters, `pickFile`, per-leaf action bags (`BuilderToolbarActions`, `BuilderGridActions`, `BuilderCluePanelActions`, `DisplacedCluesPanelActions`, `BuilderBannerActions`; player equivalents incl. `PlayerImportScreenActions`, `PlayerAnagramActions`). Own no state; plain `.ts`. |
| `gridActions.ts` / `filePickActions.ts` | Shared facade action factories, consumed by both facades: `createGridActions(dispatch)` builds the five grid-interaction bag methods (`selectCell`, `typeLetter`, `backspace`, `moveCursor`, `escape`) from plain args via the domain constructors; `createFilePickActions(appStore, dispatchFailures, onRead)` builds `pickFile` + `importDroppedFile` (the port-consumption policy: `'picked'` → `onRead(text)`, `'cancelled'` → silent `null`, `'failed'` → warn once + failure intent). |
| `modalFacade.ts` / `toastFacade.ts` | `createModalFacade` / `createToastFacade` — modal/toast VM getters + `ModalActions` / `ToastHostActions`. Own no state. |
| `persistenceCodec.ts` | Pure encode/decode of the two `localStorage` blob shapes (§8). Uses the structural `format/v1` layer (`serializeIncompleteShape`, `parsePuzzleShape`) directly — no JSON-string round-trip between the wrapper and the embedded puzzle. |
| `persistenceScheduler.ts` | `createPersistenceScheduler(storage, debounceMs, onWriteResult)` — mechanical debounce/serialize/coalesce/cancel-on-clear/flush. Holds no failure policy (the latches live in the appStore). |
| `boot.ts` | `createInitialAppState(ports, deps)` — load-or-blank boot: `ports.storage.loadBuilder()` → `parseBuilderSnapshot` → restore a full `BuilderState` (subMode forced to `'none'`, cursor to `null`) → wrap into `AppState`; or fresh `AppState.blank(...)` on absent/corrupt. Sole owner of the `BuilderState` reload shape. |
| `teardown.ts` | `installTeardown(store)` — registers the `pagehide` listener that invokes `store.getScheduler().flush()` so any debounced-but-unfired save fires before the tab is hidden. Sole owner of the persistence teardown wiring; `main.ts` calls it once. |
| `viewmodels/` | `builderVM`, `playerVM`, `gridVM`, `cluePanelVM`, `anagramVM`, `toastVM`, `modalVM` — pure state→VM derivation. |

Naming rule: **"store"** is reserved for the state-owning `AppStore`; the four experience modules are **facades**. There is no ports-register singleton (`ports.ts` is deleted); `main.ts` instantiates production ports directly.

### Layer 3 — `src/ui/` (presentational components)

Receive view-models + typed action bags as `$props()`. Three sub-trees — `ui/app/`, `ui/builder/`, `ui/player/`, plus `ui/shared/`. No domain value imports, no bindings value imports; type-only imports of VM/action-bag types from `ui/bindings` are allowed. `App.svelte` is the sole component permitted to import bindings **values** (the facade factories). Full inventory in §11.

### Layer 4 — `src/ports/` (side-effect implementations)

| Module | Implements | Wraps |
|---|---|---|
| `ports/localStoragePort.ts` | `StoragePort` | `window.localStorage` |
| `ports/downloadPort.ts` | `DownloadPort` | `URL.createObjectURL` + `<a download>` click |
| `ports/filePickPort.ts` | `FilePickPort` | `<input type="file">` (listens to `change` *and* `cancel`) + drag-and-drop |
| `ports/rngPort.ts` | `Rng` | `Math.random` (production; tests use seeded Mulberry32) |

Port contract:

- Port implementations are **stateless** — every method is self-contained over per-call locals; the module-level `export const xPort` instances are benign stateless singletons.
- **Never-throw:** `StoragePort`/`FilePickPort` methods never throw; non-`Error` throws are coerced to `Error` at the port boundary.
- **Storage reads** return `LoadResult<T>`:

  ```ts
  type LoadResult<T> =
    | { kind: 'loaded'; value: T }    // bytes successfully read
    | { kind: 'absent' }              // nothing stored under this key — silent
    | { kind: 'failed'; error: Error }; // the underlying primitive threw
  ```

  The failure signal travels in the type, so the contract is enforced at compile time. The port implementation warns **once on `kind: 'failed'`**; callers do not warn on load and never try/catch. `absent` and `failed` both collapse to a "fresh-start" / "drop-the-key" response at the call site today — main.ts returns `AppState.blank(...)`, `appStore.handleLoadPlayerProgress` returns `null`. The three cases stay distinguishable in the union so a future port that surfaces a meaningful difference (e.g. quota-exceeded vs. missing) does not require another breaking change. `LoadResult<T>` is defined in `src/domain/ports/ports.ts` and is used by both `StoragePort.loadBuilder()` and `StoragePort.loadPlayerProgress(key)`.

- **Storage writes** return `Error | null` silently — the appStore (which has dispatch context) warns/toasts via the `handleWriteResult` latch (`src/ui/bindings/appStore.svelte.ts`). The latch keys on `slice` and `deps.now()`; same shape as before.
- **File picks** return discriminated unions carrying `Error`: `PickResult` = `'picked' | 'cancelled' | 'failed'`; `DroppedFileResult` = `'read' | 'failed'` (a drop has no cancel path). Cancel is fully silent; failures travel as data and the facades warn once + dispatch the failure intent.
- Consumers add no redundant catch layers — callers pattern-match the result union, they do not catch. The type makes both contracts (`LoadResult<T>` and `Error | null`) the only visible failure channels; if a caller needs to react to a load failure it does so via the union, and if it needs to surface a save failure it dispatches `report-builder-save-failure` / `report-player-save-failure` from `handleWriteResult`. A defensive try/catch around a port call indicates a port author broke the contract, not that the consumer needs another guard.

### Layer 5 — `src/main.ts` (the only composer)

Boots the app: instantiates production ports, builds `deps = { rng: rngPort, now: () => EpochMs.of(Date.now()) }` and `ports = { storage, download, filePick }`, calls `createInitialAppState(ports, deps)` (the bindings-layer boot function) then `createAppStore(initial, deps, ports)` exactly once (running on default options: 400 ms persistence debounce, 60 s save-failure re-toast cadence), calls `installTeardown(store)` (registers the `pagehide` listener — see `teardown.ts`), and mounts `<App appStore={store} />` to `#app`. Nothing else constructs an `AppStore` in production; nothing else registers a `pagehide` listener. `main.ts` holds no domain knowledge — the `BuilderState` reload shape, the `AppState.blank(...)` fallback, and the persistence-teardown wiring all live in `ui/bindings/`.

## 4. Boundary Enforcement

ESLint (`eslint.config.js`, `@typescript-eslint/no-restricted-imports` per-glob blocks) enforces the layer boundaries; `tsc` does not check paths.

| Source path | May import | Blocked |
|---|---|---|
| `src/domain/**` | sibling `domain/**` files | `svelte`, DOM globals, `src/ui/**`, `src/ports/**`, all three `state/` trees; `domain/brand` except the 15 branded-type owner modules |
| `src/builder/state/**`, `src/player/state/**` | `domain/**`, own module (incl. own `internal/`) | each other (fully), `svelte`, DOM, `ui/**`, `ports/**`, `app/state/**`, sibling `internal/**`, `domain/brand` |
| `src/app/state/**` | `domain/**`, public root files of the other two state modules, own siblings | `svelte`, DOM, `ui/**`, `ports/**`, the other modules' `internal/**`, `domain/brand` |
| `src/ui/**` (except `ui/bindings/**`) | siblings; **type-only** from `ui/bindings/**` and `domain/**`; `App.svelte` alone may import bindings **values** | value imports from bindings, `ports/**`, all `state/**`, `domain/brand` |
| `src/ui/bindings/**` | all of `src/**` | `domain/brand` |
| `src/ports/**` | `domain/ports/ports.ts`, `domain/rng/Rng.ts`, `domain/puzzle/PuzzleKey.ts` (allow-list via negative-lookahead patterns) | everything else, `svelte`, `domain/brand` |

**Brand ban.** `domain/brand` is the unsound `brand()` escaper that bypasses range-checked constructors. It is importable only by the 15 branded-type owner modules (`Row`, `Col`, `GridSize`, `CellIndex`, `Letter`, `PuzzleKey`, `Title`, `Author`, `DisplacedClueId`, `WordNumber`, `ToastId`, `WordLength`, `Position`, `EpochMs`, `DurationMs`). `test/**` is out of scope (tests legitimately need the escaper for edge-case fixtures).

**Self-verification.** `test/boundary/imports.test.ts` drives the ESLint `Linter` API over adversarial fixture strings (with `filename` set so the per-glob rules apply) and asserts each forbidden import — static or dynamic `import()` — triggers a `no-restricted-imports` error, with negative controls proving allowed imports pass. It covers the builder↔player, state↔`internal/`, brand-ban, and bindings-value-import edges.

**Cycle policy.** `domain/` modules import each other acyclically (`domain/format/` is the bottom). No cycle can cross the bindings seam because state reducers cannot import `ui/` or `ports/`; `madge --circular` runs in `npm run lint` as a backstop.

## 5. Communication Patterns

**UI → logic.** Leaves invoke typed action-bag props. The facade-implemented bag functions construct the typed intents — branded fields via the domain constructors (`Row.of`, `Letter.try`, `GridSize.of`, `Title.try`, `Author.try`), which only bindings may call — and dispatch them. Intents are data at the dispatch seam, not callbacks. Components never call reducers and never construct branded values.

**Logic → UI.** Leaf-shaped, serializable, plain-typed view-models, derived reactively (Svelte 5 `$derived`) in `ui/bindings` from `AppState`.

**Reducers → effects.** Every reducer has the signature `(state, intent, deps) → { state, events: DomainEvent[] }` and is pure. Reducers compute the next state plus a *description* of side effects as data; they perform nothing. `deps = { rng: Rng; now: () => EpochMs }` is injected at dispatch; most cases ignore it. The cases that use it: design-mode toggle (`reconcileWords` mints `DisplacedClueId`s), `confirm-reset-builder` (`PuzzleKey.generate`), `anagram-scramble` (`Anagram.scramble`), and the app-level toast fold (`Toast.create`).

**`DomainEvent` variants.** State-affecting (consumed by `reduceApp` itself): `toast`, `modal-request`. Bindings-performed: `load-player-progress { key }`, `download { filename, content }`, `clear-builder-storage`, `clear-player-storage { key }`. A `modal-request` always carries its `confirmIntent`.

**`reduceApp` returns raw events.** `reduceApp` is the only function that sees all of `AppState`. It handles the six `AppIntent` kinds directly (`navigate`, `cancel-modal`, `dismiss-toast`, and the three `report-*-failure` kinds, which return toast events with state unchanged). For Builder/Player intents it invokes the sub-reducer (forwarding `deps`), composes the resulting `AppState` by swapping the sub-slice into `state.builder`/`state.player`, and returns the sub-reducer's events *raw* — the `toast`/`modal-request`/external events flow up untouched. `reduceApp` does not touch `state.modal` / `state.pendingConfirmIntent`; modal lifecycle is the bindings layer's responsibility (see `Confirmation modals as state` below). **`applyEventsToApp` is not called in `reducer.ts`; folding is the store's job.**

**Routing.** After the `AppIntent` switch, `reduceApp` switches on `intent.target` to invoke `reduceBuilder` (for `target: 'builder'`) or `reducePlayer` (for `target: 'player'`). No `AMBIGUOUS_INTENT_KINDS` set exists, and there is no route-based fallback; an ambiguous dispatch cannot occur because the discriminator resolves at the dispatch site. Each experience facade stamps the correct `target` literal when it constructs an intent, and the shared factory helpers `createGridActions` / `createFilePickActions` take a `target` parameter so the grid-interaction and failure intents carry the caller's experience. `BUILDER_INTENT_KINDS` and `PLAYER_INTENT_KINDS` remain as the kind-set records used by `intentKinds.test.ts` for the coverage assertions; `CONFIRMABLE_INTENT_KINDS` is no longer exported (modal lifecycle no longer depends on a runtime kind-set membership check).

**The `AppStore` is the sole event interpreter and performer of external side effects.** Its `dispatch` is a work-queue loop (reentrant dispatches queue, they do not recurse): `reduceApp` returns `{ state, events }` (raw events) → `applyEventsToApp` fold (the single fold site — `toast` events append to `state.toasts` via `Toast.create(deps.rng, …, deps.now)`; `modal-request` sets `state.modal` / `state.pendingConfirmIntent`; external events pass through) → set the rune (reactive VM updates) → iterate leftover external events. Per event: `download` → `ports.download.download(...)` (an `Error` return dispatches `report-download-failure`, which becomes an error toast); `clear-builder-storage` / `clear-player-storage` → the scheduler's synchronous clears (cancelling pending saves) → `storagePort.clear*`; `load-player-progress { key }` → `storagePort.loadPlayerProgress(key)`, parse the blob if present, dispatch `apply-loaded-progress`. Follow-up intents produced by external events re-enter the queue.

**Toasts as state.** Toasts live in `AppState.toasts`, appended by the fold from `toast` events and removed by `dismiss-toast` intents (auto-dismiss timeout or user click, via `ToastHostActions.dismiss`). There is no imperative `showToast()` anywhere.

**Confirmation modals as state.** `AppState.modal: ModalRequest | null` + `AppState.pendingConfirmIntent: ConfirmableIntent | null`, set by the fold from `modal-request` events. `Modal.svelte`'s Confirm button invokes `ModalActions.confirm()` which dispatches `pendingConfirmIntent` (a `confirm-*` intent) directly; Cancel/Escape dispatch `cancel-modal`. There is no `confirm-modal` intent. While a modal is open, other guarded controls are disabled to avoid stacking. Modal closing happens in the bindings layer's dispatch loop (the `AppStore` work-queue): after `applyEventsToApp` folds each dispatch's events, the loop snapshots whether a modal was open before the dispatch and, if so, clears both fields. Because the UI invariant guarantees the only legal dispatches with a modal open are `cancel-modal` and the modal's stashed confirm intent, this rule is structural rather than a kind-set membership check — no `CONFIRMABLE_INTENT_KINDS` set is consulted.

## 6. Store Construction & Injection

One real store, four experience facades, all factories:

```ts
export type AppDeps  = { rng: Rng; now: () => EpochMs };
export type AppPorts = { storage: StoragePort; download: DownloadPort; filePick: FilePickPort };

export type AppStore = {
  getState(); getRoute(); getToasts(); getModal();
  getPendingConfirmIntent(); getBuilder(); getPlayer();
  getScheduler(); getPorts();
  dispatch(intent: AppIntent | BuilderIntent | PlayerIntent): void;
};

export function createAppStore(
  initial: AppState,
  deps: AppDeps,
  ports: AppPorts,
  options?: { persistenceDebounceMs?: number; saveFailureRetoastMs?: number },  // defaults 400 / 60_000
): AppStore;
```

- The `PersistenceScheduler` is constructed **inside** `createAppStore` from `ports.storage` (guaranteeing the scheduler's storage is the store's storage) and is never passed in from outside. Its `onWriteResult` reports feed the store's save-failure latches (§8).
- The facades are per-instance adapters over an `AppStore`: typed dispatch narrowing, VM getters, `pickFile` (consumes the port's `PickResult`; `'picked'` → returns text, `'cancelled'` → silent `null`, `'failed'` → warn once + dispatch `report-pick-failure`, then `null`), and per-leaf action bags. They own no state.

**Prop contract.**

1. `App.svelte` declares `let { appStore }: { appStore: AppStore } = $props()` — the only component importing bindings values. It constructs the four facades and passes each as a prop to its shell; `Modal`/`ToastHost` receive VMs + action bags from the modal/toast facades.
2. Shells declare their facade prop, derive VMs reactively (`$derived(facade.…VM())`), and pass view-model + action-bag props to leaves.
3. Leaves never receive a store or a facade. Each leaf declares exactly the VM(s) + action bag(s) it invokes, e.g. `let { vm, actions }: { vm: BuilderToolbarVM; actions: BuilderToolbarActions } = $props();`. Fieldless intents (`{ kind: 'export-incomplete' }`) are wrapped as zero-arg bag functions for uniformity.
4. `Landing.svelte` takes `{ actions: LandingActions }` (`{ build(); play() }`). `Header.svelte` is static, store-free. Shared-leaf prop shapes: `Modal` = `{ vm, confirmIntent, actions }`; `ToastHost` = `{ vms, actions }` (`dismiss(id)` — id is a VM-provided branded value passed through); `FilePicker` = `{ label, pick, onpick, ondropfile }` (fully presentational: no IO, no catch layers; `null` from `pick` is a silent no-op — under the port contract `null` reaches the leaf only for cancel).
5. No `setContext`/`getContext` anywhere — context is a runtime back-channel with the same hidden-dependency problem as bare imports.
6. Autosave `$effect`s live in `App.svelte` (§8) because they observe both slices.
7. Tests construct independent stores per test via the factories — `createAppStore(initial, { rng: SeededRng, now: FakeClock }, { storage: InMemoryStoragePort, … })` — with write failures injected via `InMemoryStoragePort.nextWriteError` (one-shot). No shared singleton, no reset helpers, no import-order sensitivity; multi-instance mounting works because no module-level state exists anywhere in the chain.

## 7. State Model

### `AppState` (`app/state/state.ts`)

```ts
{
  route: 'landing' | 'build' | 'play';
  builder: BuilderState;
  player: PlayerState;
  toasts: Toast[];
  modal: ModalRequest | null;
  pendingConfirmIntent: ConfirmableIntent | null;   // the confirm-* intent the modal dispatches on Confirm
}
```

`AppIntent` = `navigate`, `cancel-modal`, `dismiss-toast { id }`, `report-download-failure`, `report-builder-save-failure`, `report-player-save-failure`.

### `BuilderState` (`builder/state/state.ts`)

```ts
{
  puzzle: Puzzle;                 // grid, words, title, author, key — NOT displacedClues
  displacedClues: DisplacedClue[];
  mode: 'design' | 'fill';
  subMode: { kind: 'none' }
        | { kind: 'join'; source: WordKey }
        | { kind: 'reattach'; displacedClueId: DisplacedClueId };
  cursor: Cursor;                 // null on reload — never persisted
}
```

Displaced clues live here, not on `Puzzle` — they are a Builder-only concept; `serializeIncomplete` takes them as a separate argument. `BuilderState.isBlank` is the work detector behind the guarded actions (§ Guarded actions). There are no `dirty`/`lastSavedAt`/`pending*` fields — persistence is a bindings concern, side effects flow as events; state is a pure snapshot of the current Builder world.

`BuilderIntent` kinds: `switch-to-fill`, `request-switch-to-design`, `confirm-switch-to-design`, `toggle-design-cell { row, col }`, `change-grid-size { size }`, `select-cell`, `move-cursor { direction, sign }`, `type-letter { letter }`, `backspace`, `toggle-marker { flag }`, `edit-clue { wordKey, clue }`, `begin-join { source }`, `click-clue-panel-word { wordKey }`, `click-grid-word { wordKey }`, `unjoin { source }`, `escape`, `begin-reattach { displacedClueId }`, `delete-displaced-clue { id }`, `edit-title`, `edit-author`, `request-import-puzzle { fileContent }`, `confirm-import-puzzle { fileContent }`, `report-import-read-failure`, `report-pick-failure`, `export-incomplete`, `export-complete`, `request-reset-builder`, `confirm-reset-builder`.

### `PlayerState` (`player/state/state.ts`)

Discriminated by phase:

```ts
| { phase: 'import'; lastImportError: string | null }
| { phase: 'solving'; puzzle: Puzzle; cursor: Cursor;
    checkResult: CheckResult | null; anagram: AnagramModalState | null }
```

`CheckResult` = `{ classification: 'complete-correct' | 'incomplete-correct' | 'complete-incorrect' | 'incomplete-incorrect'; incorrectCells; emptyCells }`. `AnagramModalState` = `{ openedForWord: WordKey; input: string; scrambledArrangement: (Letter | null)[] | null }` (null until first scramble).

`PlayerIntent` kinds: `import-puzzle { fileContent }`, `report-import-read-failure`, `report-pick-failure`, `apply-loaded-progress { playerLetters, savedGridSize }`, `import-new-puzzle`, `select-cell`, `move-cursor`, `type-letter`, `backspace`, `escape`, `click-clue-panel-word`, `check`, `clear-errors`, `request-reset-player`, `confirm-reset-player`, `open-anagram-helper`, `close-anagram-helper`, `anagram-input { input }`, `anagram-scramble`.

### Guarded actions (request/confirm pairs)

Four user actions are guarded: switch-to-design, Builder import, Builder reset, Player reset. Each is two intent variants: `request-*` checks the guard — blank state executes directly, non-blank state returns state unchanged plus a `modal-request` event carrying the matching `confirmIntent` — and `confirm-*` (dispatched by the modal's Confirm button) executes unconditionally. No `force` flag; no reducer ever refuses and re-fires.

### Polysemous click intents

`click-clue-panel-word` / `click-grid-word` branch on `state.subMode`:

- `none` → navigate the cursor to the word's start cell and set direction. (Refocusing the typing surface is a bindings side effect that follows from the resulting `cursor` field.)
- `join { source }` → attempt the join. Validity: source ≠ target, source has no outgoing `nextWord`, target not already pointed to, both exist. On success: set `source.nextWord`, displace a non-empty target clue to the displaced list, materialize the default space boundary marker on the source's last cell if the direction pair there is empty, reset sub-mode. On failure: toast with reason, sub-mode stays active.
- `reattach { displacedClueId }` → attempt reattach. Validity: target exists, empty clue, is a chain head. On success: move the clue text, remove the displaced entry. Only text transfers, never chain membership.

`unjoin` clears `source.nextWord` **and** its chain-boundary marker pair, and blanks the downstream word's clue — displacing it into the displaced-clue list first if it was non-empty (the same policy as join; a no-op under normal invariants, data-preserving in imported edge states). Admission rules for both join (`source has no nextWord`, `target not already linked`) and reattach (`target clue empty`, `target is a chain head`) are owned by `ChainAdmission` in `domain/chain/`, and user-facing rejection messages come from `ChainAdmission.message(result)`. `escape` cancels join/reattach sub-mode (Builder) or closes the anagram modal (Player).

### Reconciliation (design-mode grid changes)

`toggle-design-cell` runs `reconcileWords` (`builder/state/internal/reconcileWords.ts`), which reconciles the previous `Word[]` with words re-derived from the toggled grid: survivors keep clue/`nextWord` (length changes are toasted as "Word N Direction was shortened/lengthened"); destroyed words with non-empty clues become `DisplacedClue`s; links to destroyed words are cleared and downstream "See N Direction" clues are emptied; new words appear blank. It also maintains the chain-boundary markers on the grid — markers on linked words' old end cells move to their new last cells when links survive (preserving the user's space/hyphen/none choice), clear when links sever or the source word is destroyed, and default to space when the old end cell itself was destroyed; markers on standalone words' cells are user data and are never touched. Finally it runs `Numbering.assign` and `ChainValidation.validate` as a safety net — any post-reconciliation violation throws (an invariant breach is a bug, not a user-facing condition). The full edge-case suite lives in `test/builder/state/internal/reconcileWords.test.ts`.

### Player specifics

- **Check clear-on-change:** an interaction that changes the grid or cursor sets `checkResult = null`; a no-op interaction (out-of-bounds or unselectable click, same-cell re-click with no direction toggle, blocked move, backspace with nothing to clear) leaves state untouched. Implemented once in the `solving.ts` adapters over `GridInteraction` outcomes — a `null` outcome means state unchanged, a non-null outcome means grid and/or cursor changed. The check result drives the toolbar message/colour and the `clear-errors` action (`incorrectCells`), never per-cell grid colouring.
- **Anagram helper:** `open-anagram-helper` requires a cursor on a word and records `openedForWord`; when the selected word changes away from it, the modal auto-closes. `anagram-scramble` calls `Anagram.scramble(entries, input, deps.rng)` directly (Fisher–Yates over the non-fixed letters after fixed letters claim from the input pool) and stores the entries-aligned result. No grid write-back.
- **Import flow:** `import-puzzle` accepts complete files only; rejects set `lastImportError` (rendered inline on the import screen) and emit a toast. Success sets the solving phase and emits `load-player-progress { key }`; the appStore loads the saved progress blob and dispatches `apply-loaded-progress`, whose reducer applies the letters only if `savedGridSize` matches, only on white cells.
- **Builder import** (`request/confirm-import-puzzle`) accepts both incomplete and complete files; success replaces `BuilderState` (imported puzzle + displaced clues, auto-switched `mode = 'fill'`, `cursor = null`); failure toasts the parse errors and changes nothing. `export-incomplete` emits a `download` event unconditionally; `export-complete` runs `CompletenessCheck` first and toasts violations instead of downloading (the gate includes the non-head-clue rule, so the app can never emit a complete file its own parser rejects). On success with displaced clues present, the download is additionally accompanied by a `warning` toast stating how many were omitted and that they remain in the Displaced Clues panel — displaced clues never block export (Builder-only concept, preserved in Builder state and the incomplete format). Filenames come from `Filename.incomplete/complete(key)`.

## 8. Persistence

Two mechanisms, both bindings-layer:

1. **State observation (autosave).** `App.svelte` runs two `$effect`s over the store — one per slice (builder; player-when-solving) so a change to one slice does not re-arm the other's debounce. Changes are debounced (default 400 ms) and written via the internally-constructed `PersistenceScheduler`. The persisted blobs (`persistenceCodec.ts`):
   - **Builder snapshot:** `{ version: 1, kind: 'builder-snapshot', puzzle: <incomplete puzzle shape>, mode: 'design'|'fill' }` — a wrapper around the structural shape (`serializeIncompleteShape` produces the embedded portion directly; no JSON-string round-trip between the structural shape and the wrapper). The reload invariants (`subMode: { kind: 'none' }`, `cursor: null`) are owned by `createInitialAppState` (§3 Layer 2 / `boot.ts`); the wrapper does not carry them, so a saved snapshot has no place to drift them.
   - **Player progress:** `{ version: 1, kind: 'player-progress', key, gridSize, playerLetters: (Letter|null)[][] }`.
2. **Event-driven clears.** `clear-builder-storage` / `clear-player-storage { key }` events (emitted by the confirm-reset reducers) trigger the scheduler's synchronous `clear*`, cancelling any pending debounced save before it fires.
3. **Teardown.** `installTeardown(store)` (in `ui/bindings/teardown.ts`, called once by `main.ts`) registers a `pagehide` listener that invokes the scheduler's `flush()`, firing any pending debounced save synchronously before the tab is hidden. `pagehide` (not `beforeunload`) — `pagehide` covers both unload and bfcache-restore transitions and fires reliably on mobile. `flush()` exists for this single caller (and tests); it is not part of the autosave contract.

**Write-failure surfacing (per slice).** The scheduler reports every attempted write (save or clear, including `flush()`) via `onWriteResult(slice, err)`. The appStore latches per slice: the first failure of an episode warns (`console.warn`) and dispatches `report-builder-save-failure` / `report-player-save-failure` (error toast); further failures stay silent until 60 s (configurable) have passed since that slice's last toast, then warn + re-toast; the next successful write re-arms the latch. Reminders ride on attempted writes — an idle session writes nothing and loses nothing new. A failed Builder clear self-heals on the next successful autosave; a failed player-progress clear leaves a stale keyed blob that resurrects only if that exact puzzle is re-imported (accepted edge).

**Corrupt-state recovery.** At boot, an unreadable Builder snapshot is discarded (`console.warn`, no toast) and a fresh blank puzzle with a freshly generated key starts; corrupt player progress is silently dropped and the import screen shows. `main.ts` performs this, not a reducer.

## 9. View-Models & the Component Contract

All VM types live in `ui/bindings/` (most in `viewmodels/`): plain, leaf-shaped, serializable, no methods, no Svelte. `ToastVM` (id, kind, message, `ttlMs` — the leaf schedules its own auto-dismiss), `ModalVM` (kind, title, body, confirmLabel, cancelLabel | null), `GridVM`/`GridCellVM` (row, col, black, letter, number, `hilite: 'none'|'selected'|'in-word'`, separatorRight/Bottom, selectable), `BuilderToolbarVM` (mode, grid-size gating, marker flags, completeness gating + violations), `ClueEntryVM` (number, direction, displayClue, lengthPattern, chain affordances — builder-only fields are simply false in Player), `CluePanelVM`, `DisplacedCluesPanelVM` (always visible, empty state "No displaced clues"), `BuilderSubModeBannerVM`, `BuilderShellVM`, `ActiveClueBannerVM` (always reserved space; null pattern for non-head words), `PlayerCluePanelVM`, `PlayerToolbarVM` (canCheck/canClearErrors/canReset/canOpenAnagram/canImportNew), `AnagramModalVM`/`AnagramTileVM` (tiles with fixed/letter, separators between tiles, expected letter counts, input validity, scramble gating), `PlayerShellVM`.

A component contains no business logic: no imports from `domain/` or any `state/` module, no reducer or domain-function calls, no domain-value computation, no VM mutation. Components compute pure presentation matters from props only (e.g. resolving `hilite` into a Tailwind class). The ESLint rules in §4 make the value-import paths compiler-blocked, not convention.

**Snippet convention.** Svelte 5 `{#snippet}` deduplicates presentational markup sharing one component's reactive scope; a child `.svelte` component is extracted only for a genuine ownership boundary. The reference example is `BuilderCluePanel.svelte`'s `{#snippet clueRow(entry)}`, rendered in both the Across and Down `<ul>`s — the panel single-owns the scroll container, `<li>` refs (`bind:this` keyed by canonical id), the scroll-into-view `$effect`, and the per-row drafts `SvelteMap`. (No DOM ids, no `getElementById`, no cross-component DOM anywhere.)

## 10. JSON Puzzle Format (v1/v2 family; the app writes v2)

`domain/format/` is split into a structural layer and a JSON-I/O layer, and the **structural shape is the canonical wire shape**. The file format (downloaded `.json`, imported files) and the `localStorage` blob format (builder snapshot) share the structural layer by construction — they can only diverge by diverging `v1.ts` itself.

- `domain/format/v1.ts` — **structural layer**. The single source of truth for "what does a v1/v2 puzzle look like as data": `parsePuzzleShape(parsed: unknown) → Result` (validates both accepted versions; accepts any caller-produced `unknown`), `serializeIncompleteShape(p, clues) → object`, `serializeCompleteShape(p) → object`, `ParseFailure`, `PuzzleFileType`. Operates on structured values end-to-end — no `JSON.parse` / `JSON.stringify` anywhere in this module.
- `domain/format/v1Json.ts` — **JSON I/O adapters**. Thin wrappers that convert between the string form (what browser file APIs give and take) and the structural form: `parsePuzzle(json: string)` delegates to `parsePuzzleShape` after a single `JSON.parse`; a `JSON.parse` failure becomes the existing `ParseFailure` shape (`'File is not valid JSON.'`); `serializeIncomplete(p, clues)` and `serializeComplete(p)` call the structural shape function and `JSON.stringify` the result. `Filename` helper lives here (it is a string-output side effect, not a structural shape).

Versions 1 and 2 share an identical schema; they differ only in the interpretation of an **empty chain-boundary marker pair** on a linked word's last cell — v1 parses normalize it to a space marker (materializing the pre-feature implicit default), v2 preserves it as "no separator". The app writes `version: 2`; v1 files remain readable.

```json
{
  "version": 2,
  "type": "incomplete" | "complete",
  "key": "<UUID v4>",
  "gridSize": 15,
  "title": "...",
  "author": "...",
  "grid": [[ { "black": false, "puzzleLetter": "A" | null,
               "spaceRight": false, "spaceBottom": false,
               "hyphenRight": false, "hyphenBottom": false }, ... ], ...],
  "words": [
    { "startRow": 0, "startCol": 1, "direction": "across",
      "length": 4, "clue": "...",
      "nextWord": { "startRow": 3, "startCol": 0, "direction": "down" } | null }
  ],
  "displacedClues": [ { "id": "<UUID v4>", "clue": "...", "direction": "across" } ]
}
```

Key rules enforced by `parsePuzzle` (strict — the failure list is the contract):

- `version ∈ {1, 2}`; `type ∈ {'incomplete', 'complete'}`. Unknown fields fail (a stray `letter` field is rejected — `puzzleLetter` is the only accepted answer-letter name).
- `gridSize` integer 2..25; grid is `gridSize × gridSize`; missing marker booleans default to `false`; `puzzleLetter` is `null` or single A–Z.
- Words: in-bounds starts, `length ≥ 2`, `nextWord` resolves; `ChainValidation` reports no cycles/branches/dangling/self-refs. `number` is never carried in the file (re-derived via `Numbering.assign`); a `number` field fails. `length` is cross-checked against the grid.
- **Complete:** every white cell has a letter; every chain-head clue non-empty; every non-head chain word's clue empty (strict — non-empty fails, no silent normalization); no `displacedClues` field.
- **Incomplete:** letters may be null, clues may be empty; `displacedClues` is an array of unique valid-UUID entries.
- On any failure: a human-readable error list, no state change.

`puzzles/*.json` — seven canonical sample files (puzzle1–6 + `guardian_bank_holiday_2026-08-29.json`), all `version: 2`, `type: 'complete'`. Neither the app nor the test suite references the directory; it exists purely as a record of the format. Puzzle6 contains one chain; its previously-implicit space boundary was materialized during the v2 reserialization.

## 11. Component Inventory

### Visual conventions

Selected cell `bg-yellow-400`/`bg-yellow-300`; in-word `bg-yellow-100`/`bg-yellow-50`; black cells `bg-black`; space markers render as gray bars between cells; hyphen markers as `-` glyphs; word numbers in the top-left corner (`text-[0.6rem]`); the active-clue banner area is always reserved (`min-h-2em`).

### Builder (`ui/builder/`)

| Component | Receives | Invokes (via action bag) |
|---|---|---|
| `BuilderShell` | `BuilderFacade` prop | composes children; layout: grid+controls left, clues right |
| `BuilderToolbar` | `BuilderToolbarVM` + actions | mode toggle, grid-size control, marker toggles (gated on cell selection; four-button UI dispatches `set-marker` intents — toggle semantics in the facade, reducer is dumb write), Export Incomplete / Export Complete, Reset, Import (via FilePicker), title/author edits; renders the export-complete blocking-error messages below the export row whenever the gate fails |
| `GridSizeControl` | min/max/value/disabled | `change-grid-size`; numeric input, clamps on blur; disabled when not blank |
| `BuilderCluePanel` | `CluePanelVM` + actions | clue edits (heads only — non-heads show "See N Direction"), Link next / Unlink, `click-clue-panel-word`, `begin-join`, `unjoin`; scrolls the highlighted clue into view via manual delta on the panel element (not native `scrollIntoView`) |
| `DisplacedCluesPanel` | `DisplacedCluesPanelVM` + actions | `begin-reattach`, `delete-displaced-clue`; always rendered, empty state |
| `JoinReattachBanner` | `BuilderSubModeBannerVM` + actions | `escape`; instructional banner during sub-modes |

### Player (`ui/player/`)

| Component | Receives | Invokes |
|---|---|---|
| `PlayerShell` | `PlayerFacade` prop | switches ImportScreen ↔ solving layout; disables the typing surface while the anagram modal is open so the modal's textbox keeps focus |
| `ImportScreen` | import error + actions | puzzle import (via FilePicker); shows `importError` on reject |
| `ActiveClueBanner` | `ActiveClueBannerVM` | none; rendered above and below the grid |
| `PlayerCluePanel` | `PlayerCluePanelVM` + actions | `click-clue-panel-word`; display + navigation only; scroll-into-view like the Builder panel |
| `PlayerToolbar` | `PlayerToolbarVM` + actions | `check`, `clear-errors`, `request-reset-player`, `import-new-puzzle`, `open-anagram-helper` |
| `AnagramModal` | `AnagramModalVM` + actions | `anagram-input`, `anagram-scramble`, `close-anagram-helper`; closes on backdrop/Escape/selection-change; focuses its textbox on open |

### Shared (`ui/shared/`)

| Component | Notes |
|---|---|
| `Modal` | Backdrop, Confirm/Cancel, Escape cancels; Confirm dispatches the pending confirm intent. No focus trap (a11y out of scope). |
| `ToastHost` / `Toast` | Stacked top-right (bottom-center on mobile); click or timeout dismisses. Per-toast timer `Map<ToastId, timer>` — sibling mutations never reset unrelated timers. |
| `Grid` | The crossword grid leaf shared by Builder and Player (replaces the former twin `BuilderGrid`/`PlayerGrid`). Props `GridVM` + `onCellClick(row, col)` + `allCellsClickable` (true in Builder design mode; omitted/false otherwise). |
| `TypingSurface` | The single hidden `<input>`. Props `enabled` + `cursor`; a state-driven `$effect` refocuses on cursor change. Normalizes mobile composition/IME/Unidentified keys into `TypingIntent` values, applied to a grid action bag via `applyTypingIntent` (`ui/shared/typingIntent.ts`). |
| `FilePicker` | Fully presentational file-pick/drop surface (§6 prop shape); all IO and failure handling live in the facades. |
| `typingIntent.ts` / `clueScroll.ts` | Plain shared helpers: `TypingIntent` + `applyTypingIntent(intent, actions)` mapping a `TypingIntent` onto any grid action bag (structural type); `canonicalWordKeyId(wordKey)` + `scrollRowIntoView(panelEl, liRefs, id)` — the scroll-into-view logic shared by both clue panels. |
| `VersionStamp` | Footer rendering the build-time-injected `__APP_COMMIT_HASH__` / `__APP_BUILD_TIME__` globals (Vite `define` from an inline `gitInfo()` in `vite.config.ts`; ambient-declared in `src/vite-env.d.ts`). No props, no imports. |

### Top-level layout

`App.svelte`: Header on top; `switch (route)` renders `Landing` / `BuilderShell` / `PlayerShell`; `ToastHost` + `Modal` at the bottom. `Landing` shows Build / Play buttons dispatching `navigate`.

## 12. Testing & CI

**Unit tests (Vitest, pure-logic only).** One test file per source module under `test/` mirroring `src/` layout. Coverage includes: all `GridOps` accessors; the `GridInteraction` transitions (select/move/type/backspace, no-op outcomes, both letter slots); grid-level word topology (`WordTopology.runs` across both axes and `WordTopology.partOfRun` in every direction combination); word geometry (`WordGeometry.cells` offset sequencing and direction handling, `WordGeometry.contains` cell-in-word, `WordGeometry.lastCell`); word derivation/numbering across grid shapes; `WordSelection` and `ChainCells` cases; every `ChainViolation` kind; `LengthPattern` (standalone, space/hyphen/mixed, chain suffixes with all three boundary kinds); `parsePuzzle` happy paths (both versions) and every rejection rule (incl. strict `letter`-field and non-head-clue rejections, and the v1-only boundary normalization); export/import round-trip conformance (a gate-passing puzzle's `serializeComplete` output re-parses cleanly; the non-head-clue state is blocked by the gate and rejected by the parser — the two gates cannot drift apart silently); the exhaustive `reconcileWords` edge-case suite; every Builder/Player intent kind with happy-path and guard-rejection tests (`deps = { rng: SeededRng, now: FakeClock }`); `Anagram.scramble` with seeded RNG; the app-level modal confirm/cancel and toast folds. There is no component/DOM test harness; visual and mobile-keyboard behaviour are on the manual checklist (iOS Safari / Android Chrome typing, visual conventions, banner rendering, toast placement).

**Fakes (`test/fakes/`).** `InMemoryStoragePort` (with one-shot `nextWriteError`), `SeededRng` (Mulberry32), `FakeClock` (manually advanced, returns `EpochMs`), `StubDownloadPort` (records calls) — each paired with a co-located unit test.

**Boundary self-test.** `test/boundary/imports.test.ts` (§4).

**Scripts (`package.json`).**

```
dev       vite
build     vite build                        (single-file artifact in dist/)
preview   vite preview
test      vitest run
lint      eslint . && madge --circular --extensions ts,svelte src/
typecheck svelte-check --tsconfig ./tsconfig.json
ci        npm run lint && npm run typecheck && npm run test && npm run build
```

**CI/CD (`.github/workflows/deploy.yml`).** Node from `.nvmrc` → `npm run ci` → deploy of the Pages artifact (`upload-pages-artifact@v3`). Single-env production build; no `import.meta.env` flags in use.

## 13. File / Module Map

```
angryphrase/
├─ index.html, vite.config.ts, tsconfig.json, eslint.config.js,
│  vitest.config.ts, tailwind.config.ts, postcss.config.js, .nvmrc
├─ src/
│  ├─ main.ts, app.css, vite-env.d.ts
│  ├─ domain/         grid/ (incl. GridInteraction, GridAccess, WordTopology) word/ (incl. WordGeometry) letter/ chain/ (incl. ChainAdmission) anagram/
│  │                  puzzle/ builder/ uuid/ time/ notifications/
│  │                  format/ (v1.ts structural + v1Json.ts I/O)
│  │                  rng/ ports/  brand.ts            (§3 Layer 0)
│  ├─ builder/state/  state.ts intents.ts reducer.ts + internal/
│  │                  (designMode, fillMode, joinSubMode, reattachSubMode,
│  │                   importExport, lifecycle, reconcileWords)
│  ├─ player/state/   state.ts intents.ts reducer.ts + internal/
│  │                  (solving, lifecycle, anagram)
│  ├─ app/state/      state.ts intents.ts reducer.ts effects.ts intentKinds.ts
│  ├─ ui/
│  │  ├─ app/         App, Landing, Header
│  │  ├─ builder/     BuilderShell, BuilderToolbar, GridSizeControl,
│  │  │               BuilderCluePanel, DisplacedCluesPanel, JoinReattachBanner
│  │  ├─ player/      PlayerShell, ImportScreen, PlayerCluePanel,
│  │  │               ActiveClueBanner, PlayerToolbar, AnagramModal
│  │  ├─ shared/      Modal, ToastHost, Toast, TypingSurface, FilePicker,
│  │  │               VersionStamp, Grid, typingIntent.ts, clueScroll.ts
│  │  └─ bindings/    appStore.svelte.ts, builderFacade.ts, playerFacade.ts,
│  │                  modalFacade.ts, toastFacade.ts, persistenceCodec.ts,
│  │                  persistenceScheduler.ts, gridActions.ts,
│  │                  filePickActions.ts, viewmodels/ (§3 Layer 2)
│  └─ ports/          localStoragePort, downloadPort, filePickPort, rngPort
├─ test/              domain/ builder/state/ player/state/ app/state/
│                     ui/bindings/ fakes/ boundary/imports.test.ts
├─ puzzles/           7 sample files, version 2, unreferenced by code
└─ llmworkspace/      architecture.md (this file),
                      future_considerations.md,
                      architecture_smells.md, architecture_smell_resolutions.md
                      (audit records — not part of the live set, §14),
                      archive/ (historical; nothing live may cite it — §14)
```

**Naming conventions.** `PascalCase.ts` for type+helper bundles (`Grid.ts`, `Letter.ts`); `camelCase.ts` for pure-function modules (`reducer.ts`, `reconcileWords.ts`); `*.svelte` PascalCase; intent kinds are kebab-case string literals; VM types suffixed `VM`; no `I` prefix on interfaces (`StoragePort`, not `IStoragePort`).

**Cycle policy.** See §4 — `domain/` acyclic with `format/` at the bottom; the bindings seam is the only place that can cycle, and `madge` guards it.

---

## 14. Doc Set & Citation Policy

The **live doc set** is this file and `llmworkspace/future_considerations.md`. Two sibling documents sit beside them and are *audit records*, not part of the live set: `llmworkspace/architecture_smells.md` (a ranked audit of the architecture as built) and `llmworkspace/architecture_smell_resolutions.md` (how each ranked finding was resolved). Both describe history; neither is a citation target.

**No requirement layer.** This project has no specification document and no requirement identifier space. Behavioural rules live in the code that implements them — as code, as comments, and as test names. The `FR-*` / `NFR-*` identifiers from the project's original requirements draft are **retired**: they scaffolded the initial design and are not part of the live doc set. Do not reintroduce them. The same holds for every other identifier minted by an archived document — the archived code-smell log's, the archived design-review notes' — and for any citation of an audit record by its finding number.

**`llmworkspace/archive/` is historical.** It holds material that informed the original design and is kept for reference only. Nothing live may cite it. Archiving a document that a live artefact still cites is a **breaking change to the doc set**: the citation must be re-homed in the same commit.

**Citation rules.** A citation — a comment, a doc comment, or a test title — must resolve to something live:

1. A module, symbol, or path **inside this repository** (e.g. `ChainAdmission`, `domain/grid/WordTopology.ts`). This is the preferred form, and the right one whenever the cited rule is implemented near the citation.
2. A **named section** of this file or of `future_considerations.md` (e.g. `architecture.md §7 (Polysemous click intents)`).

Never cite:

- a path into `llmworkspace/` — the doc set is addressed by document name, never by workspace path;
- a **position**: a line number, with or without a section sign (a `file.ext:` followed by digits, or a `§` followed by three or more digits). Section numbers in this document have at most two digits, so a `§` with three or more digits is a line number;
- an identifier from a retired vocabulary.

These rules are conventions, not compiler-enforced. Comment text is read by people and by agents working on the code, and it is worth keeping resolvable — but nothing depends on it mechanically, so no checker polices it. The project's mechanical checks are reserved for the layer import edges, where a violation actually breaks the architecture. A citation that breaks the rules above is a review finding, not a build failure.

