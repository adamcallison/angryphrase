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
| **Pure-reducer + intent dispatch** (from A1) | All state transitions are pure functions `reduce(state, intent) -> state`. Maximizes testability (NFR-4), makes the closed set of allowed actions compiler-enumerable, and puts "simple domain objects" literally across the UI↔logic boundary (Principle 1). |
| **Strict immutability** (from A2) | Reducers never mutate inputs. A tiny `clone` helper handles the few deep structures (grid). No Immer dependency (single-file build stays small). |
| **In-app mode enum routing** (from A3) | `route: 'landing' \| 'build' \| 'play'` lives in `AppState`. No router library; no SSR concerns. Matches FR-1 (always show landing on load) and the single-file deployment. |
| **Aggressive branded types** (from B1) | A `brand<Tag, Primitive>` utility produces nominal `Row`, `Col`, `Letter`, `PuzzleKey`, `GridSize`, `WordNumber`, `DisplacedClueId`, `ToastId`, `CellIndex` types. Range-checked constructors make illegal values unconstructable at the boundary. |
| **Composite `WordKey`** (from B2) | `WordKey = { startRow, startCol, direction }`. Matches FR-33/FR-45 exactly; `nextWord: WordKey \| null`. Displaced clues keep a `DisplacedClueId` because they have no positional handle. A canonical string form keys a `WordMap` for O(1) lookup. |
| **2D `Cell[][]` grid + typed `GridOps`** (from B3) | Mirrors JSON; raw indexing forbidden outside `GridOps`. |
| **`answerLetter`/`playerLetter` runtime naming** (from B4) | The string `"letter"` never appears in the runtime model. Serialization adapter maps `answerLetter ↔ puzzleLetter` at the JSON boundary only. |
| **`Direction` as `'across' \| 'down'`** (from B5) | Matches FR-96; helpers in a `Direction` module. |
| **Vitest, pure-logic tests** (from D2) | Unit tests cover all pure domain logic. No DOM/component test harness required by spec; visual + mobile keyboard behaviour verified manually (RISK-4). |
| **View-models in / Intents out** (from E2) | Components receive plain typed view-models produced in `ui/bindings`. Components emit typed intents. The bindings layer owns the runes store, dispatch, debounced persistence, and view-model derivation. Components contain no business logic and no domain-function calls. |
| **`converted-puzzles/` directory** (from B6) | Existing `puzzles/*.json` files are non-conforming to the format (use `letter` not `puzzleLetter`, lack `version` and `type`). A migration script produces `converted-puzzles/*.json` in the current format. Neither the app nor the test suite references either directory; the converted files exist purely as a record. |
| **Injected RNG for anagram scramble** (from D1) | `scramble(word, input, rng)` takes an `Rng` interface; production wires `Math.random`; tests inject a seeded RNG. |
| **No cursor persistence across reload** (from C6) | Builder state autosaves everything *except* the cursor. On reload, cursor is `null`. Less code, matches your preference. |
| **Strict non-head clue rejection** (from C5) | A complete-file import with a non-empty `clue` field on a non-head chain word is invalid (clear error, no silent normalization). |
| **Displaced Clues panel always visible** (from C1) | Empty state is shown explicitly ("No displaced clues") for UI consistency. |
| **`Export Incomplete` / `Export Complete` button labels** (from G1) | The FR-58 download action is labeled "Export Incomplete" (was "Save" in the requirements doc). FR-59's action remains "Export Complete". This is a deliberate, AX-approved deviation from the requirements text; the underlying behaviour is unchanged. |
| **Toasts as state** (from G4) | Toasts are part of `AppState` (`toasts: Toast[]`), emitted by reducers and cleared by intent. No imperative side-channel. |
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
                            └─────────────────────────────────────────────────┘
                                              ▲ intents
                                              │ view-models
              ┌───────────────────────────────┴──────────────────────────────┐
              │                    ui/bindings (the seam)                    │
              │  - runes store ($state)                                        │
              │  - dispatch(intent) → reduceApp/Builder/Player                │
              │  - debounced persistence scheduling                            │
              │  - view-model derivation (state → leaf-shaped VMs)           │
              │  - RNG + ports injected here at app boot                       │
              └────────────────┬───────────────────────────────┬─────────────┘
                              │                                 │
                              ▼                                 ▼
       ┌──────────────────────────────────┐         ┌──────────────────────────────┐
       │        Svelte components         │         │         Reducers             │
       │  (ui/app, ui/builder, ui/player, │         │  reduceApp, reduceBuilder,  │
       │   ui/shared)                     │ intents │  reducePlayer — pure         │
       │  pure presentational; no logic   │────────▶│  (state, intent) -> state    │
       └──────────────────────────────────┘         └──────────────┬───────────────┘
                                                                   │ calls
                                                                   ▼
       ┌─────────────────────────────────────────────────────────────────────────┐
       │                              domain/                                    │
       │  grid/  word/  letter/  chain/  anagram/  puzzle/  persistence/  format/ │
       │  - pure TS, zero framework imports, no Svelte, no DOM                   │
       │  - immutable value objects, branded types, pure functions               │
       └─────────────────────────────────────────────────────────────────────────┘
                                                                   │ uses (interfaces)
                                                                   ▼
       ┌─────────────────────────────────────────────────────────────────────────┐
       │                              ports/                                     │
       │  localStoragePort, downloadPort, filePickPort, rngPort                  │
       │  - implementations of domain/persistence interfaces                      │
       │  - side-effectful; swappable in tests                                   │
       └─────────────────────────────────────────────────────────────────────────┘
```

The boundary enforced by tooling: **`domain/`, `builder/state/`, `player/state/` MUST NOT import Svelte, DOM APIs, or `ports/`.** A lint rule (ESLint `no-restricted-imports`) blocks this. The bindings layer is the *only* place that wires ports to reducers and reducers to Svelte runes.

---

## 2. Architecture

### 2.1 Layers and responsibilities

**Layer 0 — `domain/` (pure, framework-free).**
Owns the entire domain model: value objects, branded types, pure functions, and port *interfaces*. This is where word derivation, numbering, chain traversal/validation, reconciliation, length-pattern derivation, display-clue derivation, anagram scramble, completeness check, and JSON parse/validate all live. May import only from itself and from TS's standard library. Components in this layer:

| Module | Owns |
|---|---|
| `domain/grid/` | `GridSize` (2..25), `Row`, `Col`, `Cell`, `CellMarker`, `CellMarkerFlag`, `Grid` (`Cell[][]`), `GridOps` (typed accessors), `CellIndex`. |
| `domain/word/` | `Word`, `WordKey`, `Direction` and its helpers, `WordDerivation` (scan grid → words), `Numbering` (assign word numbers per FR-6), `WordMap`. |
| `domain/letter/` | `Letter` brand + parsing/validation (`Letter.try(ch)`), case-folding rules (FR-51). |
| `domain/chain/` | `Chain` traversal, `ChainValidation` (cycles/branches/dangling/self-ref per FR-98), `DisplayClue` (FR-90), `LengthPattern` (FR-91, full suffix rule implemented and unit-tested). |
| `domain/anagram/` | `TileRow` model, `AnagramInput` validation (FR-85), `scramble` (FR-86). |
| `domain/puzzle/` | `Puzzle` aggregate (grid + words + title + author + key), `PuzzleKey` (UUID brand), `Title`, `Author`, `CompletenessCheck` (FR-61/FR-62). |
| `domain/format/` | `v1` JSON parse + validate, both incomplete and complete (FR-94 to FR-99), strict non-head-clue rejection (C5). Produces `Puzzle` or a `ParseError[]`. |
| `domain/persistence/` | Port *interfaces* only: `StoragePort`, `DownloadPort`, `FilePickPort`, `Rng`. No implementations. |

**Layer 1 — `builder/state/` and `player/state/` (pure reducers).**
Owns the reducer functions and the `Intent` discriminated unions for each experience, plus the per-experience `State` value objects. Pure; may import `domain/` only. No Svelte, no DOM, no ports. Components:

| Module | Owns |
|---|---|
| `builder/state/intents.ts` | `BuilderIntent` discriminated union |
| `builder/state/state.ts` | `BuilderState`, `BuilderMode`, `BuilderSubMode`, `Cursor`, blank-state factory |
| `builder/state/reducer.ts` | `reduceBuilder(state, intent): BuilderState` — single reducer dispatching to per-mode helpers |
| `builder/state/designMode.ts` | Design-mode intents (toggle, change size) + reconciliation orchestration (FR-23, FR-45..FR-48) |
| `builder/state/fillMode.ts` | Fill-mode intents (letter typing, markers, clue edits, metadata, cursor rules) |
| `builder/state/joinSubMode.ts` | Join sub-mode intents (FR-34..FR-38) |
| `builder/state/reattachSubMode.ts` | Reattach sub-mode intents (FR-41..FR-44) |
| `builder/state/importExport.ts` | Import/export intents (parse → validate → replace → mode=fill; export incomplete/complete) |
| `builder/state/toasts.ts` | Toast-request helpers (reducers produce `Toast[]` as part of state) |
| `player/state/intents.ts` | `PlayerIntent` discriminated union |
| `player/state/state.ts` | `PlayerState`, `CheckResult`, `CheckClassification`, `AnagramModalState`, blank/error-state factories |
| `player/state/reducer.ts` | `reducePlayer(state, intent): PlayerState` |
| `player/state/solving.ts` | Solving intents (type, backspace, arrows, click, check, clear-errors, reset) |
| `player/state/anagram.ts` | Anagram modal intents (FR-81..FR-89) including auto-close on selection change |

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
Implements `domain/persistence` interfaces. Each is a small adapter over a browser API; each is replaceable with an in-memory fake for tests.

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
- **logic → ports:** reducers emit *persistence intents* ("schedule autosave with this blob"), expressed as data in state. The bindings layer observes and invokes the port. Reducers never call ports directly. This keeps pure-logic tests port-free.
- **toasts:** reducers append `Toast` records to `AppState.toasts`. The bindings layer forwards them to the toast host and schedules their dismissal intents. No imperative `showToast()` call from a reducer.
- **modals (confirmations):** reducers set `AppState.modal: ModalRequest | null` with a kind (`'confirm-design-switch' | 'confirm-import' | 'confirm-reset-builder' | 'confirm-reset-player'`). The bindings layer renders the modal via `Modal.svelte`; the user's confirm/cancel becomes a confirmation intent that resumes the deferred action.

### 2.3 Boundary definitions

| Boundary | What crosses | How |
|---|---|---|
| Component ↔ bindings | View-models (in), Intents (out) | `$props()` in, `dispatch()` out |
| Bindings ↔ reducers | `State` + `Intent` (in), `State` (out) | Plain function calls; pure |
| Reducers ↔ domain | Domain value objects and pure-function calls | Direct TS imports |
| Reducers ↔ ports | Ports are **not** called from reducers; persistence happens in the bindings layer by observing state changes | Indirect — via state signals |
| Domain ↔ format/parse | `Puzzle` domain objects (out), JSON-shaped plain objects (in) | Adapter functions in `domain/format/` |
| App ↔ outside world | Puzzle JSON files (file system); state blobs (`localStorage`) | `FilePickPort`, `DownloadPort`, `StoragePort` only |

The ESLint `no-restricted-imports` rule mentioned in §1.2 enforces that `domain/`, `builder/state/`, and `player/state/` cannot import `svelte`, `svelte/*`, anything under `ui/`, anything under `ports/`, or any DOM-global-using module. A unit test verifies the boundary by attempting adversarial imports in a fixture file and asserting they fail to compile.

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
  generate(): PuzzleKey;                                   // uses injected Rng
  try(s: string): PuzzleKey | null;
};

// domain/word/WordNumber.ts
export type WordNumber = number & { __brand: 'WordNumber' }; // ≥ 1

// domain/builder/DisplacedClueId.ts
export type DisplacedClueId = string & { __brand: 'DisplacedClueId' };
export const DisplacedClueId: { generate(): DisplacedClueId };

// domain/ui/ToastId.ts
export type ToastId = string & { __brand: 'ToastId' };
export const ToastId: { generate(): ToastId };
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

// Grid is a 2D array (B3) but indexed only through GridOps
export type Grid = Cell[][];                                // outer = Row, inner = Col
export const GridOps: {
  blank(size: GridSize): Grid;                              // FR-19 all-white empty grid
  cellAt(g: Grid, row: Row, col: Col): Cell;
  setCell(g: Grid, row: Row, col: Col, c: Cell): Grid;      // returns new grid (immutability)
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
export const Word: {
  startsAt(key: WordKey): boolean;
};

export type WordMap = ReadonlyMap<string, Word>;            // keyed by WordKey.toCanonical
export const WordMap: {
  fromWords(ws: Word[]): WordMap;
  get(m: WordMap, k: WordKey): Word | undefined;
  has(m: WordMap, k: WordKey): boolean;
  set(m: WordMap, w: Word): WordMap;                        // returns new map (immutability)
  remove(m: WordMap, k: WordKey): WordMap;
};

// Pure functions
export const WordDerivation: {
  derive(grid: Grid): Word[];                               // FR-5: scan rows & cols for length-≥2 white runs
};

export const Numbering: {
  assign(grid: Grid, words: Word[]): Word[];                // FR-6: L-R, T-B; a cell gets the next int if it starts an across and/or down word
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
  create(clue: string, direction: Direction): DisplacedClue;
  withText(d: DisplacedClue, clue: string): DisplacedClue;
};
```

**Invariants — `DisplacedClue`:**
- No positional information. The `id` is the only stable handle (FR-39, FR-97).
- Order in the panel follows insertion order; deleting one adjusts reattach indices (FR-44). The reducer carries an array `DisplacedClue[]`.

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
  // incomplete format only:
  displacedClues?: DisposedClue[];                           // absent on complete-file imports; the field is omitted, not null
};
export const Puzzle: {
  blank(size: GridSize, key: PuzzleKey): Puzzle;             // FR-19
  isBlank(p: Puzzle): boolean;                               // FR-22 / FR-53: no answer letters, no clues, no chains, no displaced clues
  withGrid(p: Puzzle, g: Grid): Puzzle;                      // returns new Puzzle
  withWords(p: Puzzle, ws: Word[]): Puzzle;
  withMetadata(p: Puzzle, title: Title, author: Author): Puzzle;
};

// Completeness — FR-61, FR-62
export type CompletenessViolation =
  | { kind: 'missing-answer-letter'; row: Row; col: Col }
  | { kind: 'invalid-answer-letter'; row: Row; col: Col; value: string }
  | { kind: 'missing-clue'; wordNumber: WordNumber; direction: Direction };

export const CompletenessCheck: {
  check(p: Puzzle): CompletenessViolation[];
  isComplete(p: Puzzle): boolean;                           // === check(p).length === 0
};
```

**Invariants — `Puzzle`:**
- `grid.length === gridSize`; every row has length `gridSize`.
- Every `Word` in `words` corresponds to a maximal white run actually present in `grid` (re-derived on every change, validated on load per FR-98a).
- `displacedClues` is absent for the complete format; present (possibly empty) for the incomplete format.
- Displaced clues never block completeness (FR-63); `CompletenessCheck.check` does not consult `displacedClues`.

### 3.7 Persistence & format (`domain/persistence/`, `domain/format/`)

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
  download(filename: string, content: string): void;
}
export interface FilePickPort {
  pickFile(): Promise<string | null>;                 // returns file text or null if cancelled
}
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

// Returns either a valid Puzzle or a list of failures.
export const parsePuzzleV1(json: string): { ok: true; puzzle: Puzzle } | { ok: false; failures: ParseFailure[] };

// Serialize — to be used by Builder export only, in the bindings layer
export const serializeIncomplete(p: Puzzle): string;
export const serializeComplete(p: Puzzle): string;     // omit displacedClues (FR-59)

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
- `puzzleLetter` is the only accepted answer-letter field name (FR-95). A field named `letter` is *not* a fallback; the parser rejects files that use `letter` (treated as an unknown extra field — failed strictly). ① See "①" note below for the converted-puzzles migration path.
- Word positions within bounds; `length ≥ 2`; `nextWord` (if present) points to an existing word; no cycles, branches, dangling refs, self-refs (FR-98 + `ChainValidation`).
- **Complete format:** every white cell has a non-null A–Z `puzzleLetter` (FR-61). Every chain-head word has a non-empty non-whitespace clue (FR-62). **Strict C5 rule:** a non-head chain word with a non-empty `clue` field is a validation failure (not silently normalized).
- **Incomplete format:** `puzzleLetter` may be `null`; clues may be empty; `displacedClues` field is a `DisplacedClue[]` (FR-97). Extra fields not in the schema cause validation failure (strict).
- On success, `word.number` is overwritten by the re-derived value (FR-98a), and `word.length` is cross-checked against the grid-derived value (a mismatch is a validation failure).
- `playerLetter` is never present in JSON; `null` is implied at runtime (FR-99).

**`①` Migration note for the existing `puzzles/*.json` files:** they use `letter` and lack `version`/`type`, so they fail the strict parser. They are *not* fixtures; the app never reads them. A one-shot migration script (`scripts/migrate-puzzles.ts`, run manually) rewrites each into `converted-puzzles/puzzleN-incomplete.json` (renaming `letter → puzzleLetter`, adding `version: 1`, `type: 'incomplete'`, generating fresh `key`s, adding `displacedClues: []`). The `converted-puzzles/` directory is committed for the record but is referenced by neither the app nor the test suite (per B6).

---

## 4. State Model & Reducers

All types in this section live in `builder/state/` and `player/state/`. They import only `domain/`. Reducers are pure functions: `(state, intent) -> state`. State objects are immutable; transitions return new state values (B2 immutability discipline).

### 4.1 App-level state

```ts
// ui/bindings/appStore.svelte.ts
export type AppState = {
  route: 'landing' | 'build' | 'play';                       // A3
  builder: BuilderState;
  player: PlayerState;
  toasts: Toast[];                                            // G4: toasts as state
  modal: ModalRequest | null;                                 // G4: confirmations as state
};

export type ModalRequest =
  | { kind: 'confirm-design-switch' }                         // FR-53
  | { kind: 'confirm-import-builder' }                       // FR-54
  | { kind: 'confirm-reset-builder' }                        // FR-55
  | { kind: 'confirm-reset-player' };                         // FR-77

export type AppIntent =
  | { kind: 'navigate'; route: 'landing' | 'build' | 'play' }
  | { kind: 'confirm-modal' }                                 // user clicked Confirm
  | { kind: 'cancel-modal' };                                  // user clicked Cancel / Escape

export function reduceApp(state: AppState, intent: AppIntent): AppState;
```

The bindings layer dispatches `AppIntent`s directly; builder/player intents are wrapped and forwarded. The modal field carries the *deferred action id* stored in state (see §4.4).

### 4.2 Toasts (`domain/ui/Toast.ts`)

```ts
export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export type Toast = {
  id: ToastId;
  kind: ToastKind;
  message: string;
  createdAt: number;                                          // epoch ms
  ttlMs: number;                                              // C2 default 3500
};
export const Toast: { create(kind: ToastKind, message: string, ttlMs?: number): Toast };
```

Toasts are appended by reducers (e.g., reconciliation warnings FR-45/FR-46, invalid join FR-35, reattach block FR-42) and removed either by a `dismiss-toast` intent (raised by the toast timeout in the bindings layer or by user click). Reducers do not schedule timeouts; the bindings layer does.

### 4.3 Builder state and intents

```ts
// builder/state/state.ts
export type Cursor = {
  row: Row;
  col: Col;
  direction: Direction;
} | null;                                                     // FR-7: null = no selection; C6: not persisted across reload

export type BuilderMode = 'design' | 'fill';                  // FR-16
export type BuilderSubMode =
  | { kind: 'none' }
  | { kind: 'join'; source: WordKey }                          // FR-34
  | { kind: 'reattach'; displacedClueId: DisplacedClueId };   // FR-41

export type BuilderState = {
  puzzle: Puzzle;                                             // includes grid, words, title, author, key
  displacedClues: DisplacedClue[];                            // FR-39
  mode: BuilderMode;
  subMode: BuilderSubMode;
  cursor: Cursor;
  // persistence bookkeeping (not persisted):
  dirty: boolean;                                             // true whenever state has changed since last autosave
  lastSavedAt: number | null;
};

export const BuilderState: {
  blank(size: GridSize, key: PuzzleKey): BuilderState;        // FR-19
  isBlank(s: BuilderState): boolean;                          // FR-53 / FR-54 / FR-22 work-detector
};
```

```ts
// builder/state/intents.ts
export type BuilderIntent =
  // navigation & mode
  | { kind: 'select-mode'; mode: BuilderMode }                // FR-16; guarded for design-switch (FR-53)
  // design
  | { kind: 'toggle-design-cell'; row: Row; col: Col }        // FR-20; clears cursor (FR-21); triggers reconcile (FR-23)
  | { kind: 'change-grid-size'; size: GridSize }              // FR-22; only when blank
  // fill — cell selection & cursor
  | { kind: 'select-cell'; row: Row; col: Col }               // FR-10, FR-11
  | { kind: 'move-cursor'; direction: Direction }            // FR-14 arrow keys
  // fill — typing
  | { kind: 'type-letter'; letter: Letter }                   // FR-12; writes answerLetter; advances (or stays)
  | { kind: 'backspace' }                                      // FR-13
  // fill — markers
  | { kind: 'toggle-marker'; flag: CellMarkerFlag }           // FR-26, FR-27
  // fill — clues
  | { kind: 'edit-clue'; wordKey: WordKey; clue: string }     // FR-30; only chain heads (FR-31); C5 enforced
  // fill — chains
  | { kind: 'begin-join'; source: WordKey }                   // FR-34
  | { kind: 'click-clue-panel-word'; wordKey: WordKey }        // FR-32 navigation, OR join target (FR-34), OR reattach target (FR-41) depending on subMode
  | { kind: 'click-grid-word'; wordKey: WordKey }             // FR-32 alternative when clicking grid; same polysemous dispatch
  | { kind: 'unjoin'; source: WordKey }                       // FR-37
  | { kind: 'escape' }                                         // FR-15; cancels join/reattach sub-mode
  // displaced clues
  | { kind: 'begin-reattach'; displacedClueId: DisplacedClueId }// FR-41
  | { kind: 'delete-displaced-clue'; id: DisplacedClueId }    // FR-40, FR-44
  // metadata
  | { kind: 'edit-title'; title: Title }
  | { kind: 'edit-author'; author: Author }
  // import / export
  | { kind: 'import-puzzle'; fileContent: string }            // FR-56; requires confirm if not blank (FR-54); on success → mode=fill, clean cursor
  | { kind: 'export-incomplete' }                              // FR-58 (label "Export Incomplete" per G1); always available
  | { kind: 'export-complete' }                                // FR-59; reducer checks completeness; on failure emits Toast + detail
  // lifecycle
  | { kind: 'reset' };                                         // FR-55; requires confirm (FR-77? no — FR-55)
```

**Polysemous `click-clue-panel-word` / `click-grid-word` intent:** its effect depends on `state.subMode`. The reducer branches:

- `subMode = none` → navigate cursor to `wordKey.startCell`, set direction, focus typing surface (bindings handles focus).
- `subMode = join { source }` → attempt join; validity FR-35; on success sets `source.nextWord`, displaces target's non-empty clue (FR-36); on failure emits Toast and leaves sub-mode active.
- `subMode = reattach { displacedClueId }` → attempt reattach; validity FR-42 (target exists, empty clue, chain head); on success moves text, removes displaced clue; on failure emits Toast.

**`select-mode { mode: 'design' }` guard:** if `BuilderState.isBlank(state)` is false, reducer returns state unchanged *plus* `modal: { kind: 'confirm-design-switch' }` (pending action id stored at app level). Only after `confirm-modal` does the bindings layer dispatch a (synthetic) `select-mode` intent again, this time with a flag bypassing the guard. The pattern is identical for `confirm-import-builder` and `confirm-reset-builder`.

**`export-incomplete` and `export-complete`:** these intents do *not* mutate the puzzle; they signal the bindings layer to call `DownloadPort`. The reducer's only job is to construct the file payload (via `serializeIncomplete`/`serializeComplete`) and return it as part of state (`pendingDownload: { filename, content } | null`). The bindings layer observes, calls the port, then dispatches `clear-pending-download`. For `export-complete`, the reducer first runs `CompletenessCheck`; on failure it appends error toasts and does not set a pending download.

### 4.4 Player state and intents

```ts
// player/state/state.ts
export type PlayerState =
  | { phase: 'import' }                                        // awaiting puzzle file (FR-67)
  | { phase: 'solving'; puzzle: Puzzle; cursor: Cursor; checkResult: CheckResult | null; anagram: AnagramModalState | null; lastImportError: string | null };

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
  scrambledArrangement: Letter[] | null;                      // null until first Scramble (FR-86)
};

export const PlayerState: {
  importScreen(): PlayerState;
  loaded(p: Puzzle): PlayerState;
};
```

```ts
// player/state/intents.ts
export type PlayerIntent =
  // import
  | { kind: 'import-puzzle'; fileContent: string }            // FR-67; complete format only; reject others; apply saved progress (FR-69, FR-80)
  | { kind: 'import-new-puzzle' }                             // FR-78
  // solving — cell & cursor
  | { kind: 'select-cell'; row: Row; col: Col }
  | { kind: 'move-cursor'; direction: Direction }
  | { kind: 'type-letter'; letter: Letter }
  | { kind: 'backspace' }
  | { kind: 'escape' }
  | { kind: 'click-clue-panel-word'; wordKey: WordKey }
  // checking
  | { kind: 'check' }                                         // FR-74; sets checkResult; clears on grid change (FR-76, G5)
  | { kind: 'clear-errors' }                                  // FR-75; only valid when checkResult has incorrectCells
  // lifecycle
  | { kind: 'reset'; confirmationToken?: true }               // FR-77; requires modal unless token present (same deferred-action pattern as Builder)
  // anagram
  | { kind: 'open-anagram-helper' }
  | { kind: 'close-anagram-helper' }                          // FR-89
  | { kind: 'anagram-input'; input: string }                  // FR-83
  | { kind: 'anagram-scramble' }                              // FR-86; uses injected Rng (D1)
  ;
```

**`check` clear-on-change:** every intent that mutates `puzzle.grid`, `cursor`, or replaces the puzzle sets `checkResult = null` first thing in its reducer case. A small helper `withGridClear(state, grid)` standardizes this.

**`open-anagram-helper`:** requires `cursor != null` and the cursor's cell to belong to a word. Computes the word from the cursor/direction and stores `openedForWord`. If the cursor changes such that the new selected word's `WordKey` differs from `openedForWord`, every cell/click/arrow reducer closes the anagram modal (`anagram = null`) — implementing FR-88.

**`anagram-scramble`:** uses the *injected* `Rng` (wired in the bindings layer at app boot, per D1). The reducer is pure given the RNG; the bindings layer injects `Math.random`-backed `Rng` in production and seeded Mulberry32 in tests.

### 4.5 Persistence & autosave scheduling

Reducers never call ports. Persistence is the bindings layer's responsibility:

```ts
// ui/bindings/persistenceScheduler.ts
export function scheduleBuilderAutosave(state: BuilderState, port: StoragePort, debounceMs: number): void;
export function schedulePlayerAutosave(state: PlayerState, port: StoragePort, debounceMs: number): void;
```

The bindings layer observes state changes via `$derived` or `$effect` and:
- For Builder: whenever `state.builder` changes, debounces (configurable, default 400 ms per F2) and calls `port.saveBuilder(serializedBlob)`.
- For Player: whenever `state.player.puzzle` and `state.player.cursor`/`checkResult` change, debounces and calls `port.savePlayerProgress(key, blob)`. The serialized blob includes the grid of player letters and the `gridSize` (FR-79, FR-80).
- Reset intents call `port.clearBuilder()` / `port.clearPlayerProgress(key)` synchronously.

The serialization format for the persisted Builder blob is *not* the incomplete puzzle JSON; it's a fuller snapshot (mode, subMode=no on restore per FR-64, cursor=null per C6, the puzzle, displaced clues, title, author). The schema:
```ts
{ version: 1, kind: 'builder-snapshot', puzzle: <incomplete puzzle JSON>, displacedClues: [...], mode, title, author, key }
```
Player progress blob: `{ version: 1, kind: 'player-progress', key, gridSize, playerLetters: (Letter|null)[][] }`.

**Corrupt-state recovery (NFR-9):** if deserialization fails on load, the bindings layer throws away the blob and starts fresh (Builder: blank puzzle per FR-19; Player: import screen). The recoverer does not raise a toast (silent), though a console warning is acceptable.

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
export type CellHilite = 'none' | 'selected' | 'in-word' | 'correct' | 'incorrect' | 'empty-flagged';
// selected: yellow bg (CON-4); in-word: pale yellow; correct/incorrect: only after Check (Player)
export type CellSeparator = 'none' | 'space' | 'hyphen';     // rendered right/below the cell per marker flags

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
  cursor: { row: Row; col: Col; direction: Direction } | null;
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
  lengthPattern: LengthPattern | null;                       // FR-91 suffix-from-here; null for non-heads (FR-73)
  isChainHead: boolean;
  hasOutgoingNextWord: boolean;
  isSelected: boolean;                                       // matches cursor
  // builder-only affordances
  isStartableJoinSource: boolean;                            // has no outgoing nextWord; not already pointed to
  isLinkableFromJoinSource: boolean;                         // join sub-mode active, this word can be target
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
  letter: string | null;                                      // fixed: grid letter; else: from scrambledArrangement or input pool
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
11. `displacedClues` (incomplete only): array of `{ id, clue, direction }`; each `id` is a unique string; `direction ∈ {'across', 'down'}`.

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

The architect defers fine spacing/typography choices to the implementer; the colour conventions above are fixed.

### 7.2 Component inventory (Builder)

| Component | Props (VM) | Emits intents | Notes |
|---|---|---|---|
| `BuilderShell.svelte` | `BuilderShellVM` | (composes children) | Lays out toolbar + grid + clue panel + displaced panel; renders `JoinReattachBanner` when sub-mode active. Layout per CON-4: grid+controls left, clues right. |
| `BuilderToolbar.svelte` | `BuilderToolbarVM` | `select-mode`, `change-grid-size`, `toggle-marker`, `import-puzzle` (via FilePicker), `export-incomplete`, `export-complete`, `reset`, `edit-title`, `edit-author` | Shows Design/Fill toggle (FR-16); grid-size control (FR-22, C3 numeric input clamp-on-blur); markers toolbar (FR-26) disabled when no cell; Export Incomplete always available; Export Complete enabled iff `canExportComplete` (FR-63). |
| `GridSizeControl.svelte` | min/max/value/disabled | `change-grid-size` | `<input type="number" min=2 max=25 step=1>`; clamps on blur. Disabled+explanatory text when grid not blank. |
| `BuilderGrid.svelte` | `GridVM` + cell-selected flag | `select-cell`, `toggle-design-cell` (in design mode), `click-grid-word` | Renders the grid; in Design mode clicks toggle; in Fill mode clicks select. Markers render as bars/hyphens per separators. Number rendered corner. Uses `TypingSurface` for input. |
| `BuilderCluePanel.svelte` | `CluePanelVM` | `click-clue-panel-word`, `begin-join`, `unjoin`, `edit-clue` | Two sections Across/Down sorted by number (FR-32). Chain heads have an editable text input (FR-31); non-heads show "See N Direction" reference, no input. Per-clue "Link next" / "Unlink" controls (FR-38) when relevant. Scrolls the highlighted clue into view (FR-32). |
| `DisplacedCluesPanel.svelte` | `DisplacedCluesPanelVM` | `begin-reattach`, `delete-displaced-clue` | Always rendered (C1). Empty state shows "No displaced clues". Per-entry "Reattach" / "Delete" controls (FR-40). |
| `JoinReattachBanner.svelte` | `BuilderSubModeBannerVM` | `escape` | Instructional banner (FR-34, FR-41); visible in join & reattach sub-modes; Escape cancels. |

### 7.3 Component inventory (Player)

| Component | Props (VM) | Emits intents | Notes |
|---|---|---|---|
| `PlayerShell.svelte` | `PlayerShellVM` | (composes children) | Switches between ImportScreen and solving layout per `phase`. Solving layout: top-banner, grid, bottom-banner (FR-71), clue panel side, toolbar. |
| `ImportScreen.svelte` | `importError` | `import-puzzle` (via FilePicker) | Drag-and-drop or file picker (FR-67). On reject shows `importError`. |
| `PlayerGrid.svelte` | `GridVM` | `select-cell`, `move-cursor`, `type-letter`, `backspace`, `escape`, `click-grid-word` | Same grid component shape as Builder; check result paints incorrect/correct cells. |
| `ActiveClueBanner.svelte` | `ActiveClueBannerVM` | (none) | Rendered twice: above and below grid (FR-71). Always reserves space (FR-71). |
| `PlayerCluePanel.svelte` | `PlayerCluePanelVM` | `click-clue-panel-word` | Same shape as Builder but no edit inputs; just display + navigation (FR-73). |
| `PlayerToolbar.svelte` | `PlayerToolbarVM` | `check`, `clear-errors`, `reset`, `import-new-puzzle`, `open-anagram-helper` | Check shows result message + colour (FR-75). Reset triggers modal (FR-77). |
| `AnagramModal.svelte` | `AnagramModalVM` | `anagram-input`, `anagram-scramble`, `close-anagram-helper` | Modal per FR-81..FR-89. Closes on backdrop click / Escape / selection-change (FR-88 / FR-89). No grid write-back (FR-87). |

### 7.4 Shared components

| Component | Props | Emits | Notes |
|---|---|---|---|
| `Modal.svelte` | `ModalVM` | `confirm-modal`, `cancel-modal` | One reusable modal (G4). Backdrop, Confirm/Cancel buttons, Escape cancels. No focus trap (a11y out of scope). |
| `ToastHost.svelte` | `ToastVM[]` | `dismiss-toast` (id) | Stacked top-right; bottom-center on mobile via Tailwind responsive. Click dismisses; auto-dismiss via bindings-layer timeout (C2 = 3500 ms). |
| `Toast.svelte` | `ToastVM` | `dismiss-toast` | Single toast row. |
| `TypingSurface.svelte` | `enabled: boolean` | key/IME events → `type-letter`, `backspace`, `move-cursor`, `escape` | The single hidden `<input>` (FR-93, G3). Owned nowhere else. Focused when grid is interactive (Builder Fill / Player solving). Normalizes mobile composition/input/Unidentified key events. Never visually obtrusive. |
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

Input: `Grid`. Output: `Word[]` (no numbers assigned here — that's `Numbering.assign`).

1. For each row `r` in `0..gridSize-1`: scan left-to-right. A run begins at column `c` when `grid[r][c]` is white and (`c === 0` or `grid[r-1][c]` is black — *horizontal* start means either grid edge or previous cell black) — actually wait: horizontal start is `grid[r][c-1]` is black or `c === 0`. Accumulate white cells until a black cell or grid edge. If run length ≥ 2, emit a `Word` with `direction: 'across'`, start cell `{r, c}`, `length = run length`, `clue: ''`, `nextWord: null`. (`number` left unset here.)
2. For each column `c` in `0..gridSize-1`: similarly, scan top-to-bottom. Emit `direction: 'down'`.
3. Return all words in arbitrary order (binding code sorts as needed).

### 8.2 Numbering (`Numbering.assign`)

Input: `Grid`, `Word[]` (un-numbered). Output: `Word[]` numbered per FR-6.

1. Build a set `starts` of all `Word.startCell`.
2. Walk cells in row-major order. Maintain a counter starting at 1. For each cell `(r, c)`:
   - If `(r, c)` is the start cell of any word (across or down), assign that number to every word starting there, then increment the counter.
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

### 8.5 Reconciliation (`builder/state/designMode.ts` — `reconcileWords`)

Input: previous `Word[]` (with clues, nextWord links), new derived `Word[]`, plus the previous `DisplacedClues[]`. Output: `{ words: Word[], displacedClues: DisplacedClue[], toasts: Toast[] }`. Implements FR-45..FR-48.

1. Compute the set of **surviving words** (same `WordKey` in both old and new lists).
2. For each surviving word: retain its clue and `nextWord` from the old word. If `length` changed, emit an info toast "Word N Direction was shortened/lengthened." (FR-45).
3. **Destroyed words** (in old, not in new): remove them. If they had a non-empty clue, append a `DisplacedClue` (text + direction) to the displaced list (FR-46).
4. **Chain cleanup** (FR-47):
   - For each surviving word whose `nextWord` points to a destroyed word, clear that `nextWord`.
   - For each destroyed word `d`, traverse its chain forward (via `nextWord`) over surviving downstream words (i.e., words that *were* displaying a "See …" reference attributable to `d`'s chain) and clear each such downstream word's clue (set to empty). Note: chain traversal must stop at any cleared/destroyed word to avoid spurious walks.
5. **Newly-appearing words** (in new, not in old): empty clue, `nextWord: null` (FR-48).
6. Run `ChainValidation.validate` on the resulting words; if it now reports branches/dangling (a destroyed word was a non-head and its head survived), the cleanup in step 4 should have prevented these — but the validator is run as a safety net, and any violation is logged as an internal error toast (should be unreachable, but defensive).
7. Run `Numbering.assign` on the new words.
8. Return the new words, the updated displaced clues, and any emitted toasts.

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
- Pure given the RNG; tests inject seeded RNG.

### 8.9 Player import (`player/state/reducer.ts` — `import-puzzle`)

1. Call `parsePuzzleV1(fileContent)`.
2. If `!ok`: set `phase = 'import'`, `lastImportError = failures.map(f => f.message).join('\n')` (FR-99, NFR-10). Return.
3. If `type !== 'complete'`: reject with `lastImportError = "Only complete puzzle files can be loaded into the Player."` (FR-67). Return.
4. Otherwise: look up `StoragePort.loadPlayerProgress(puzzle.key)`. If present, parse the progress blob and apply its letters: only on white cells, only if `progress.gridSize === puzzle.gridSize` (FR-80). Saved letters targeting now-black cells are silently dropped.
5. Set `phase = 'solving'`, `puzzle = p`, `cursor = null`, `checkResult = null`, `anagram = null`, `lastImportError = null`.

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
│  │  │  ├─ GridSize.ts  Row.ts  Col.ts  CellIndex.ts
│  │  │  ├─ Cell.ts  CellMarker.ts  CellMarkerFlag.ts
│  │  │  ├─ Grid.ts  GridOps.ts
│  │  ├─ word/
│  │  │  ├─ Direction.ts  WordKey.ts  Word.ts  WordNumber.ts
│  │  │  ├─ WordDerivation.ts  Numbering.ts  WordMap.ts
│  │  ├─ letter/Letter.ts
│  │  ├─ chain/
│  │  │  ├─ Chain.ts  ChainValidation.ts  ChainViolation.ts
│  │  │  ├─ DisplayClue.ts  LengthPattern.ts
│  │  ├─ anagram/
│  │  │  ├─ Anagram.ts  AnagramEntry.ts  TileRow.ts
│  │  ├─ puzzle/
│  │  │  ├─ Puzzle.ts  PuzzleKey.ts  Title.ts  Author.ts
│  │  │  ├─ CompletenessCheck.ts  CompletenessViolation.ts
│  │  ├─ builder/
│  │  │  └─ DisplacedClue.ts  DisplacedClueId.ts
│  │  ├─ format/
│  │  │  └─ v1.ts  ParseFailure.ts  Filename.ts
│  │  └─ persistence/
│  │     └─ ports.ts                      # StoragePort, DownloadPort, FilePickPort, Rng (interfaces)
│  ├─ builder/state/                       # Layer 1: pure reducers (§2.1)
│  │  ├─ state.ts  intents.ts  reducer.ts
│  │  ├─ designMode.ts  fillMode.ts
│  │  ├─ joinSubMode.ts  reattachSubMode.ts
│  │  ├─ importExport.ts  reconcileWords.ts
│  ├─ player/state/
│  │  ├─ state.ts  intents.ts  reducer.ts
│  │  ├─ solving.ts  anagram.ts
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
│  │  │  ├─ TypingSurface.svelte  FilePicker.svelte
│  │  ├─ bindings/                        # Layer 2: the seam — the only place that crosses all layers (§2.1, §5.5)
│  │     ├─ appStore.svelte.ts  builderStore.svelte.ts  playerStore.svelte.ts
│  │     ├─ toastStore.svelte.ts  modalStore.svelte.ts
│  │     ├─ ports.ts  persistenceScheduler.ts
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
│  │  ├─ grid/  word/  chain/  anagram/  puzzle/  format/
│  │  └─ (one test file per source module; pure unit tests)
│  ├─ builder/state/
│  │  ├─ reducer.test.ts  designMode.test.ts  fillMode.test.ts
│  │  ├─ joinSubMode.test.ts  reattachSubMode.test.ts
│  │  ├─ importExport.test.ts  reconcileWords.test.ts   # exhaustive RISK-1 cases (§8.5)
│  │  ├─ reconcileWords.property.test.ts                # property-based over random toggles (optional)
│  ├─ player/state/
│  │  ├─ reducer.test.ts  solving.test.ts  anagram.test.ts  import.test.ts
│  ├─ fakes/
│  │  ├─ InMemoryStoragePort.ts  SeededRng.ts  StubDownloadPort.ts
│  └─ boundary/
│     └─ imports.test.ts                  # asserts ESLint rule denies forbidden imports (§9.2)
├─ converted-puzzles/                       # B6 — migrated from puzzles/, for the record only
│  └─ puzzle1-incomplete.json …
├─ puzzles/                                  # B6 — left untouched, non-conforming
├─ scripts/migrate-puzzles.ts                # one-shot migration: puzzles/ → converted-puzzles/
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
| `src/domain/**` | only sibling files under `src/domain/**` | `svelte`, `svelte/*`, DOM-global-only modules, `src/ui/**`, `src/ports/**`, `src/builder/state/**`, `src/player/state/**` |
| `src/builder/state/**`, `src/player/state/**` | `src/domain/**`, sibling files | `svelte`, `svelte/*`, DOM globals, `src/ui/**`, `src/ports/**` |
| `src/ui/**` (except `src/ui/bindings/**`) | sibling files, `src/ui/bindings/**`, types-only from `src/domain/**` (for VM prop shapes only — *importing functions is blocked*) | `svelte` allowed; `src/ports/**`, `src/builder/state/**`, `src/player/state/**` blocked |
| `src/ui/bindings/**` | all of `src/**` | (none) |
| `src/ports/**` | `src/domain/persistence/ports.ts` (interfaces only) | `svelte`, `src/state/**`, `src/ui/**` |

A `test/boundary/imports.test.ts` runs `tsc` on a small fixture file that attempts each forbidden import and asserts compilation fails. This makes the boundary self-verifying (NFR-4).

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
- `ChainValidation.validate` for each violation kind.
- `LengthPattern.forWord` for: standalone no markers; space separators; hyphen separators; mixed; chain suffixes (full FR-91).
- `LengthPattern.forActiveClueBanner` returns `null` for non-heads (C4).
- `CompletenessCheck.check` for each violation kind, plus the displaced-clue-ignored case (FR-63).
- `parsePuzzleV1` happy paths for incomplete and complete; rejection paths for every §6.3 rule including the strict `letter`-field rejection, the strict C5 non-head-with-non-empty-clue rejection, and unbalanced grid.
- `reconcileWords` — the full RISK-1 edge-case suite enumerated in §8.5. At minimum 12 cases.
- Every `BuilderIntent` and every `PlayerIntent`: at least one happy-path test and one guard-rejection test (e.g., `select-mode` when not blank produces a modal, not a transition).
- `Anagram.scramble` with a seeded RNG and a deterministic assertion.
- `reduceApp` for modal confirm/cancel flow.

**Property-based tests (optional but strongly recommended per RISK-1):** `test/builder/state/reconcileWords.property.test.ts` uses `fast-check` or a hand-rolled random-grid toggler; asserts that after any design-mode toggle, the resulting `Word[]` is consistent with the new grid (every word's start/length matches a derived white run) and `ChainValidation` finds no violations.

### 10.2 Fakes & helpers (`test/fakes/`)

- `InMemoryStoragePort` — full `StoragePort` impl over a `Map<string, string>`; throws on demand for corruption tests.
- `SeededRng` — Mulberry32 with a configurable seed.
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
  autosave: { builderDebounceMs: number; playerDebounceMs: number };
  toast: { ttlMs: number };
};
```
Production defaults:
- `builderDebounceMs: 400`, `playerDebounceMs: 400` (F2).
- `toast.ttlMs: 3500` (C2).
- `rng`: `Math.random`-backed.

Tests inject a `Config` with `InMemoryStoragePort`, `StubDownloadPort`, a `SeededRng`, and tight debounce intervals (e.g., 0 ms).

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
- **Sample puzzle bundling.** Currently out of scope, but if/when added, the `converted-puzzles/` migration path already shows the format; `domain/format/parsePuzzleV1` is the only entry.
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
| FR-16..FR-22 design mode | §4.3 Builder intents (`select-mode`, `toggle-design-cell`, `change-grid-size`), §8.5 reconcile |
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
| FR-52..FR-55 confirmations | §4.1 `ModalRequest`, §4.3 deferred-action pattern |
| FR-56..FR-60 import/export | §4.3 `import-puzzle`/`export-incomplete`/`export-complete` intents; §6 JSON format; G1 label rename |
| FR-61..FR-63 completeness | §3.6 `CompletenessCheck` |
| FR-64..FR-66 builder persistence | §4.5 autosave scheduling; corrupt-state recovery (NFR-9); C6 no-cursor-restore |
| FR-67..FR-69 player import | §8.9 import algorithm; §4.4 `import-puzzle` |
| FR-70..FR-73 solving + banner | §4.4 solving intents; §5.4 `ActiveClueBannerVM`; C4 banner pattern rule |
| FR-74..FR-76 check/clear | §4.4 `CheckResult`; G5 clear-on-change |
| FR-77 reset | §4.4 `reset` intent + modal pattern |
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

- Added explicit `pendingDownload` mention in §4.3 so the builder understands that "export" intents do not directly call ports — they signal via state. (Earlier draft left it implicit.)
- Added the `madge --circular` step to CI (§9.3, §10.4) after recognizing that the bindings layer's blanket import rights could invite a cycle.
- Reconfirmed the parser's strictness on unknown fields (the `letter` field in existing `puzzles/*.json`) — failure, not normalization — and tied it to the `converted-puzzles/` migration path so the builder knows the strict path is intentional, not a bug (§3.7 ①, §6.3, §9 tree).
- Added `viewmodels/` subdirectory under `ui/bindings/` to keep VM derivation files organized; the original E1 tree showed only stores at that level.

### 13.4 Open items for builder to confirm at implementation start

None architecture-blocking. Optional implementation choices left to the builder:
- `$derived` vs explicit function for VM derivation — pick consistently within `ui/bindings/`.
- Whether to use `svelte-preprocess`-style class maps or plain string concat for tailwind class composition (no architectural impact).
- Whether the parser returns a `ParseFailure[]` array or a single concatenated string — the spec (FR-99) only requires the user-facing error be a single message; the builder may join internally.

---

**End of design.**