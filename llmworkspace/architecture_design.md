# angryphrase — Architecture Design

> Status: Builder-ready design. Pair with `llmworkspace/requirements.md` (functional/non-functional requirements) and `llmworkspace/architectquestions0.md` (decisions log). Every section is intended to give a builder agent enough information to implement without making further architectural decisions.

---

## 0. Design Principles (binding)

These four principles are binding constraints on the implementation. Every other section is downstream of them.

1. **Thin UI.** The UI layer is as thin as possible. All logic lives in pure logic modules with no knowledge of Svelte, HTML, DOM, or any rendering concept. Components render view-models and emit intents — nothing else.
2. **Domain-Driven Design.** The domain model is the centre; persistence, format, and UI are adapters at the edges. Pure functions over immutable domain objects are the unit of behaviour.
3. **Explicit types.** bundles of data have named types; field types are precise (`Letter | null`, not `string`); illegal states are unrepresentable where feasible.
4. **No primitive obsession.** Row, Column, Letter, PuzzleKey, Direction, GridSize, WordNumber, DisplacedClueId, ToastId, MarkerFlag, etc. are all branded-types or discriminated unions. Plain `string` and plain `number` do not appear in domain signatures.

---

## 1. System Overview

`angryphrase` is a client-only web application for building and solving cryptic-style crossword puzzles. It runs entirely in the browser, persists to `localStorage`, and ships as a single self-contained HTML file via `vite-plugin-singlefile`. There are exactly two top-level experiences — **Builder** and **Player** — connected only via puzzle JSON files exported to and imported from the user's file system. There is no backend, no accounts, and no multi-user anything.

### 1.1 Key design decisions (rationale)

| Decision | Rationale |
|---|---|
| **Pure-reducer + intent dispatch + events** (from A1) | Reducers are pure functions `reduce(state, intent) -> { state, events }`. They compute the next state and the *description* of any side effects they want performed (toasts, modals, downloads, storage clears) as data, but never perform them. The bindings layer interprets the returned events. Maximizes testability (NFR-4), makes the closed set of allowed actions compiler-enumerable, puts "simple domain objects" literally across the UI↔logic boundary (Principle 1), and resolves the "pure functions need to cause effects" tension without ad-hoc scratch fields. |
| **Strict immutability** (from A2) | Reducers never mutate inputs. A tiny `clone` helper handles the few deep structures (grid). No Immer dependency (single-file build stays small). |
| **In-app mode enum routing** (from A3) | `route: 'landing' \| 'build' \| 'play'` lives in `AppState`. No router library; no SSR concerns. Matches FR-1 (always show landing on load) and the single-file deployment. |
| **Aggressive branded types** (from B1) | A `brand<Tag, Primitive>` utility produces nominal `Row`, `Col`, `Letter`, `PuzzleKey`, `GridSize`, `WordNumber`, `DisplacedClueId`, `ToastId`, `CellIndex` types. Range-checked constructors make illegal values unconstructable at the boundary. |
| **Composite `WordKey`** (from B2) | `WordKey = { startRow, startCol, direction }`. Matches FR-33/FR-45 exactly; `nextWord: WordKey \| null`. Displaced clues keep a `DisplacedClueId` because they have no positional handle. A canonical string form keys a `WordMap` for O(1) lookup. |
| **2D `Cell[][]` grid + typed `GridOps`** (from B3) | Mirrors JSON; raw indexing forbidden outside `GridOps`. |
| **`answerLetter`/`playerLetter` runtime naming** (from B4) | The string `"letter"` never appears in the runtime model. Serialization adapter maps `answerLetter ↔ puzzleLetter` at the JSON boundary only. |
| **`Direction` as `'across' \| 'down'`** (from B5) | Matches FR-96; helpers in a `Direction` module. |
| **Vitest, pure-logic tests** (from D2) | Unit tests cover all pure domain logic. No DOM/component test harness required by spec; visual + mobile keyboard behaviour verified manually (RISK-4). |
| **View-models in / Intents out** (from E2) | Components receive plain typed view-models produced in `ui/bindings`. Components emit typed intents. The bindings layer owns the runes store, dispatch, debounced persistence, and view-model derivation. Components contain no business logic and no domain-function calls. |
| **`puzzles/` directory** | Canonical v1 sample puzzle files (`version: 1`, `type: 'complete'`, `puzzleLetter` field, UUID-v4 `key`). Neither the app nor the test suite references the directory; the files exist purely as a record of the format. The strict parser's rejection of an unknown `letter` field (FR-95) is documented at §3.7 and §6.3; no migration script is shipped — the samples are already canonical. |
| **Injected RNG for anagram scramble** (from D1) | `scramble(word, input, rng)` takes an `Rng` interface; production wires `Math.random`; tests inject a seeded RNG. |
| **No cursor persistence across reload** (from C6) | Builder state autosaves everything *except* the cursor. On reload, cursor is `null`. Less code, matches your preference. |
| **Strict non-head clue rejection** (from C5) | A complete-file import with a non-empty `clue` field on a non-head chain word is invalid (clear error, no silent normalization). |
| **Displaced Clues panel always visible** (from C1) | Empty state is shown explicitly ("No displaced clues") for UI consistency. |
| **`Export Incomplete` / `Export Complete` button labels** (from G1) | The FR-58 download action is labeled "Export Incomplete" (was "Save" in the requirements doc). FR-59's action remains "Export Complete". This is a deliberate, AX-approved deviation from the requirements text; the underlying behaviour is unchanged. |
| **Toasts/modals as state** (from G4) | Toasts live in `AppState.toasts: Toast[]` (added by `reduceApp` based on `toast` events emitted by reducers; cleared by `dismiss-toast` intents from timeouts or user clicks). The currently displayed modal lives in `AppState.modal` (set by `reduceApp` based on `modal-request` events; cleared by `cancel-modal` or by the deferred confirm pass). Toasts/modal descriptions are pure value objects living in `domain/notifications/` (UI consumers render them; the types themselves are not UI-coupled). |
| **Request/confirm intent pairs for guarded actions** (revised S2) | Four user actions require confirmation (FR-53 design-switch, FR-54 builder import, FR-55 builder reset, FR-77 player reset). Each becomes two intent variants: `request-*` (executes the guard; emits a `modal-request` event when blocked) and `confirm-*` (executes the action unconditionally, dispatched by the modal's Confirm button). No `force` flag; no reducer ever refuses and re-fires. The "click Design → guard pops modal" and "click Confirm in modal → action executes" flows are two distinct domain actions and are modelled as such. |
| **`app/state/` reducer module** (revised S2) | A third pure reducer module parallel to `builder/state/` and `player/state/`, owning `AppState`, `reduceApp`, and the deferred-action re-dispatch logic. Pure: imports `domain/`, `domain/notifications/`, and the **public API** of `builder/state/` and `player/state/` (their root files: `state.ts`, `intents.ts`, `reducer.ts`) — both values and types — but never their `internal/` implementation files (see §1.3 module-boundary rule). No Svelte, no DOM, no ports. Required so that `reduceApp` — the only function that sees all of `AppState` — can invoke `reduceBuilder`/`reducePlayer` and interpret reducer-emitted events that affect app-level state (toasts array, modal field, pending confirm intent). |
| **`domain/notifications/` directory** (revised S2; issue 18) | Pure value objects whose consumers happen to be UI but whose shapes belong to the domain: `Toast`, `ToastId`, `ToastKind`, `ModalRequest`, `Kind`, and the `DomainEvent` discriminated union emitted by reducers. Lives in `domain/` (not `domain/ui/` — "UI" has no business in a domain path). Components import these types only type-only via `ui/bindings/`. |
| **Displaced clues live on `BuilderState`, not `Puzzle`** (from S1) | FR-59 calls displaced clues "a Builder-only concept." Removed from `Puzzle` entirely; the serialization adapter (`serializeIncomplete`) takes `(puzzle, displacedClues)` as separate args. Makes the conceptual boundary in the spec literal in the code. |
| **Check result in PlayerState** (from G5) | `checkResult: CheckResult \| null`. Any grid/cursor-changing intent clears it. Pure and testable. |
| **Single hidden typing surface** (from G3) | One `TypingSurface.svelte` component owns the hidden `<input>` and normalizes key/IME events into intents. Mobile specifics isolated. |

### 1.2 Architectural layer diagram (textual)

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
              │  - runes store ($state)                                        │
              │  - dispatch(intent) → { state, events } from reduceApp         │
              │  - applies state to rune; performs external events via ports  │
              │  - debounced persistence scheduling (state observation)       │
              │  - view-model derivation (state → leaf-shaped VMs)           │
              │  - RNG + ports injected here at app boot                       │
              └────────────────┬───────────────────────────────┬─────────────┘
                              │                                 │
                              ▼                                 ▼
       ┌──────────────────────────────────┐         ┌──────────────────────────────┐
       │        Svelte components         │         │         Reducers             │
       │  (ui/app, ui/builder, ui/player, │         │  reduceApp, reduceBuilder,  │
       │   ui/shared)                     │ intents │  reducePlayer — pure         │
       │  pure presentational; no logic   │────────▶│  (state, intent) ->          │
       └──────────────────────────────────┘         │     { state, DomainEvent[] } │
                                                   └──────────────┬───────────────┘
                                                                   │ calls
                                                                   ▼
       ┌─────────────────────────────────────────────────────────────────────────┐
       │                              domain/                                    │
        │  grid/  word/  letter/  chain/  anagram/  puzzle/                        │
        │  builder/  notifications/  format/  ports/                               │
       │  - pure TS, zero framework imports, no Svelte, no DOM                   │
       │  - immutable value objects, branded types, pure functions               │
       └─────────────────────────────────────────────────────────────────────────┘
                                                                   │ uses (interfaces)
                                                                   ▼
       ┌─────────────────────────────────────────────────────────────────────────┐
       │                              ports/                                     │
        │  localStoragePort, downloadPort, filePickPort, rngPort                  │
        │  - implementations of domain/ports interfaces                            │
       │  - side-effectful; swappable in tests                                   │
       └─────────────────────────────────────────────────────────────────────────┘
```

The boundary enforced by tooling: **`domain/`, `builder/state/`, `player/state/`, and `app/state/` MUST NOT import Svelte, DOM APIs, or `ports/`.** A lint rule (ESLint `no-restricted-imports`) blocks this. The bindings layer is the *only* place that wires ports to reducers and reducers to Svelte runes.

---

## 2. Architecture

### 2.1 Layers and responsibilities

**Layer 0 — `domain/` (pure, framework-free).**
Owns the entire domain model: value objects, branded types, pure functions, and port *interfaces*. This is where word derivation, numbering, chain traversal/validation, reconciliation, length-pattern derivation, display-clue derivation, anagram scramble, completeness check, and JSON parse/validate all live. May import only from itself and from TS's standard library. Components in this layer:

| Module | Owns |
|---|---|
| `domain/grid/` | `GridSize` (2..25), `Row`, `Col`, `Cursor` (`{row, col, direction} \| null`; owned here so Player state + viewmodels do not reach type-only into a sibling Layer-1 module), `Cell`, `CellMarker`, `CellMarkerFlag`, `Grid` (`Cell[][]`), `GridOps` (typed accessors), `CellIndex`. |
| `domain/word/` | `Word`, `WordKey`, `Direction` and its helpers, `DerivedWord` (the shape of a `Word` before `Numbering.assign` mints its `number`; output of `WordDerivation.derive`, input to `Numbering.assign`, and the `newWords` argument of §8.5 `reconcileWords`), `WordDerivation` (scan grid → `DerivedWord[]`), `Numbering` (`assign(grid, DerivedWord[]) → Word[]` per FR-6), `WordMap`. |
| `domain/letter/` | `Letter` brand + parsing/validation (`Letter.try(ch)`), case-folding rules (FR-51). |
| `domain/chain/` | `Chain` traversal, `ChainValidation` (cycles/branches/dangling/self-ref per FR-98), `DisplayClue` (FR-90), `LengthPattern` (FR-91, full suffix rule implemented and unit-tested). |
| `domain/anagram/` | `AnagramEntry` model, `AnagramInput` validation (FR-85), `scramble` (FR-86). |
| `domain/puzzle/` | `Puzzle` aggregate (grid + words + title + author + key), `PuzzleKey` (UUID brand), `Title`, `Author`, `CompletenessCheck` (FR-61/FR-62). |
| `domain/builder/` | `DisplacedClue`, `DisplacedClueId`. (Builder-only concept per S1 — lives in `domain/` as a pure value-object pair; `BuilderState` carries the `DisplacedClue[]`, not `Puzzle`.) |
| `domain/notifications/` | `Toast`, `ToastId`, `ToastKind`, `ModalRequest`, `ModalKind`, and `DomainEvent` — the discriminated union of side-effect requests that reducers return. Pure value objects whose consumers are UI, not UI themselves. |
| `domain/format/` | `v1` JSON parse + validate, both incomplete and complete (FR-94 to FR-99), strict non-head-clue rejection (C5). Produces `Puzzle` + `DisplacedClue[]` (for the incomplete format) or a `ParseFailure[]`. |
| `domain/ports/` | Side-effect port *interfaces* only: `StoragePort`, `DownloadPort`, `FilePickPort`. No implementations. |
| `domain/rng/` | `Rng` interface only — a deps-injection abstraction, not a port. Hoisted out of `domain/ports/` to keep the "port" definition honest and break a type-only cycle (see §3.7 and `design_review_notes.md` item 1). |

**Layer 1 — `builder/state/`, `player/state/`, and `app/state/` (pure reducers).**
Owns the reducer functions and the `Intent` discriminated unions for each experience, plus the per-experience `State` value objects. Pure; no Svelte, no DOM, no ports. All three freely import `domain/`. **Module boundaries within Layer 1 (binding):** each of `builder/state/`, `player/state/`, and `app/state/` is a module that publishes its API at the folder root (`state.ts`, `intents.ts`, `reducer.ts`, and — for `app/state/` — `effects.ts`); implementation helpers live under that module's `internal/` subfolder. `app/state` is a client of the `builder/state` and `player/state` modules: it may import their root files (value or type, as needed) but never their `internal/` files. **`builder/state` and `player/state` may not import each other at all (cross-module imports are fully forbidden; the ESLint `no-restricted-imports` rule for each forbids any import path resolving into the sibling `state/` tree, root files included). Shared concepts that both experiences need — e.g. `Cursor` — live in `domain/`; the prior "public root files only" relaxation is closed.** `builder/state` and `player/state` may not import `app/state` (no cycles). Tests may import from `internal/` freely — the `internal/` rule constrains only cross-module imports within `src/`. The boundary self-test `test/boundary/imports.test.ts` drives the ESLint `Linter` API over adversarial fixtures asserting forbidden imports fail to compile; the builder↔player and builder/player↔`internal/` edges each have positive and negative controls. Components:

**`builder/state/` — public root files:**

| Module | Owns |
|---|---|
| `builder/state/intents.ts` | `BuilderIntent` discriminated union |
| `builder/state/state.ts` | `BuilderState`, `BuilderMode`, `BuilderSubMode`, blank-state factory (`Cursor` is imported type-only from `domain/grid/Cursor.ts`; it is not owned here) |
| `builder/state/reducer.ts` | `reduceBuilder(state, intent, deps): { state, events }` — single reducer dispatching to per-mode helpers; `deps = { rng, now }` is used in the design-mode case (passes `rng` to `reconcileWords` for fresh `DisplacedClueId`s) and the `confirm-reset-builder` case (calls `PuzzleKey.generate(rng)` for the fresh key) |

**`builder/state/internal/` — implementation helpers (not importable from `app/state/`):**

| Module | Owns |
|---|---|
| `builder/state/internal/designMode.ts` | Design-mode intents (`request-switch-to-design`, `confirm-switch-to-design`, `toggle-design-cell`, `change-grid-size`) + reconciliation orchestration (FR-23, FR-45..FR-48); passes `deps.rng` to `reconcileWords` |
| `builder/state/internal/fillMode.ts` | Fill-mode intents (letter typing, markers, clue edits, metadata, cursor rules) |
| `builder/state/internal/joinSubMode.ts` | Join sub-mode intents (FR-34..FR-38) |
| `builder/state/internal/reattachSubMode.ts` | Reattach sub-mode intents (FR-41..FR-44) |
| `builder/state/internal/importExport.ts` | `request-import-puzzle`, `confirm-import-puzzle`, `export-incomplete`, `export-complete` intents |
| `builder/state/internal/lifecycle.ts` | `request-reset-builder`, `confirm-reset-builder` intents |
| `builder/state/internal/reconcileWords.ts` | Pure reconciliation algorithm (FR-45..FR-48); returns `{ words, displacedClues, events }` where `events` are shortening/lengthening toast requests |

**`player/state/` — public root files:**

| Module | Owns |
|---|---|
| `player/state/intents.ts` | `PlayerIntent` discriminated union |
| `player/state/state.ts` | `PlayerState`, `CheckResult`, `CheckClassification`, `AnagramModalState`, blank/error-state factories |
| `player/state/reducer.ts` | `reducePlayer(state, intent, deps): { state, events }` — `deps.rng` is used in the `anagram-scramble` case |

**`player/state/internal/` — implementation helpers (not importable from `app/state/`):**

| Module | Owns |
|---|---|
| `player/state/internal/solving.ts` | Solving intents (type, backspace, arrows, click, check, clear-errors) |
| `player/state/internal/lifecycle.ts` | `request-reset-player`, `confirm-reset-player`, `import-new-puzzle`, `import-puzzle`, `apply-loaded-progress` intents |
| `player/state/internal/anagram.ts` | Anagram modal intents (FR-81..FR-89) including auto-close on selection change |

**`app/state/` — public root files (`app/state/` has no `internal/` subfolder; all five files are the published API):**

| Module | Owns |
|---|---|
| `app/state/intents.ts` | `AppIntent` union: `navigate`, `cancel-modal`, `dismiss-toast`, `report-download-failure` (no `confirm-modal` — confirm dispatches the specific `confirm-*` Builder/Player intent directly) |
| `app/state/state.ts` | `AppState`, `ModalRequest` reference, blank-state factory |
| `app/state/reducer.ts` | `reduceApp(state, intent, deps): { state, events }` — the only reducer that sees all of `AppState`; invokes `reduceBuilder`/`reducePlayer` (forwarding `deps`), folds their returned `toast` and `modal-request` events via `applyEventsToApp` (using `deps.rng` and `deps.now` to construct the `Toast`/`createdAt`), and passes `download` / `clear-builder-storage` / `clear-player-storage` / `load-player-progress` events through to the bindings layer |
| `app/state/effects.ts` | `applyEventsToApp(state, events, deps): { state, leftoverEvents }` — pure helper called from `reduceApp`; consumes `toast` and `modal-request` events (the only state-affecting events in `DomainEvent`), updating `AppState.toasts` / `AppState.modal` / `AppState.pendingConfirmIntent`; returns the leftover external events for the bindings layer |
| `app/state/intentKinds.ts` | `BUILDER_INTENT_KINDS`, `PLAYER_INTENT_KINDS`, `CONFIRMABLE_INTENT_KINDS`, `AMBIGUOUS_INTENT_KINDS` — `ReadonlySet<string>` constants used by `reduceApp` to route intents to `reduceBuilder`/`reducePlayer`. The first three are derived from their respective unions (`BuilderIntent`, `PlayerIntent`, `ConfirmableIntent`) via a `satisfies Record<Kind, null>` record literal so the compiler enforces that every union member is present exactly once (closing D1 / DRN item 7: no hand-maintained string literal that can drift from the union). `AMBIGUOUS_INTENT_KINDS` is the runtime intersection of the Builder and Player sets. |

**Layer 2 — `ui/bindings/` (the seam; the only Svelte-aware logic module).**
Owns the runes store, `dispatch(intent)`, view-model derivation, debounced persistence scheduling, and port/RNG injection. This is the *only* module that imports from all three other layers (`domain/`, reducers, ports) plus Svelte. Components:

| Module | Owns |
|---|---|
| `appStore.svelte.ts` | `AppState` rune, `reduceApp`, route transitions, toasts array, current modal |
| `builderStore.svelte.ts` | `BuilderState` rune nested inside app state, `dispatch(BuilderIntent)`, debounced autosave, builder view-models (`BuilderGridVM`, `BuilderCluePanelVM`, `BuilderToolbarVM`, `DisplacedCluesPanelVM`) |
| `playerStore.svelte.ts` | `PlayerState` rune, `dispatch(PlayerIntent)`, debounced player-progress autosave, player view-models (`PlayerGridVM`, `PlayerCluePanelVM`, `ActiveClueBannerVM`, `AnagramModalVM`) |
| `toastStore.svelte.ts` | Toast list exposed as VM; toast dismissal intent dispatch |
| `modalStore.svelte.ts` | Current modal request exposed as VM; modal confirm/cancel intent dispatch |
| `ports.ts` | Singleton port instances wired at boot (`localStoragePort`, `downloadPort`, `filePickPort`, `rngPort`), injectable for tests |

**Layer 3 — `ui/` (presentational Svelte components).**
Receives view-models as `$props()`; emits intents via `dispatch` imported from bindings. No domain imports. Three sub-trees:

| Module | Owns |
|---|---|
| `ui/app/` | `App.svelte` (top-level switch on `route`), `Landing.svelte` (FR-1), `Header.svelte` |
| `ui/builder/` | `BuilderShell.svelte`, `BuilderToolbar.svelte` (Design/Fill toggle, markers, Export Incomplete, Export Complete, Reset, Import), `BuilderGrid.svelte`, `BuilderCluePanel.svelte`, `DisplacedCluesPanel.svelte` (always rendered, empty state per C1), `JoinReattachBanner.svelte`, `GridSizeControl.svelte` |
| `ui/player/` | `PlayerShell.svelte`, `PlayerGrid.svelte`, `ActiveClueBanner.svelte` (rendered twice: above and below grid — FR-71), `PlayerCluePanel.svelte`, `PlayerToolbar.svelte` (Check, Clear Errors, Reset, Import New, Anagram Helper), `ImportScreen.svelte`, `AnagramModal.svelte` |
| `ui/shared/` | `Modal.svelte`, `Toast.svelte`, `ToastHost.svelte`, `TypingSurface.svelte` (FR-93 — owns the hidden `<input>`), `FilePicker.svelte` |
| `ui/bindings/` | (covered above) |

**Layer 4 — `ports/` (side-effect implementations).**
Implements `domain/ports` interfaces. Each is a small adapter over a browser API; each is replaceable with an in-memory fake for tests.

| Module | Implements | Wraps |
|---|---|---|
| `ports/localStoragePort.ts` | `StoragePort` | `window.localStorage` |
| `ports/downloadPort.ts` | `DownloadPort` | `URL.createObjectURL` + `<a download>` click |
| `ports/filePickPort.ts` | `FilePickPort` | `<input type="file">` + drag-and-drop drop events |
| `ports/rngPort.ts` | `Rng` | `Math.random` (production); seeded Mulberry32 in tests |

**Layer 5 — `main.ts`.**
Boots the app: instantiates ports, loads initial `AppState` (Builder state from `localStorage` or a fresh blank puzzle per FR-19; player starts at the import screen), mounts `App.svelte` to `#app`. Wires the debounced persistence delays as config values (the "inject as config value" principle from F2).

### 2.2 Communication patterns

- **UI → logic:** typed `Intent` discriminated-union objects, delivered via `dispatch(intent)`. Intents are data, not callbacks. Components never call reducers directly.
- **logic → UI:** derived view-models — leaf-shaped, serializable, plain typed objects (no methods, no Svelte). Produced in `ui/bindings` from `AppState`. Reactive via Svelte 5 runes.
- **reducers → effects:** every reducer returns `{ state, events }`, where `events: DomainEvent[]` (§3.5a) is a discriminated union describing side effects the reducer wants performed. The full variants are: `toast`, `modal-request`, `load-player-progress`, `download`, `clear-builder-storage`, `clear-player-storage`. Events are pure data. Reducers themselves cause zero side effects (`(state, intent, deps) -> { state, events }` is a pure function of its inputs, given the injected `deps`).
- **`reduceApp` interprets state-affecting events:** the `app/state/reducer.ts` reducer is the only function that sees all of `AppState`. It receives `deps = { rng, now }` and forwards `deps` to the underlying `reduceBuilder`/`reducePlayer` invocations. When a Builder/Player reducer emits a `toast` event, `reduceApp` consumes it (constructs a `Toast` via `Toast.create(deps.rng, event.toastKind, event.message, deps.now)` and appends to `AppState.toasts`). When a Builder/Player reducer emits a `modal-request { modal, confirmIntent }` event, `reduceApp` consumes it (sets `AppState.modal = event.modal` and `AppState.pendingConfirmIntent = event.confirmIntent`). Events that need to cause *external* side effects (`download`, `clear-builder-storage`, `clear-player-storage`, `load-player-progress`) are *not* consumed by `reduceApp` — they pass through and the bindings layer performs them (see the next bullet). This split keeps reducers free of port knowledge while still confining all `AppState` mutation to reducer code.
- **bindings layer performs external side effects:** after `dispatch(intent)` returns `{ state, events }`, the bindings layer first folds `result.events` through `applyEventsToApp` (consuming `toast`/`modal-request` into `state.toasts`/`state.modal`; passing `download`/`clear-builder-storage`/`clear-player-storage`/`load-player-progress` through as `leftoverEvents`), sets the rune to the folded state (which causes reactive VM updates), then iterates the `leftoverEvents`. For each leftover event: `download` → calls `downloadPort.download(filename, content)`; if it returns an `Error`, the bindings layer dispatches `report-download-failure` (G7 — `reduceApp` turns it into an error toast so a failed irreversible user action no longer disappears silently; mirrors the `load-player-progress → apply-loaded-progress` follow-up pattern); `clear-builder-storage` → calls `storagePort.clearBuilder()`; `clear-player-storage { key }` → calls `storagePort.clearPlayerProgress(key)`; `load-player-progress { key }` → calls `storagePort.loadPlayerProgress(key)` and dispatches `apply-loaded-progress` (see §4.4). The fold step is what lets an AppIntent like `report-download-failure` return a `toast` event and have it reach `state.toasts` — without the fold, `performExternalEvent`'s `case 'toast': return null` would drop it. (For Builder/Player intents the fold is a no-op pass-through: `reduceApp` already folded their events internally and returns only the leftover external events, so re-folding leftover events returns them unchanged.) Toast auto-dismiss timeouts likewise dispatch `dismiss-toast` intents, never direct mutations.
- **toasts stored in `AppState.toasts: Toast[]`:** added by `reduceApp` based on reducer-emitted `toast` events; removed by `dismiss-toast` intents (raised from the bindings-layer timeout in `ToastHost.svelte` or by user click). No imperative `showToast()` call from anywhere.
- **confirmation modals:** stored in `AppState.modal: ModalRequest | null`, with `AppState.pendingConfirmIntent: ConfirmableIntent | null` describing what to dispatch on confirm. Set by `reduceApp` based on `modal-request` events. The bindings layer's `Modal.svelte` Confirm button dispatches `pendingConfirmIntent` directly (a `confirm-*` intent variant — see §4); the Cancel button dispatches the AppIntent `cancel-modal`, which clears both fields. While `state.modal != null`, components should disable other guarded controls to avoid stacking modals.

### 2.3 Boundary definitions

| Boundary | What crosses | How |
|---|---|---|
| Component ↔ bindings | View-models (in), Intents (out) | `$props()` in, `dispatch()` out |
| Bindings ↔ reducers | `State` + `Intent` (in), `ReducerResult<State>` = `{ state, events }` (out) | Plain function calls; pure |
| Reducers ↔ domain | Domain value objects and pure-function calls | Direct TS imports |
| Reducers ↔ ports | Ports are **not** called from reducers. External side effects (download / storage clear / player-progress load) flow as `DomainEvent`s returned by reducers and are performed by the bindings layer. Autosave flows through the bindings layer's state observation + debounce, not from reducers. | Indirect — via returned events plus bindings-layer state observation |
| Domain ↔ format/parse | `Puzzle` domain objects (out), JSON-shaped plain objects (in) | Adapter functions in `domain/format/` |
| App ↔ outside world | Puzzle JSON files (file system); state blobs (`localStorage`) | `FilePickPort`, `DownloadPort`, `StoragePort` only |

The ESLint `no-restricted-imports` rule mentioned in §1.2 enforces that `domain/`, `builder/state/`, `player/state/`, and `app/state/` cannot import `svelte`, `svelte/*`, anything under `ui/`, anything under `ports/`, or any DOM-global-using module. A unit test (`test/boundary/imports.test.ts`) verifies the boundary by running the ESLint `Linter` API over adversarial fixture strings with `filename` set so the per-glob `no-restricted-imports` rules apply, and asserts each forbidden import triggers a `no-restricted-imports` error (with negative controls: allowed imports produce no error). This self-verifies that the rule is wired and catches static and dynamic `import()` violations.

---

## 3. Domain Model

All types in this section live in `domain/`. None imports Svelte, DOM, or `ports/`. All are immutable value objects (record-style; structural equality for keys). Branded primitive types use a `brand<Tag, Primitive>` utility; range-checked constructors (`Row.try(n)`, `GridSize.try(n)`, `Letter.try(ch)`) throw on invalid input or return `Option<…>` — the builder may pick the convention, but *unbranded primitives never appear in signatures*.

### 3.1 Branded primitives and small types

```ts
// domain/letter/Letter.ts
export type Letter = string & { __brand: 'Letter' };       // exactly one A–Z
export const Letter: {
  try(ch: string): Letter | null;                          // case-folds, validates A–Z
  from(s: string): Letter[];                               // filters, uppercases
  equals(a: Letter, b: Letter): boolean;
};

// domain/grid/Row.ts, Col.ts
export type Row = number & { __brand: 'Row' };             // 0-based, ≥ 0
export type Col = number & { __brand: 'Col' };             // 0-based, ≥ 0
export const Row: { try(n: number): Row | null; of(n: number): Row; /* bounds helper */ };
export const Col: { try(n: number): Col | null; of(n: number): Col; /* bounds helper */ };

// domain/grid/GridSize.ts
export type GridSize = number & { __brand: 'GridSize' };   // 2 ≤ n ≤ 25
export const GridSize: {
  try(n: number): GridSize | null;
  of(n: number): GridSize;
  MIN: 2; MAX: 25; DEFAULT: 15;
};

// domain/word/Direction.ts  (string-literal union per B5)
export type Direction = 'across' | 'down';
export const Direction: {
  opposite(d: Direction): Direction;
  isAcross(d: Direction): boolean;
  advance(coord: { row: Row; col: Col }, d: Direction, n: number): { row: Row; col: Col };
};

// domain/puzzle/PuzzleKey.ts
export type PuzzleKey = string & { __brand: 'PuzzleKey' }; // UUID v4 string
export const PuzzleKey: {
  generate(rng: Rng): PuzzleKey;                           // takes injected Rng (kept pure)
  try(s: string): PuzzleKey | null;
};

// domain/word/WordNumber.ts
export type WordNumber = number & { __brand: 'WordNumber' }; // ≥ 1

// domain/uuid/uuidv4.ts
export function uuidv4(rng: Rng): string;   // pure: 16 bytes via rng.nextInt(256), sets RFC 4122 version (0x40) + variant (0x80), formats 8-4-4-4-12 dashed lowercase; shared by PuzzleKey.generate + DisplacedClueId.generate

// domain/builder/DisplacedClueId.ts
export type DisplacedClueId = string & { __brand: 'DisplacedClueId' };   // UUID v4 string (§6.1, §6.3 step 11)
export const DisplacedClueId: {
  generate(rng: Rng): DisplacedClueId;   // delegates to uuidv4(rng); called from reconcileWords/designMode with deps.rng
  try(s: string): DisplacedClueId | null;   // validates UUID v4 lowercase regex; used by parsePuzzleV1 validateDisplacedClues (§6.3 step 11)
  equals(a: DisplacedClueId, b: DisplacedClueId): boolean;   // brand-safe value equality; used by builder reattach/delete-displaced-clue reducers
};

// domain/notifications/ToastId.ts
export type ToastId = string & { __brand: 'ToastId' };
export const ToastId: { generate(rng: Rng): ToastId };       // takes injected Rng; called by reduceApp when constructing a Toast
```

### 3.2 Grid (`domain/grid/`)

```ts
// Cell marker flags (FR-27, FR-29)
export type CellMarkerFlag =
  | 'space-right' | 'space-bottom'
  | 'hyphen-right' | 'hyphen-bottom';

export type CellMarker = {
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
};
export const CellMarker: {
  EMPTY: CellMarker;                                       // all false
  toggle(marker: CellMarker, flag: CellMarkerFlag): CellMarker;
  // FR-27 mutual exclusion: toggling space-right on turns hyphen-right off (and vice versa for bottom)
};

// Runtime cell — FR-50. Note both letter fields; neither named "letter" (B4).
export type Cell = {
  black: boolean;                                           // FR-4
  answerLetter: Letter | null;                              // Builder edits; serialized as puzzleLetter (FR-95)
  playerLetter: Letter | null;                              // Player edits; runtime only; never serialized; null on import (FR-99)
  marker: CellMarker;
};
export const Cell: {
  white(): Cell;                                            // { black:false, both letters null, EMPTY marker }
  black(): Cell;                                            // { black:true, both letters null, EMPTY marker }
  isWhite(c: Cell): boolean;
  setAnswerLetter(c: Cell, l: Letter | null): Cell;
  setPlayerLetter(c: Cell, l: Letter | null): Cell;
  setMarker(c: Cell, marker: CellMarker): Cell;
};

// Rendered separator per cell, derived from marker flags. Lives in `domain/grid/`
// (not `ui/bindings/`) because `domain/anagram/Anagram.ts` returns it (§8.8); the
// grid-VM in §5.2 re-imports it type-only. Hoisted out of `ui/bindings/` to keep
// the domain→UI dependency direction one-way. See `design_review_notes.md` item 3.
export type CellSeparator = 'none' | 'space' | 'hyphen';     // rendered right/below the cell per marker flags

// Cursor — the selected grid cell + travel direction. Shared by Builder, Player, and the
// grid view-model (§5.2). Lives in `domain/grid/`: its `Row`/`Col`/`Direction`
// dependencies already live here/next door, and placing it here lets Layer-1 modules
// (`builder/state`, `player/state`) and the bindings VMs import it without reaching type-only
// into a sibling state module (which §9.2's `internal/` rules exist to prevent). `| null`
// means "no selection" (FR-7; C6: not persisted across reload).
export type Cursor = {
  row: Row;
  col: Col;
  direction: Direction;
} | null;

// Grid is a 2D array (B3) but indexed only through GridOps
export type Grid = Cell[][];                                // outer = Row, inner = Col
export const GridOps: {
  blank(size: GridSize): Grid;                              // FR-19 all-white empty grid
  cellAt(g: Grid, row: Row, col: Col): Cell;
  setCell(g: Grid, row: Row, col: Col, c: Cell): Grid;      // returns new grid (immutability)
  updateCells(g: Grid, updates: ReadonlyArray<{ row: Row; col: Col; cell: Cell }>): Grid; // batch immutability; empty updates returns g; all-or-nothing bounds check (D6)
  withinBounds(g: Grid, row: Row, col: Col): boolean;
  neighbours(g: Grid, row: Row, col: Col): { row: Row; col: Col }[]; // orthogonal in-bounds
  neighboursInDirection(g: Grid, row: Row, col: Col, d: Direction): { row: Row; col: Col } | null;
  isSelectable(g: Grid, row: Row, col: Col): boolean;       // FR-8: white and part of a length-≥2 run
  clone(g: Grid): Grid;                                     // deep clone, used by reducers
  equals(a: Grid, b: Grid): boolean;
};
```

**Invariants — `Cell`:**
- `black === true` ⇒ `answerLetter === null && playerLetter === null && marker === CellMarker.EMPTY` (FR-4, FR-29). Enforced by `Cell.black()`.
- `Letter` is always a single A–Z char; `Cell.setAnswerLetter`/`setPlayerLetter` reject lowercase via `Letter.try`.
- `marker.spaceRight && marker.hyphenRight` is never `true` simultaneously (FR-27); the toggle helper enforces this. Same for the `-bottom` pair.

**Invariants — `Grid`:**
- `grid.length === gridSize` and every row `row.length === gridSize`.
- All `row`/`col` args are within `GridSize` bounds; `GridOps.cellAt` throws on out-of-bounds (defensive; UI never produces OOB coords).
- `GridOps.updateCells` validates all updates up front and throws `RangeError` on the first out-of-bounds entry before mutating (all-or-nothing); empty `updates` returns `g` ref-equal.

### 3.3 Words (`domain/word/`)

```ts
export type WordKey = {
  startRow: Row;
  startCol: Col;
  direction: Direction;
};
export const WordKey: {
  equals(a: WordKey, b: WordKey): boolean;
  toCanonical(k: WordKey): string;                          // e.g. "0,3,across" — for WordMap
};

export type Word = {
  key: WordKey;
  number: WordNumber;                                       // FR-6, re-derived on load (FR-98a)
  length: number;                                            // ≥ 2 (FR-5)
  clue: string;                                             // empty allowed; non-head chain words carry empty (FR-31, C5)
  nextWord: WordKey | null;                                 // FR-33
};
// `Word` has no attached behaviour beyond its data; pure helper functions in this module
// operate on `Word[]` / `WordMap` rather than `Word` methods.

export type WordMap = ReadonlyMap<string, Word>;            // keyed by WordKey.toCanonical
export const WordMap: {
  fromWords(ws: Word[]): WordMap;
  get(m: WordMap, k: WordKey): Word | undefined;
  has(m: WordMap, k: WordKey): boolean;
  set(m: WordMap, w: Word): WordMap;                        // returns new map (immutability)
  remove(m: WordMap, k: WordKey): WordMap;
};

// Pure linear-scan helper over `Word[]` + a `Cursor`. Lives in `domain/word/`
// (single source of truth; previously duplicated across player reducers + builder/player
// viewmodels). `Cursor` is imported from `domain/grid/Cursor.ts` — no Layer-1
// reach. The parameter accepts the nullable `Cursor` (`| null`) and early-returns `null`
// when the cursor is null; call-sites already null-check before invoking, so the early
// return is defensive. Returns `Word | null` to match the project's nullable idiom
// (not `undefined`).
export const WordSelection: {
  findContainingWord(words: Word[], cursor: Cursor): Word | null;
};

// `DerivedWord` is the shape of a `Word` before `Numbering.assign` mints its `number`:
// the output of `WordDerivation.derive` and the input of `Numbering.assign`. It carries
// `clue` and `nextWord` so that §8.5 `reconcileWords` (which runs BEFORE `Numbering.assign`)
// can retain/transplant those fields from the old `Word[]` onto the newly-derived words
// without ever producing an un-numbered `Word`. Lives only transiently between `derive`
// and `assign`; the type that lives on `Puzzle.words` is always the numbered `Word`.
export type DerivedWord = {
  key: WordKey;
  length: number;
  clue: string;
  nextWord: WordKey | null;
};

// Pure functions
export const WordDerivation: {
  derive(grid: Grid): DerivedWord[];                        // FR-5: scan rows & cols for length-≥2 white runs
};

export const Numbering: {
  assign(grid: Grid, words: DerivedWord[]): Word[];         // FR-6: L-R, T-B; a cell gets the next int if it starts an across and/or down word
};
```

**Invariants — `Word`:**
- `length >= 2`.
- `startRow`/`startCol` point to a white cell; the `length` cells in `direction` from there are all white and form a maximal run (no white cell continues the run beyond either end).
- `nextWord`, if present, points to a `WordKey` that exists in the same `WordMap` (validated at parse time, reconciled at every grid change in Design mode — FR-47).
- No self-reference. No cycles. No branching (no `WordKey` pointed to by more than one `nextWord`). Enforced by `ChainValidation`.

### 3.4 Chains (`domain/chain/`)

```ts
export type Chain = { head: WordKey; members: Word[] };      // linear list from head → tail via nextWord
export const Chain: {
  fromHead(words: WordMap, head: WordKey): Chain;          // returns chain; throws if cycle/branch detected
  isHead(words: WordMap, k: WordKey): boolean;              // no other word's nextWord points to k
  isNonHead(words: WordMap, k: WordKey): boolean;
  membersOf(words: WordMap, k: WordKey): Word[];            // suffix from k onward (used by LengthPattern)
};

export const ChainValidation: {
  validate(words: Word[]): ChainViolation[];               // FR-98: cycles, branches, dangling, self-reference
};
export type ChainViolation =
  | { kind: 'cycle'; involved: WordKey[] }
  | { kind: 'branch'; target: WordKey; sources: WordKey[] }
  | { kind: 'dangling'; source: WordKey; missingTarget: WordKey }
  | { kind: 'self-reference'; word: WordKey };

// Pure display derivations
export const DisplayClue: {
  forWord(words: WordMap, w: Word): string;                // FR-90: own clue if head; "See N Direction" otherwise
};

export type LengthPattern = string;                         // e.g., "4,4,5", "4-4", "2, 2-3", "8"
export const LengthPattern: {
  // FR-91 full suffix rule — implemented and unit-tested as the literal spec describes,
  // even though the banner uses a restricted variant for non-head words (see §7 / C4).
  forWord(grid: Grid, words: WordMap, w: Word): LengthPattern;

  // C4 helper used only by the active-clue banner VM:
  forActiveClueBanner(grid: Grid, words: WordMap, w: Word): LengthPattern | null;
};

// Pure cell-coord helpers shared by builderVM + playerVM (B2 dedup). Lives in domain/chain/
// because cellsOfChain composes Chain.headOf + Chain.fromHead over a WordMap; domain/word/
// cannot import domain/chain/ (acyclic — Chain.ts already imports domain/word/*).
export const ChainCells: {
  cellsOfWord(w: Word): Set<string>;                        // "${row},${col}" per cell along w's run
  cellsOfChain(words: Word[], cursorWord: Word | null): Set<string>; // union of all chain members'
                                                             // cells; empty set when cursorWord === null
};
```

**Behaviour — `LengthPattern.forWord` (FR-91, full):**
- If `w.nextWord != null`: return `chain.membersOf(words, w.key).map(m => String(m.length)).join(',')` (suffix of chain from `w` onward, comma-joined, no space).
- Else: split `w`'s cells into runs using the cell markers in `direction`. Between cells `i` and `i+1` of the word: a `spaceRight`/`spaceBottom` marker (whichever matches `direction`) inserts a `", "` separator; a `hyphenRight`/`hyphenBottom` inserts `"-"`. Otherwise the run extends. Each contiguous run contributes its length. Single run with no markers → just `String(w.length)`.

**Behaviour — `LengthPattern.forActiveClueBanner` (C4 deviation):**
- If `Chain.isHead(words, w.key)`: return `forWord(grid, words, w)`.
- Else (non-head): return `null` (banner shows no pattern). The clue list already returns null for non-heads per FR-73. This makes banner and list consistent.

### 3.5 Displaced clues (`domain/builder/DisplacedClue.ts`)

```ts
export type DisplacedClue = {
  id: DisplacedClueId;                                       // stable; survives move within panel (FR-44)
  clue: string;                                              // free-form; possibly empty originally but usually non-empty
  direction: Direction;                                      // original word's direction; positional info intentionally absent (FR-39)
};
export const DisplacedClue: {
  create(rng: Rng, clue: string, direction: Direction): DisplacedClue;  // mints a fresh DisplacedClueId via DisplacedClueId.generate(rng); see §8.5 reconciliation
  withText(d: DisplacedClue, clue: string): DisplacedClue;
};
```

**Invariants — `DisplacedClue`:**
- No positional information. The `id` is the only stable handle (FR-39, FR-97).
- Order in the panel follows insertion order; deleting one adjusts reattach indices (FR-44). The reducer carries an array `DisplacedClue[]`.

### 3.5a Notifications & events (`domain/notifications/`)

Pure value objects whose *consumers* are UI but whose shapes belong to the domain. Naming and location deliberately avoid the oxymoronic `domain/ui/` — these types describe what the system is *saying*, not how it renders.

```ts
// domain/notifications/Toast.ts, ToastId.ts
export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export type ToastId = string & { __brand: 'ToastId' };
export const ToastId: { generate(rng: Rng): ToastId };
export type Toast = {
  id: ToastId;
  kind: ToastKind;
  message: string;
  createdAt: number;                                          // epoch ms
  ttlMs: number;                                              // C2 default 3500
};
export const Toast: {
  create(rng: Rng, kind: ToastKind, message: string, now: () => number, ttlMs?: number): Toast;
};
// `rng` generates `id`; `now` provides `createdAt`. Called by reduceApp (not by Builder/Player reducers)
// when folding a `toast` event into AppState.toasts. Builder/Player reducers themselves only emit
// `{ kind: 'toast'; toastKind; message }` events — they have `deps` available but don't use it for
// toasts, because toasts live at AppState level and the reducer can't store the constructed Toast.

// domain/notifications/ModalRequest.ts
export type ModalKind =
  | 'confirm-design-switch'                                   // FR-53
  | 'confirm-import-puzzle'                                   // FR-54 (aligned with the matching ConfirmableIntent kind)
  | 'confirm-reset-builder'                                   // FR-55
  | 'confirm-reset-player';                                    // FR-77
export type ModalRequest = { kind: ModalKind };

// domain/notifications/Event.ts
// The discriminated union returned by every reducer. Pure data describing effects.
// NOTE: `toast` and `modal-request` are *state-affecting* events handled by `reduceApp`
// itself (using `deps.rng` / `deps.now` for Toast id+createdAt). `load-player-progress`
// is handled by the bindings layer (it needs the StoragePort). `download`,
// `clear-builder-storage`, and `clear-player-storage` are external side-effect events
// performed by the bindings layer.
//
// Reducers no longer emit regenerate-key or scramble events now that every reducer
// takes `deps` and can call `PuzzleKey.generate(rng)` / `Anagram.scramble(rng)` /
// `DisplacedClueId.generate(rng)` directly.
export type DomainEvent =
  // State-affecting events (consumed by reduceApp):
  | { kind: 'toast'; toastKind: ToastKind; message: string }
  | { kind: 'modal-request'; modal: ModalRequest; confirmIntent: ConfirmableIntent }
  // Bindings-layer-performed events:
  | { kind: 'load-player-progress'; key: PuzzleKey }           // bindings layer loads via storagePort and dispatches apply-loaded-progress
  | { kind: 'download'; filename: string; content: string }
  | { kind: 'clear-builder-storage' }
  | { kind: 'clear-player-storage'; key: PuzzleKey };

// ConfirmableIntent: the closed union of `confirm-*` intent variants the bindings layer's
// Modal.svelte Confirm button dispatches directly. Defined here (in domain notifications)
// because the modal-request event carries it. Re-exported for convenience.
export type ConfirmableIntent =
  | { kind: 'confirm-switch-to-design' }
  | { kind: 'confirm-import-puzzle'; fileContent: string }
  | { kind: 'confirm-reset-builder' }
  | { kind: 'confirm-reset-player' };

// Reducer-return helper
export type ReducerResult<S> = { state: S; events: DomainEvent[] };
export const Result: {
  ok<S>(state: S): ReducerResult<S>;                          // { state, events: [] }
  withEvents<S>(state: S, events: DomainEvent[]): ReducerResult<S>;
};
```

**Invariants — `DomainEvent`:**
- All variants are pure data — no functions, no DOM references, no Svelte.
- A `modal-request` event must always carry a `confirmIntent` so the bindings layer knows what to dispatch when the user clicks Confirm.
- `download.content` is already a serialized string (JSON); the bindings layer does not re-serialize.
- Autosave is independent of `download` events: the bindings layer observes `state.builder` and serializes a snapshot blob to the StoragePort; `download` events are one-off user-triggered file exports.

### 3.6 Puzzle aggregate (`domain/puzzle/`)

```ts
export type Title = string & { __brand: 'Title' };          // free-form, possibly empty
export type Author = string & { __brand: 'Author' };         // free-form, possibly empty
export const Title: { try(s: string): Title };
export const Author: { try(s: string): Author };

export type Puzzle = {
  key: PuzzleKey;
  gridSize: GridSize;
  grid: Grid;
  words: Word[];                                             // numbered + derived at load (FR-98a)
  title: Title;
  author: Author;
};
// Displaced clues are a Builder-only concept (FR-59). They live on `BuilderState`
// (§4.3), not on `Puzzle`. The serialization adapter takes them as a separate arg.
export const Puzzle: {
  blank(size: GridSize, key: PuzzleKey): Puzzle;             // FR-19
  isBlank(p: Puzzle): boolean;                               // FR-22 / FR-53 work-detector at the puzzle layer:
                                                              //   no answer letters, no non-empty clues, no chains (no word has nextWord)
  withGrid(p: Puzzle, g: Grid): Puzzle;                      // returns new Puzzle; re-syncs gridSize from g.length (invariant §3.6)
  withWords(p: Puzzle, ws: Word[]): Puzzle;
  withMetadata(p: Puzzle, title: Title, author: Author): Puzzle;
};

// Completeness — FR-61, FR-62
export type CompletenessViolation =
  | { kind: 'missing-answer-letter'; row: Row; col: Col }
  | { kind: 'missing-clue'; wordNumber: WordNumber; direction: Direction };
// Note: `invalid-answer-letter` removed per §0 Principle 3 — `Cell.answerLetter: Letter | null`
// where `Letter` is a range-checked branded type, so an invalid letter is unrepresentable.

export const CompletenessCheck: {
  check(p: Puzzle): CompletenessViolation[];
  isComplete(p: Puzzle): boolean;                           // === check(p).length === 0
};
```

**Invariants — `Puzzle`:**
- `grid.length === gridSize`; every row has length `gridSize`.
- Every `Word` in `words` corresponds to a maximal white run actually present in `grid` (re-derived on every change, validated on load per FR-98a).
- Displaced clues never block completeness (FR-63); `CompletenessCheck.check` does not consult `BuilderState.displacedClues`.

### 3.7 Persistence & format (`domain/ports/`, `domain/format/`, `domain/rng/`)

```ts
// Port interfaces only — implementations live in ports/
export interface StoragePort {
  loadBuilder(): string | null;                       // raw JSON string of BuilderState blob; null if missing or unreadable
  saveBuilder(blob: string): void;
  clearBuilder(): void;
  loadPlayerProgress(key: PuzzleKey): string | null;
  savePlayerProgress(key: PuzzleKey, blob: string): void;
  clearPlayerProgress(key: PuzzleKey): void;
}
export interface DownloadPort {
  download(filename: string, content: string): Error | null;  // null = success; Error = failure (G7 — bindings layer surfaces as toast)
}
export interface FilePickPort {
  pickFile(): Promise<string | null>;                 // returns file text or null if cancelled
}

// domain/rng/Rng.ts — NOT a port. Rng is a deps-injection abstraction (a determinism
// knob), not a side-effect hole against the outside world. Unlike the three interfaces
// above, reducers ARE allowed to call Rng directly (e.g., PuzzleKey.generate(rng),
// Anagram.scramble(rng, …), Toast.create(rng, …)). Hoisting Rng out of `domain/ports/`
// keeps the "port" definition honest and breaks the type-only cycle that would otherwise
// form between `domain/ports/ports.ts` (importing PuzzleKey) and `domain/puzzle/PuzzleKey.ts`
// (importing Rng). See `llmworkspace/design_review_notes.md` item 1.
export interface Rng {
  nextInt(n: number): number;                          // 0 ≤ result < n
}
```

```ts
// domain/format/v1.ts  — parse + validate per FR-94..FR-99 (C5 strict)
export type PuzzleFileType = 'incomplete' | 'complete';

export type ParseFailure = {
  message: string;                                    // single human-readable error string (FR-99)
};

// Returns either a valid Puzzle + (if incomplete) its displaced clues, or a list of failures.
// `fileType` lets the Player reducer reject incomplete files (FR-67) without inspecting displacedClues.
export const parsePuzzleV1(json: string):
  | { ok: true; puzzle: Puzzle; fileType: PuzzleFileType; displacedClues: DisplacedClue[] }   // displacedClues: [] for complete
  | { ok: false; failures: ParseFailure[] };

// Serialize — to be used by Builder export only, in the bindings layer.
// Displaced clues are passed separately because they live on BuilderState, not on Puzzle.
export const serializeIncomplete(p: Puzzle, displacedClues: DisplacedClue[]): string;
export const serializeComplete(p: Puzzle): string;    // never includes displacedClues (FR-59)

// Filename helper — FR-60
export const Filename: {
  incomplete(key: PuzzleKey): string;                 // puzzle-<first8>-incomplete.json
  complete(key: PuzzleKey): string;
};
```

**Parse/validation rules (FR-98 + C5):**
- Top-level `version === 1` and `type ∈ {'incomplete', 'complete'}` (FR-94).
- `gridSize` integer, 2 ≤ n ≤ 25.
- `grid` is a 2D array of `gridSize` × `gridSize`; each cell is `{ black, puzzleLetter, spaceRight, spaceBottom, hyphenRight, hyphenBottom }`. Missing marker booleans default to `false` (FR-99). `puzzleLetter` is `null` or single A–Z.
- `puzzleLetter` is the only accepted answer-letter field name (FR-95). A field named `letter` is *not* a fallback; the parser rejects files that use `letter` as an unknown extra field (strict).
- Word positions within bounds; `length ≥ 2`; `nextWord` (if present) points to an existing word; no cycles, branches, dangling refs, self-refs (FR-98 + `ChainValidation`).
- **Complete format:** every white cell has a non-null A–Z `puzzleLetter` (FR-61). Every chain-head word has a non-empty non-whitespace clue (FR-62). **Strict C5 rule:** a non-head chain word with a non-empty `clue` field is a validation failure (not silently normalized).
- **Incomplete format:** `puzzleLetter` may be `null`; clues may be empty; `displacedClues` field is a `DisplacedClue[]` (FR-97). Extra fields not in the schema cause validation failure (strict).
- On success, `word.number` is overwritten by the re-derived value (FR-98a), and `word.length` is cross-checked against the grid-derived value (a mismatch is a validation failure).
- `playerLetter` is never present in JSON; `null` is implied at runtime (FR-99).

**Sample puzzle files — `puzzles/*.json`:** canonical v1 format (`version: 1`, `type: 'complete'`, `puzzleLetter` field, UUID-v4 `key`). They are *not* fixtures; the app and the test suite never read them. The directory exists purely as a record of the format. No migration script is shipped — the files are already canonical.

---

## 4. State Model & Reducers

All reducer modules — `domain/`, `builder/state/`, `player/state/`, and `app/state/` — are pure. Each reducer has the signature `(state, intent, deps) -> { state, events }` where `events: DomainEvent[]` (§3.5a) and `deps = { rng: Rng; now: () => number }` is injected by the bindings layer at dispatch time. Reducers never call ports, never call Svelte, never touch the DOM; if a reducer case needs randomness or clock values, it uses `deps`. (Most reducer cases ignore `deps`.) State objects are immutable; transitions return new state values (A2 immutability discipline).

### 4.1 App-level state (`app/state/`)

```ts
// app/state/state.ts
export type AppState = {
  route: 'landing' | 'build' | 'play';                       // A3
  builder: BuilderState;
  player: PlayerState;
  toasts: Toast[];                                            // G4: toasts as state (appended by reduceApp from toast events)
  modal: ModalRequest | null;                                 // G4: confirmations as state (set by reduceApp from modal-request events)
  pendingConfirmIntent: ConfirmableIntent | null;            // the `confirm-*` intent the modal will dispatch on Confirm (narrow type; not the full Builder/Player unions)
};

// Note: there is no `confirm-modal` AppIntent. The bindings layer's Modal.svelte Confirm
// button dispatches `state.pendingConfirmIntent` directly (a `confirm-*` Builder/Player
// intent variant). Cancel dispatches the `cancel-modal` AppIntent below.
export type AppIntent =
  | { kind: 'navigate'; route: 'landing' | 'build' | 'play' }
  | { kind: 'cancel-modal' }                                  // user clicked Cancel / pressed Escape on the modal
  | { kind: 'dismiss-toast'; id: ToastId };                   // user clicked toast or toast timeout fired
  | { kind: 'report-download-failure' };                      // bindings layer raised after DownloadPort.download returned an Error (G7)

// The unified dispatcher: takes any of the three intent unions, plus deps (rng + clock).
export function reduceApp(state: AppState, intent: AppIntent | BuilderIntent | PlayerIntent, deps: { rng: Rng; now: () => number }): ReducerResult<AppState>;
```

**`reduceApp` responsibilities:**

The dispatcher narrows `intent` first by `kind` string against three `ReadonlySet<string>` constants in `app/state/intentKinds.ts`: `BUILDER_INTENT_KINDS`, `PLAYER_INTENT_KINDS`, `CONFIRMABLE_INTENT_KINDS` (the variant after a `confirm-*` has executed — clears `modal`/`pendingConfirmIntent`), and `AMBIGUOUS_INTENT_KINDS` (the runtime intersection of Builder and Player kinds). The first three sets are derived from their unions via a `satisfies Record<Kind, null>` record so the compiler enforces coverage (closing D1 / DRN item 7); `AMBIGUOUS_INTENT_KINDS` is computed as the set intersection. For ambiguous kinds, the dispatcher routes by `state.route`: `'build' → reduceBuilder`, `'play' → reducePlayer`, and `'landing' → throws` (closing D2 / DRN item 9: no Builder/Player UI is mounted on the landing route, so an ambiguous kind dispatched during landing is a bug — the reducer surfaces it rather than silently mutating `state.builder`).

1. If `intent` is a `BuilderIntent`: invoke `reduceBuilder(state.builder, intent, deps)` — the Builder reducer does its own rng-dependent work directly (e.g., `confirm-reset-builder` generates the new `PuzzleKey` via `PuzzleKey.generate(deps.rng)`; the design-mode case passes `deps.rng` to `reconcileWords` for fresh `DisplacedClueId`s). It returns `{ state: nextBuilder, events }`. Fold `nextBuilder` into `state.builder`. Then for each event:
   - `toast { toastKind, message }` → construct a `Toast` via `Toast.create(deps.rng, event.toastKind, event.message, deps.now)` and append to `state.toasts`.
   - `modal-request { modal, confirmIntent }` → set `state.modal = event.modal` and `state.pendingConfirmIntent = event.confirmIntent`.
   - `download` / `clear-builder-storage` / `clear-player-storage` / `load-player-progress` → not consumed here; carry forward in the returned `events` array for the bindings layer to perform.
   Return `{ state, events: passthroughEvents }`.
2. Same for `PlayerIntent` (invokes `reducePlayer(state.player, intent, deps)` — the anagram-scramble case calls `Anagram.scramble(deps.rng)` directly). Player's events are `toast`, `modal-request`, `clear-player-storage`, `load-player-progress` only (no `download`).
3. If `intent` is `cancel-modal`: return `{ state: { ...state, modal: null, pendingConfirmIntent: null }, events: [] }`.
4. If `intent` is `dismiss-toast { id }`: return `{ state: { ...state, toasts: state.toasts.filter(t => t.id !== id) }, events: [] }`.
5. If `intent` is `navigate { route }`: return `{ state: { ...state, route }, events: [] }`.
6. If `intent` is `report-download-failure` (G7): return `{ state, events: [{ kind: 'toast', toastKind: 'error', message: 'Download failed. Please try again.' }] }`. State unchanged; the toast event is folded back into `state.toasts` by `applyEventsToApp` on the next work-queue iteration.

When a `confirm-*` Builder/Player intent is dispatched (originating from the Modal's confirm button), it flows through step 1/2 normally and executes the action — those intent variants are unconditional (no guard) by construction.

### 4.2 Toasts

The `Toast` and `ToastId` value objects live in `domain/notifications/` (§3.5a). Builder/Player reducers do not construct `Toast` values directly, even though they have `deps` — they emit `{ kind: 'toast'; toastKind; message }` events in their return value. The reason is structural: toasts live at `AppState.toasts`, not on `BuilderState`/`PlayerState`, so a Builder/Player reducer has nowhere to put a fully-constructed `Toast` even if it could build one. `reduceApp` consumes the event and constructs the `Toast` via `Toast.create(deps.rng, event.toastKind, event.message, deps.now)`, then appends to `AppState.toasts`.

The three reducers' signatures:

```ts
export function reduceApp(
  state: AppState,
  intent: AppIntent | BuilderIntent | PlayerIntent,
  deps: { rng: Rng; now: () => number }
): ReducerResult<AppState>;

export function reduceBuilder(
  state: BuilderState,
  intent: BuilderIntent,
  deps: { rng: Rng; now: () => number }
): ReducerResult<BuilderState>;
// `rng` used by: `confirm-reset-builder` (PuzzleKey.generate), design-mode toggle
// (passes rng to reconcileWords for DisplacedClueId.generate). `now` unused today.

export function reducePlayer(
  state: PlayerState,
  intent: PlayerIntent,
  deps: { rng: Rng; now: () => number }
): ReducerResult<PlayerState>;
// `rng` used by: `anagram-scramble` (Anagram.scramble). `now` unused today.
```

Most reducer cases ignore `deps`. Production wires `deps = { rng: MathRandomRng, now: Date.now }` at boot. Tests inject `SeededRng` and `FakeClock`. This is consistent with the Anagram scramble's already-injected RNG (D1) and the F2 "inject as a config value" principle. The three signatures are uniform, so the bindings-layer `dispatch` is also uniform.

### 4.3 Builder state and intents

```ts
// builder/state/state.ts
import type { Cursor } from '../../domain/grid/Cursor';     // Cursor owned by `domain/grid/` (§3.2)
                                                              //   — was defined inline here, imported type-only by
                                                              //   Player state + grid/VMs (sibling Layer-1 reach).
// (Cursor type definition lives in §3.2; shape: { row: Row; col: Col; direction: Direction } | null,
//  FR-7: null = no selection; C6: not persisted across reload.)

export type BuilderMode = 'design' | 'fill';                  // FR-16
export type BuilderSubMode =
  | { kind: 'none' }
  | { kind: 'join'; source: WordKey }                          // FR-34
  | { kind: 'reattach'; displacedClueId: DisplacedClueId };   // FR-41

export type BuilderState = {
  puzzle: Puzzle;                                             // grid, words, title, author, key (NOT displacedClues — see S1)
  displacedClues: DisplacedClue[];                            // FR-39, S1 — lives here, not on Puzzle
  mode: BuilderMode;
  subMode: BuilderSubMode;
  cursor: Cursor;
};
// No `dirty` / `lastSavedAt` / `pendingDownload` / `pendingIntent` fields —
// persistence is bindings-layer concern (observation + debounce); side effects
// flow as events. State stays a pure data snapshot of "current Builder world".

export const BuilderState: {
  blank(size: GridSize, key: PuzzleKey): BuilderState;        // FR-19
  isBlank(s: BuilderState): boolean;                          // FR-53 / FR-54 / FR-22 work-detector:
                                                              //   Puzzle.isBlank(s.puzzle) && s.displacedClues.length === 0
};
```

```ts
// builder/state/intents.ts
export type BuilderIntent =
  // mode
  | { kind: 'switch-to-fill' }                                 // unguarded (FR-53: switch to fill never requires confirm)
  | { kind: 'request-switch-to-design' }                       // guarded (FR-53); emits modal-request on block
  | { kind: 'confirm-switch-to-design' }                       // dispatched by Modal Confirm button; executes unconditionally
  // design
  | { kind: 'toggle-design-cell'; row: Row; col: Col }        // FR-20; clears cursor (FR-21); triggers reconcile (FR-23)
  | { kind: 'change-grid-size'; size: GridSize }              // FR-22; only when blank
  // fill — cell selection & cursor
  | { kind: 'select-cell'; row: Row; col: Col }               // FR-10, FR-11
  | { kind: 'move-cursor'; direction: Direction; sign: -1 | 1 } // FR-14 arrow keys; sign picks ±1 along axis
  // fill — typing
  | { kind: 'type-letter'; letter: Letter }                   // FR-12; writes answerLetter; advances (or stays)
  | { kind: 'backspace' }                                      // FR-13
  // fill — markers
  | { kind: 'toggle-marker'; flag: CellMarkerFlag }           // FR-26, FR-27
  // fill — clues
  | { kind: 'edit-clue'; wordKey: WordKey; clue: string }     // FR-30; reducer rejects with toast if word is non-head chain word (FR-31, C5)
  // fill — chains
  | { kind: 'begin-join'; source: WordKey }                   // FR-34
  | { kind: 'click-clue-panel-word'; wordKey: WordKey }        // polysemous — see below
  | { kind: 'click-grid-word'; wordKey: WordKey }             // polysemous (alternative entry point) — see below
  | { kind: 'unjoin'; source: WordKey }                       // FR-37
  | { kind: 'escape' }                                         // FR-15; cancels join/reattach sub-mode
  // displaced clues
  | { kind: 'begin-reattach'; displacedClueId: DisplacedClueId }// FR-41
  | { kind: 'delete-displaced-clue'; id: DisplacedClueId }    // FR-40, FR-44
  // metadata
  | { kind: 'edit-title'; title: Title }
  | { kind: 'edit-author'; author: Author }
  // import / export
  | { kind: 'request-import-puzzle'; fileContent: string }    // guarded (FR-54); emits modal-request on block
  | { kind: 'confirm-import-puzzle'; fileContent: string }     // dispatched by Modal Confirm; executes unconditionally;
                                                              //   on success → mode=fill, cursor=null
  | { kind: 'export-incomplete' }                             // always available; emits `download` event
  | { kind: 'export-complete' }                                // reducer runs CompletenessCheck;
                                                              //   on success emits `download`; on failure emits `toast` events with errors
  // lifecycle
  | { kind: 'request-reset-builder' }                         // guarded (FR-55); emits modal-request on block
  | { kind: 'confirm-reset-builder' };                         // dispatched by Modal Confirm;
                                                              //   clears puzzle, generates new PuzzleKey via PuzzleKey.generate(deps.rng),
                                                              //   emits `clear-builder-storage` event
```

The `rng` needed for `PuzzleKey.generate(rng)` in `confirm-reset-builder` is `deps.rng`, passed to `reduceBuilder` (and forwarded to `reconcileWords` for design-mode cases that need fresh `DisplacedClueId`s). All randomness used inside `reduceBuilder` comes from `deps`; there are no global-random calls.

**Polysemous `click-clue-panel-word` / `click-grid-word` intent:** effect depends on `state.subMode`. The reducer branches:

- `subMode = none` → navigate cursor to `wordKey`'s start cell (`wordKey.startRow`, `wordKey.startCol`), set direction. (Focusing the typing surface is a bindings-layer side effect that follows from the resulting `cursor` field, not an event.)
- `subMode = join { source }` → attempt join; validity FR-35; on success sets `source.nextWord`, displaces target's non-empty clue (FR-36); on failure emits a `toast` event and leaves sub-mode active.
- `subMode = reattach { displacedClueId }` → attempt reattach; validity FR-42 (target exists, empty clue, chain head); on success moves text, removes displaced clue; on failure emits a `toast` event.

**`request-switch-to-design` guard:** if `BuilderState.isBlank(state)` is true, the reducer simply executes the switch (sets `mode = 'design'`, clears sub-mode and cursor). If `state.isBlank` is false, the reducer returns state unchanged and emits `{ kind: 'modal-request'; modal: { kind: 'confirm-design-switch' }; confirmIntent: { kind: 'confirm-switch-to-design' } }`. `reduceApp` folds that event into `AppState.modal` and `AppState.pendingConfirmIntent`. The bindings layer's `Modal.svelte` Confirm button dispatches `state.pendingConfirmIntent` (i.e. `{ kind: 'confirm-switch-to-design' }`), which re-enters `reduceBuilder` and executes unconditionally. **No `force` flag; no recursive guard re-fire.**

**`request-import-puzzle { fileContent }` guard & `confirm-import-puzzle { fileContent }` action:** see §8.9a for the full algorithm. Summary: the Builder accepts both incomplete and complete files (FR-57). On success, replace `BuilderState` with a fresh one carrying the imported `Puzzle`, its `DisplacedClue[]` (taken from `parsePuzzleV1`'s `displacedClues` field — populated for incomplete, `[]` for complete), set `mode = 'fill'` and `cursor = null`. On failure, emit a `toast` event with the parse error and leave state unchanged. The `request-*` form checks `BuilderState.isBlank`: if blank, executes the import directly; if not blank, emits `modal-request { confirmIntent: { kind: 'confirm-import-puzzle'; fileContent } }`. The `confirm-*` form executes the import unconditionally.

**`request-reset-builder` guard:** if `state.isBlank` is true, reducer executes reset directly (clears puzzle, generates a fresh `PuzzleKey` via `PuzzleKey.generate(deps.rng)`, emits `{ kind: 'clear-builder-storage' }`). If not blank, emits `modal-request` with `confirmIntent: { kind: 'confirm-reset-builder' }`.

**`confirm-reset-builder`:** sets state to a fresh blank `BuilderState` with a new `PuzzleKey.generate(deps.rng)` and emits `{ kind: 'clear-builder-storage' }` (so the bindings layer calls `storagePort.clearBuilder()`). The new key is written into `state.builder.puzzle.key` directly; no event needed because the reducer has `deps.rng` and the key is Builder state (not AppState).

**`export-incomplete` and `export-complete`:** reducer constructs the serialized file content (via `serializeIncomplete(state.puzzle, state.displacedClues)` / `serializeComplete(state.puzzle)`) and emits a `{ kind: 'download'; filename; content }` event. For `export-complete`, the reducer first runs `CompletenessCheck.check`; on failure it emits one or more `toast` events describing the violations and does not emit a download event. Filename via `Filename.incomplete(key)` / `Filename.complete(key)`.

### 4.4 Player state and intents

```ts
// player/state/state.ts
export type PlayerState =
  | { phase: 'import'; lastImportError: string | null }        // awaiting puzzle file (FR-67); shows inline error on screen
  | {
      phase: 'solving';
      puzzle: Puzzle;
      cursor: Cursor;
      checkResult: CheckResult | null;                        // G5: cleared to null by any grid/cursor/puzzle change
      anagram: AnagramModalState | null;
    };

export type CheckClassification =
  | 'complete-correct' | 'incomplete-correct'
  | 'complete-incorrect' | 'incomplete-incorrect';             // FR-74

export type CheckResult = {
  classification: CheckClassification;
  incorrectCells: { row: Row; col: Col }[];                    // cells whose playerLetter differs from answerLetter
  emptyCells:     { row: Row; col: Col }[];                    // white cells with no playerLetter
};

export type AnagramModalState = {
  openedForWord: WordKey;                                     // modal closes if selection moves off this word (FR-88)
  input: string;                                              // uppercased A–Z; clamped to word length
  scrambledArrangement: (Letter | null)[] | null;             // entries-aligned (length === chain entries); fixed slots hold grid letter, non-fixed hold pool letter or null; null until first Scramble (FR-86)
};

export const PlayerState: {
  importScreen(): PlayerState;
  loaded(p: Puzzle): PlayerState;
};
```

```ts
// player/state/intents.ts
export type PlayerIntent =
  // import (NOT guarded — Player import has no existing work to overwrite; progress is keyed and retained)
  | { kind: 'import-puzzle'; fileContent: string }            // FR-67; complete format only; on reject sets lastImportError and emits toast; on success emits `load-player-progress` event (bindings layer then dispatches apply-loaded-progress)
  | { kind: 'apply-loaded-progress'; playerLetters: (Letter|null)[][]; savedGridSize: GridSize }  // dispatched by the bindings layer after observing `load-player-progress`; reducer applies FR-80 rules
  | { kind: 'import-new-puzzle' }                              // FR-78; returns to 'import' phase, retains autosaved progress in localStorage
  // solving — cell & cursor
  | { kind: 'select-cell'; row: Row; col: Col }
  | { kind: 'move-cursor'; direction: Direction; sign: -1 | 1 }  // FR-14 arrow keys; sign picks ±1 along axis
  | { kind: 'type-letter'; letter: Letter }
  | { kind: 'backspace' }
  | { kind: 'escape' }                                          // closes anagram modal (FR-89); no sub-modes in Player
  | { kind: 'click-clue-panel-word'; wordKey: WordKey }
  // checking
  | { kind: 'check' }                                          // FR-74; sets checkResult
  | { kind: 'clear-errors' }                                   // FR-75; only valid when checkResult has incorrectCells
  // lifecycle
  | { kind: 'request-reset-player' }                           // guarded (FR-77)
  | { kind: 'confirm-reset-player' }                            // dispatched by Modal Confirm; clears player letters, removes cursor,
                                                              //   emits `clear-player-storage { key }` event
  // anagram
  | { kind: 'open-anagram-helper' }
  | { kind: 'close-anagram-helper' }                          // FR-89
  | { kind: 'anagram-input'; input: string }                  // FR-83
  | { kind: 'anagram-scramble' };                              // FR-86 — reducer calls Anagram.scramble(deps.rng) directly and writes scrambledArrangement into PlayerState
```

**`check` clear-on-change:** every intent that mutates `puzzle.grid`, `cursor`, or replaces the puzzle sets `checkResult = null` first thing in its reducer case. A small helper `withGridClear(state, grid)` standardizes this.

**`open-anagram-helper`:** requires `cursor != null` and the cursor's cell to belong to a word. Computes the word from the cursor/direction and stores `openedForWord`. If the cursor changes such that the new selected word's `WordKey` differs from `openedForWord`, every cell/click/arrow reducer closes the anagram modal (`anagram = null`) — implementing FR-88.

**`anagram-scramble`:** `reducePlayer` calls `Anagram.scramble(entries, input, deps.rng)` directly and writes the result into `PlayerState.anagram.scrambledArrangement`. No `anagram-scramble` event is needed; the reducer has `deps.rng`, and the scrambled state is Player state, not AppState. Stores `scrambled.map(e => e.letter)` (entries-aligned, nulls preserved — not filtered).

**`import-puzzle`:** reducer calls `parsePuzzleV1(fileContent)`.
- On `!ok`: set state to `{ phase: 'import'; lastImportError: failures.map(f => f.message).join('\n') }` and emit a `toast` event with the same.
- On ok but `fileType !== 'complete'`: set `lastImportError` to "Only complete puzzle files can be loaded into the Player." and emit a toast.
- On success (`fileType === 'complete'`): the reducer sets `phase: 'solving'` with the loaded `Puzzle`, `cursor: null`, `checkResult: null`, `anagram: null`, and emits a `{ kind: 'load-player-progress'; key: puzzle.key }` event. The bindings layer observes this event, calls `storagePort.loadPlayerProgress(key)`, parses the saved progress blob (if present), and dispatches a new `PlayerIntent: { kind: 'apply-loaded-progress'; playerLetters: (Letter|null)[][]; savedGridSize: GridSize }`. The Player reducer for `apply-loaded-progress` handles the application rules (FR-80): only if `savedGridSize === puzzle.gridSize`, only on white cells, dropped letters targeting now-black cells.

### 4.5 Persistence & autosave scheduling

Persistence is the bindings layer's responsibility — driven by two mechanisms:

1. **State observation (autosave).** The bindings layer runs two `$effect`s — one over `state.builder` (the full BuilderState) and one over `state.player` (when `phase === 'solving'`) — split per-slice so a change to one slice does not re-arm the other's debounce timer. On any change, debounce (configurable; default 400 ms per F2) and call `storagePort.saveBuilder(blob)` or `storagePort.savePlayerProgress(key, blob)`. The persisted Builder blob is richer than the incomplete-puzzle JSON — it includes `mode` and `subMode` for restore — so it is a wrapper around the puzzle JSON, not the puzzle JSON directly:
   ```ts
   // Player progress blob: { version: 1, kind: 'player-progress', key, gridSize, playerLetters: (Letter|null)[][] }
    // Builder snapshot blob: { version: 1, kind: 'builder-snapshot',
    //     puzzle: <incomplete puzzle JSON>, mode: 'design'|'fill', subMode: 'none' }
    //   (subMode forced to 'none' on save per FR-64; cursor omitted per C6)
    //   (displacedClues lives only inside the embedded puzzle JSON via serializeIncomplete;
    //    no top-level displacedClues field — the dead duplicate was removed)
   ```
   The bindings layer constructs the Builder snapshot wrapper; the `serializeIncomplete(state.builder.puzzle, state.builder.displacedClues)` adapter produces just the embedded puzzle-JSON portion.

2. **Event-driven storage clears.** When the bindings layer receives a `{ kind: 'clear-builder-storage' }` event (from `confirm-reset-builder`), it calls `storagePort.clearBuilder()` *synchronously* (no debounce) before any debounced autosave fires. Same for `{ kind: 'clear-player-storage'; key }`.

**Corrupt-state recovery (NFR-9):** when the bindings layer loads `state.builder` from `localStorage` at boot, if deserialization fails, it throws away the blob and starts fresh (Builder: blank puzzle per FR-19, with a freshly-generated `PuzzleKey` via the injected rng at boot — `main.ts` performs this; not a reducer concern). Player corrupt progress is silently dropped and the import screen is shown. A `console.warn` is acceptable; no toast.

---

## 5. View-Models (UI ↔ Bindings Contract)

All view-model definitions live in `ui/bindings/`. They are plain typed objects: leaf-shaped, serializable, with no methods and no Svelte awareness. Components consume them as `$props()`. Components never call domain functions; they emit intents via `dispatch`.

Each VM below is derived from `AppState` purely and reactively (Svelte 5 `$derived`). Components use `$derived` locally only for trivial presentational computations (e.g., resolving a cell-colour flag into a CSS class).

### 5.1 Shared

```ts
export type ToastVM = { id: ToastId; kind: ToastKind; message: string };
export type ModalVM = { kind: ModalRequest['kind']; title: string; body: string; confirmLabel: string; cancelLabel: string } | null;
```

### 5.2 Grid VM (shared shape; both Builder and Player produce one)

```ts
export type CellHilite = 'none' | 'selected' | 'in-word';
// selected: yellow bg (CON-4); in-word: pale yellow.
// Check produces no per-cell colouring on the grid itself. Correct, incorrect, and empty cells (post-Check) all render without a special hilite; player feedback is solely via the toolbar classification message/colour (deriveCheckResultVM, FR-75). The `CheckResult` state object still drives the `clear-errors` action (FR-75) via its `incorrectCells` field — that is reducer data, not grid display.
export type CellSeparator = 'none' | 'space' | 'hyphen';     // re-exported from `domain/grid/CellSeparator.ts` (see §3.2)

export type GridCellVM = {
  row: Row; col: Col;
  black: boolean;
  letter: string | null;                                     // Builder: answerLetter; Player: playerLetter (displayed)
  number: WordNumber | null;                                 // shown top-left only on word-start cells
  hilite: CellHilite;
  separatorRight: CellSeparator;
  separatorBottom: CellSeparator;
  selectable: boolean;                                       // FR-8
};

export type GridVM = {
  size: GridSize;
  cells: GridCellVM[][];                                     // row-major
  cursor: Cursor;                                            // `Cursor` imported type-only from `domain/grid/Cursor.ts` (§3.2)
};
```

### 5.3 Builder view-models

```ts
export type BuilderToolbarVM = {
  mode: BuilderMode;
  canSwitchToDesignWithoutConfirm: boolean;                  // false when state.isBlank is false
  canChangeGridSize: boolean;                                 // false unless blank (FR-22)
  gridSizeInput: number;                                     // current numeric value
  minGridSize: 2; maxGridSize: 25;
  cellSelected: boolean;                                      // gates marker toolbar (FR-26)
  markerFlags: CellMarker;                                    // current selected cell's markers
  canExportComplete: boolean;                                 // completeness check passes (FR-63)
  exportCompleteViolations: CompletenessViolation[];          // shown as inline errors when blocked
};

export type ClueEntryVM = {
  wordKey: WordKey;
  number: WordNumber;
  direction: Direction;
  displayClue: string;                                       // FR-90: own clue if head; "See N Direction" if non-head
  lengthPattern: LengthPattern | null;                       // FR-91: suffix-from-here for heads; null for non-heads in the clue list per FR-73.
                                                              // (The active-clue banner's null-pattern-for-non-heads comes from the C4 deviation,
                                                              // separate from this clue-list null-for-non-heads.)
  isChainHead: boolean;
  hasOutgoingNextWord: boolean;
  isSelected: boolean;                                       // matches cursor
  // builder-only affordances
  isStartableJoinSource: boolean;                            // source side: has no outgoing nextWord (FR-35b)
  isLinkableFromJoinSource: boolean;                         // target side: this word can be the join target;
                                                              //   requires (a) join sub-mode active, (b) ≠ source, (c) not already pointed to by any word (FR-35c)
  isUnjoinable: boolean;                                     // has outgoing nextWord
};

export type CluePanelVM = {
  across: ClueEntryVM[];                                     // sorted by WordNumber
  down: ClueEntryVM[];
  highlightedWordKey: WordKey | null;                        // scrolls into view (FR-32)
};

export type DisplacedClueEntryVM = {
  id: DisplacedClueId;
  clue: string;
  direction: Direction;
  isBeingReattached: boolean;                                // matches active reattach sub-mode's id
};
export type DisplacedCluesPanelVM = {
  visible: true;                                             // always rendered (C1)
  entries: DisplacedClueEntryVM[];                           // empty array when none
  emptyMessage: 'No displaced clues';
};

export type BuilderSubModeBannerVM =
  | { kind: 'none' }
  | { kind: 'join'; sourceNumber: WordNumber; sourceDirection: Direction }
  | { kind: 'reattach'; cluePreview: string; clueDirection: Direction };

export type BuilderShellVM = {
  toolbar: BuilderToolbarVM;
  grid: GridVM;
  cluePanel: CluePanelVM;
  displacedClues: DisplacedCluesPanelVM;
  subModeBanner: BuilderSubModeBannerVM;
  title: string; author: string;
};
```

### 5.4 Player view-models

```ts
export type ActiveClueBannerVM = {
  visible: true;                                             // always reserved space (FR-71)
  wordNumber: WordNumber | null;
  direction: Direction | null;
  displayClue: string | null;                                // FR-72: own clue for heads; "See N Direction" for non-heads
  lengthPattern: LengthPattern | null;                       // C4: null for non-head words; FR-91 suffix for heads
};

export type PlayerCluePanelVM = {
  across: ClueEntryVM[];                                     // FR-73: same shape as Builder but no builder-only affordances;
  down:   ClueEntryVM[];                                      // (ClueEntryVM fields like isLinkableFromJoinSource are just false in Player)
  highlightedWordKey: WordKey | null;
};

export type PlayerToolbarVM = {
  canCheck: boolean;                                         // phase = solving
  canClearErrors: boolean;                                   // checkResult has incorrectCells
  canReset: boolean;
  canOpenAnagram: boolean;                                   // cursor != null and cursor cell belongs to a word
  canImportNew: boolean;
};

export type AnagramTileVM = {
  position: number;                                          // 0-based within word
  fixed: boolean;                                            // grid letter present -> fixed (FR-82)
  letter: string | null;                                      // fixed: grid letter; else: scrambledArrangement[i] (entries-aligned) or null
};
export type AnagramModalVM = {
  open: boolean;
  wordLength: number;
  tiles: AnagramTileVM[];
  separators: CellSeparator[];                               // between tiles, from word markers (FR-82)
  input: string;
  inputLength: number;
  expectedUniqueLetterCounts: { letter: Letter; count: number }[];  // for "X of Y entered" hint
  inputValid: boolean;
  scrambleEnabled: boolean;                                   // input valid AND has ≥1 non-fixed tile
  errorMessage: string | null;
};

export type PlayerShellVM = {
  phase: 'import' | 'solving';
  importError: string | null;
  title: string; author: string;
  grid: GridVM;
  topBanner: ActiveClueBannerVM;
  bottomBanner: ActiveClueBannerVM;                          // same instance as top — rendered twice (FR-71)
  cluePanel: PlayerCluePanelVM;
  toolbar: PlayerToolbarVM;
  anagram: AnagramModalVM;
  checkResult: {
    classification: CheckClassification;
    incorrectCount: number;
    emptyCount: number;
    message: string;
    colorClass: string;                                       // tailwind class per classification (FR-75)
  } | null;
};
```

### 5.5 No logic in components — rules

A component MUST NOT:
- import from `domain/` or any `state/` module,
- call any reducer or domain function,
- compute a domain value (e.g., `WordKey.toCanonical`, `Chain.isHead`) — even if "trivial",
- mutate any VM it receives.

A component MAY:
- compute pure presentation matters from its props (e.g., `cls = vm.hilite === 'selected' ? 'bg-yellow-200' : vm.hilite === 'in-word' ? 'bg-yellow-50' : 'bg-white'`),
- emit `Intent`s via the `dispatch` function from the appropriate `ui/bindings/*Store.svelte.ts` module.

The ESLint `no-restricted-imports` rule blocks `domain/`, `state/`, `ports/` imports from anything under `ui/` *except* `ui/bindings/`.

---

## 6. JSON Format Reference (v1, the only supported format)

Authoritative for both serialization and parsing. All field names are exact. Strict parser (extra fields rejected).

### 6.1 Incomplete file (Builder's "Export Incomplete"; can be re-imported into Builder)

```json
{
  "version": 1,
  "type": "incomplete",
  "key": "<UUID v4>",
  "gridSize": 15,
  "title": "...",
  "author": "...",
  "grid": [[ { "black": false, "puzzleLetter": "A" | null,
               "spaceRight": false, "spaceBottom": false,
               "hyphenRight": false, "hyphenBottom": false }, ... ], ...],
  "words": [
    { "startRow": 0, "startCol": 1, "direction": "across",
      "length": 4, "number": 1, "clue": "...", "nextWord": { "startRow": 3, "startCol": 0, "direction": "down" } | null }
  ],
  "displacedClues": [
    { "id": "<UUID v4>", "clue": "...", "direction": "across" }
  ]
}
```

### 6.2 Complete file (Builder's "Export Complete"; consumed by Player; also re-importable by Builder per FR-57)

Same as §6.1 with these differences:
- `"type": "complete"`,
- `"displacedClues"` field **absent** (FR-97); presence is a validation failure,
- Every white cell's `"puzzleLetter"` is a single A–Z char (FR-61),
- Every chain-head `"clue"` is non-empty (FR-62) — *and*, per C5, every non-head chain word's `"clue"` is empty; a non-empty value is a validation failure.

### 6.3 Validation checklist (FR-98 + C5)

1. `version === 1` else reject (FR-94).
2. `type ∈ {'incomplete', 'complete'}` else reject (FR-94).
3. `key` parses as `PuzzleKey` (UUID v4).
4. `gridSize` is an integer in `[2, 25]`.
5. `grid` is a `gridSize × gridSize` 2D array of cell objects.
6. Each cell's fields: `black: boolean`, `puzzleLetter: null | single A–Z`, four marker booleans (missing → `false`). Any other field present (including a stray `letter`) fails strict validation. For complete: `puzzleLetter` is never `null` on a white cell.
7. `title`, `author` are strings (possibly empty).
8. `words` array: each word has `startRow`, `startCol` (in bounds), `direction`, `length ≥ 2`, `number ≥ 1`, `clue: string`, `nextWord: { startRow, startCol, direction } | null`. For complete: chain heads have non-empty non-whitespace `clue`; non-heads have empty `clue` (C5 — non-empty → fail).
9. Re-derive words from `grid` and verify each listed word matches a derived word exactly (`startRow`/`startCol`/`direction`/`length`). Derive `number` per FR-6 and overwrite the file's cached `number` (FR-98a); a mismatch in `length` between the file and the re-derived grid is a failure.
10. `nextWord` references resolve to existing words; `ChainValidation.validate` reports no cycles/branches/dangling/self-references.
11. `displacedClues` (incomplete only): array of `{ id, clue, direction }`; each `id` is a valid lowercase UUID v4 string (`DisplacedClueId.try`) and unique within the array; `direction ∈ {'across', 'down'}`.

On any failure, return a single human-readable error list (FR-99) and change no app state (NFR-10).

---

## 7. Component Inventory & UI Layout

### 7.1 Visual conventions (CON-4) — colour tokens

| Token | Tailwind class | Meaning |
|---|---|---|
| bg-selected | `bg-yellow-400` / `bg-yellow-300` | selected cell (FR-7, CON-4) |
| bg-in-word | `bg-yellow-100` / `bg-yellow-50` | cells in the selected word |
| bg-white-cell | `bg-white` | ordinary white cell |
| bg-black-cell | `bg-black` | black cell |
| sep-space | `bg-gray-800 w-1` (vertical bar) / `h-1` (horizontal bar) | space-marker visual |
| sep-hyphen | text glyph `-` between cells | hyphen-marker visual |
| num-corner | `text-[0.6rem] top-0 left-0` | small number in top-left (FR-6) |
| banner | `min-h-2em` always-reserved | banner area when no selection (FR-71) |

Fine spacing and typography choices are left to the implementer; the colour conventions above are fixed.

### 7.2 Component inventory (Builder)

| Component | Props (VM) | Emits intents | Notes |
|---|---|---|---|
| `BuilderShell.svelte` | `BuilderShellVM` | (composes children) | Lays out toolbar + grid + clue panel + displaced panel; renders `JoinReattachBanner` when sub-mode active. Layout per CON-4: grid+controls left, clues right. |
| `BuilderToolbar.svelte` | `BuilderToolbarVM` | `switch-to-fill`, `request-switch-to-design`, `change-grid-size`, `toggle-marker`, `request-import-puzzle` (via FilePicker), `export-incomplete`, `export-complete`, `request-reset-builder`, `edit-title`, `edit-author` | Shows Design/Fill toggle (FR-16); grid-size control (FR-22, C3 numeric input clamp-on-blur); markers toolbar (FR-26) disabled when no cell; Export Incomplete always available; Export Complete enabled iff `canExportComplete` (FR-63). The matching `confirm-*` intents are dispatched by `Modal.svelte`, not by this toolbar. Marker flag → `CellMarker` field key via `Record<CellMarkerFlag, keyof CellMarker>` map (compile-safe exhaustiveness — adding a flag variant breaks the build). |
| `GridSizeControl.svelte` | min/max/value/disabled | `change-grid-size` | `<input type="number" min=2 max=25 step=1>`; clamps on blur. Disabled+explanatory text when grid not blank. |
| `BuilderGrid.svelte` | `GridVM` + cell-selected flag | `select-cell`, `toggle-design-cell` (in design mode), `click-grid-word` | Renders the grid; in Design mode clicks toggle; in Fill mode clicks select. Markers render as bars/hyphens per separators. Number rendered corner. Uses `TypingSurface` for input. |
| `BuilderCluePanel.svelte` | `CluePanelVM` | `click-clue-panel-word`, `begin-join`, `unjoin`, `edit-clue` | Single owner of the `<aside>` scroll container, all `<li>` refs (`bind:this` keyed by `canonicalId`), the scroll-into-view `$effect` (driven by `vm.highlightedWordKey` — no DOM id, no `getElementById`, no cross-component DOM; G8 closed), `isInJoinMode` derived, the per-row `drafts` store (`SvelteMap<string, string>` from `svelte/reactivity` — reactive Map; G3 closed; keyed by `canonicalId` = `${row}_${col}_${direction}` so Across/Down never collide), and all per-row dispatch helpers. The per-row `<li>` body is deduplicated via a Svelte 5 `{#snippet clueRow(entry)}` rendered in both the Across `<ul>` and the Down `<ul>` (replaces the B3 `ClueSection.svelte` component extraction — see snippet guidance below). Sections Across/Down sorted by number (FR-32). Chain heads have an editable text input (FR-31); non-heads show "See N Direction" reference, no input. Per-clue "Link next" / "Unlink" controls (FR-38) when relevant. Scrolls the highlighted clue into view (FR-32) via manual delta on `panelEl` (preserved exactly — not native `scrollIntoView`, which would scroll all ancestors). |
| `DisplacedCluesPanel.svelte` | `DisplacedCluesPanelVM` | `begin-reattach`, `delete-displaced-clue` | Always rendered (C1). Empty state shows "No displaced clues". Per-entry "Reattach" / "Delete" controls (FR-40). |
| `JoinReattachBanner.svelte` | `BuilderSubModeBannerVM` | `escape` | Instructional banner (FR-34, FR-41); visible in join & reattach sub-modes; Escape cancels. |

**Markup dedup guidance (from G8).** Svelte 5 `{#snippet}` is the approved mechanism for deduplicating presentational markup that shares one component's reactive scope. Extract a child `.svelte` component only when there is a genuine ownership boundary (a distinct sub-view-model, isolated state, or a reusable unit mounted in multiple parents). Do NOT extract a component solely to dedup markup when the parent must still reach into the child's DOM (scroll containers, focus targets, `bind:this` refs) — that splits ownership of things that must move together and reintroduces the cross-component DOM coupling G1/G8 closed. `BuilderCluePanel.svelte`'s `{#snippet clueRow(entry)}` (rendered in the Across + Down `<ul>`s) is the reference example.

### 7.3 Component inventory (Player)

| Component | Props (VM) | Emits intents | Notes |
|---|---|---|---|
| `PlayerShell.svelte` | `PlayerShellVM` | (composes children) | Switches between ImportScreen and solving layout per `phase`. Solving layout: top-banner, grid, bottom-banner (FR-71), clue panel side, toolbar. |
| `ImportScreen.svelte` | `importError` | `import-puzzle` (via FilePicker) | Drag-and-drop or file picker (FR-67). On reject shows `importError`. |
| `PlayerGrid.svelte` | `GridVM` | `select-cell`, `move-cursor`, `type-letter`, `backspace`, `escape`, `click-grid-word` | Same grid component shape as Builder; check result paints incorrect/correct cells. |
| `ActiveClueBanner.svelte` | `ActiveClueBannerVM` | (none) | Rendered twice: above and below grid (FR-71). Always reserves space (FR-71). |
| `PlayerCluePanel.svelte` | `PlayerCluePanelVM` | `click-clue-panel-word` | Same shape as Builder but no edit inputs; just display + navigation (FR-73). Owns `<li>` refs via `bind:this` keyed by `canonicalId`; scroll-into-view `$effect` driven by `vm.highlightedWordKey` (G9 — no DOM id, no `getElementById`). |
| `PlayerToolbar.svelte` | `PlayerToolbarVM` | `check`, `clear-errors`, `request-reset-player`, `import-new-puzzle`, `open-anagram-helper` | Check shows result message + colour (FR-75). Reset emits `request-reset-player` (which may pop a modal via reducer). |
| `AnagramModal.svelte` | `AnagramModalVM` | `anagram-input`, `anagram-scramble`, `close-anagram-helper` | Modal per FR-81..FR-89. Closes on backdrop click / Escape / selection-change (FR-88 / FR-89). No grid write-back (FR-87). |

### 7.4 Shared components

| Component | Props | Emits | Notes |
|---|---|---|---|
| `Modal.svelte` | `ModalVM` | the deferred `confirm-*` Builder/Player intent from `state.pendingConfirmIntent` (on Confirm); `cancel-modal` (on Cancel/Escape) | One reusable modal (G4 closed: single `const vm = $derived(modalVM())` derivation per tick; template narrows via `{#if vm !== null}` — no double-call, no `!`). Backdrop, Confirm/Cancel buttons, Escape cancels. No focus trap (a11y out of scope). The bindings layer reads `pendingConfirmIntent` off `AppState` and dispatches it directly on confirm. |
| `ToastHost.svelte` | `ToastVM[]` | `dismiss-toast` (id) | Stacked top-right; bottom-center on mobile via Tailwind responsive. Click dismisses; auto-dismiss via bindings-layer timeout (C2 = 3500 ms). Per-toast diff scheduling (G5 closed): a persistent `Map<ToastId, timer>` keyed by id; each toast gets exactly one timer scheduled when it first appears, timers for dismissed toasts are cleared — sibling mutations no longer reset unrelated timers (deadline ≈ `createdAt + ttlMs`). `onDestroy` clears all on unmount; `$effect` has no cleanup-return. |
| `Toast.svelte` | `ToastVM` | `dismiss-toast` | Single toast row. |
| `TypingSurface.svelte` | `enabled: boolean; cursor: Cursor` | key/IME events → `type-letter`, `backspace`, `move-cursor`, `escape` | The single hidden `<input>` (FR-93, G3). Owned nowhere else. Focus is state-driven: the existing `$effect` reads `enabled` and `cursor` and re-focuses the input when `enabled` is true and the `cursor` ref changes (i.e. whenever `select-cell` / `click-clue-panel-word` reducers produce a new cursor). No DOM id, no imperative cross-component focus calls, no Svelte context (G1/G2 — closed). `Cursor` type-imported from `domain/grid/Cursor` (AD §2.3 permits UI→domain type imports; precedent `gridVM.ts`). Normalizes mobile composition/input/Unidentified key events. Never visually obtrusive. Emits `TypingIntent` values (B6 — type owned by `ui/shared/typingIntent.ts`, imported type-only here + by both shells). Accepted behaviour change: Builder clue-panel click during `join`/`reattach` subMode no longer refocuses the surface (those reducers mutate `subMode` but not `cursor`); user stays oriented and clicks a cell/clue to refocus, which now works via state. |
| `FilePicker.svelte` | accept label | `pick-file` (callback with text) | Wraps `<input type="file">` + drag-and-drop; returns file text to caller. |

### 7.5 Layout (top-level)

`App.svelte`:
```
┌───────────────────────────┐
│ Header (title, FR CON-5)  │
├───────────────────────────┤
│                           │
│   switch(route):          │
│     landing  → <Landing/> │
│     build   → <BuilderShell/> │
│     play    → <PlayerShell/>  │
│                           │
├───────────────────────────┤
│ <ToastHost/>  <Modal/>     │
└───────────────────────────┘
```
`Landing.svelte` shows two buttons Build / Play (FR-1) which dispatch `navigate`.

---

## 8. Key Algorithms

These are pure functions living in `domain/`. Each is fully unit-tested (NFR-4). The builder implements the signatures exactly; the algorithm descriptions are the contract.

### 8.1 Word derivation (`WordDerivation.derive`)

Input: `Grid`. Output: `DerivedWord[]` (no `number` field — `Numbering.assign` mints the number).

1. For each row `r` in `0..gridSize-1`: scan left-to-right. A run begins at column `c` when `grid[r][c]` is white and (`c === 0` or `grid[r][c-1]` is black — i.e. the run starts either at the grid edge or just after a black cell). Accumulate white cells until a black cell or grid edge. If run length ≥ 2, emit a `DerivedWord` with `direction: 'across'`, `startRow: r`, `startCol: c`, `length = run length`, `clue: ''`, `nextWord: null` (no `number` field).
2. For each column `c` in `0..gridSize-1`: similarly, scan top-to-bottom. Emit `direction: 'down'`.
3. Return all `DerivedWord`s in arbitrary order (binding code sorts as needed).

### 8.2 Numbering (`Numbering.assign`)

Input: `Grid`, `DerivedWord[]` (un-numbered). Output: `Word[]` numbered per FR-6.

1. Build a set `starts` of all `WordKey`s in the input list (keyed by `(startRow, startCol, direction)`).
2. Walk cells in row-major order. Maintain a counter starting at 1. For each cell `(r, c)`:
   - If `(r, c)` is the start cell of any word (across and/or down), assign that number to every word starting there, then increment the counter.
3. Sort the returned words by start cell then by direction (across before down at the same start cell — for stable display).

### 8.3 Chain validation (`ChainValidation.validate`)

Input: `Word[]`. Output: `ChainViolation[]`. Detects (FR-98):
- **Self-reference** — `w.nextWord equals w.key`.
- **Branch** — two distinct words have `nextWord` pointing to the same `WordKey`.
- **Dangling** — `w.nextWord` points to no word in the list.
- **Cycle** — following `nextWord` links revisits a word before terminating at `null`.

Implementation: build a map `target → sources[]` for branch detection; build a `key → Word` lookup for dangling/self-ref; cycle detection via visited-set per head.

### 8.4 Length pattern (`LengthPattern.forWord`)

Full FR-91 algorithm (unit-tested even though the banner UI uses a restricted variant — §3.4, C4):
1. If `w.nextWord != null`: collect `chainMembersFrom(words, w.key)`, map each to `String(member.length)`, join with `","` (no space). Return.
2. Else (no nextWord): walk the word's cells. Maintain a running run-length counter and an output buffer. For each pair of adjacent cells (i, i+1) in the word:
   - Determine the separator in `direction`: for `across`, look at cell `i`'s `marker.spaceRight` / `hyphenRight`; for `down`, `marker.spaceBottom` / `hyphenBottom`.
   - If neither is set, increment the current run-length counter.
   - If `space…` set: push the current run-length to the buffer, then push `", "` separator marker.
   - If `hyphen…` set: push the current run-length, push `"-"` separator marker.
   - After the loop, push the final accumulated run-length.
3. Render run lengths and separators in order: e.g., `["4", ", ", "4"]` → `"4, 4"`. Note the literal spec uses `", "` (comma + space) between space-separated runs and `"-"` between hyphen-separated runs (FR-91). Mixed example: `2, 2-3`.

### 8.5 Reconciliation (`builder/state/internal/reconcileWords.ts` — `reconcileWords`)

Input: `grid: Grid` (the post-toggle grid, needed for `Numbering.assign`), previous `Word[]` (with numbers, clues, nextWord links), new derived `DerivedWord[]` (no numbers — straight from `WordDerivation.derive`), the previous `DisplacedClue[]`, and a `rng: Rng` (used to mint fresh `DisplacedClueId`s for any clue text displaced by destroyed words). Output: `{ words: Word[], displacedClues: DisplacedClue[], events: DomainEvent[] }`. `events` contains `toast` events for shortened/lengthened notifications (FR-45). The `toggle-design-cell` reducer case calls `reconcileWords` (passing `state.puzzle.grid`, `state.puzzle.words`, `WordDerivation.derive(grid)`, `state.displacedClues`, `deps.rng`), sets `puzzle.words` and `displacedClues` on the resulting `BuilderState`, and returns the events alongside. Implements FR-45..FR-48.

1. Compute the set of **surviving words** (same `WordKey` in both old and new lists).
2. For each surviving word: retain its clue and `nextWord` from the old word onto the corresponding new `DerivedWord`. If `length` changed, record a `{ wordKey, direction, change: 'shortened' | 'lengthened' }` entry (the new `number` is not yet known — `Numbering.assign` runs in step 7; the toast is emitted after step 7 with the new number).
3. **Destroyed words** (in old, not in new): remove them. If they had a non-empty clue, append a `DisplacedClue` (constructed via `DisplacedClue.create(rng, clue, direction)`, which calls `DisplacedClueId.generate(rng)` for the id) to the displaced list (FR-46).
4. **Chain cleanup** (FR-47):
   - For each surviving word whose `nextWord` points to a destroyed word, clear that `nextWord`.
   - For each destroyed word `d`, traverse its chain forward (via `nextWord`) over surviving downstream words (i.e., words that *were* displaying a "See …" reference attributable to `d`'s chain) and clear each such downstream word's clue (set to empty). Note: chain traversal must stop at any cleared/destroyed word to avoid spurious walks.
5. **Newly-appearing words** (in new, not in old): `clue: ''`, `nextWord: null` (FR-48). For surviving words, the retained `clue`/`nextWord` from step 2 stays.
6. Run `Numbering.assign(grid, derivedWords)` to produce the final `Word[]` with numbers.
7. Run `ChainValidation.validate` on the resulting `Word[]` as a safety net; if it reports branches/dangling (a destroyed word was a non-head and its head survived), the cleanup in step 4 should have prevented these — but the validator is run as a safety net, and any violation is logged as an internal error toast (should be unreachable, but defensive). (Chain structure is independent of `number`, so running validation after numbering is observability-equivalent to running it before; the order was swapped from the original draft so the validator can operate on `Word[]`, matching `ChainValidation.validate`'s existing signature without a wider refactor of `Chain`/`WordMap` to be generic.)
8. For each `{ wordKey, direction, change }` recorded in step 2, look up the word's new `number` from the step-6 result and emit a `toast` event: `"Word N Direction was shortened."` or `"Word N Direction was lengthened."` (FR-45). Append any internal-error toasts from step 7. Return `{ words, displacedClues, events }`.

**Edge cases the test suite MUST cover (RISK-1):**
- Destroyed head of a chain surviving only in part (head destroyed, mid survives with downstream).
- Destroyed mid-chain word with downstream tail.
- Three-deep chain A→B→C, B destroyed: A's nextWord cleared, C's clue cleared.
- Destroyed head whose nextWord target survives (becomes a head, retains nothing from its destroyed predecessor).
- Word shortened/lengthened at the same key (clue + nextWord preserved).
- Multiple destroyed words in the same chain.

### 8.6 Join (FR-34..FR-38)

Reducer case for `click-clue-panel-word`/`click-grid-word` when `subMode = join { source }`:

1. Target = `wordKey`.
2. **Validity (FR-35):** source ≠ target; `source.nextWord` must be `null`; target must not be pointed to by any other word; both exist. If any fail, emit a Toast with the specific reason and leave sub-mode active.
3. On success: set `source.nextWord = target`. If target had a non-empty clue, displace it (create a `DisplacedClue`, append to the list); the target's `clue` is set to empty (FR-36, FR-31). Reset sub-mode to `none`.
4. Source clicked again cancels (FR-34).
5. Escape cancels.

### 8.7 Reattach (FR-41..FR-43)

Reducer case for `click-clue-panel-word` when `subMode = reattach { displacedClueId }`:

1. Target = `wordKey`.
2. **Validity (FR-42):** target exists; target's clue is empty; target is a chain head (`Chain.isHead`). If any fail, emit Toast with reason; sub-mode stays active.
3. On success: set `target.clue = displacedClue.clue`; remove the displaced clue from the list (FR-43); reset sub-mode to none. Note: only the text is transferred (not chain membership).

### 8.8 Anagram helper (`domain/anagram/`)

```ts
export type AnagramEntry = { position: number; fixed: boolean; letter: Letter | null };   // position 0..length-1
export const Anagram: {
  buildWordModel(grid: Grid, word: Word): { entries: AnagramEntry[]; separators: CellSeparator[] }; // FR-82
  validateInput(word: Word, entries: AnagramEntry[], input: string): { ok: true } | { ok: false; reason: string }; // FR-85
  scramble(entries: AnagramEntry[], input: string, rng: Rng): AnagramEntry[]; // FR-86
};
```

**`validateInput` (FR-85):**
- `input` is uppercased A–Z (filtered) and clamped to `word.length` (FR-83).
- Valid iff `input.length === word.length` AND the multiset of `input` letters is a superset of the multiset of fixed-position letters.
- At full length and failing the multiset check: return a clear reason.

**`scramble` (FR-86):**
- Take only the non-fixed positions. Gather their candidate letters from `input` after "claiming" any fixed letters from the input pool first (FR-84).
- Fisher–Yates shuffle the non-fixed candidate letters using the injected `rng`.
- Place shuffled letters into the non-fixed entries; fixed entries keep their `letter`. Return the new entries.
- Pure given the RNG; tests inject seeded RNG. **Called by `reducePlayer`** directly from the `anagram-scramble` reducer case (see §4.4), with `deps.rng`.

### 8.9 Player import (`player/state/lifecycle.ts` — `import-puzzle`)

1. Call `parsePuzzleV1(fileContent)`.
2. If `!ok`: set `phase = 'import'`, `lastImportError = failures.map(f => f.message).join('\n')` (FR-99, NFR-10). Emit a `toast` event. Return.
3. If `fileType !== 'complete'`: set `lastImportError = "Only complete puzzle files can be loaded into the Player."` (FR-67). Emit a `toast` event. Return.
4. Otherwise: set `phase = 'solving'`, `puzzle = p`, `cursor = null`, `checkResult = null`, `anagram = null`, `lastImportError = null`. Emit a `{ kind: 'load-player-progress'; key: p.key }` event. (The bindings layer observes this event, calls `storagePort.loadPlayerProgress(key)` — if present, parses the progress blob — and dispatches `{ kind: 'apply-loaded-progress'; playerLetters; savedGridSize }`. The Player reducer for `apply-loaded-progress` runs the application rules: only if `savedGridSize === puzzle.gridSize`, only on white cells, dropped letters for now-black cells — FR-80.)

### 8.9a Builder import (`builder/state/importExport.ts` — `request-import-puzzle` / `confirm-import-puzzle`)

The Builder accepts both incomplete and complete files (FR-57). On the unguarded path (blank Builder state) the `request-*` body executes directly; on the guarded path the bindings layer dispatches `confirm-*` after the user confirms the modal. Both paths share the body below.

1. Call `parsePuzzleV1(fileContent)`.
2. If `!ok`: emit a `toast` event with `failures.map(f => f.message).join('\n')`. Leave `BuilderState` unchanged (FR-99, NFR-10). Return.
3. (Both `fileType` values are acceptable; the Builder does not reject complete files like Player does.) Build a fresh `BuilderState`:
   - `puzzle = result.puzzle`
   - `displacedClues = result.displacedClues` — `[]` for complete files, the imported array for incomplete files
   - `mode = 'fill'` (FR-56 requires auto-switch to Fill mode on successful import)
   - `subMode = { kind: 'none' }`
   - `cursor = null`
4. Return the new `BuilderState`. No `download`/`clear-storage`/`load-progress` events are emitted (import is purely an in-memory state replacement; autosave will fire via the bindings layer's state observation).

---

## 9. File / Module Structure

Full tree. Every path is relative to repo root.

```
angryphrase/
├─ .github/workflows/deploy.yml            # FR-100; lint, type-check, test, build, deploy
├─ .nvmrc
├─ index.html                              # Vite entry; imports /src/main.ts
├─ package.json
├─ tsconfig.json
├─ vite.config.ts                          # vite-plugin-singlefile, inline favicon
├─ tailwind.config.ts
├─ eslint.config.js                        # includes no-restricted-imports boundary rule (§9.2)
├─ vitest.config.ts
├─ src/
│  ├─ main.ts                              # boot: ports, initial AppState, mount App.svelte
│  ├─ app.css                              # tailwind imports + minimal global styles (CON-4 tokens)
│  ├─ domain/                              # Layer 0: pure, framework-free (§2.1)
│  │  ├─ grid/
│  │  │  ├─ GridSize.ts  Row.ts  Col.ts  Cursor.ts  CellIndex.ts        # Cursor owned here (not builder/state)
│  │  │  ├─ Cell.ts  CellMarker.ts  CellMarkerFlag.ts
│  │  │  ├─ Grid.ts  GridOps.ts
│  │  ├─ word/
│  │  │  ├─ Direction.ts  WordKey.ts  Word.ts  WordNumber.ts  DerivedWord.ts
│  │  │  ├─ WordDerivation.ts  Numbering.ts  WordMap.ts  WordSelection.ts
│  │  ├─ letter/Letter.ts
│  │  ├─ chain/
│  │  │  ├─ Chain.ts  ChainValidation.ts  ChainViolation.ts
│  │  │  ├─ DisplayClue.ts  LengthPattern.ts
│  │  │  └─ ChainCells.ts                    # B2: shared cellsOfWord/cellsOfChain (builderVM + playerVM)
│  │  ├─ anagram/
│  │  │  ├─ Anagram.ts  AnagramEntry.ts
│  │  ├─ puzzle/
│  │  │  ├─ Puzzle.ts  PuzzleKey.ts  Title.ts  Author.ts
│  │  │  ├─ CompletenessCheck.ts  CompletenessViolation.ts
│  │  ├─ builder/
│  │  │  └─ DisplacedClue.ts  DisplacedClueId.ts
│  │  ├─ uuid/
│  │  │  └─ uuidv4.ts                       # pure UUID v4 minting from Rng; shared by PuzzleKey.generate + DisplacedClueId.generate
│  │  ├─ notifications/                    # Pure value objects whose consumers happen to be UI (§3.5a, revised S2)
│  │  │  ├─ Toast.ts  ToastId.ts  ToastKind.ts
│  │  │  ├─ ModalRequest.ts  ModalKind.ts
│  │  │  └─ Event.ts                       # DomainEvent discriminated union; ReducerResult helper; ConfirmableIntent
│  │  ├─ format/
│  │  │  └─ v1.ts  ParseFailure.ts  Filename.ts
│  │  ├─ rng/
│  │  │  └─ Rng.ts                        # Rng interface — deps-injection abstraction, NOT a port (§3.7, design_review_notes.md item 1)
        │  │  └─ ports/
        │  │     └─ ports.ts                      # StoragePort, DownloadPort, FilePickPort (side-effect port interfaces only)
│  ├─ builder/state/                       # Layer 1: pure reducers (§2.1)
│  │  ├─ state.ts  intents.ts  reducer.ts   # public API (app/state imports these)
│  │  └─ internal/
│  │     ├─ designMode.ts  fillMode.ts
│  │     ├─ joinSubMode.ts  reattachSubMode.ts
│  │     ├─ importExport.ts  lifecycle.ts  # lifecycle.ts = request-reset-builder / confirm-reset-builder
│  │     └─ reconcileWords.ts
│  ├─ app/state/                            # Layer 1 (app): the only reducer that sees all of AppState (§4.1, revised S2)
│  │  ├─ state.ts  intents.ts
│  │  ├─ reducer.ts  effects.ts            # effects.ts = applyEventsToApp helper; no internal/ subfolder
│  │  └─ intentKinds.ts                    # D1/DRN-7: type-derived kind Sets for reducer dispatch (BUILDER/PLAYER/CONFIRMABLE/AMBIGUOUS)
│  ├─ player/state/
│  │  ├─ state.ts  intents.ts  reducer.ts   # public API (app/state imports these)
│  │  └─ internal/
│  │     └─ solving.ts  lifecycle.ts  anagram.ts   # lifecycle.ts = import/import-new/apply-loaded-progress/request+confirm-reset-player
│  ├─ ui/
│  │  ├─ app/App.svelte  Landing.svelte  Header.svelte
│  │  ├─ builder/
│  │  │  ├─ BuilderShell.svelte  BuilderToolbar.svelte
│  │  │  ├─ BuilderGrid.svelte  BuilderCluePanel.svelte
│  │  │  ├─ DisplacedCluesPanel.svelte  JoinReattachBanner.svelte
│  │  │  ├─ GridSizeControl.svelte
│  │  ├─ player/
│  │  │  ├─ PlayerShell.svelte  ImportScreen.svelte
│  │  │  ├─ PlayerGrid.svelte  PlayerCluePanel.svelte
│  │  │  ├─ ActiveClueBanner.svelte  PlayerToolbar.svelte  AnagramModal.svelte
│  │  ├─ shared/
│  │  │  ├─ Modal.svelte  ToastHost.svelte  Toast.svelte
│  │  │  ├─ TypingSurface.svelte  FilePicker.svelte  typingIntent.ts
│  │  ├─ bindings/                        # Layer 2: the seam — the only place that crosses all layers (§2.1, §5.5)
│  │     ├─ appStore.svelte.ts  builderStore.svelte.ts  playerStore.svelte.ts
│  │     ├─ toastStore.svelte.ts  modalStore.svelte.ts
  │  │     ├─ ports.ts  persistenceCodec.ts  persistenceScheduler.ts
│  │     ├─ viewmodels/
│  │        ├─ builderVM.ts  playerVM.ts  gridVM.ts  cluePanelVM.ts
│  │        ├─ anagramVM.ts  toastVM.ts  modalVM.ts
│  ├─ ports/                              # Layer 4: port implementations (§2.1)
│  │  ├─ localStoragePort.ts
│  │  ├─ downloadPort.ts
│  │  ├─ filePickPort.ts
│  │  └─ rngPort.ts
├─ test/
│  ├─ domain/
│  │  ├─ grid/  word/  chain/  anagram/  puzzle/  format/  notifications/
│  │  └─ (one test file per source module; pure unit tests)
│  ├─ builder/state/
│  │  ├─ reducer.test.ts  designMode.test.ts  fillMode.test.ts
│  │  ├─ joinSubMode.test.ts  reattachSubMode.test.ts
│  │  ├─ importExport.test.ts  lifecycle.test.ts
│  │  ├─ reconcileWords.test.ts                          # exhaustive RISK-1 cases (§8.5)
│  │  ├─ reconcileWords.property.test.ts                # property-based over random toggles (optional)
│  ├─ player/state/
│  │  ├─ reducer.test.ts  solving.test.ts  anagram.test.ts  lifecycle.test.ts  import.test.ts
│  ├─ app/state/
│  │  └─ reducer.test.ts                  # full flow tests: dump-events cases, request→confirm pass, cancel; toast fold; modal fold; passthrough of download/clear-storage
│  ├─ fakes/
│  │  ├─ InMemoryStoragePort.ts  SeededRng.ts  StubDownloadPort.ts  FakeClock.ts
│  └─ boundary/
│     └─ imports.test.ts                  # asserts ESLint rule denies forbidden imports (§9.2)
├─ puzzles/                                  # canonical v1 sample puzzle files; not referenced by app or tests
│  └─ puzzle1.json … puzzle6.json
└─ llmworkspace/
   ├─ requirements.md
   ├─ architectquestions0.md
   └─ architecture_design.md                # this document
```

### 9.1 Naming conventions

- Files: `PascalCase.ts` for value objects/modules that bundle a type + helpers (`Grid.ts`, `Letter.ts`, `Word.ts`); `camelCase.ts` for pure-function modules (`reducer.ts`, `reconcileWords.ts`, `LengthPattern.ts` is an exception since it bundles a type + helpers); `*.svelte` for components (PascalCase).
- Types are `PascalCase`; branded primitive types are `PascalCase` nominal (`Row`, `Col`, `Letter`).
- Intent kinds: kebab-case string literals (`'select-cell'`, `'type-letter'`) — consistent across Builder/Player intent unions for tooling-friendly discrimination.
- View-model types are suffixed `VM` (`GridVM`, `ClueEntryVM`).
- Prefix `I` is NOT used for interfaces (`StoragePort`, not `IStoragePort`).

### 9.2 Boundary enforcement

`eslint.config.js` defines `no-restricted-imports` rules so that:

| Source path | May import | May NOT import |
|---|---|---|
| `src/domain/**` | only sibling files under `src/domain/**` | `svelte`, `svelte/*`, DOM-global-only modules, `src/ui/**`, `src/ports/**`, `src/builder/state/**`, `src/player/state/**`, `src/app/state/**` |
| `src/builder/state/**`, `src/player/state/**` | `src/domain/**`, sibling files within the same module (including its own `internal/` subfolder); the other module's public root files only | `svelte`, `svelte/*`, DOM globals, `src/ui/**`, `src/ports/**`, `src/app/state/**`, the other module's `internal/**` subfolder (no cycles, no reaching into another module's internals) |
| `src/app/state/**` | `src/domain/**`, value and type imports from the public root files of `src/builder/state/**` (`state.ts`, `intents.ts`, `reducer.ts`) and `src/player/state/**` (same three files), and from sibling `src/app/state/**` files | `svelte`, `svelte/*`, DOM globals, `src/ui/**`, `src/ports/**`, and `src/builder/state/internal/**` / `src/player/state/internal/**` (anything under an `internal/` subfolder of another Layer-1 module) |
| `src/ui/**` (except `src/ui/bindings/**`) | sibling files, `src/ui/bindings/**`, types-only from `src/domain/**` (for VM prop shapes only — *importing functions is blocked*) | `svelte` allowed; `src/ports/**`, `src/builder/state/**`, `src/player/state/**` blocked |
| `src/ui/bindings/**` | all of `src/**` | (none) |
| `src/ports/**` | `src/domain/ports/ports.ts` (interfaces only) and `src/domain/rng/Rng.ts` (the rngPort adapter needs `Rng`) | `svelte`, `src/state/**`, `src/ui/**`, rest of `src/**` |

A `test/boundary/imports.test.ts` runs the ESLint `Linter` API over adversarial fixture strings (with `filename` matching the per-glob rule's `files` pattern) and asserts each forbidden import triggers a `@typescript-eslint/no-restricted-imports` error. Negative controls assert allowed imports produce no error, proving the rule fires on the forbidden cases rather than blanket-erroring. This makes the boundary self-verifying (NFR-4); `tsc` does not enforce path boundaries, so ESLint is the enforcement mechanism.

### 9.3 Import-cycle policy

- `domain/` modules MAY import each other but acyclically. `domain/format/` is the bottom of the stack (depends on `puzzle/`, `grid/`, `word/`, `chain/`, `builder/`).
- State reducers never import `ui/` or `ports/` (enforced by lint), so no cycle can cross the seam.
- `ui/bindings/` may import anything; it's the only place that can, so circular imports are statically detectable and forbidden by `madge` (run in CI).

---

## 10. Testing Strategy

### 10.1 Unit tests (Vitest) — mandatory, pure-logic only

Per NFR-4/NFR-5, every pure domain function and every reducer case is unit-tested. Test files are co-located in `test/<module>/<source>.test.ts`.

**Coverage targets (binding):**
- All `domain/grid/` accessors + `GridOps.isSelectable` (FR-8).
- `WordDerivation.derive` + `Numbering.assign` against several grid shapes.
- `WordSelection.findContainingWord` for: across hit, down hit, direction mismatch, cursor outside run, empty word list, cursor at last cell of run, cursor one past run end (B1).
- `ChainCells.cellsOfWord` for: across run, down run, direction drives r/c offset. `ChainCells.cellsOfChain` for: null cursor → empty; single word with no chain; two-member chain union; cursor on non-head returns whole chain; empty words list (B2).
- `ChainValidation.validate` for each violation kind.
- `LengthPattern.forWord` for: standalone no markers; space separators; hyphen separators; mixed; chain suffixes (full FR-91).
- `LengthPattern.forActiveClueBanner` returns `null` for non-heads (C4).
- `CompletenessCheck.check` for each violation kind, plus the displaced-clue-ignored case (FR-63).
- `parsePuzzleV1` happy paths for incomplete and complete; rejection paths for every §6.3 rule including the strict `letter`-field rejection, the strict C5 non-head-with-non-empty-clue rejection, and unbalanced grid.
- `reconcileWords` — the full RISK-1 edge-case suite enumerated in §8.5. At minimum 12 cases. Each test injects a `SeededRng` so the minted `DisplacedClueId`s are deterministic.
- Every `BuilderIntent` and every `PlayerIntent`: at least one happy-path test and one guard-rejection test (e.g., `request-switch-to-design` when not blank produces a `modal-request` event, not a transition). Tests pass `deps = { rng: SeededRng, now: FakeClock }`.
- `Anagram.scramble` with a seeded RNG and a deterministic assertion.
- `reduceBuilder` for the `confirm-reset-builder` flow (key generation via `deps.rng`).
- `reducePlayer` for the `anagram-scramble` flow (scramble via `deps.rng`).
- `reduceApp` for modal confirm/cancel flow + toast fold (constructs `Toast` via `deps.rng` + `deps.now`).

**Property-based tests (optional but strongly recommended per RISK-1):** `test/builder/state/reconcileWords.property.test.ts` uses `fast-check` or a hand-rolled random-grid toggler; asserts that after any design-mode toggle, the resulting `Word[]` is consistent with the new grid (every word's start/length matches a derived white run) and `ChainValidation` finds no violations.

### 10.2 Fakes & helpers (`test/fakes/`)

- `InMemoryStoragePort` — full `StoragePort` impl over a `Map<string, string>`; throws on demand for corruption tests.
- `SeededRng` — Mulberry32 with a configurable seed.
- `FakeClock` — a manually-advanced `() => number` for deterministic `Toast.createdAt` values.
- `StubDownloadPort` — records filename + content; never touches the DOM.

Tests for reducers wire these directly; bindings-layer tests (if any) are not required, since the bindings layer is largely mechanical.

### 10.3 Manual verification (must be done before release)

The spec mandates behaviours that automated tests cannot fully cover (RISK-4):
- Mobile soft-keyboard input on iOS Safari and Android Chrome (FR-93). Verify the hidden `TypingSurface` accepts letters, doesn't zoom the layout, and handles IME/composition/Unidentified keys.
- Visual conventions (CON-4): selected-cell yellow, in-word pale yellow, space-bar/hyphen rendering, numbered-cell corner labels.
- Banner-above-and-below-grid rendering (FR-71).
- Toast placement and dismissal (FR-92, C2).

### 10.4 CI pipeline (`.github/workflows/deploy.yml` — FR-100)

The existing workflow already runs `npm run ci` before deploy. The `ci` script in `package.json` MUST be:
```
"ci": "npm run lint && npm run typecheck && npm run test && npm run build"
```
- `lint`: ESLint with the boundary rules (§9.2) + Svelte/TS recommended rules.
- `typecheck`: `tsc --noEmit` (or `svelte-check`).
- `test`: `vitest run` (no watch).
- `build`: `vite build` with `vite-plugin-singlefile`, producing `dist/index.html` with inlined JS/CSS/favicon (FR-100).
- `madge --circular src/` runs in `lint` or as its own step (§9.3).

---

## 11. Configuration & Deployment

### 11.1 Runtime configuration (injected, per the F2 principle)

A single `AppConfig` object is constructed in `main.ts` and passed (or imported) into the bindings layer:

```ts
export type AppConfig = {
  ports: { storage: StoragePort; download: DownloadPort; filePick: FilePickPort; rng: Rng };
  now: () => number;                              // clock for Toast.createdAt; production uses Date.now
  autosave: { builderDebounceMs: number; playerDebounceMs: number };
  toast: { ttlMs: number };
};
```
Production defaults:
- `builderDebounceMs: 400`, `playerDebounceMs: 400` (F2).
- `toast.ttlMs: 3500` (C2).
- `rng`: `Math.random`-backed; `now`: `Date.now`.

Tests inject an `AppConfig` with `InMemoryStoragePort`, `StubDownloadPort`, a `SeededRng`, a `FakeClock`, and tight debounce intervals (e.g., 0 ms). The bindings layer constructs `deps = { rng: config.ports.rng, now: config.now }` once and passes it to all three reducers (`reduceApp`, `reduceBuilder`, `reducePlayer`) on every dispatch (§4.2).

### 11.2 Build & deploy

- `vite-plugin-singlefile` inlines all JS/CSS into `dist/index.html`. The favicon is base64-inlined in the HTML `<head>` (an inline step in the build script, or a small Vite plugin).
- No external runtime fetches (NFR-8) — Tailwind is build-time only; no Svelte runtime fetches; no fonts beyond system stacks.
- `dist/` is the artifact uploaded as the Pages artifact (matches existing `upload-pages-artifact@v3` invocation).

### 11.3 Environment assumptions

- Node version pinned via `.nvmrc`.
- Modern evergreen browsers (desktop + iOS Safari + Android Chrome — NFR-11).
- No `import.meta.env` flags are required; the build is single-env (production only). If dev-mode conveniences (e.g., test puzzles) are wanted, gate them on `import.meta.env.DEV`.

---

## 12. Future Considerations & Extension Points

### 12.1 Extension points intentionally designed into the code

- **Persistence layer.** All persistence goes through `StoragePort` / `DownloadPort` / `FilePickPort`. Adding IndexedDB or cloud sync later means adding a new port implementation; nothing else changes.
- **Format versioning.** `parsePuzzleV1` is named with a version. Adding a v2 means adding `parsePuzzleV2` parallel to v1 and a dispatcher based on the file's `version` field.
- **Anagram RNG.** Already an injected port; a "show deterministic scramble" feature is a one-line wiring change.
- **Routing.** `AppState.route` is an enum. Adding shareable URLs later means swapping it for a hash router; nothing in reducers cares.
- **New Builder sub-modes.** `BuilderSubMode` is a discriminated union; new variants slot in with their own reducer case files (mirroring `joinSubMode.ts` / `reattachSubMode.ts`).
- **A11y pass** (RISK-5). The component structure keeps presentational components isolated; adding ARIA roles is a local change in each component. The `Modal.svelte` has the structure (backdrop, focusable buttons) but no focus trap; adding one is a contained change.

### 12.2 Anticipated future requirements (not in scope, but designed-not-to-block)

- **Undo/redo** (currently out of scope, §8). The pure-reducer + intent dispatch model is trivially amenable to an undo stack: store recent `(state, intent)` pairs and reuse the reducers in reverse isn't possible (reducers aren't reversible), but storing past `BuilderState`/`PlayerState` snapshots and popping on undo is. The strict immutability (A2) makes snapshots cheap via structural sharing.
- **Sample puzzle bundling.** Currently out of scope, but if/when added, the `puzzles/*.json` files already show the canonical v1 format; `domain/format/parsePuzzleV1` is the only entry.
- **Plugin for foreign puzzle formats** (`.puz`, `.xd`, `.jpz`). Out of scope (§8) and explicitly unsupported, but if added, it would be a sibling to `domain/format/` producing the same `Puzzle` type.

### 12.3 Things that would change under scale

The application is single-user, single-device (ASM-1) by design; "scale" is not a concern. If forced to consider:
- **Large grids.** 25x25 is the max (FR-3). `GridOps.clone` on every edit is fine at this size; if max grid size were much larger, a structural-sharing grid (e.g., row-vec immutable structure) would be needed.
- **Many puzzles in localStorage.** Per-key progress keys could grow unbounded; no GC is specified. If needed, a sweep on Player import could prune progress for keys no longer in any imported file — out of scope here.

---

## 13. Self-Review

This design was checked against the QA criteria before release.

### 13.1 Completeness checklist (vs. requirements)

Every FR is covered. Highlighted mappings of subtle ones:

| Requirement | Where covered |
|---|---|
| FR-1/FR-2 landing + nav | §4.1 `AppState.route`, §7.5 `App.svelte`/`Landing.svelte` |
| FR-3 grid bounds | §3.1 `GridSize`, §3.2 `GridOps` invariants |
| FR-5..FR-8 words/cursor/selectable | §3.3 `Word`/`WordKey`, `GridOps.isSelectable`; §8.1 `WordDerivation.derive` |
| FR-6 numbering | §8.2 `Numbering.assign` |
| FR-10..FR-15 keyboard | §4.3 Builder intents (`select-cell`, `move-cursor`, `type-letter`, `backspace`, `escape`); §4.4 Player intents; §7.4 `TypingSurface` |
| FR-12 advance-or-stay; FR-13 backspace | Intent definitions + reducer logic noted; algorithm lives in `fillMode.ts` reducer |
| FR-16..FR-22 design mode | §4.3 Builder intents (`switch-to-fill`, `request-switch-to-design`/`confirm-switch-to-design`, `toggle-design-cell`, `change-grid-size`), §8.5 reconcile |
| FR-22 blank check | §3.6 `Puzzle.isBlank` |
| FR-23 grid-change reconcile | §8.5 |
| FR-24..FR-26 fill markers | §4.3 intents, §7.2 `BuilderToolbar` |
| FR-27 marker mutual exclusion | §3.2 `CellMarker` invariant |
| FR-30..FR-32 clues panel | §3.3 `Word.clue`, §5.3 `CluePanelVM`, §7.2 `BuilderCluePanel`, §8.4 `DisplayClue`/`LengthPattern` |
| FR-33..FR-38 chains & join | §3.3 `nextWord`, §4.3 join intents, §8.6 join algorithm, §3.4 `ChainValidation` |
| FR-39..FR-44 displaced clues & reattach | §3.5 `DisplacedClue`, §4.3 reattach intents, §5.3 `DisplacedCluesPanelVM`, §8.7 reattach algorithm |
| FR-45..FR-48 reconciliation | §8.5 |
| FR-49 metadata | §3.6 `Title`/`Author`, §4.3 intents |
| FR-50/FR-51 letter semantics | §3.2 `Cell` (`answerLetter`/`playerLetter`); B4 note |
| FR-52..FR-55 confirmations | §4.1 `ModalRequest`, §4.3 `request-*`/`confirm-*` intent pairs producing `modal-request` events; §3.5a `DomainEvent` |
| FR-56..FR-60 import/export | §4.3 intent definitions; §8.9a Builder import algorithm; §8.9 Player import algorithm; §6 JSON format; G1 label rename |
| FR-61..FR-63 completeness | §3.6 `CompletenessCheck` |
| FR-64..FR-66 builder persistence | §4.5 autosave scheduling; corrupt-state recovery (NFR-9); C6 no-cursor-restore |
| FR-67..FR-69 player import | §8.9 import algorithm; §4.4 `import-puzzle` |
| FR-70..FR-73 solving + banner | §4.4 solving intents; §5.4 `ActiveClueBannerVM`; C4 banner pattern rule |
| FR-74..FR-76 check/clear | §4.4 `CheckResult`; G5 clear-on-change |
| FR-77 reset | §4.4 `request-reset-player`/`confirm-reset-player` intent pair + `clear-player-storage` event |
| FR-78..FR-80 import-new & progress | §4.4 `import-new-puzzle`; §8.9 progress-apply rules |
| FR-81..FR-89 anagram helper | §4.4 anagram intents; §8.8 algorithm; §5.4 VM |
| FR-90/FR-91 chain display | §3.4 `DisplayClue`/`LengthPattern`; C4 restriction |
| FR-92 toasts | §4.2 `Toast`; G4 toasts-as-state |
| FR-93 mobile typing | §7.4 `TypingSurface` |
| FR-94..FR-99 + FR-98a JSON | §6, §3.7 |
| FR-100 build/deploy | §9, §10.4, §11.2 |
| NFR-1–NFR-12 | §1.1 (immutability/purity), §10 (tests), §11 (build), §12 (a11y thread) |
| CON-1..CON-5 | §1.1 (stack decisions), §7.1 (CON-4 tokens), §11.2 (single-file build) |

### 13.2 Quality checks

- **Completeness.** Every FR/NFR has an explicit home in the design; a builder can implement each module without further architectural decisions.
- **Consistency.** The "Save → Export Incomplete" rename (G1) is reflected everywhere (§1.1, §4.3, §7.2). The C4 deviation (banner null pattern for non-heads) is reflected in §3.4, §5.4, §8.4, §13.1 — single source. The C5 strict rule (non-head clue) is enforced at parse (§3.7, §6.3) and reflected in the runtime invariant (§3.3 Word). No contradictions detected.
- **Maintainability.** Single responsibility per module (e.g., `joinSubMode.ts` owns only join logic). Boundary enforced by lint (§9.2). No business logic in components (§5.5). Reducers are pure and testable.
- **Simplicity.** No router library; no Immer; no component test harness required; no state library; in-app enum routing. The `domain/` purity constraint is rigorously scoped but does not preclude the few practical VM derivations in `ui/bindings/`.
- **Clarity.** Every type, VM, intent, reducer, and algorithm is named and its responsibility stated. The decisions log (§1.1) cites the round-0 question that produced each non-default decision.

### 13.3 Adjustments made during self-review

- Replaced the earlier `pendingDownload` / `pendingIntent` / `pendingToasts` + `force` scratch-field pattern with an explicit `events[]` return-value from every reducer, folded by `reduceApp` for state-affecting events and passed through to the bindings layer for external side effects. Eliminates the "refusing reducer" anti-pattern (which a designer review correctly called out as hacky).
- Added a separate `app/state/` reducer module so `reduceApp` (the only reducer that sees all of `AppState`) can live outside `ui/bindings/`. This keeps `ui/bindings/` purely about Svelte/rune wiring and side-effect performance, not state-altering logic.
- Renamed the originally-proposed `domain/ui/` folder to `domain/notifications/` to avoid the conceptual oxymoron ("UI" has no business in a domain path) while keeping its pure value objects in the right layer.
- Replaced guarded-intent variants (`select-mode`, `import-puzzle`, `reset`) with strict `request-*`/`confirm-*` pairs: `request-*` checks the guard and emits a `modal-request` event; `confirm-*` executes unconditionally and is dispatched by the modal's Confirm button. Each intent variant has exactly one behaviour; no recursion; no refusal.
- `PuzzleKey.generate`, `Anagram.scramble`, `DisplacedClueId.generate`, and `Toast.create` all take their rng/now as an explicit `deps` argument passed uniformly to all three reducers (`reduceApp` / `reduceBuilder` / `reducePlayer`), preserving the F2 "inject as a config value" principle. No reducer calls global `Math.random` or `Date.now`. Most reducer cases ignore `deps`; the few that need it (design-mode toggle for `DisplacedClueId`, `confirm-reset-builder` for `PuzzleKey`, `anagram-scramble`, and `reduceApp`'s toast fold) read `deps` explicitly.
- Moved `DisplacedClue` ownership from `Puzzle` to `BuilderState` (S1) to match the spec's "Builder-only concept" declaration; serialization adapter now takes displaced clues as a separate argument to `serializeIncomplete`.
- Kept both `lastImportError` (for inline `ImportScreen` rendering) and a `toast` event (for transient notification); an earlier draft had dropped one of them redundantly.
- Added the `madge --circular` step to CI (§9.3, §10.4) after recognizing that the bindings layer's blanket import rights could invite a cycle.
- Reconfirmed the parser's strictness on unknown fields (a `letter` field is rejected, not normalized) so the builder knows the strict path is intentional, not a bug (§3.7, §6.3). The `puzzles/*.json` samples are canonical v1 (`puzzleLetter`, `version: 1`); no migration script is shipped.
- Added `viewmodels/` subdirectory under `ui/bindings/` to keep VM derivation files organized; the original E1 tree showed only stores at that level.
- Fixed several inconsistencies and typos (the "DisposedClue" typo, an inconsistent `confirm-import` vs `confirm-import-builder` modal kind, a stale "select-mode" reference in toolbar emissions, an indented `①` glyph, etc.).

### 13.4 Open items for builder to confirm at implementation start

None architecture-blocking. Optional implementation choices left to the builder:
- `$derived` vs explicit function for VM derivation — pick consistently within `ui/bindings/`.
- Whether to use `svelte-preprocess`-style class maps or plain string concat for tailwind class composition (no architectural impact).
- Whether the parser returns a `ParseFailure[]` array or a single concatenated string — the spec (FR-99) only requires the user-facing error be a single message; the builder may join internally.

---

**End of design.**