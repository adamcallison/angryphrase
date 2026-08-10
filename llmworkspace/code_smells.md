# angryphrase — Code & Architectural Smells Audit

Audit-only. No fixes. Refs `llmworkspace/architecture_design.md` (AD), `design_review_notes.md` (DRN), `chain_aware_selection_addendum.md`. Severity: 🔴 high / 🟠 medium / 🟡 low.

Scope: files sampled are those under `src/` plus key config. Not exhaustively read: `Header.svelte`, `Landing.svelte`, `GridSizeControl.svelte`, `DisplacedCluesPanel.svelte`, `ImportScreen.svelte`, `PlayerGrid.svelte`, `ActiveClueBanner.svelte`, `PlayerShell.svelte`, `PlayerToolbar.svelte`, `PlayerCluePanel.svelte`, `Toast.svelte`, `FilePicker.svelte`, `app.css`, `tailwind.config.ts`, several small `domain/` modules (`Direction.ts`, `CellIndex.ts`, `CellSeparator.ts`, `ModalKind.ts`, `ModalRequest.ts`, `ToastId.ts`, `ToastKind.ts`, `Event.ts`, `DerivedWord.ts`, `WordNumber.ts`, `CellMarkerFlag.ts`, `Grid.ts`, `Title.ts`, `Author.ts`, `Rng.ts`, `persistence/ports.ts`). Smells hiding there are not captured.

---

## A. Boundary enforcement

### A1. Missing design-mandated boundary self-test 🔴
AD §9.2 / §10 require `test/boundary/imports.test.ts` running `tsc` on adversarial fixtures asserting forbidden imports fail to compile. No `test/boundary/` exists; only ESLint `no-restricted-imports` enforces boundaries. Lint is bypassable (e.g., dynamic imports, `import()` expressions), and no runtime assertion that the lint rule is wired. Boundary claim not self-verifying as designed.

#### A1 — Fix
- Created `test/boundary/imports.test.ts`: 36 fixtures drive the ESLint `Linter` API (flat config) over adversarial import strings with `filename` routing each into the per-glob rule block; asserts `@typescript-eslint/no-restricted-imports` fires on forbidden cases and stays silent on negative controls.
- Amended AD §2.3 + §9.2: `tsc` does not enforce path boundaries → enforcement mechanism is ESLint; self-test asserts rule is wired.
- `eslint.config.js` fix: `group: ['src/X/**']` globs only matched absolute-prefixed import strings; real source uses relative imports (`../ui/`, `../../ports/`) → rules were inert. Converted all path `group` entries to `regex: '(?:^src/|(?:\.\./)+)X/'` so relative imports now match. Ports allow-list regex depth fixed (`(?:\.\./)+`).
- Removed dead `group: ['src/state/**']` entry in ports block (no such dir; catch-all regex already blocks siblings).

### A2. `domain/` modules reach into `Grid` via raw indexing 🟠
AD §3.2: "Grid is a 2D array but indexed only through `GridOps`." Violations:
- `src/domain/puzzle/CompletenessCheck.ts:21-24` — `p.grid[r]!` / `row[c]!`.
- `src/domain/word/WordDerivation.ts:9-13` — `g[r]` / `row[c]` raw indexing.
- `src/domain/word/Numbering.ts:25-27` — `grid[r]!` / `row.length`.
- `src/domain/grid/GridOps.ts:37,46,128-159` — acceptable inside `GridOps` itself, but exposes the pattern as the norm.
Reducer-adjacent raw indexing: `src/player/state/internal/solving.ts:331-334` (`g[r]!` / `row[c]!` in `handleCheck`), `src/player/state/internal/lifecycle.ts:138-149` (`handleConfirmResetPlayer`). Treats grid as a generic array, weakening the §3.2 invariant.

### A3. `Cursor` type lives in `builder/state/state.ts`, imported type-only by Player + grids/VMs 🟠
`src/player/state/state.ts:8`, `src/ui/bindings/viewmodels/gridVM.ts:11`, `src/ui/bindings/viewmodels/builderVM.ts:2`, `src/ui/bindings/viewmodels/playerVM.ts:6` all `import type { Cursor } from '../../.../builder/state/state'`. Cursor is a shared domain concept, not a Builder concept. Placing it in `builder/state` makes Player/viewmodel logic depend (type-only) on a sibling state module — exactly the kind of cross-module coupling that `internal/` rules exist to prevent, here dodged because the symbol sits on a public root file. AD has no shared cursor module.

### A4. `domain/persistence/` folder misnomer (DRN item 1) 🟡
Still unresolved per DRN. Folder holds `DownloadPort`/`FilePickPort` which are not persistence. `Rng` already hoisted to `domain/rng/`. Cheapest option (status quo) is the documented choice; flagged as acknowledged smell.

---

## B. Duplication

### B1. `findContainingWord` / `findWordContaining` duplicated 4× 🟠
Identical linear-scan algorithm reimplemented:
- `src/player/state/internal/solving.ts:59-74`
- `src/player/state/internal/anagram.ts:17-32` (exact copy of solving's)
- `src/ui/bindings/viewmodels/builderVM.ts:139-156`
- `src/ui/bindings/viewmodels/playerVM.ts:264-281`

Belongs in `domain/word/` (pure function over `Word[]` + `Cursor`).

### B2. `cellsOfWord` / `cellsOfChain` duplicated 2× verbatim 🟠
Between `builderVM.ts:158-181` and `playerVM.ts:283-307`. Same chain-aware logic, copy-pasted. Both should derive from a single `domain/word/` or `ui/bindings/viewmodels/` helper.

### B3. `BuilderCluePanel.svelte` Across/Down sections near-duplicate 🟠
`src/ui/builder/BuilderCluePanel.svelte` lines 92-152 and 154-214 are structurally identical, differing only in `{#each vm.across...}` vs `{#each vm.down...}`. ~60 lines duplicated. Extract one `<ClueSection>` component.

### B4. `EMPTY` banner / blank-grid stub repeated in `playerVM.ts` import branch 🟡
`derivePlayerShellVM` constructs a 2×2 blank grid + empty everything for the `phase==='import'` branch (`playerVM.ts:180-217`). Same shape partially repeated in `derivePlayerToolbarVM` import branch.

### B5. `void _deps; void _intent;` ceremony spans every reducer helper 🟡
Every handler in `builder/state/internal/*` and `player/state/internal/*` begins with `void _deps;` (and often `void _intent;`) to silence `noUnusedParameters`. ~40 occurrences. Noise; signals an over-broad uniform `deps`/`intent` signature (`AD §4.2`) where most cases ignore both. Could narrow via overloads or a helper that strips unused params.

### B6. `TypingIntent` union defined three times — once private in `TypingSurface.svelte`, once inlined in `BuilderShell.svelte`, once inlined in `PlayerShell.svelte` 🟠
`src/ui/shared/TypingSurface.svelte:4-8` declares `type TypingIntent` privately (not exported). `src/ui/builder/BuilderShell.svelte:24-31` and `src/ui/player/PlayerShell.svelte:20-30` each redeclare a structurally-identical `type TypingIntent` plus duplicate `function onTypingIntent`. Comment in `PlayerShell.svelte:19` acknowledges the duplication (`// TypingSurface TypingIntent union (inlined structural type — same shape as in BuilderShell.svelte)`). Three copies of the same discriminated union; no single source of truth. Adding a new intent variant requires editing three files in lock-step, with no compile-time guarantee they stay aligned (each shell's copy is structural). Fix: export `TypingIntent` from `TypingSurface.svelte` (or a sibling `.ts`) and import in both shells.

---

## C. Validation / format drift

### C1. `DisplacedClueId.generate` emits raw 32-hex, not UUID v4 ✅ Resolved
Was 🔴: `src/domain/builder/DisplacedClueId.ts:9-12` produced 32 hex chars (`"abcd…"`). `PuzzleKey.generate` (`src/domain/puzzle/PuzzleKey.ts:10-18`) emitted UUID-v4 dashed form. AD §6.1 example: `"id": "<UUID v4>"`. Parser (`domain/format/v1.ts:487-535`) accepted any string for `displacedClue.id`, so round-trip worked but the serialized output diverged from the documented format and from PuzzleKey's id style. Inconsistent id minting.

#### C1 — Fix
- Extracted shared minting to `src/domain/uuid/uuidv4.ts` — pure `uuidv4(rng: Rng): string`; 16 bytes via `rng.nextInt(256)`, RFC 4122 version (0x40) + variant (0x80) masking, `8-4-4-4-12` dashed lowercase. `test/domain/uuid/uuidv4.test.ts` (4 tests).
- `DisplacedClueId.generate` (`src/domain/builder/DisplacedClueId.ts`) now delegates to `uuidv4(rng)`; added `DisplacedClueId.try(s)` (UUID v4 lowercase regex) — AD §3.3 amended.
- `PuzzleKey.generate` (`src/domain/puzzle/PuzzleKey.ts`) now delegates to `uuidv4(rng)`; behavior identical. Tests stay as integration guards.
- AD §3.3 + §9.3 tree amended: added `DisplacedClueId.try` to type catalogue, new `domain/uuid/uuidv4.ts` module.

### C2. `converted-puzzles/` directory specified by AD §9.3 tree absent 🟡
AD §9.3 / B6 commit `converted-puzzles/*.json` as migrated record. Repo lacks the dir; `scripts/convert-puzzles.ts:95` writes to `join(cwd, 'converted-puzzles')` at run time, never committed. Also AD §9.3 describes `puzzles/` as "non-conforming (legacy `letter` field, no version)" — but `puzzles/puzzle1.json` is now in v1 format (verified `"version":1,"type":"complete"`). The design premise is stale; the directory's documented role no longer applies.

### C3. `DisplacedClue` id uniqueness validated at parse but `PuzzleKey` format validated strictly ✅ Resolved
Was 🟡: `parsePuzzleV1` (`v1.ts`) enforced `key` via `PuzzleKey.try` regex; for `displacedClue.id` it only checked `typeof id === 'string'` + uniqueness (`v1.ts:518-529`). Asymmetric strictness.

#### C3 — Fix
- AD §6.3 step 11 amended: "each `id` is a valid lowercase UUID v4 string (`DisplacedClueId.try`) and unique within the array".
- `validateDisplacedClues` (`src/domain/format/v1.ts`) now calls `DisplacedClueId.try(id)` after the shape check and before the duplicate check; non-UUID id fails with `'displacedClue id is not a valid UUID v4: <id>.'`.
- `v1.test.ts` fixtures migrated from `'dc-1'`/`'id-1'`/`'same-id'` to valid inline UUID v4 literals (`UUID_A`/`UUID_B` consts). Added 2 new rejection tests (non-UUID `'not-a-uuid'`, legacy 32-hex `'ab'.repeat(16)`). Adjacent `DisplacedClue.test.ts` length-32 assertions migrated to length-36 + UUID v4 regex match.
- Acceptance decision: localStorage Builder snapshots carrying legacy 32-hex ids fail strict parse on reload → snapshot discarded → blank Builder. No migration code; per human decision.

### C4. `CompletenessCheck` never emits `invalid-answer-letter` 🟡
`CompletenessViolation` AD §3.6 / `src/domain/puzzle/CompletenessCheck.ts:9-12` has an `'invalid-answer-letter'` variant, but `check()` only emits `missing-answer-letter` and `missing-clue`. `Cell.answerLetter` invariant prevents invalid letters, so variant is dead by construction. Either remove variant or make it truly redundant with the impossible-state principle (AD §0 principle 3).

### C5. Parser constructs a throwaway blank puzzle before overwriting with parsed contents 🟡
`parsePuzzleV1` (`v1.ts:607-630`). Step 1: `buildDomainGrid` builds cells via repeated `GridOps.setCell` over a `GridOps.blank`. Step 2: `WordDerivation.derive(grid)` (v1.ts:608) — used only for `crossCheckWords` against parsed words, then discarded. Step 3: `Numbering.assign(grid, buildDomainWords(parsedWords))` (v1.ts:615) — the words that actually go into the puzzle. Step 4 (v1.ts:628): `puzzle = PuzzleOps.blank(gridSize, puzzleKey)`. `PuzzleOps.blank` (Puzzle.ts:27-37) builds ANOTHER blank grid + runs `Numbering.assign(grid, WordDerivation.derive(grid))` on it — empty grid, so derive/assign return `[]` but still allocate. Lines 629-630 then immediately overwrite with `withGrid` (the parsed grid) and `withWords` (the numbered words), discarding the `blank`-produced grid + words. The `blank` call exists as a constructor scaffold only; its work is fully thrown away. Belt-and-suspenders; could construct the puzzle object literal directly from the already-built grid + numberedWords.

---

## D. State / reducer smells

### D1. Hand-maintained intent-kind string sets must stay in sync with the unions 🟠 (DRN items 7, 9)
`src/app/state/reducer.ts:11-45` has four parallel `ReadonlySet<string>` constants (`BUILDER_INTENT_KINDS`, `PLAYER_INTENT_KINDS`, `CONFIRMABLE_INTENT_KINDS`, `AMBIGUOUS_INTENT_KINDS`). Adding a new intent kind requires touching the union AND the matching set(s); no compiler link. DRN item 7 notes deferred "static type-derived set" fix. Concrete drift risk: `AMBIGUOUS_INTENT_KINDS` is the intersection hardcoded — if a seventh shared kind is added to both unions but not to this set, intent silently routes (or throws). **Fix path requires DRN item 7 / 9 resolution (derive sets from union types at compile time, or eliminate the string-set routing layer).**

### D2. Ambiguous intent on `route === 'landing'` silently routes to Builder 🟠 (DRN item 9 open)
`reducer.ts:105-106`. A Player intent dispatched before `navigate play` runs through `reduceBuilder`, mutating Builder state. DRN flags this as "back-compat silent fallback"; considered deferred. Real silent-state-change risk if a stray dispatch lands during landing. **Fix path requires DRN item 9 resolution (reject ambiguous intents on landing, or force explicit `navigate` first).**

### D3. `Puzzle.withGrid` does not sync `gridSize`; `change-grid-size` patches locally 🟠 (DRN item 8)
`src/domain/puzzle/Puzzle.ts:50-52` is `{ ...p, grid: g }` — never updates `gridSize`. `src/builder/state/internal/designMode.ts:71` manually re-writes `gridSize: intent.size` after the spread. Every other `withGrid` call-site assumes same-size swap. The aggregate's own invariant (`grid.length === gridSize`) is enforced at construction only, not by the wither. DRN defers hardening; latent invariant-break risk for any future caller that swaps a different-sized grid. **Fix path requires DRN item 8 resolution (widen `withGrid` to take a `GridSize`, or add an invariant-reasserting `withGridSize` constructor).**

### D4. `handleClickWord` double-scans `words` then non-null asserts 🟡
`src/builder/state/internal/fillMode.ts:294-300`: `words.some(w => WordKey.equals(w.key, intent.wordKey))` then `words.find(...)!`. Two O(n) scans + a non-null assertion. Combine into one `find`.

### D5. `DisplacedClueId` ad-hoc equality via `String(a) === String(b)` 🟡
`src/builder/state/internal/reattachSubMode.ts:12` defines `idEquals` by stringifying branded ids; uses `String(d.id) === String(displacedClueId)` again at lines 71, 107. Branded-type contract has no `equals` helper (unlike `WordKey.equals`, `Letter.equals`). Manual brand-erase at every comparison.

### D6. `applyLoadedProgress` and `confirmResetPlayer` mutate grid via repeated `GridOps.setCell` rebuilding whole grid each cell 🟡
`src/player/state/internal/lifecycle.ts:67-82,136-150`. For a 25×25 grid with many letters, this rebuilds the grid array N times (one per cell). A `GridOps` "update many cells" / functional updater API would be O(1) restructures over the affected rows.

---

## E. Viewmodel smells

### E1. `findContainingWord` + `WordMap.fromWords` + `Chain.headOf` + `Chain.fromHead` recomputed on every VM derivation 🟠
`builderVM.ts:109-111,158-172`, `playerVM.ts:219-223,293-306`, `cluePanelVM.ts:44-51`, `anagramVM.ts:55-62`. Each `deriveXShellVM` call (per `$derived` tick / per keystroke) allocates a `WordMap`, walks predecessors to find the chain head, builds a `Chain.fromHead`. For a 25×25 grid, every cursor move does several full word-list scans + map allocations. No memoization; correctness unaffected.

### E2. `deriveBuilderToolbarVM` runs `CompletenessCheck.check` twice per call 🟡
`builderVM.ts:70-71`: `CompletenessCheck.isComplete(state.puzzle)` (which calls `.check()` internally) then `CompletenessCheck.check(state.puzzle)` again. Double O(grid²+words) work per VM tick.

### E3. `deriveAnagramModalVM` indexes `scrambledArrangement` by absolute entry index `i` 🟡
`anagramVM.ts:86-91`: `scrambled[i]!` where `scrambled` is `Letter[]` filtered to non-nulls in the reducer (`player/state/internal/anagram.ts:104-106`). Alignment holds only because scramble is gated on `inputValid` (full-length input), so every non-fixed position is non-null; if the gate ever weakens, indexing silently desyncs. Fragile contract between reducer's filtered array shape and VM index assumption.

### E4. `cluePanelVM` re-derives `selectedChainMemberKeys` even when cursor moved off-cluster 🟡
`cluePanelVM.ts:46-51` runs `Chain.headOf`+`fromHead` whenever `highlightedWordKey !== null`. For a long chain, builds a set on every VM derivation.

---

## F. Persistence / bindings smells

### F1. `persistenceScheduler.ts` mixes serialize + parse + schedule in one 270-line file 🟠
Single module owns: `serializeBuilderSnapshot`, `parseBuilderSnapshot`, `serializePlayerProgress`, `parsePlayerProgress`, `PersistenceScheduler` interface, and `createPersistenceScheduler` impl. AD §9.3 lists `persistenceScheduler.ts` (singular) so the layout is design-blessed, but cohesion is low.

### F2. `serializeBuilderSnapshot` embeds puzzle JSON twice: inside `puzzle` object AND top-level `displacedClues` 🟡
`persistenceScheduler.ts:26-37`: `puzzleObj.displacedClues` carries the displaced clues (puzzle JSON), then `wrapper.displacedClues = puzzleObj.displacedClues ?? []` duplicates them at the wrapper level. On reload, `parseBuilderSnapshot` re-parses `snap.puzzle` (the embedded puzzle) and reads `result.displacedClues` from there — the top-level `displacedClues` is unread. Dead duplicated field.

### F3. `createPersistenceScheduler` accepts `now: () => number` then `void now` 🟡
`persistenceScheduler.ts:166-169`. Dead param retained "for future timestamping" — unused; callers must still pass it (defaulted). API surface noise.

### F4. `createBlankKeyRng` in `appStore.svelte.ts` is a no-op wrapper 🟡
`appStore.svelte.ts:23-25` returns `getPorts().rng`. Used once at module init. Dead indirection.

### F5. Module-level `scheduler` initialised but discarded if `bootApp` is called without `schedulerArg` 🟡
`appStore.svelte.ts:21` creates a scheduler at import; `bootApp` (line 30) creates another if no arg passed, ignoring the module-level one. Two schedulers floating in tests depending on call order.

### F6. `load-player-progress` event triggers synchronous recursive `dispatch(intent)` mid reducer-result event loop 🟡
`appStore.svelte.ts:91-122` (`handleLoadPlayerProgress`): while the bindings layer iterates over `result.events`, it calls `dispatch(apply-loaded-progress)`, which runs `reduceApp` again and triggers another event pass. Re-entrancy is bounded (apply-loaded-progress emits no events) but the dispatch-from-within-event-handler pattern couples store mutation to event iteration order.

### F7. `parsePlayerProgress` mixed error strategy: throws inside `.map` caught at boundary, but `Letter.try` nulls silently 🟡
`persistenceScheduler.ts:133-140`. Row-not-array / cell-not-string → `throw` caught by outer `try`. Invalid letter → `LetterCtor.try(cell)` returns `null` (silent drop). Inconsistent failure semantics.

### F8. `App.svelte` autosave `$effect` schedules both builder & player save on every state tick 🟡
`src/ui/app/App.svelte:15-20`. The single `$effect` reads both `getBuilder()` and `getPlayer()` then calls both `scheduleBuilderSave` and `schedulePlayerSave` unconditionally. Any builder keystroke re-schedules the player save timer (and vice versa). Scheduler coalesces so cost is bounded, but the effect body re-runs and re-arms two timers per change where one would do. Splitting into two effects — one per state slice — would cut half the redundant scheduling.

### F9. `appStore.svelte.ts` eagerly initialises entire app state at module import 🟠
`appStore.svelte.ts:19-21`. `let state: AppState = $state(AppStateCtor.blank(GridSizeCtor.of(15), PuzzleKeyCtor.generate(createBlankKeyRng())))` runs at import time: builds a 15×15 grid, mints a `PuzzleKey`, and calls `getPorts().rng` (warming the ports singleton). `bootApp` (line 27) then overwrites `state` with the caller's initial. Two full-state constructions per production boot; one wasted. Side effects at module top-level also complicate test isolation (`_resetAppStateForTests` is the band-aid at line 125). Lazy init (or null sentinel until `bootApp`) would remove the eager work.

---

## G. Components / DOM coupling

### G1. Direct `document.getElementById('typing-surface-input')` focus coupling 🟠
`src/ui/builder/BuilderShell.svelte:37`, `src/ui/builder/BuilderCluePanel.svelte:54`. Both components reach into the DOM by magic id string to focus the hidden input owned by `TypingSurface.svelte`. AD §7.4 designates `TypingSurface` as the single owner of the hidden input (G3); this cross-component DOM ID contract violates ownership and breaks if the id changes or two surfaces mount.

### G2. `TypingSurface.svelte` input id hard-coded to `typing-surface-input` global singleton 🟡
`TypingSurface.svelte:109`. Assumes exactly one instance; no scoped id. Two grids in DOM (Builder + Player not simultaneously, but landing could theoretically host both later) would collide.

### G3. `BuilderCluePanel.svelte` mutates `drafts: Map` held in `$state(new Map())` and reads via `valueFor` 🟠
`BuilderCluePanel.svelte:9,29-31,113`. Svelte 5 runes do NOT observe internal `Map` mutation; `drafts.set(...)` does not trigger reactivity. The input is bound `value={valueFor(...)}` (one-way) and user-typed DOM value persists visually, so it happens to work, but `valueFor` re-reads on parent re-render only. Fragile: any future `$derived` reading `drafts` would not update on `.set`.

### G4. `Modal.svelte` calls `modalVM()` twice in the render branch 🟡
`Modal.svelte:29-30`: `{#if modalVM() !== null}` then `{@const vm = modalVM()!}`. Double derivation; trivial cost, mild smell.

### G5. `ToastHost.svelte` re-runs `$effect` on whole toast-list change; re-schedules timers for all toasts each run 🟡
`ToastHost.svelte:7-16`. Cleanup clears prior timers (correct), but every list mutation re-asserts timers for the full set. Acceptable but wasteful at high toast churn.

### G6. `BuilderToolbar.svelte` marker flag → marker-field mapping uses nested ternary 🟡
`BuilderToolbar.svelte:119-127`. Four-way flag-to-`CellMarker` field dispatch via `'space-right' ? … : 'space-bottom' ? … : … : 'hyphenBottom'`. Brittle; would slip silently if a fifth marker flag added. A record map `flag → markerKey` would be safer.

### G7. `DownloadPort.download` is `void`-returning; both port impl and `appStore` swallow errors with no user feedback 🟠
`src/domain/persistence/ports.ts:12-13` `download(filename, content): void` — no `Result` channel. `src/ports/downloadPort.ts:6-18` wraps the DOM Blob/anchor dance in `try/catch` → `console.warn` only. `src/ui/bindings/appStore.svelte.ts:75-81` adds a second `try/catch` that also just `console.warn`s. Effect: a user-initiated download that fails (rare, but possible: blocked focus, sandbox, store API throw) leaves the user with zero UI signal — no toast, no modal, no inline state change. Failed irreversible user action disappears silently. **Fix path: widen the port signature to `Result<null, DownloadError>` (or `DownloadError` discriminated union) and emit a `toast` event on failure from `appStore.performExternalEvent`; this requires a new `DownloadError` domain type + a reducer `DomainEvent` variant for the toast — surface as design amendment if needed.**

---

## H. Type-safety / branded types

### H1. `brand<Tag, T>` is structurally unsound at the brand boundary 🟠
`src/domain/brand.ts:1-3`: `export type Brand<Tag extends string, T> = T & { readonly __brand: Tag }` then `brand(value) = value as Brand<Tag,T>`. The cast means any `string`/`number` can be branded without range validation. Validation only happens in `.try`/`.of` constructors. Concrete bypass: `src/ui/bindings/persistenceScheduler.ts:130` `brand<'PuzzleKey', string>((parsed as { key: string }).key)` skips `PuzzleKey.try`'s regex (line 120 only checks `typeof === 'string'`), so a corrupted player-progress blob brands an unvalidated string as `PuzzleKey`. Contrast with the next line (`GridSizeCtor.of(...)` at line 131) which properly validates. Other `brand(...)` direct uses (`DisplacedClueId.ts:11`, `PuzzleKey.ts:18/23`, `v1.ts:635`) live inside `.generate`/`.try`/`.of` constructors or in paths where `.try` doesn't exist (DisplacedClueId has only `.generate`), so they assert rather than bypass. The `brand` escaper is the lint-trusted escape hatch — it trusts callers; the persistenceScheduler.ts:130 call is the one that demonstrably trusts a non-validated external value.

### H2. `GridOps.withinBounds` mixes defensive optional chaining (`g[r]?.length ?? -1`) with the project-wide aggressive `!` non-null style elsewhere 🟡
`GridOps.ts:53-62`. Inconsistent null-handling idiom inside the one module that is supposed to be the typed grid boundary.

### H3. Pervasive non-null assertions `x!` from `noUncheckedIndexedAccess` 🟡
~200 `!` uses across reducers, viewmodels, format parser (`v1.ts:329`, grid scans, etc.). Forced by `tsconfig.json:12 noUncheckedIndexedAccess: true`. Defensible but blunts the intended safety; several `!` assert grid cells where `GridOps.cellAt` is the typed path.

### H4. Plain `number` in domain type signatures violates AD §0 Principle 4 🟠
AD §0 principle 4 (binding): "Plain `string` and plain `number` do not appear in domain signatures." Yet the AD's own §3.3 type definitions and the repo use raw `number`:
- `src/domain/word/Word.ts:7` `length: number` (AD §3.3 line 373, 397).
- `src/domain/anagram/AnagramEntry.ts:4` `position: number` (AD §3.3 line 1334).
- `src/domain/notifications/Toast.ts:10-11` `createdAt: number; ttlMs: number` (AD §3.3 lines 493-494).
- `src/domain/word/DerivedWord.ts:5` `length: number`.
- `src/domain/rng/Rng.ts:5` `nextInt(n: number): number` (function signature — clearest breach).

Word length could be a `WordLength` branded range-checked type (≥2 per FR-5); AnagramEntry position could be a `Position` branded (0..length-1); Toast timestamps/durations could be `EpochMs`/`DurationMs` branded. The breach is design-level — the AD's own type catalogue breaks its own binding principle, so the code faithfully reflects the spec. **Fix path requires amending the AD §3.3 first** (introduce `WordLength`, `Position`, `EpochMs`, `DurationMs` branded types + range-checked constructors; update §3.3 type definitions; re-derive downstream signatures).

---

## I. CI / build config

### I1. ESLint `no-restricted-imports` `src/ports/**` allow-list uses negative-lookahead regex with explicit `.ts` extensions 🟡
`eslint.config.js:205-206` (DRN item 6). Regex enumerates exact allowed paths (`src/domain/persistence/ports.ts`, `src/domain/rng/Rng.ts`, `src/domain/puzzle/PuzzleKey.ts`) with `.ts` suffix. The `.ts`-extension convention is inconsistent across layer boundaries (other rules use globs). Operationally fine; stylistic inconsistency.

---

## J. Domain logic quirks

### J1. `Chain.headOf` rebuilds predecessor-reverse map on every call 🟡
`src/domain/chain/Chain.ts:50-71`. Each `headOf` allocates `new Map` over all words, then walks predecessors calling `isHead` (itself an O(words) scan) per step. Cascading: `DisplayClue.forWord`, `cluePanelVM`, `builderVM`/`playerVM` `cellsOfChain`, `anagramAfterCursorChange` all call `headOf` per keystroke. No caching; O(n²) ceiling on long chains.

### J2. `DisplayClue.forWord` duplicates `Chain.headOf`'s reverse-map walk 🟡
`src/domain/chain/DisplayClue.ts:14-34` reimplements the predecessor walk that `Chain.headOf` already does. Could call `Chain.headOf` + `WordMap.get` instead.

### J3. `reconcileWords` runs `ChainValidation.validate` after numbering purely as safety-net toast 🟡
`reconcileWords.ts:133-141`. Per AD §8.5 step 7, defensive; emits `Internal:` error toasts on "unreachable" violations. Defensive code that "should never run" but ships to users as toast text. If truly unreachable, throwing / asserting would be more honest than surfacing user-facing "Internal:" toasts.

---

## K. Cross-cutting / documentation

### K1. `architecture_design.md` §9.3 file tree out of sync with repo 🟠
- `src/domain/word/Word.ts` not listed under `puzzle/` tree (correct) — but AD §9.3 lists `puzzle/CompletenessViolation.ts` and `format/ParseFailure.ts` / `Filename.ts` as separate files; in repo these types live inside `CompletenessCheck.ts` and `v1.ts`. Multiple AD-listed files missing or merged. Concrete drift between design file tree and actual layout.
- `src/test/boundary/imports.test.ts` listed in §9.3, missing (see A1).
- `src/test/builder/state/reconcileWords.property.test.ts` listed, missing.
- `src/test/builder/state/import.test.ts` listed, missing (player has `lifecycle.test.ts`, builder has `importExport.test.ts`).
- `converted-puzzles/` directory listed, missing (see C2).

### K2. `version_stamp_plan.md` not implemented 🟡
Plan describes baked git-commit-hash/timestamp footer + `VersionStamp.svelte` + `vite.config.ts` inline plugin. Repo `vite.config.ts:1-18` has no `define` block; no `src/ui/shared/VersionStamp.svelte`; no `vite-env.d.ts` ambient declarations. `git log` shows "add git stamp design doc" commit but no implementation commit. Feature gap between plan and code.

### K3. DRN follow-up items + AD-internal contradictions un-addressed 🟡
- DRN item 4 follow-up: "Retrofit `AppState.blank` ... to call `BuilderState.blank` and `PlayerState.importScreen` as values, eliminating the inlined construction." Done — `app/state/state.ts:21-29` does call both. ✔ Resolved.
- DRN item 5 open question: file-format should it drop `number`? Not addressed. Open.
- DRN item 7 open: `CONFIRMABLE_INTENT_KINDS` derived from type — not addressed (see D1).
- DRN item 8 open: harden `Puzzle.withGrid` — not addressed (see D3).
- DRN item 9 open: `'landing'` ambiguous routing — not addressed (see D2).
- AD §0 principle 4 internal contradiction: AD's own §3.3 type catalogue uses plain `number` (`Word.length`, `AnagramEntry.position`, `Toast.createdAt/ttlMs`, `Rng.nextInt`) violating the binding principle — see H4. Fix requires AD §3.3 amendment.
- `DownloadPort.download` silent-failure path: no `Result` channel, double-swallowed errors, zero UI feedback on failed irreversible user action — see G7. Fix may require new `DownloadError` type + `DomainEvent` variant (design amendment).

---

## Summary

Top 5 by impact:
1. **A1** missing boundary self-test — design claims self-verification that doesn't exist.
2. **C1** `DisplacedClueId` non-UUID format diverges from AD §6.1.
3. **D1/D2/D3** reducer-dispatch string sets, ambiguous routing, `Puzzle.withGrid` gridSize drift — three acknowledged-but-unfixed DRN items that compound dispatch-correctness risk.
4. **B1/B2/B3** algorithm/UI duplication (findContainingWord ×4, cellsOfChain ×2, clue-panel sections) — structural maintenance load.
5. **A3** Cursor misplaced in Builder state module, type-imported everywhere.

Acknowledged-but-accepted (no action needed unless revisiting): A4, K2/K3 open items, F3.