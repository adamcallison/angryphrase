# Architect Questions — Round 0

Please answer inline. For each, I've given context, options, and a **Proposed default**. You can simply leave the default, override it, or add comments under each item. Anything you don't touch I'll take as "accept the proposed default."

---

## A. Architecture & state management

### A1. State management style
**Context.** Principles 1–2 call for a thin UI over pure logic, with simple domain objects crossing the boundary. Two idiomatic shapes fit Svelte 5:

- **(a) Pure-reducer / intent dispatch.** A single `AppState` value object per experience (Builder state, Player state). All mutations go through pure ` reducer(state, intent) -> newState` functions. UI dispatches typed `Intent` objects. State is held in a thin Svelte 5 runes store (`$state`). Maximizes testability (reducers are pure) and matches "domain objects crossing the boundary" literally. More ceremony; more files.
- **(b) Thin domain service.** A `BuilderService` / `PlayerService` class holds the `$state` rune and exposes method calls (`toggleDesign()`, `typeLetter(...)`, etc.) that internally delegate to pure functions and mutate in place. Less boilerplate, idiomatic Svelte. Slightly less "intent-object pure" feel.

**Proposed default: (a)** pure-reducer with intent dispatch, because your stated principles (thin UI, pure logic, domain-object boundary) align most cleanly with explicit intents, and it gives you freely unit-testable transition functions (which NFR-4/NFR-5 demand).

**Your answer:**
Yes (a)


### A2. Immutability discipline
**Context.** Do pure logic functions return *new* state values (structural sharing, never mutate inputs), or mutate a copy/frame and return it?

- **(a) Strict immutability.** Every reducer returns a new state object; inputs are never mutated. Best for testing, time-travel debugging, and Svelte reactivity. Slightly verbose in TS without a library.
- **(b) Mutate-a-draft.** Pure functions take a shallow/cloned draft, mutate freely, and return it. Simpler to write; harder to detect accidental input mutation in tests.

**Proposed default: (a)** strict immutability for all reducer outputs, with a tiny `clone` helper for the few deep structures (grid). No Immer dependency (keeps bundle minimal for the single-file build).

**Your answer:**

Immutability everywhere.

### A3. Application routing
**Context.** Three top-level screens: Landing, Build, Play (FR-1, FR-2). Options:

- **(a) In-app mode enum.** `route: 'landing' | 'build' | 'play'` lives in app state; a single `App.svelte` switches the top-level component. No router library. Lightest, best fit for single-file build. No URLs for deep links.
- **(b) SvelteKit file routes.** `/`, `/build`, `/play`. Familiar, gives shareable URLs, but heavier and adds SSR concerns to suppress. Single-file build via `vite-plugin-singlefile` works with SPA-mode SvelteKit but is more wiring.
- **(c) Tiny hash router.** `#/build`, `#/play`. Shareable URLs, no SSR, minimal code.

**Proposed default: (a)** in-app mode enum. The requirements describe landing screen always shown on load (FR-1) with no persisted mode, and there's no deep-linking need stated. Simplest and matches the single-file deployment cleanly.

**Your answer:**

Yes (a)

## B. Domain modeling & types

### B1. Branded / opaque primitive types
**Context.** Principles 3–4 ("explicit types," "avoid primitive obsession"). Candidates for branded types: `Row` (0-based), `Col`, `Letter` (single A–Z), `PuzzleKey` (UUID string), `WordNumber`, `GridSize` (2..25), `CellIndex` (flat), `ToastId`, `DisplacedClueId`. Direction as a discriminated union `'across' | 'down'`.

- **(a) Aggressive branding.** Brand all of the above. Compile-time guarantee against `row`/`col` mixups, accidental `string` for a `PuzzleKey`, etc. Most "explicit."
- **(b) Selective branding.** Brand only the ones with real confusion risk: `Row`, `Col`, `Letter`, `PuzzleKey`. Use plain `number` for `WordNumber`, `GridSize`; use string-literal union for `Direction`.
- **(c) No branding; use discriminated objects + aliases.** Use `type Row = number` aliases (no runtime/compile protection) and rely on object wrappers (`CellCoord { row; col }`) to prevent confusion.

**Proposed default: (a)** aggressive branding with a tiny `brand<'Row', number>` utility and range-checked constructors (`Row.try(n)`). Direction as a discriminated union type with a small set of pure helpers.

**Your answer:**
Aggressive branding


### B2. Word identity
**Context.** FR-33 defines `nextWord` as pointing to "the start cell and direction of another word." FR-45 (reconciliation) keys words by "same start cell and direction." So word identity = `(startRow, startCol, direction)` composite, not a surrogate ID. Displaced clues, however, *do* carry a stable `id` (FR-97).

- **(a) Composite key only.** `WordKey = { startRow, startCol, direction }`. `nextWord: WordKey | null`. No surrogate IDs anywhere except `DisplacedClueId`.
- **(b) Surrogate `WordId`.** Stable IDs assigned at word derivation; `nextWord: WordId | null`. Easier to reference, but the spec literally says start-cell+direction, and IDs would need to survive reconciliation re-derivation (fragile).

**Proposed default: (a)** composite `WordKey`, as the spec mandates, with structural equality helpers and a `WordMap` keyed by a canonical string form of `WordKey` for O(1) lookup. Displaced clues keep their `id` since they have no positional handle.

**Your answer:**
Yes (a)


### B3. Grid internal representation
**Context.** JSON is a 2D array of cells (FR-95). Internally:

- **(a) 2D array `Cell[][]`** indexed by `Row`/`Col`. Mirrors JSON exactly; serialization is trivial.
- **(b) Flat `Cell[]` with `GridSize`, accessor `cellAt(row, col)`.** Slightly easier to clone and reason about; serialization requires regrouping.

**Proposed default: (a)** 2D `Cell[][]`, with a small `GridOps` module providing typed accessors (`cellAt(grid, row, col)`, `withinBounds`, `neighbours`) so call sites never index raw arrays.

**Your answer:**
(a)


### B4. Letter field naming on the runtime Cell
**Context.** FR-50 distinguishes **answer letter** (Builder-edited) from **player letter** (Player-edited). FR-95 calls the serialized field `puzzleLetter` (== answer letter) and says player letter is never serialized. Confusing names will cause cross-contamination (RISK-2).

**Proposed default:** Internally name both explicitly and unambiguously:
- `Cell.answerLetter: Letter | null` (puzzle's intended letter; the Builder edits this; serialized as `puzzleLetter`)
- `Cell.playerLetter: Letter | null` (solver's letter; runtime-only, never serialized; always `null` on import per FR-99)
- Serialization adapter maps `answerLetter ↔ puzzleLetter` at the boundary only. The string `letter` is *never* used as a field name in the runtime model.

Confirm? (Also relevant to question B6 below.)

**Your answer:**
Confirm


### B5. Direction type
**Context.** Across vs down appears everywhere.

- **(a) String-literal union: `type Direction = 'across' | 'down'`.** Simple, JSON-friendly (matches FR-96), no indirection.
- **(b) Branded/enum object with attached helpers.** e.g. `Direction.Across` with `Direction.opposite`, `Direction.delta`. More OOP.

**Proposed default: (a)** string-literal union (matches the JSON format directly); a small `Direction` helper module with `opposite`, `advance`, `isAcross`.

**Your answer:**
(a)


### B6. The `puzzles/*.json` fixture files
**Context.** The repo contains `puzzles/puzzle1.json` … `puzzle5.json` (~46 KB each). They use the field name `"letter"` (not `"puzzleLetter"`, per FR-95), have no `"type"` discriminator, and have no `"version"` field — so they fail *both* FR-94 and FR-95. What's their intended role?

- **(a) Outdated sample puzzles — delete them.** They pre-date the format. §8 says "No bundled sample puzzles"; the app does not ship with any.
- **(b) Test fixtures — migrate them** to the current format (rename `letter → puzzleLetter`, add `version: 1`, add `type: 'complete'`, validate). Keep under `puzzles/` (or move to `test-fixtures/`).
- **(c) Keep as-is** and treat them as legacy input the parser must tolerate. (Conflicts with FR-94/FR-95 and §8.)

**Proposed default: (b)** migrate to current format and use them as integration test fixtures for import + validation + check + chain display. Without fixtures, NFR-4's mandate to unit-test the pure logic gets thin. I'll add a one-time migration note in the design. Delete option (a) is fine if you'd rather keep the repo pristine.

**Your answer:**
Create a "converted puzzles" dir with the converted puzzles, but otherwise pretend they don't exist. Don't use them as test fixtures.


## C. Open questions raised in the requirements doc (OQ-1 to OQ-6)

I'll adopt these defaults unless you override:

### C1. OQ-1 — Displaced Clues panel when empty
**Default:** Hide the panel entirely when there are no displaced clues. (Per FR-40 "display … when any displaced clues exist" already implies this.)

**Your answer:**
No, keep the panel there. Better to keep UI consistent.


### C2. OQ-2 — Toast duration
**Default:** 3500 ms auto-dismiss; toasts also dismissible on click. Stacked top-right (or bottom-center on mobile).

**Your answer:**



### C3. OQ-3 — Grid-size control shape
**Default:** Numeric `<input type="number">` with `min=2 max=25 step=1`, disabled (with explanatory text per FR-22) when the grid is not blank. Submitting an out-of-range or non-integer value is clamped on blur. (Numeric is lighter than rendering 24 `<option>`s and fits the bounds.)

**Your answer:**



### C4. OQ-4 — Length pattern for a selected non-head mid-chain word in the active-clue banner
**Context.** FR-91 literally produces a "suffix-from-this-word-onward" pattern (e.g., for chain A→B→C of lengths 4,4,5, selecting B shows `(4,5)`). The clue list, per FR-73, shows no pattern for non-heads. So selecting a non-head word would display *a pattern in the banner that never appears in the list* — inconsistent.

**Default:** Show no length pattern for a non-head word in the banner — display the "See N Direction" reference alone, consistent with the clue list. (This is a small deliberate deviation from the literal FR-91 text, limited to the banner; the length-pattern derivation pure function still implements the full suffix rule and is unit-tested as such, in case you later want the other behaviour. I'll flag the deviation in the design.)

**Your answer:**



### C5. OQ-5 — Reject non-head chain words carrying a non-empty `clue` field on complete-file import?
**Default:** Be lenient (per FR-99's "normalize where reasonable"): ignore the non-head's `clue` field on import, replace it with empty, and do not fail validation. Note that this is treated only as redundant cached data. (Stricter rejection is one extra validator line if you prefer.)

**Your answer:**
It should be considered invalid.


### C6. OQ-6 — Builder cursor persistence across reload
**Default:** Restore cursor (selected cell + direction) per FR-64 as specified. Keep the spec.

**Your answer:**
Unopinionated. If not doing this means less code, don't do it.


## D. Testing & determinism

### D1. Randomness source for the Anagram Helper scramble (FR-86)
**Context.** Fisher–Yates shuffle needs an RNG. For deterministic unit tests, we want to inject the RNG.

**Proposed default:** Define `interface Rng { nextInt(n: number): number }`. Pure `scramble(word, inputLetters, rng): Letter[]` takes an `Rng`. Production wires `Math.random`-backed `Rng`; tests inject a seeded `Rng` (e.g., a Mulberry32 sequence) for deterministic verification.

**Your answer:**



### D2. Test framework
**Context.** Vite + Svelte 5 ecosystem.

**Proposed default:** Vitest for unit tests (pure logic only). No component/DOM testing infrastructure mandated by the spec — visual/keyboard behaviour is covered by NFR-4's pure-logic tests plus manual mobile review (RISK-4). If you want a Playwright smoke E2E, say so; I'll otherwise skip to keep CI fast and the single-file build simple.

**Your answer:**



## E. Module / folder layout

### E1. Source tree shape
**Context.** Mapping DDD + your principles onto a Vite-Svelte project.

**Proposed default:**
```
src/
  domain/                # pure, zero-framework, no Svelte imports
    grid/                # GridSize, Row, Col, Cell, CellMarker, GridOps
    word/                # Word, WordKey, Direction, WordDerivation, Numbering
    letter/              # Letter (branded), Letter parsing/validation
    chain/               # Chain traversal, ChainValidation, DisplayClue, LengthPattern
    anagram/             # scramble, input validation, tile-row model
    puzzle/              # Puzzle (aggregate), PuzzleKey, Title, Author, completeness check
    persistence/         # LocalStorage ports (interfaces) + JSON serialization adapters
    format/              # v1 JSON parse + validate (incomplete/complete)
  builder/
    state/               # BuilderState, Builder reducers (design/fill/join/reattach), intents
    persistence/         # Builder localStorage adapter (impl of the port)
  player/
    state/               # PlayerState, Player reducers, intents
    persistence/         # Player progress localStorage adapter
  ui/
    app/                 # App.svelte (mode enum root), Landing.svelte
    builder/             # thin Svelte components — presentational only
    player/              # thin Svelte components — presentational only
    shared/              # Modal, Toast, generic presentational bits
    bindings/            # the single place that turns domain state into view-models and turns UI events into Intents
  ports/                 # runtime implementations of domain ports (localStorage, download, file-pick)
  main.ts                # wires ports + initial state, mounts App
```
- `domain/` is rigorously `import`-clean: only TS, no Svelte, no DOM. This is the enforceable boundary for Principle 1.
- `ui/bindings/` is the seam: domain objects → Svelte-runes store → components; component events → typed Intents → reducers. Components themselves contain no business logic.
- `ports/` holds side-effecting implementations behind interfaces declared in `domain/persistence` (so tests can swap them).

Confirm? Or would you prefer a flatter tree?

**Your answer:**



### E2. UI <-> logic contract enforcement
**Context.** Principle 1 says "communication between UI and logic is simple domain objects."

**Proposed default:**
- Components receive view-models (plain typed objects produced in `ui/bindings`), never raw domain aggregates — view-models are leaf-shaped and serializable.
- Components emit `Intent` objects (discriminated unions: `BuilderIntent | PlayerIntent | AppIntent`). A thin `dispatch(intent)` in the bindings layer calls the right reducer, writes the new state into the runes store, triggers persistence (`debounced` per FR-65/FR-79), and updates view-models.
- Svelte components may use `$derived` for trivial local view computation (e.g., cell colour from a passed-in flag), but never call domain functions directly.

Confirm? (This is the heart of your first principle; if you want it stricter or looser, say so.)

**Your answer:**



## F. Persistence & ports

### F1. localStorage key namespacing
**Proposed default:**
- Builder state: `angryphrase:builder` (single key; full state blob).
- Player progress: `angryphrase:player-progress:<puzzleKey>` per puzzle.
A single `StoragePort` interface in `domain/persistence`, implemented in `ports/localStoragePort.ts`. Tests use an in-memory `StoragePort`.

**Your answer:**



### F2. Autosave debounce interval
**Default:** 400 ms (covers FR-65 / FR-79 "a few hundred ms"). I'll inject the delay as a config value so it's tunable and overridable in tests.

**Your answer:**
No overridign this default, just want to see that a "inject...as a config value" is a good general principle to follow


## G. Misc specific behaviours I want to confirm before codifying

### G1. "Save" vs. "Export Complete" wording (RISK-3)
FR-58 calls the download-the-incomplete-file action "Save". This is counter-intuitive (it doesn't write to localStorage; autosave does). I'll preserve the label "Save" per the spec, with a tooltip/help text clarifying it downloads a `.json` file. Keep, or rename?

**Default:** Keep "Save" per FR-58; add explanatory tooltip.

**Your answer:**
Ok, since the requirements engineer flagged this and so have you, I've changed my mind. Let's call it Export Complete.


### G2. Builder import "auto-switch to Fill mode" (FR-56)
I'll model this as a reducer that runs parse → validate → replace state → set `mode = 'fill'` → clears sub-modes and cursor. Confirm this matches your intent (the requirements don't say anything about preserving cursor through import).

**Your answer:**



### G3. Mobile typing surface (FR-93)
**Default:** A single hidden `<input>` positioned offscreen but focused when the grid is interactive (Builder Fill / Player). All grid key handling routes through it; key events and `compositionend`/`input` events are normalized into `Intent`s. The "typing surface" is the *only* component that knows about the DOM input; everything else consumes intents. This keeps mobile-ROM specifics isolated in one component, satisfying Principle 1.

**Your answer:**



### G4. Confirmation modals (FR-52–FR-55, FR-77)
**Default:** A single reusable `Modal.svelte` presentational component (backdrop, focus trap not required per out-of-scope a11y, but Escape-to-cancel and explicit confirm/cancel buttons). Toasts are separate (`Toast.svelte` + a `ToastStore` rune fed by reducer-emitted `ToastRequest` intents — i.e., toasts are part of state, not an imperative side channel).

**Your answer:**



### G5. Check result lifecycle (FR-76)
**Default:** Check result is part of `PlayerState` (`checkResult: CheckResult | null`). Any intent that mutates the grid, the cursor, or the imported puzzle sets `checkResult = null` as part of the reducer. Pure, deterministic, testable.

**Your answer:**



---

## Anything else you want me to know before I draft `architecture_design.md`?

(Open-ended. Things like: visual/typography preferences inside CON-4's constraints, CI extras you want, constraints I haven't surfaced, opinions on the reducer/intent approach, anything.)

**Your answer:**



---

## Summary of decisions I'll make unless overridden

| # | Decision | Default |
|---|---|---|
| A1 | State mgmt | Pure-reducer + intent dispatch |
| A2 | Immutability | Strict immutability with structural cloning helpers |
| A3 | Routing | In-app mode enum (no router lib) |
| B1 | Branded types | Aggressive branding for Row/Col/Letter/PuzzleKey/Direction/etc. |
| B2 | Word identity | Composite WordKey {startRow,startCol,direction}; DisplacedClue keeps id |
| B3 | Grid repr | 2D Cell[][] with typed GridOps accessors |
| B4 | Letter field naming | answerLetter / playerLetter internally; puzzleLetter only at JSON boundary |
| B5 | Direction | String-literal union + helper module |
| B6 | puzzles/ fixtures | Migrate to current format, use as test fixtures |
| C1 | Displaced panel empty | Hidden |
| C2 | Toast duration | 3500 ms |
| C3 | Grid-size control | Numeric input, clamp on blur |
| C4 | Non-head banner pattern | No pattern (deviation from literal FR-91) |
| C5 | Non-head clue on import | Lenient: ignored, replaced with empty |
| C6 | Cursor restore | Per FR-64, keep |
| D1 | RNG | Injected Rng interface; seeded for tests |
| D2 | Tests | Vitest, pure-logic only (no E2E unless asked) |
| E1 | Folder layout | domain/ + builder/ + player/ + ui/ + ports/ as above |
| E2 | UI/logic contract | View-models in, Intents out; bindings layer is the seam |
| F1 | localStorage keys | `angryphrase:builder`, `angryphrase:player-progress:<key>` |
| F2 | Autosave debounce | 400 ms |
| G1 | "Save" label | Keep per spec + tooltip |
| G2 | Import auto-Fill | Reducer: parse→validate→replace→mode=fill |
| G3 | Mobile typing surface | Single hidden `<input>` component normalizing key/IME events to Intents |
| G4 | Modals + toasts | One reusable Modal; Toasts as state (emitted via reducer) |
| G5 | Check result lifecycle | Cleared to null by any grid/cursor changing intent |