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

### A2. `domain/` modules reach into `Grid` via raw indexing 🟠 ✅ Resolved
AD §3.2: "Grid is a 2D array but indexed only through `GridOps`." Violations:
- `src/domain/puzzle/CompletenessCheck.ts:21-24` — `p.grid[r]!` / `row[c]!`.
- `src/domain/word/WordDerivation.ts:9-13` — `g[r]` / `row[c]` raw indexing.
- `src/domain/word/Numbering.ts:25-27` — `grid[r]!` / `row.length`.
- `src/domain/grid/GridOps.ts:37,46,128-159` — acceptable inside `GridOps` itself, but exposes the pattern as the norm.
Reducer-adjacent raw indexing: `src/player/state/internal/solving.ts:331-334` (`g[r]!` / `row[c]!` in `handleCheck`), `src/player/state/internal/lifecycle.ts:138-149` (`handleConfirmResetPlayer`). Treats grid as a generic array, weakening the §3.2 invariant.

#### A2 — Fix
- `src/domain/puzzle/CompletenessCheck.ts`: replaced raw `p.grid[r]!` / `row[c]!` scan with `const size = p.grid.length` double loop using `GridOps.cellAt(p.grid, Row.of(r), Col.of(c))`; added `GridOps` import.
- `src/domain/word/WordDerivation.ts`: `isWhite` now reads only via `GridOps.cellAt` (in-bounds); dropped OOB-tolerant `undefined` short-circuits. Guarded run-length `while` with `(direction === 'across' ? cc : cr) < size` so callers never pass OOB coords. Added `GridOps` import.
- `src/domain/word/Numbering.ts`: scan now uses `const size = grid.length` and inner `< size`; removed `const row = grid[r]!`.
- `src/player/state/internal/solving.ts`: `handleCheck` scan replaced raw `g[r]!` / `row[c]!` with `const size = g.length` and `GridOps.cellAt(g, Row.of(r), Col.of(c))` (`GridOps` already imported).
- `src/player/state/internal/lifecycle.ts`: `handleApplyLoadedProgress` and `handleConfirmResetPlayer` now derive row/column bounds from `const size = g.length` instead of `g[r]!.length`.
- Verification (green): `npm run test` (77 files, 1021 passed), `npm run typecheck` (0 errors), `npm run lint` (eslint + `madge --circular` no cycles), `grep -rn 'g\[[^ ]*\]!\|\.grid\[[^]]*\]!\|g\[r\]!\|row\[c\]!' src/domain/puzzle src/domain/word src/player/state/internal` → empty.
- Out of scope (separate tasks): E1/E2 memoization, A1-style enforcement test, `GridOps.ts` internal raw indexing.

### A3. `Cursor` type lives in `builder/state/state.ts`, imported type-only by Player + grids/VMs ✅ Resolved
Was 🟠: `src/player/state/state.ts:8`, `src/player/state/internal/solving.ts:2`, `src/ui/bindings/viewmodels/gridVM.ts:11`, `src/ui/bindings/viewmodels/playerVM.ts:5` (the original audit's `builderVM.ts:2` reference was already stale — B1 removed that import; A3 only listed it because the smell predates B1) all `import type { Cursor } from '../../.../builder/state/state'`. Cursor is a shared domain concept, not a Builder concept. Placing it in `builder/state` makes Player/viewmodel logic depend (type-only) on a sibling state module — exactly the kind of cross-module coupling that `internal/` rules exist to prevent, here dodged because the symbol sits on a public root file. AD had no shared cursor module.

#### A3 — Fix
- Created `src/domain/grid/Cursor.ts` — `export type Cursor = { row: Row; col: Col; direction: Direction } | null;` (same shape + FR-7/C6 semantics as the old `builder/state/state.ts` def). Placement rationale: `Row`/`Col` live in `domain/grid/`; `GridOps.neighboursInDirection(d: Direction)` already type-imports `Direction` from `domain/word/` — no new layer edge. `Cursor` is a handle into the grid (a live cell + travel direction), so `domain/grid/` is the natural owner; `WordKey` (a word *start*) remains in `domain/word/`.
- `src/builder/state/state.ts` no longer owns `Cursor` — it `import type`s it from `domain/grid/Cursor` (now a consumer, not owner). The `BuilderState.cursor: Cursor` field is unchanged.
- Re-pointed all 4 prod importers (`src/player/state/state.ts`, `src/player/state/internal/solving.ts`, `src/ui/bindings/viewmodels/gridVM.ts`, `src/ui/bindings/viewmodels/playerVM.ts`) and 6 test importers (`test/ui/bindings/viewmodels/{playerVM,gridVM,builderVM}.test.ts`, `test/builder/state/internal/{joinSubMode,reattachSubMode,fillMode}.test.ts`) to `domain/grid/Cursor`. Where a test file mixed the `Cursor` import with the `BuilderState`/`BuilderMode`/`BuilderSubMode` value-or-type import from `builder/state/state`, the single import was split into two so the type-only `Cursor` no longer drags a Layer-1 dependency.
- **B1-fold**: `src/domain/word/WordSelection.findContainingWord` signature changed from the B1 workaround inline shape `{ row: Row; col: Col; direction: Direction }` to the named `Cursor` type. An early `if (cursor === null) return null;` guard replaces the B1 doc's "call-sites null-check before invoking" assumption — the function now accepts the nullable `Cursor` and is never called with a stale non-null variant type. `src/domain/word/WordSelection.ts` dropped its now-unused `Row`/`Col`/`Direction` type imports; only `Word` + `Cursor` remain.
- `src/ui/bindings/viewmodels/gridVM.ts` `GridVM.cursor` type changed from inline `{ row: Row; col: Col; direction: Direction } | null` to `Cursor`. The now-unused `Direction` type import in `gridVM.ts` was removed (`Row`/`Col` are still consumed by `GridCellVM`).
- `test/domain/word/WordSelection.test.ts` gained one new test `'returns null when cursor is null'`; the 8 existing tests were left unchanged (their inline non-null cursor literals are structurally compatible with `Cursor`'s non-null variant, so no call-site edits were needed).
- AD §1.3 module table (line 114 `domain/grid/` Owns adds `Cursor`; line 134 `builder/state/state.ts` Owns drops `Cursor`), §3.2 (new `Cursor` type block inserted before `Grid`), §3.3 (`WordSelection.findContainingWord` signature folded to `Cursor`; B1 workaround note re-anchored to A3), §4.3 (inline `Cursor` def replaced with `import type { Cursor } from '../../domain/grid/Cursor'` directive + A3 note), §5.2 (`GridVM.cursor` folded to `Cursor`), §9.3 file tree (`Cursor.ts` added under `domain/grid/`) amended.
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run test` (77 files, 1021 passed). `grep -rn "Cursor.*builder/state/state" src/ test/` → empty.
- Out of scope (separate tasks): A2 (raw grid indexing outside `GridOps`), A4 (`domain/persistence/` folder misnomer), E1 (memoization of `findContainingWord`+`WordMap`+`Chain.headOf` per VM tick — A3 fold does not add memoization, only clarifies the `Cursor` identity).

### A4. `domain/persistence/` folder misnomer (DRN item 1) 🟡 ✅ Resolved
Still unresolved per DRN. Folder holds `DownloadPort`/`FilePickPort` which are not persistence. `Rng` already hoisted to `domain/rng/`. Cheapest option (status quo) is the documented choice; flagged as acknowledged smell.

#### A4 — Fix
- Option A adopted 2026-08-18. Folder renamed via `git mv` from `src/domain/persistence/` to `src/domain/ports/`. 10 importers re-pointed, `eslint.config.js` `src/ports/**` allow-list regex + boundary fixture updated, AD §1.3/§2.1/§3.7/§9.2/§9.3 + DRN item 1 + this file amended. Verification commands run green.

---

## B. Duplication

### B1. `findContainingWord` / `findWordContaining` duplicated 4× ✅ Resolved
Was 🟠: identical linear-scan algorithm reimplemented:
- `src/player/state/internal/solving.ts:59-74`
- `src/player/state/internal/anagram.ts:17-32` (exact copy of solving's)
- `src/ui/bindings/viewmodels/builderVM.ts:139-156`
- `src/ui/bindings/viewmodels/playerVM.ts:264-281`

Belongs in `domain/word/` (pure function over `Word[]` + `Cursor`).

#### B1 — Fix
- Extracted shared pure function to `src/domain/word/WordSelection.ts` — `WordSelection.findContainingWord(words: Word[], cursor: { row: Row; col: Col; direction: Direction }): Word | null`. Linear scan, matches `direction`, across checks `startRow===r && c∈[startCol, startCol+length)`, down mirrors. Returns `null` (project nullable idiom, not `undefined`).
- **AD §9.2 respected**: `domain/word/` is Layer 0 — cannot import the `Cursor` type from `builder/state/` (Layer 1). Used the inline structural shape `{ row: Row; col: Col; direction: Direction }` instead. All 4 call-sites already null-check the nullable `Cursor` (`| null`) before invoking — function never receives a null cursor.
- `test/domain/word/WordSelection.test.ts` (8 tests): across hit, down hit, direction mismatch, cursor outside run, empty word list, other-direction ignore, last-cell vs one-past-end, first-match on overlap.
- Replaced all 4 sites: deleted local fns; `solving.ts:66` and `anagram.ts:23` flipped `=== undefined` → `=== null`; `builderVM.ts:110` and `playerVM.ts:84/130/221` already compared to `null`. Removed unused imports: `Cursor` from `builderVM.ts` (only the deleted local fn consumed it), `Word`/`Puzzle`/`Row`/`Col`/`Direction` type imports from `anagram.ts`.
- AD §3.3 type catalogue + §9.3 file tree + §10.1 coverage target amended to bless `WordSelection.ts` / `WordSelection.findContainingWord`.
- Verification (green): `npm run test` (76 files, 1012 passed), `npm run typecheck` (0 errors), `npm run lint` (eslint + `madge --circular` no cycles). `grep -rn "findWordContaining\|function findContainingWord" src/` → empty.
- Out of scope (separate tasks): B2 (`cellsOfChain`/`cellsOfWord` dup), E1 (memoization of `findContainingWord`+`WordMap`+`Chain.headOf` per VM tick), A3 (`Cursor` misplaced in `builder/state`).

### B2. `cellsOfWord` / `cellsOfChain` duplicated 2× verbatim ✅ Resolved
Was 🟠: Between `builderVM.ts:158-181` and `playerVM.ts:283-307`. Same chain-aware logic, copy-pasted. Both should derive from a single `domain/word/` or `ui/bindings/viewmodels/` helper.

#### B2 — Fix
- Extracted shared pure helpers to `src/domain/chain/ChainCells.ts` — `ChainCells.cellsOfWord(w: Word): Set<string>` (emits `"${row},${col}"` per cell along `w`'s run; across → `startRow` constant, `startCol+i`; down mirrors) and `ChainCells.cellsOfChain(words: Word[], cursorWord: Word | null): Set<string>` (builds `WordMap.fromWords(words)`, `Chain.headOf(wordMap, cursorWord.key)`, `Chain.fromHead(wordMap, head).members`, unions `cellsOfWord` of each member; returns `new Set<string>()` when `cursorWord === null`). Behavior identical to the deleted locals.
- **Placement rationale**: `domain/word/` cannot host `cellsOfChain` (it composes `domain/chain/Chain`; `Chain.ts` already imports `domain/word/*` → cycle). `domain/chain/` is the existing acyclic owner. AD §3.4 + §9.3 §10.1 amended to bless `ChainCells.ts`.
- Replaced both sites: `builderVM.ts:112` and `playerVM.ts:224` now call `ChainCells.cellsOfChain(state.puzzle.words, cursorWord)`. Deleted the local `cellsOfWord` + `cellsOfChain` from both files.
- Import cleanup: `builderVM.ts` `WordMap` (line 7) and `Chain` (line 11) were consumed *only* by the deleted local → removed. `playerVM.ts` keeps both (banner derivation at line 89/91 still uses `WordMap.fromWords` + `Chain.isHead`).
- `test/domain/chain/ChainCells.test.ts` (8 tests): across run, down run, direction drives r/c offset, null cursor → empty, single no-chain word, two-member chain union, cursor on non-head returns whole chain, empty words list.
- Existing `builderVM.test.ts` / `playerVM.test.ts` chain-highlight tests unchanged (output shape `Set<string>` preserved → `gridVM` `selectedWordCells: ReadonlySet<string>` contract intact).
- Verification: `npm run test`, `npm run typecheck`, `npm run lint` (eslint + `madge --circular`), `npm run ci` green. `grep -rn "function cellsOfWord\|function cellsOfChain" src/` → empty.
- Out of scope (separate tasks): E1 (memoization of `findContainingWord`+`WordMap`+`Chain.headOf` per VM tick), A3 (`Cursor` misplaced in `builder/state`), J1 (`Chain.headOf` O(n²) caching), J2 (`DisplayClue.forWord` duplicating `headOf`'s reverse-map walk).

### B3. `BuilderCluePanel.svelte` Across/Down sections near-duplicate ✅ Resolved
`src/ui/builder/BuilderCluePanel.svelte` lines 92-152 and 154-214 were structurally identical, differing only in `{#each vm.across...}` vs `{#each vm.down...}`. ~60 lines duplicated. Extracted one `<ClueSection>` component.

#### B3 — Fix
- Extracted `src/ui/builder/ClueSection.svelte` — presentational Svelte 5 component; props `{ title: string; entries: ClueEntryVM[]; isInJoinMode: boolean }`. Owns the per-row `drafts = $state(new Map<string,string>())` plus the helpers previously in the parent (`canonicalId`, `rowId`, `valueFor`, `setDraft`, `clearDraft`, `dispatchEditClue`, `dispatchBeginJoin`, `dispatchUnjoin`, `dispatchRowClick`, `stopPropagation`). Markup is the old Across-`<section>` body generalised from `vm.across` to `entries` and the literal `Across` heading to `{title}`.
- `BuilderCluePanel.svelte` now composes two children (`title="Across"`/`entries={vm.across}` and `title="Down"`/`entries={vm.down}`); both invocations share one identical row body via `ClueSection`. Parent keeps only `vm` prop, `panelEl` state, `isInJoinMode` derived, and the scroll-into-view `$effect`. The scroll effect was consolidated from two parallel for-loops (old lines 66-86) into one walk over `[...vm.across, ...vm.down]`, matching by `startRow`/`startCol`/`direction`; `rowId(entry)` format `${entry.direction}-${Number(entry.number)}` preserved so `document.getElementById` still resolves children's `<li id>`.
- Behaviour preserved exactly: same DOM id scheme, same `dispatchBuilder` intents (`click-clue-panel-word`, `begin-join`, `unjoin`, `edit-clue`), same `drafts` Map persistence, same scroll behaviour, same Tailwind classes. Unused `dispatchBuilder` import removed from parent (dispatch now in child); unused `canonicalId` removed from parent (new scroll loop compares fields directly); `ClueEntryVM` import retained for `rowId`.
- **Placement rationale**: `ui/builder/` (not `ui/shared/`) because the row body is Builder-specific (edit input + join/unlink buttons). `PlayerCluePanel.svelte` has a different, simpler row body (display only, no edit/join) and is not flagged by this smell; a shared `ClueSection` would force snippet/param soup. AD §7.2 + §9.3 tree amended to add `ClueSection.svelte` under `ui/builder/`.
- Verification: `npm run typecheck` (svelte-check 0 errors/0 warnings), `npm run lint` (eslint + `madge --circular`), `npm run test` (77 files / 1020 tests green), `npm run build`, `npm run ci` green.
- **Superseded 2026-08-20 by G8.** The B3 component extraction was the wrong tool: it deduplicated the row markup but split ownership of the scroll subsystem (one `<aside>` scroll container in the parent + the scrolled `<li>`s in the child), birthing smell G8's cross-component DOM-id contract (`document.getElementById(rowId(entry))` reaching from parent into child's `<li id>`). G8 collapsed `ClueSection.svelte` back into `BuilderCluePanel.svelte` and rededuplicated the row body via a Svelte 5 `{#snippet clueRow(entry)}` — preserving B3's dedup goal without a component boundary. AD §7.2 now carries a "Markup dedup guidance (from G8)" note: use `{#snippet}` for markup dedup that shares one reactive scope; extract a child component only at a genuine ownership boundary. The original B3 "Placement rationale" claim that a shared component "would force snippet/param soup" was wrong — the snippet is the cleaner primitive here. B3's dedup *intent* stands; only its *mechanism* (component extraction) was reversed.

### B4. `EMPTY` banner / blank-grid stub repeated in `playerVM.ts` import branch 🟡 ✅ Resolved
`derivePlayerShellVM` constructs a 2×2 blank grid + empty everything for the `phase==='import'` branch (`playerVM.ts:180-217`). Same shape partially repeated in `derivePlayerToolbarVM` import branch.

#### B4 — Fix
- Hoisted invariant import-phase VM pieces to module-level consts in `src/ui/bindings/viewmodels/playerVM.ts` (built once at module load, all pure): `IMPORT_GRID_VM` (`deriveGridVM` over `GridOps.blank(GridSize.of(2))`), `IMPORT_BANNER` (`emptyBanner()`), `IMPORT_CLUE_PANEL` (empty across/down + null key), `IMPORT_ANAGRAM` (`deriveAnagramModalVM({ anagramModal: null, ... })` → `CLOSED_BASELINE`-equivalent), `IMPORT_TOOLBAR` (all-false literal). Single source for the all-false toolbar; `derivePlayerToolbarVM` import branch now `return IMPORT_TOOLBAR;`.
- Added private `deriveImportShellVM(state: Extract<PlayerState, { phase: 'import' }>): PlayerShellVM` returning the import-phase `PlayerShellVM` assembled from the shared consts; only `importError: state.lastImportError` varies per call. `derivePlayerShellVM` import branch is now `return deriveImportShellVM(state);` (call-site narrowing carries the import variant through — no cast).
- Behaviour preserved: same field values; `vm.topBanner === vm.bottomBanner` (shared `IMPORT_BANNER`); `grid`/`anagram`/`toolbar`/`cluePanel` identity-stable across calls. Safe per AD §5.5 (components MUST NOT mutate VMs they receive).
- 2 new tests in `test/ui/bindings/viewmodels/playerVM.test.ts`: `'derivePlayerShellVM: import phase bottomBanner === topBanner (same shared instance)'`, `'derivePlayerShellVM: import phase grid + anagram + toolbar identical across two calls (module-level constants); only importError tracks state.lastImportError'`. Existing import-phase tests unchanged.
- Verification (green): `npm run test -- playerVM` (26 passed), `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (clean), `npm run ci` (77 files / 1023 tests + build green).
- Out of scope (separate tasks): E1 (memoization of `findContainingWord`+`WordMap`+`Chain.headOf` per VM tick), F8 (App.svelte autosave `$effect` split).

### B5. `void _deps; void _intent;` ceremony spans every reducer helper 🟡 ✅ Resolved
Every handler in `builder/state/internal/*` and `player/state/internal/*` begins with `void _deps;` (and often `void _intent;`) to silence `noUnusedParameters`. ~40 occurrences. Noise; signals an over-broad uniform `deps`/`intent` signature (`AD §4.2` reducer-signature block, lines 760-785) where most cases ignore both. Could narrow via overloads or a helper that strips unused params.

#### B5 — Fix
- AD §4.3 (lines 760-785) mandates the uniform `(state, intent, deps) -> { state, events }` signature ONLY for the three top-level reducers (`reduceApp`/`reduceBuilder`/`reducePlayer`). The internal helpers under `*/state/internal/*` are NOT bound by that rule — they are private implementation. Narrowed each exported helper to exactly the params it reads; removed all `void _deps;` / `void _intent;` / `void deps.now;` lines (48 occurrences across 8 files). The `@typescript-eslint/no-unused-vars` rule (error; default `argsIgnorePattern: '^_'`) already silences unused `_`-prefixed params, so the `void _x;` lines were redundant cargo — but the over-broad signature itself was the real noise, now gone.
- Precedent: `reconcileWords(grid, prevWords, derived, displacedClues, rng: Rng)` and the private `resetBuilder(state, rng: Rng)` already took `rng` (not full `deps`). The narrow-what-you-read pattern was established; this task applied it uniformly.
- Per-helper new signatures (full catalog): handlers that read no deps/intent drop those params entirely (`handleBackspace(state)`, `handleCheck(state)`, `handleClearErrors(state)`, `handleEscape(state)`, `handleCloseAnagramHelper(state)`, `handleOpenAnagramHelper(state)`, `handleRequestResetPlayer(state)`, `handleConfirmResetPlayer(state)`, `handleImportNewPuzzle()`, `handleExportIncomplete(state)`, `handleExportComplete(state)`, `handleRequestSwitchToDesign(state)`, `handleConfirmSwitchToDesign(state)`); handlers needing only rng take `rng: Rng` (`handleToggleDesignCell(state, intent, rng)`, `handleClickWord(state, intent, rng)`, `resolveJoin(state, source, target, rng)`, `handleRequestResetBuilder(state, rng)`, `handleConfirmResetBuilder(state, rng)`, `handleAnagramScramble(state, rng)`); `handleImportPuzzle(intent)` drops the unused leading `state` param (body returns a fresh `PlayerState`); `resolveReattach(state, displacedClueId, targetKey)` drops deps entirely (FR-43 success just moves clue text, no rng/now). Remaining handlers keep `(state, intent)`.
- `reduceBuilder` / `reducePlayer` signatures kept `(state, intent, deps)` per AD §4.3; only their call-sites changed (pass `deps.rng` where the helper now takes `rng`, drop trailing args otherwise).
- Behaviour preserved: pure signature narrowing + `void` line removal; no logic touched. Test assertions unchanged; only call-site arities updated in 9 `*/state/internal/*.test.ts` files. One incidental fixture improvement in `test/player/state/internal/anagram.test.ts`: replaced module-level shared `deps.rng` with fresh `new SeededRng(1)` per scramble call (the original FR-86 specific-letter test already used fresh inline `SeededRng(1)`; other scramble tests only asserted length/preservation which are rng-independent) — makes tests order-independent.
- Verification (green): `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` clean), `npm run test` (77 files / 1023 tests), `npm run build`, `npm run ci` green.

### B6. `TypingIntent` union defined three times — once private in `TypingSurface.svelte`, once inlined in `BuilderShell.svelte`, once inlined in `PlayerShell.svelte` 🟠 ✅ Resolved
`src/ui/shared/TypingSurface.svelte:4-8` declares `type TypingIntent` privately (not exported). `src/ui/builder/BuilderShell.svelte:24-31` and `src/ui/player/PlayerShell.svelte:20-30` each redeclare a structurally-identical `type TypingIntent` plus duplicate `function onTypingIntent`. Comment in `PlayerShell.svelte:19` acknowledges the duplication (`// TypingSurface TypingIntent union (inlined structural type — same shape as in BuilderShell.svelte)`). Three copies of the same discriminated union; no single source of truth. Adding a new intent variant requires editing three files in lock-step, with no compile-time guarantee they stay aligned (each shell's copy is structural). Fix: export `TypingIntent` from `TypingSurface.svelte` (or a sibling `.ts`) and import in both shells.

#### B6 — Fix
- Extracted shared type to `src/ui/shared/typingIntent.ts` — `export type TypingIntent = { kind: 'type-letter'; letter: string } | { kind: 'backspace' } | { kind: 'move-cursor'; direction: Direction; sign: -1 | 1 } | { kind: 'escape' }`. Type-only import of `Direction` from `domain/word/Direction.ts` (precedent: `ui/bindings/viewmodels/gridVM.ts` already type-imports `Direction` from the same path; AD §2.3 permits UI→domain type imports). Placement: `ui/shared/` sibling of `TypingSurface.svelte` per the smell's own stated fix.
- `src/ui/shared/TypingSurface.svelte`: deleted local `type Direction` alias + local `type TypingIntent` block (old lines 2-8); now `import type { TypingIntent } from './typingIntent'`. Arrow-key handlers still emit literal `'across'`/`'down'` strings, valid against the imported `Direction`. No behaviour change.
- `src/ui/builder/BuilderShell.svelte`: deleted `type Direction` + `type TypingIntent` (old lines 23-28); added `import type { TypingIntent } from '../shared/typingIntent'`. `function onTypingIntent` body unchanged — its switch is now exhaustive over the shared union, so a new variant would break compile here.
- `src/ui/player/PlayerShell.svelte`: deleted the acknowledging comment + inlined `type TypingIntent` (old lines 19-24); added `import type { TypingIntent } from '../shared/typingIntent'`. `function onTypingIntent` body unchanged.
- `function onTypingIntent` deliberately kept per-shell — B6's stated fix is "export `TypingIntent` ... and import in both shells"; the per-shell switches are now compile-checked against the shared union, which is the alignment guarantee B6 demands. Extracting the fn too would exceed the smell's scope.
- No new tests: B6 is a type-only refactor with no behaviour change; `test/ui/shared/` empty, no existing shell/`TypingSurface` tests. Matches B3 precedent.
- AD §7.4 (TypingSurface row amended to reference `typingIntent.ts` ownership) + §9.3 file tree (`typingIntent.ts` added under `ui/shared/`) amended.
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run test` (77 files / 1023 passed), `npm run ci` green. `grep -rn "type TypingIntent" src/` → exactly one match (`src/ui/shared/typingIntent.ts:3`).
- Out of scope (separate tasks): G1 (`document.getElementById('typing-surface-input')` cross-component focus coupling), G2 (hard-coded global input id), exhaustiveness `default: const _x: never = intent` hardening in each shell's switch.

---

## C. Validation / format drift

### C1. `DisplacedClueId.generate` emits raw 32-hex, not UUID v4 ✅ Resolved
Was 🔴: `src/domain/builder/DisplacedClueId.ts:9-12` produced 32 hex chars (`"abcd…"`). `PuzzleKey.generate` (`src/domain/puzzle/PuzzleKey.ts:10-18`) emitted UUID-v4 dashed form. AD §6.1 example: `"id": "<UUID v4>"`. Parser (`domain/format/v1.ts:487-535`) accepted any string for `displacedClue.id`, so round-trip worked but the serialized output diverged from the documented format and from PuzzleKey's id style. Inconsistent id minting.

#### C1 — Fix
- Extracted shared minting to `src/domain/uuid/uuidv4.ts` — pure `uuidv4(rng: Rng): string`; 16 bytes via `rng.nextInt(256)`, RFC 4122 version (0x40) + variant (0x80) masking, `8-4-4-4-12` dashed lowercase. `test/domain/uuid/uuidv4.test.ts` (4 tests).
- `DisplacedClueId.generate` (`src/domain/builder/DisplacedClueId.ts`) now delegates to `uuidv4(rng)`; added `DisplacedClueId.try(s)` (UUID v4 lowercase regex) — AD §3.3 amended.
- `PuzzleKey.generate` (`src/domain/puzzle/PuzzleKey.ts`) now delegates to `uuidv4(rng)`; behavior identical. Tests stay as integration guards.
- AD §3.3 + §9.3 tree amended: added `DisplacedClueId.try` to type catalogue, new `domain/uuid/uuidv4.ts` module.

### C2. `converted-puzzles/` directory specified by AD §9.3 tree absent 🟡 ✅ Resolved
AD §9.3 / B6 commit `converted-puzzles/*.json` as migrated record. Repo lacks the dir; `scripts/convert-puzzles.ts:95` writes to `join(cwd, 'converted-puzzles')` at run time, never committed. Also AD §9.3 describes `puzzles/` as "non-conforming (legacy `letter` field, no version)" — but `puzzles/puzzle1.json` is now in v1 format (verified `"version":1,"type":"complete"`). The design premise is stale; the directory's documented role no longer applies.

#### C2 — Fix
- Root cause: a prior audit's item B6 recommended a one-shot migration script (`scripts/migrate-puzzles.ts`) rewrite legacy `puzzles/*.json` (then using `letter`, lacking `version`/`type`) into `converted-puzzles/puzzleN-incomplete.json`. Commit `afd9f95 "convert puzzles and initial bugs list"` instead converted `puzzles/` in place to canonical v1 (`version: 1`, `type: 'complete'`, `puzzleLetter`, UUID-v4 `key`); the `converted-puzzles/` dir and the migrator role were both superseded. A later `scripts/convert-puzzles.ts` (name drift from AD's `migrate-puzzles.ts`) survived as a parse+reserialize round-trip normalizer writing to a never-committed `converted-puzzles/` dir. Repo was correct; the AD lagged.
- Deleted `scripts/convert-puzzles.ts` and the now-empty `scripts/` directory. Removed the `"convert-puzzles"` npm script and the `tsx` devDependency (its only consumer) from `package.json`; ran `npm install` to update `package-lock.json`.
- AD §1 table row (was "`converted-puzzles/` directory (from B6)"): replaced with a `puzzles/` directory row stating the files are canonical v1 samples, not referenced by app or tests, no migration script shipped.
- AD §3.7 (line 700): dropped the trailing "See migration note below for the existing `puzzles/*.json` files." clause; strict `letter`-field rejection note kept (parser behaviour unchanged).
- AD §3.7 (was "Migration note — existing `puzzles/*.json` files …"): rewritten as "Sample puzzle files — `puzzles/*.json`" stating canonical v1, not fixtures, no migration script.
- AD §9.3 tree: removed `converted-puzzles/` and `scripts/migrate-puzzles.ts` rows; relabelled `puzzles/` as "canonical v1 sample puzzle files; not referenced by app or tests".
- AD §12.2 line 1673 + §13 line 1747: re-anchored from `converted-puzzles/` migration path to `puzzles/*.json` canonical v1.
- Verification: `grep -rn 'converted-puzzles\|migrate-puzzles\|convert-puzzles' llmworkspace/ src/ test/ scripts/ package.json` → only the historical reference inside this C2 block (auditor's record of the prior state). `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run test` (77 files / 1023 passed), `npm run build` green.

### C3. `DisplacedClue` id uniqueness validated at parse but `PuzzleKey` format validated strictly ✅ Resolved
Was 🟡: `parsePuzzleV1` (`v1.ts`) enforced `key` via `PuzzleKey.try` regex; for `displacedClue.id` it only checked `typeof id === 'string'` + uniqueness (`v1.ts:518-529`). Asymmetric strictness.

#### C3 — Fix
- AD §6.3 step 11 amended: "each `id` is a valid lowercase UUID v4 string (`DisplacedClueId.try`) and unique within the array".
- `validateDisplacedClues` (`src/domain/format/v1.ts`) now calls `DisplacedClueId.try(id)` after the shape check and before the duplicate check; non-UUID id fails with `'displacedClue id is not a valid UUID v4: <id>.'`.
- `v1.test.ts` fixtures migrated from `'dc-1'`/`'id-1'`/`'same-id'` to valid inline UUID v4 literals (`UUID_A`/`UUID_B` consts). Added 2 new rejection tests (non-UUID `'not-a-uuid'`, legacy 32-hex `'ab'.repeat(16)`). Adjacent `DisplacedClue.test.ts` length-32 assertions migrated to length-36 + UUID v4 regex match.
- Acceptance decision: localStorage Builder snapshots carrying legacy 32-hex ids fail strict parse on reload → snapshot discarded → blank Builder. No migration code; per human decision.

### C4. `CompletenessCheck` never emits `invalid-answer-letter` 🟡 ✅ Resolved
`CompletenessViolation` AD §3.6 / `src/domain/puzzle/CompletenessCheck.ts:9-12` has an `'invalid-answer-letter'` variant, but `check()` only emits `missing-answer-letter` and `missing-clue`. `Cell.answerLetter` invariant prevents invalid letters, so variant is dead by construction. Either remove variant or make it truly redundant with the impossible-state principle (AD §0 principle 3).

#### C4 — Fix
- Option adopted 2026-08-18: **remove the variant** (principled per §0 Principle 3 — `Cell.answerLetter: Letter | null` where `Letter` is a range-checked branded type, so an invalid letter is unrepresentable; keeping a union member for an impossible state is itself a Principle-3 violation, so "make redundant" would preserve the dead representation).
- `src/domain/puzzle/CompletenessCheck.ts:12` — deleted `| { kind: 'invalid-answer-letter'; row: Row; col: Col; value: string }` from `CompletenessViolation` union; union now 2 members (`missing-answer-letter`, `missing-clue`).
- `src/builder/state/internal/importExport.ts:58-59` — deleted the dead `case 'invalid-answer-letter':` branch from `violationMessage` switch. Remaining 2 cases are exhaustive over the 2-member union; no `default` / `never` assertion needed; return type `string` still satisfied.
- No new tests: C4 is a type-only refactor + dead-branch deletion with no behaviour change. No existing test exercises the variant (grep `invalid-answer-letter` in `test/` empty). Matches B6/B3 precedent for type-only refactors.
- AD §3.6 (line 625 variant line deleted; note added citing §0 Principle 3) amended.
- Verification: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run ci` green; `grep -rn 'invalid-answer-letter' src/` → empty.
- Out of scope (separate tasks): E2 (`deriveBuilderToolbarVM` runs `CompletenessCheck.check` twice per call), C5 (parser constructs throwaway `PuzzleOps.blank` before overwriting).

### C5. Parser constructs a throwaway blank puzzle before overwriting with parsed contents ✅ Resolved
Was 🟡: `parsePuzzleV1` (`v1.ts:635-638`) built puzzle via 4-step scaffold: `PuzzleOps.blank(gridSize, puzzleKey)` → `withGrid` → `withWords` → `withMetadata`. `PuzzleOps.blank` (`Puzzle.ts:27-37`) calls `GridOps.blank(size)` (full N×N grid) + `Numbering.assign(grid, WordDerivation.derive(grid))` (empty grid → returns `[]` but still allocates). All that work thrown away next 2 lines; only `withMetadata` survived. Belt-and-suspenders scaffold.

#### C5 — Fix
- `src/domain/format/v1.ts:634-641` — replaced 4-step scaffold with direct `Puzzle` object literal: `{ key: puzzleKey, gridSize, grid, words: numberedWords, title: Title.try(titleRaw), author: Author.try(authorRaw) }`. All inputs already validated/branded upstream (`gridSize` GridSize-validated line 581; `grid` built from same `gridSize` via `buildDomainGrid` line 614 so `grid.length === Number(gridSize)` — no D3 drift risk; `numberedWords` `Word[]` from `Numbering.assign` line 622; `titleRaw`/`authorRaw` string-validated lines 588-590 + 603-605; `Title.try`/`Author.try` just brand, no throw). Behaviour identical: same 6 fields, same values.
- `src/domain/format/v1.ts:2` — removed now-unused `import { Puzzle as PuzzleOps } from '../puzzle/Puzzle';`. Kept `import type { Puzzle }` (line 1) for the literal annotation.
- No new tests: C5 is a dead-call removal + literal-for-scaffold refactor with no behaviour change. Existing parser tests cover: `test/domain/format/v1.test.ts` (35 tests) round-trip + parse happy paths assert `result.puzzle.{key,gridSize,words,grid}` (lines 140-579). All preserved.
- `Puzzle.blank`/`withGrid`/`withWords`/`withMetadata` retained — still used at `builder/state/state.ts:30`, `builder/state/reducer.ts:47,53`, `designMode.ts:30,41,68`, `joinSubMode.ts:59,114`, `reattachSubMode.ts:102`, `fillMode.ts:122,149,169,194,261`, `player/state/internal/solving.ts:202,237,262,331`, `player/state/internal/lifecycle.ts:80,127`.
- AD §3.7 (line 672) shows only `parsePuzzleV1` signature; no prose describes the blank-scaffold. No AD amendment needed.
- Verification: `npm run ci` green (lint incl. madge circular-check, typecheck 0/0, 1023 tests pass, vite build).

---

## D. State / reducer smells

### D1. Hand-maintained intent-kind string sets must stay in sync with the unions ✅ Resolved (DRN item 7 closed)
Was 🟠: `src/app/state/reducer.ts:11-45` had four parallel `ReadonlySet<string>` constants (`BUILDER_INTENT_KINDS`, `PLAYER_INTENT_KINDS`, `CONFIRMABLE_INTENT_KINDS`, `AMBIGUOUS_INTENT_KINDS`). Adding a new intent kind required touching the union AND the matching set(s); no compiler link. DRN item 7 noted deferred "static type-derived set" fix. Concrete drift risk: `AMBIGUOUS_INTENT_KINDS` was the intersection hardcoded — if a seventh shared kind was added to both unions but not to this set, intent silently routed (or threw).

#### D1 — Fix
- Extracted all four sets to new `src/app/state/intentKinds.ts`. The first three (`BUILDER_INTENT_KINDS`, `PLAYER_INTENT_KINDS`, `CONFIRMABLE_INTENT_KINDS`) are built from `Record<Kind, null>` record literals annotated with `satisfies` so `tsc` fails the build when a key is missing or an extra key is present — the union is the single source of truth, the Set is a derived view. `BuilderIntentKind`/`PlayerIntentKind`/`ConfirmableIntentKind` are extracted via `extends { kind: infer K }` conditional types.
- `AMBIGUOUS_INTENT_KINDS` is now computed at module load as the runtime intersection of the Builder and Player sets (`new Set([...BUILDER].filter(k => PLAYER.has(k)))`); adding a shared kind to both unions automatically enrols it in the ambiguous set — no manual string maintenance.
- `src/app/state/reducer.ts` imports the four sets from `intentKinds.ts`; dispatch body unchanged (set names preserved).
- `test/app/state/intentKinds.test.ts` (6 tests) — hand-listed fixture arrays assert each set equals exactly the expected kinds (double-lock against removal: `satisfies` catches additions/omissions at compile time, tests catch accidental removal at runtime), `AMBIGUOUS` equals the intersection, confirmable kinds are members of Builder or Player, AppIntent kinds are not in any set.
- AD §1.3 module table, §4.1 prose, §9.3 file tree amended: added `intentKinds.ts` row / file / paragraph.
- DRN item 7 resolution appended (2026-08-10): closed. D2 (ambiguous `'landing'` routing) remains open — D1 fix does not touch the `state.route`-based ambiguous dispatch, only the kind-set derivation. D2 is a separate smell with its own deferred decision.

### D2. Ambiguous intent on `route === 'landing'` silently routes to Builder ✅ Resolved (DRN item 9 closed)
Was 🟠: `src/app/state/reducer.ts:105-106`. A Player intent dispatched before `navigate play` ran through `reduceBuilder`, mutating Builder state. DRN flagged this as "back-compat silent fallback"; considered deferred. Real silent-state-change risk if a stray dispatch landed during landing. **Fix path required DRN item 9 resolution (reject ambiguous intents on landing, or force explicit `navigate` first).**

#### D2 — Fix
- DRN item 9 resolved (2026-08-10): option A — **throw** on ambiguous kind during `route === 'landing'`. Rationale: FR-1/FR-2 require the landing screen to present only `navigate` Build/Play actions; no Builder or Player UI is mounted on landing, so an ambiguous kind dispatched during landing is necessarily a bug. The previous silent routing hid the bug and mutated `state.builder` with no user-visible signal.
- `src/app/state/reducer.ts:69-77` `case 'landing'` now throws an `Error` reproducing the unknown-kind throw pattern already in use at line 66 (same message shape: `reduceApp: ambiguous intent kind on landing route: <kind>; navigate first`). `routeToBuilder`/`routeToPlayer` helpers unchanged (still used by `'build'`/`'play'` branches); `AMBIGUOUS_INTENT_KINDS` set unchanged; no new intent kinds; no UI/bindings layer change.
- `test/app/state/reducer.test.ts:245-257` rewritten: the single test that asserted landing→Builder cursor mutation now asserts `reduceApp(landingState, { kind: 'select-cell', ... }, deps)` throws. Test text renamed from "(back-compat)" to "(rejects without navigate)". No other test dispatches ambiguous kinds during landing — verified via repo grep of `route: 'landing'` / `route='landing'`.
- AD §4.1 prose amended: ambiguous dispatch routes `'build' → reduceBuilder`, `'play' → reducePlayer`, `'landing' → throws` (closing D2 / DRN item 9).
- DRN item 9 resolution appended to `llmworkspace/design_review_notes.md` §9 (2026-08-10): closed. D3 (`Puzzle.withGrid` gridSize drift, DRN item 8) remains open — separate smell, separate deferred decision; D2 fix does not touch the aggregate or the wither.

### D3. `Puzzle.withGrid` does not sync `gridSize`; `change-grid-size` patches locally ✅ Resolved (DRN item 8 closed)
**Resolved 2026-08-10 (DRN item 8 closed).** `Puzzle.withGrid` now re-syncs `gridSize` from `g.length` via `GridSize.of(g.length)`; the redundant `gridSize: intent.size` re-write in `designMode.ts:71` is removed; the test at `Puzzle.test.ts:100` encoding the stale-gridSize behavior was flipped to assert the invariant. `src/domain/puzzle/Puzzle.ts:50-52` is `{ ...p, grid: g, gridSize: GridSize.of(g.length) }`. Every other `withGrid` call-site is a same-size swap and is unaffected. **DRN item 8 deferred decision (harden in one place) is now adopted.**

### D4. `handleClickWord` double-scans `words` then non-null asserts 🟡 ✅ Resolved
`src/builder/state/internal/fillMode.ts:294-300`: `words.some(w => WordKey.equals(w.key, intent.wordKey))` then `words.find(...)!`. Two O(n) scans + a non-null assertion. Combine into one `find`.

#### D4 — Fix
- Replaced the `.some()` guard + separate `.find(...)!` with a single `words.find(...)` + `if (target === undefined) return Result.ok(state);` early-return in `src/builder/state/internal/fillMode.ts` `handleClickWord`. The `none` branch now reads `target` directly (no `!`); `join`/`reattach` branches pass `intent.wordKey` (unchanged, `target` computed but unused there). `handleClickWord(state, intent, rng)` signature preserved per B5.
- No new tests: pure refactor, behaviour preserved. Existing `test/builder/state/internal/fillMode.test.ts:803-891` covers design-mode no-op, wordKey-not-found defensive no-op (exercises the new `undefined` early-return), subMode=none cursor nav, join/reattach delegation, source===target cancel — all unchanged and green.
- Verification (green): `npm run test -- fillMode` (59 passed), `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` clean). `grep -n "words\.some\|words\.find" src/builder/state/internal/fillMode.ts` → one `find` in `handleClickWord` (line 275); the other `find` at line 242 is the unrelated `handleEditClue`. Zero `words.some` in file.
- Out of scope (separate tasks): E1/E2 memoization, D5 (`DisplacedClueId` ad-hoc equality), D6 (grid rebuild via repeated `GridOps.setCell`).

### D5. `DisplacedClueId` ad-hoc equality via `String(a) === String(b)` 🟡 ✅ Resolved
`src/builder/state/internal/reattachSubMode.ts:12` defines `idEquals` by stringifying branded ids; uses `String(d.id) === String(displacedClueId)` again at lines 71, 107. Branded-type contract has no `equals` helper (unlike `WordKey.equals`, `Letter.equals`). Manual brand-erase at every comparison.

#### D5 — Fix
- Added `DisplacedClueId.equals(a, b): boolean` to `src/domain/builder/DisplacedClueId.ts` const object — body `return a === b;` (branded string primitive; `===` is value equality, behavior identical to the prior `String(a) === String(b)` brand-erase). Matches the `Letter.equals` precedent (`src/domain/letter/Letter.ts:28-30`).
- `src/builder/state/internal/reattachSubMode.ts`: deleted local `idEquals` fn (line 11); flipped `import type { DisplacedClueId }` → `import { DisplacedClueId }` (runtime call now). 4 `idEquals(x, y)` call-sites → `DisplacedClueId.equals(x, y)` (lines 21, 36, 41, 44). 2 raw `String(d.id) ===/!== String(displacedClueId)` → `DisplacedClueId.equals(...)` / `!DisplacedClueId.equals(...)` (lines 61, 97 inside `resolveReattach`). Logic, control flow, return shapes preserved.
- 1 new test in `test/domain/builder/DisplacedClueId.test.ts`: `'DisplacedClueId.equals returns true for the same id, false for different ids'` (mirrors `Letter.equals` test shape; uses two `SeededRng(1)` ids + one `SeededRng(2)` id). Existing 7 tests unchanged.
- AD §3.3 `DisplacedClueId` const block amended: added `equals(a: DisplacedClueId, b: DisplacedClueId): boolean;` member (mirrors `Letter` block line 248).
- Verification (green): `npm run test`, `npm run typecheck`, `npm run lint`, `npm run ci`. `grep -rn "String(d\.id)\|String(.*displacedClueId)\|idEquals" src/` → empty.
- Out of scope (separate tasks): E1/E2 memoization, D6 (`applyLoadedProgress`/`confirmResetPlayer` grid rebuild via repeated `GridOps.setCell`).

### D6. `applyLoadedProgress` and `confirmResetPlayer` mutate grid via repeated `GridOps.setCell` rebuilding whole grid each cell 🟡 ✅ Resolved
`src/player/state/internal/lifecycle.ts:67-82,136-150`. For a 25×25 grid with many letters, this rebuilds the grid array N times (one per cell). A `GridOps` "update many cells" / functional updater API would be O(1) restructures over the affected rows.

#### D6 — Fix
- Added `GridOps.updateCells(g: Grid, updates: ReadonlyArray<{ row: Row; col: Col; cell: Cell }>): Grid` to `src/domain/grid/GridOps.ts` — batch immutability primitive. Empty `updates` → returns `g` ref-equal (no allocation). All-or-nothing bounds check up front: validates every update via `GridOps.withinBounds` and throws `RangeError` (reusing the existing `outOfBoundsMessage` helper) on the first OOB entry before any mutation — never half-applies. Single outer-array clone (`[...g`); each touched row shallow-copied lazily on first touch (tracked by a `Set<number>` of row indices); untouched rows keep their original reference. Cells at untouched `(row, col)` keep their original `Cell` reference (same no-deep-clone-of-unchanged-cells contract as `setCell`). Matches `setCell` style; internal raw indexing acceptable inside `GridOps` per A2 fix note.
- AD §3.2 `GridOps` block + Grid invariants amended: `updateCells` member line inserted after `setCell`; new invariant "validates all updates up front and throws `RangeError` on the first out-of-bounds entry before mutating (all-or-nothing); empty `updates` returns `g` ref-equal" added.
- `src/player/state/internal/lifecycle.ts` `handleApplyLoadedProgress`: replaced the per-cell `GridOps.setCell` loop with a collect-then-batch pattern. Walks the same `Math.min` intersection bounds; for each non-null `saved` on a non-black cell (read from the immutable `g`, not a running `newGrid` — equivalent because `Cell.setPlayerLetter` only overwrites `playerLetter` and does not read the prior value, and each update targets a distinct `(row, col)`), pushes `{ row, col, cell: Cell.setPlayerLetter(cell, saved) }` onto an `updates` array. `if (updates.length === 0) return Result.ok(state);` preserves the existing ref-equal no-op contract (`test/player/state/internal/lifecycle.test.ts:397` "returns original state reference when nothing changed"). Otherwise `const newGrid = GridOps.updateCells(g, updates);` + `Puzzle.withGrid`.
- `src/player/state/internal/lifecycle.ts` `handleConfirmResetPlayer`: same collect-then-batch pattern over the full `size×size` scan. For each white cell with `playerLetter !== null`, pushes `{ row, col, cell: Cell.setPlayerLetter(cell, null) }`. `const newPuzzle = updates.length === 0 ? state.puzzle : Puzzle.withGrid(state.puzzle, GridOps.updateCells(g, updates));` preserves the existing ref-equal grid contract (`test/player/state/internal/lifecycle.test.ts:690` asserts `result.state.puzzle.grid === state.puzzle.grid` when no playerLetters were set). Rest unchanged: cursor/checkResult/anagram reset + `clear-player-storage` event.
- Behaviour preserved: pure `setCell`-loop → `updateCells`-batch refactor; no logic touched. Helper signatures unchanged (`handleApplyLoadedProgress(state, intent)`, `handleConfirmResetPlayer(state)` per B5).
- 6 new tests in `test/domain/grid/GridOps.test.ts`: empty updates → ref-equal; applies all + leaves others unchanged; touched rows cloned once + untouched rows ref-equal; outer grid cloned once; OOB throws + grid unmutated (all-or-nothing); multiple updates same row one pass. No new lifecycle tests — existing 12 `handleApplyLoadedProgress` + 11 `handleConfirmResetPlayer` tests stay green unchanged.
- Verification (green): `npx vitest run test/domain/grid/GridOps.test.ts` (27 passed), `npx vitest run test/player/state/internal/lifecycle.test.ts` (42 passed), `npm run typecheck` (0 errors / 0 warnings), `npm run lint`, `npm run ci` (77 files / 1030 tests + build green).
- Out of scope (separate tasks): E1/E2 memoization, `solving.ts:327` `handleCheck` same `setCell`-loop pattern (not named by D6), H2 (`withinBounds` idiom).

---

## E. Viewmodel smells

### E1. `findContainingWord` + `WordMap.fromWords` + `Chain.headOf` + `Chain.fromHead` recomputed on every VM derivation 🟠 ⏸ Deferred 2026-08-18
`builderVM.ts:109-111,158-172`, `playerVM.ts:219-223,293-306`, `cluePanelVM.ts:44-51`, `anagramVM.ts:55-62`. Each `deriveXShellVM` call (per `$derived` tick / per keystroke) allocates a `WordMap`, walks predecessors to find the chain head, builds a `Chain.fromHead`. For a 25×25 grid, every cursor move does several full word-list scans + map allocations. No memoization; correctness unaffected.

#### E1 — Deferral
- Deferred 2026-08-18. Fix sketched (introduce `ui/bindings/viewmodels/chainIndex.ts` — pure `ChainIndex.forWords(words): ChainIndex` building wordMap + position index + head-set + lazy per-instance caches; store layer wraps in `$derived`; VM fns take `idx` param; O(words²) `cluePanelVM` per-word loop collapses to O(words)); deferred because the asymptotic win is real but the absolute cost on a 25×25 grid is not user-visible and the change widens every VM signature + touches all VM unit tests.
- Two design questions surfaced during analysis, unresolved:
  1. **Across-tick memoization.** Svelte 5 `$derived` re-runs every dispatch (root `$state` reassign fires dependents regardless of input-ref identity), so `const idx = $derived(ChainIndex.forWords(...words))` rebuilds idx every tick — giving one shared idx per tick (the O(words²)→O(words) win) but not idx reuse across keystrokes when words ref is stable. Across-tick memo would require a module-level `WeakMap<Word[], ChainIndex>` keyed by words ref — flagged as non-idiomatic for this codebase (implicit global singleton; invisible to `madge --circular`; not in Svelte's reactivity graph; test-isolation relies on fixture-ref-uniqueness convention). Decision: drop across-tick memo, accept per-tick O(words) build. Revisit with profiling data if needed.
  2. **Cache-key invariant reliance.** Any fix relies on reducers never mutating `Word` objects (`nextWord`, `clue`) or the `words[]` array in place — currently true, no compiler enforcement. Module-level WeakMap would make a future in-place mutation silently stale; `$derived`-per-tick makes it silently wrong only within one tick (less bad). Either way the invariant is unenforced.
- Resuming this task: pick up from the `chainIndex.ts` sketch above; resolve Q1 (WeakMap vs per-tick rebuild) and Q2 (invariant enforcement — dev-assert? AD bullet? lint rule?) before dispatching.

### E2. `deriveBuilderToolbarVM` runs `CompletenessCheck.check` twice per call 🟡 ✅ Resolved
`builderVM.ts:70-71`: `CompletenessCheck.isComplete(state.puzzle)` (which calls `.check()` internally) then `CompletenessCheck.check(state.puzzle)` again. Double O(grid²+words) work per VM tick.

#### E2 — Fix
- `src/ui/bindings/viewmodels/builderVM.ts` `deriveBuilderToolbarVM`: hoisted `const exportCompleteViolations = CompletenessCheck.check(state.puzzle);` before the return; `canExportComplete: exportCompleteViolations.length === 0` (inlines the `isComplete` body — `check(p).length === 0`); `exportCompleteViolations` field now reads the local. Single `check` call per tick.
- `CompletenessCheck` API unchanged (`check` + `isComplete` stay; AD §3.6 lines 632-634 untouched). `isComplete` still used at `importExport.ts:76` and tested at `CompletenessCheck.test.ts:161,186`.
- No new tests: pure refactor, no behaviour change. Existing `test/ui/bindings/viewmodels/builderVM.test.ts:113-182` (blank state `canExportComplete=false`; complete state `canExportComplete=true` + `exportCompleteViolations=[]`; `exportCompleteViolations` equals `CompletenessCheck.check(state.puzzle)`) assert values not call-site — stay green.
- Verification (green): `npm run test -- builderVM` (22 passed), `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` clean), `npm run ci` (1030 tests + build). `grep -n "CompletenessCheck" src/ui/bindings/viewmodels/builderVM.ts` → import + one `check` call-site only.

### E3. `deriveAnagramModalVM` indexes `scrambledArrangement` by absolute entry index `i` 🟡 ✅ Resolved
`anagramVM.ts:86-91`: `scrambled[i]!` where `scrambled` is `Letter[]` filtered to non-nulls in the reducer (`player/state/internal/anagram.ts:104-106`). Alignment holds only because scramble is gated on `inputValid` (full-length input), so every non-fixed position is non-null; if the gate ever weakens, indexing silently desyncs. Fragile contract between reducer's filtered array shape and VM index assumption.

#### E3 — Fix
- Option A adopted (structural alignment, not reducer-side gate).
- `src/player/state/state.ts:21` field widened `Letter[] | null` → `(Letter | null)[] | null`.
- `src/player/state/internal/anagram.ts:75-77` dropped `.filter((l): l is Letter => l !== null)`; reducer now stores `scrambled.map((e) => e.letter)` entries-aligned (nulls preserved). `Letter` value import retained (still used by `Letter.from(intent.input)`).
- `src/ui/bindings/viewmodels/anagramVM.ts:85-97` tile derivation simplified: dropped `i < scrambled.length` guard + `scrambled[i]!` assertion; now `scrambled[i] == null ? null : String(scrambled[i])` (null-preserving, covers `noUncheckedIndexedAccess` `undefined`).
- AD §3.3 (field widened + comment), §4.4 (anagram-scramble prose appended), §5.4 (`AnagramTileVM.letter` comment corrected — "input pool" clause was inaccurate; VM never reads input pool) amended.
- 2 new tests: `'anagram-scramble: scrambledArrangement is entries-aligned when input is short (E3 structural contract)'` (reducer, input `'BA'` covers 1 fixed + 1 pool → arrangement `[B, null, A]` under `SeededRng(1)`), `'deriveAnagramModalVM: non-fixed tile reads entries-aligned scrambledArrangement[i] (E3 — short input does not desync)'` (VM, injected `[B, null, A]` → tiles `[B, null, A]`). Existing tests unchanged (full-length inputs → no nulls → entries-aligned === filtered shape).
- Verification: `npx vitest run test/player/state/internal/anagram.test.ts test/ui/bindings/viewmodels/anagramVM.test.ts test/ui/bindings/playerStore.test.ts test/player/state/reducer.test.ts test/player/state/internal/lifecycle.test.ts test/player/state/internal/solving.test.ts` (226 passed), `npm run typecheck` (clean), `npm run lint` (clean), `npm run ci` (clean).
- Out of scope: E1 memoization, reducer-side `inputValid` gate on `anagram-scramble` (structural fix makes it redundant), H4 branded `Position`/`WordLength`.

### E4. `cluePanelVM` re-derives `selectedChainMemberKeys` even when cursor moved off-cluster 🟡 ⏸ Deferred 2026-08-18
`cluePanelVM.ts:46-51` runs `Chain.headOf`+`fromHead` whenever `highlightedWordKey !== null`. For a long chain, builds a set on every VM derivation.

#### E4 — Deferral
- Deferred 2026-08-18. E4 is a strict subset of E1 (cross-tick memoization of `ChainIndex`) and J1 (`Chain.headOf` O(n²) — no reverse-map caching). The null-highlight case is already O(1); the head case is one O(words) `isHead` scan; the only expensive case is a non-head cursor deep in a long chain, which is exactly what J1 fixes in the right place (inside `Chain.headOf` itself — all callers benefit, no `cluePanelVM` branching).
- The only contained in-isolation fix sketched was a head fast-path using the `nonHeadKeys` set the function already builds (`!nonHeadKeys.has(highlighted) → skip Chain.headOf, call Chain.fromHead directly`). Honest assessment: marginal — saves one O(words) `isHead` scan per tick when cursor is on a head, does NOT address the body's "long chain" cost (the non-head case → J1), adds a conditional that J1 will make redundant. Net cost-benefit unfavorable.
- Rejected alternative: inline `Chain.headOf`'s reverse walk with a local predecessor map inside `cluePanelVM` for O(words+chain) non-head case. That duplicates `headOf`'s logic + cycle detection — introduces a J2-style duplication smell to fix an E4 smell. The right home is J1.
- Resuming this task: pick up via E1 (introduce `ui/bindings/viewmodels/chainIndex.ts` — `ChainIndex.forWords(words): ChainIndex` with cached reverse map + head-set; store layer wraps in `$derived`; `cluePanelVM` consumes `idx`) or via J1 (cache `Chain.headOf`'s reverse predecessor map). Either automatically fixes E4. Do NOT pursue the head fast-path in isolation — wait for E1/J1.

---

## F. Persistence / bindings smells

### F1. `persistenceScheduler.ts` mixes serialize + parse + schedule in one 270-line file 🟠 ✅ Resolved
Single module owns: `serializeBuilderSnapshot`, `parseBuilderSnapshot`, `serializePlayerProgress`, `parsePlayerProgress`, `PersistenceScheduler` interface, and `createPersistenceScheduler` impl. AD §9.3 lists `persistenceScheduler.ts` (singular) so the layout is design-blessed, but cohesion is low.

#### F1 — Fix
- Split into `src/ui/bindings/persistenceCodec.ts` (146 lines, pure) + `src/ui/bindings/persistenceScheduler.ts` (128 lines, stateful). Codec file owns `BuilderSnapshot` + `serializeBuilderSnapshot` + `parseBuilderSnapshot` + `PlayerProgressBlob` + `serializePlayerProgress` + `parsePlayerProgress` (verbatim move of old lines 16-147 + their imports, minus `StoragePort` which codec never touched). Scheduler file keeps `PersistenceScheduler` interface + `createPersistenceScheduler` impl; imports only `serializeBuilderSnapshot` + `serializePlayerProgress` from `./persistenceCodec` (scheduler never parses — parse fns are called directly by `appStore` and `main.ts`).
- No re-export shim. Explicit deps. Importers re-pointed: `src/main.ts:13` `parseBuilderSnapshot` → `./ui/bindings/persistenceCodec`; `src/ui/bindings/appStore.svelte.ts:14` `parsePlayerProgress` → `./persistenceCodec` (keeps `createPersistenceScheduler` + `PersistenceScheduler` from `./persistenceScheduler`); `test/ui/bindings/persistenceScheduler.test.ts:3-15` import block split — codec symbols from `./persistenceCodec`, scheduler symbols from `./persistenceScheduler`. Other test files (`builderStore`/`appStore`/`playerStore`/`modalStore`/`toastStore`) unchanged (only import `createPersistenceScheduler`).
- No new tests. Pure file split, zero behavior change. Existing `persistenceScheduler.test.ts` (25 tests) covers every moved codec fn + the scheduler via the new import paths. Test file not split — it tests the persistence module's public API; the source split is an internal layout concern.
- AD §9.3 line 1504 tree amended: `ports.ts  persistenceScheduler.ts` → `ports.ts  persistenceCodec.ts  persistenceScheduler.ts`.
- Verification (green): `npx vitest run test/ui/bindings/{persistenceScheduler,appStore,builderStore,playerStore,modalStore,toastStore}.test.ts` (6 files / 91 passed), `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run ci` (1032 tests + build). `grep -rn 'persistenceScheduler' src/ test/ | grep -E 'serialize|parse|BuilderSnapshot|PlayerProgressBlob'` → empty; codec symbols no longer flow through `persistenceScheduler`.
- Out of scope (separate tasks): F2 (duplicate `displacedClues` field in `serializeBuilderSnapshot`), F3 (dead `now` param in `createPersistenceScheduler` — `void now;` line preserved), F7 (mixed error strategy in `parsePlayerProgress`).

### F2. `serializeBuilderSnapshot` embeds puzzle JSON twice: inside `puzzle` object AND top-level `displacedClues` 🟡 ✅ Resolved
`persistenceScheduler.ts:26-37`: `puzzleObj.displacedClues` carries the displaced clues (puzzle JSON), then `wrapper.displacedClues = puzzleObj.displacedClues ?? []` duplicates them at the wrapper level. On reload, `parseBuilderSnapshot` re-parses `snap.puzzle` (the embedded puzzle) and reads `result.displacedClues` from there — the top-level `displacedClues` is unread. Dead duplicated field.

#### F2 — Fix
- `src/ui/bindings/persistenceCodec.ts` `serializeBuilderSnapshot`: dropped the `as { displacedClues?: unknown }` cast on `puzzleObj` (only existed to read the field being duplicated) and deleted the wrapper-level `displacedClues: puzzleObj.displacedClues ?? [],` line. Wrapper shape is now `{ version, kind: 'builder-snapshot', puzzle: <incomplete puzzle JSON>, mode, subMode: 'none' }` — `displacedClues` lives only inside the embedded puzzle via `serializeIncomplete`. Comment `// includes displacedClues field already` on the `puzzle:` line retained (still accurate).
- `parseBuilderSnapshot` unchanged: already read `displacedClues` from `result.displacedClues` (parsed embedded puzzle), never from the wrapper field. `BuilderSnapshot` type (`{ puzzle, displacedClues, mode }`) unchanged — its `displacedClues` field is the parsed return type, not the wrapper JSON shape.
- Behaviour preserved for round-trip: `main.ts:61` sources `snapshot.displacedClues` from the parser return; no reader of wrapper-level `displacedClues` existed in `src/` or `test/` (verified via grep). Existing prod localStorage blobs carrying the legacy top-level field parse unchanged (parser ignores it).
- 1 test rewritten in `test/ui/bindings/persistenceScheduler.test.ts`: the old `'serializeBuilderSnapshot: the embedded puzzle has its displacedClues matched in the snapshot top-level displacedClues'` (asserted the dup) → new `'serializeBuilderSnapshot: no top-level displacedClues field (lives only inside embedded puzzle)'` (asserts `parsed.displacedClues` is `undefined` and `parsed.puzzle.displacedClues` still carries the clue entries). Other 24 tests unchanged; round-trip test at line 99 sources from parser return, unaffected.
- AD §4.4 (line 972) amended: dropped `displacedClues: [...]` from Builder snapshot blob shape; note added citing F2 — displacedClues lives only inside embedded puzzle JSON.
- Verification (green): `npx vitest run test/ui/bindings/persistenceScheduler.test.ts` (25 passed), `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run ci` (77 files / 1032 tests + build). `grep -n 'puzzleObj\.displacedClues' src/` → empty.
- Out of scope (separate tasks): F3 (dead `now` param in `createPersistenceScheduler`), F7 (mixed error strategy in `parsePlayerProgress`), F8 (App.svelte autosave `$effect` split), F9 (eager app state init at module import).

### F3. `createPersistenceScheduler` accepts `now: () => number` then `void now` 🟡 ✅ Resolved
`persistenceScheduler.ts:166-169`. Dead param retained "for future timestamping" — unused; callers must still pass it (defaulted). API surface noise.

#### F3 — Fix
- `src/ui/bindings/persistenceScheduler.ts` `createPersistenceScheduler`: dropped the `now: () => number = () => Date.now(),` param and the `void now; // kept for future timestamping; currently unused` line. New signature `(storage: StoragePort, debounceMs: number = 400): PersistenceScheduler`. Scheduler never timestamps blobs — `now` was pure API noise. Body otherwise unchanged.
- No caller changes: grep-confirmed zero callers passed `now` (prod `appStore.svelte.ts:21,30` call `createPersistenceScheduler(getPorts().storage)`; all 6 test files call `createPersistenceScheduler(storage)` or `createPersistenceScheduler(storage, 400)`). Defaulted param was never exercised.
- `now` clock remains in use elsewhere — reducer `deps.now` (AD §4.3 lines 741/770/776/784), `Toast.create` (`domain/notifications/Toast.ts`), `main.ts:78`. Separate concern; untouched.
- No AD amendment: `createPersistenceScheduler` signature is not AD-specified (only reducer `deps.now` is AD-blessed). Scheduler signature is impl detail.
- No test changes: no test asserts the `now` param. Existing 25 `persistenceScheduler.test.ts` + 6 store test files unaffected.
- Verification (green): `npx vitest run test/ui/bindings/persistenceScheduler.test.ts` (25 passed), `npx vitest run test/ui/bindings/{builderStore,appStore,playerStore,modalStore,toastStore}.test.ts` (66 passed), `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run ci` (77 files / 1032 tests + build). `grep -n 'void now\|now:.*=>.*number' src/ui/bindings/persistenceScheduler.ts` → empty.
- Out of scope (separate tasks): F7 (mixed error strategy in `parsePlayerProgress`), F8 (App.svelte autosave `$effect` split), F9 (eager app state init at module import).

### F4. `createBlankKeyRng` in `appStore.svelte.ts` is a no-op wrapper 🟡 ✅ Resolved
`appStore.svelte.ts:23-25` returns `getPorts().rng`. Used once at module init. Dead indirection.

#### F4 — Fix
- `src/ui/bindings/appStore.svelte.ts`: deleted the `createBlankKeyRng` fn (old lines 23-25) and inlined its sole call-site at line 19 → `PuzzleKeyCtor.generate(getPorts().rng)`. Same value, no indirection. `Rng` type import (line 9) retained — still used by `AppDeps` type (line 17). `getPorts` already imported (line 12).
- No AD amendment: `createBlankKeyRng` not in AD. Impl detail.
- No test changes: `createBlankKeyRng` was not exported, not referenced by any test (grep-confirmed). Module-level `state` init at line 19 still constructs the same blank AppState identically.
- Verification (green): `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npx vitest run test/ui/bindings/appStore.test.ts` (17 passed), `npm run ci` (77 files / 1032 tests + build). `grep -n 'createBlankKeyRng' src/ test/` → empty.
- Out of scope (separate tasks): F5 (module-level `scheduler` discarded if `bootApp` called without `schedulerArg`), F9 (eager app state init at module import — line 19 still runs at import time, only the indirection fn removed).

### F5. Module-level `scheduler` initialised but discarded if `bootApp` is called without `schedulerArg` 🟡 ✅ Resolved
`appStore.svelte.ts:21` creates a scheduler at import; `bootApp` (line 30) creates another if no arg passed, ignoring the module-level one. Two schedulers floating in tests depending on call order.

#### F5 — Fix
- `src/ui/bindings/appStore.svelte.ts`: dropped the eager module-level `let scheduler: PersistenceScheduler = createPersistenceScheduler(getPorts().storage);` → `let scheduler!: PersistenceScheduler;` (definite assignment; `bootApp` assigns before any access). `bootApp` signature flipped `schedulerArg?: PersistenceScheduler` → `schedulerArg: PersistenceScheduler` (mandatory). `bootApp` body `scheduler = schedulerArg ?? createPersistenceScheduler(getPorts().storage);` → `scheduler = schedulerArg;` (fallback removed). `createPersistenceScheduler` import (old line 15) dropped — no longer called in this file. `PersistenceScheduler` type import (line 13) retained — still used by the `scheduler` var + `getScheduler()` return type. `getPorts` import retained — still used at lines 18-19 (eager `state`/`deps` init, F9 separate task).
- `src/main.ts`: added `import { createPersistenceScheduler } from './ui/bindings/persistenceScheduler';`; constructs `const scheduler = createPersistenceScheduler(getPorts().storage);` alongside `deps`; `bootApp(initial, deps)` → `bootApp(initial, deps, scheduler)`. Prod now passes a scheduler explicitly — one scheduler created total, not two.
- No test changes: grep-confirmed all 6 test files (`appStore`/`builderStore`/`playerStore`/`modalStore`/`toastStore`/`persistenceScheduler`) already pass `createPersistenceScheduler(inMemoryStorage)` as the third `bootApp` arg. Mandatory sig matches existing test calls exactly.
- Behaviour preserved: `getScheduler()` and `performExternalEvent` scheduler calls (`clearBuilder`/`clearPlayer`) read the same module-level `scheduler` var, now assigned by `bootApp` before any access (prod `main.ts` boots before `mount(App)`; tests boot in `beforeEach`).
- No AD amendment: `bootApp` / `scheduler` init pattern not AD-specified. Impl detail.
- Verification (green): `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npx vitest run test/ui/bindings/appStore.test.ts` (17 passed), `npx vitest run test/ui/bindings/{builderStore,playerStore,modalStore,toastStore,persistenceScheduler}.test.ts` (74 passed), `npm run ci` (77 files / 1032 tests + build). `grep -n 'schedulerArg?' src/ui/bindings/appStore.svelte.ts` → empty.
- Out of scope (separate tasks): F9 (eager `state`/`deps` init at lines 18-19 — `getPorts()` still warmed at module import via state + deps, F5 only removes the scheduler's contribution), F6 (recursive `dispatch` in `handleLoadPlayerProgress`).

### F6. `load-player-progress` event triggers synchronous recursive `dispatch(intent)` mid reducer-result event loop 🟡 ✅ Resolved
`appStore.svelte.ts:91-122` (`handleLoadPlayerProgress`): while the bindings layer iterates over `result.events`, it calls `dispatch(apply-loaded-progress)`, which runs `reduceApp` again and triggers another event pass. Re-entrancy is bounded (apply-loaded-progress emits no events) but the dispatch-from-within-event-handler pattern couples store mutation to event iteration order.

#### F6 — Fix
- `src/ui/bindings/appStore.svelte.ts` `dispatch` (old lines 60-66): replaced single reducer-run + event-iteration with a work-queue loop. Seeds `const pending: (AppIntent | BuilderIntent | PlayerIntent)[] = [intent]`; while `pending.length > 0`, shifts the next intent, runs `reduceApp`, assigns `state = result.state`, iterates `result.events`, calls `performExternalEvent(event)`, and pushes any non-null follow-up intent onto `pending`. Loop drains the queue. Follow-up intents processed strictly after the current event batch — no re-entrant `reduceApp` mid event iteration.
- `performExternalEvent` (old lines 68-94): return type `void` → `PlayerIntent | null`. `download` / `clear-builder-storage` / `clear-player-storage` / `toast` / `modal-request` cases return `null` (no follow-up). `load-player-progress` case returns `handleLoadPlayerProgress(event.key)` (the follow-up intent, if any). Switch exhaustive over the 6 `DomainEvent` variants; no trailing `return null` after switch needed (`tsc` clean).
- `handleLoadPlayerProgress` (old lines 96-118): return type `void` → `PlayerIntent | null`. The 3 early returns after load-throw / blob-null / parse-null changed `return;` → `return null;`. Final `dispatch(intent);` → `return intent;` — no longer calls `dispatch` recursively; returns the `apply-loaded-progress` intent to the caller (`performExternalEvent`), which pushes it onto `pending` for the next while-iteration.
- Behaviour preserved: `import-puzzle` → reducer emits `[load-player-progress]` → `handleLoadPlayerProgress` returns `apply-loaded-progress` intent → pushed to `pending` → next while-iteration runs reducer → letters applied. Identical end state + ordering. Event ordering within a single reducer's `result.events` unchanged. `_resetAppStateForTests` unchanged. Imports unchanged.
- No test changes: 5 `appStore.test.ts` load-player-progress tests (lines 230-310) assert end state (letters loaded / null blob no-op / corrupt blob warn / storage throw warn), not recursion mechanism. All 17 `appStore.test.ts` tests green unchanged.
- No AD amendment: AD §4.4 line 217 semantically requires "dispatches apply-loaded-progress" — queue dispatch still satisfies this (bindings layer still dispatches it, sequenced after the current event batch rather than re-entrant within it). Mechanism below AD's abstraction level.
- Verification (green): `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npx vitest run test/ui/bindings/appStore.test.ts` (17 passed), `npm run ci` (77 files / 1032 tests + build). `grep -n 'dispatch(intent)' src/ui/bindings/appStore.svelte.ts` → empty (no recursive dispatch call site).
- Out of scope (separate tasks): F7 (`parsePlayerProgress` mixed error strategy — same fn but separate concern), F8 (App.svelte autosave `$effect` split), F9 (eager app state init at module import).

### F7. `parsePlayerProgress` mixed error strategy: throws inside `.map` caught at boundary, but `Letter.try` nulls silently 🟡 ✅ Resolved
`persistenceScheduler.ts:133-140`. Row-not-array / cell-not-string → `throw` caught by outer `try`. Invalid letter → `LetterCtor.try(cell)` returns `null` (silent drop). Inconsistent failure semantics.

#### F7 — Fix
- `src/ui/bindings/persistenceCodec.ts:136` — replaced `return LetterCtor.try(cell); // null on invalid per FR-80` with `const letter = LetterCtor.try(cell); if (letter === null) throw new Error('parsePlayerProgress: invalid letter cell'); return letter;`. Invalid letter now triggers the same throw path as row-not-array / cell-not-string; outer `catch (err)` (line 141) already does `console.warn('parsePlayerProgress: parse error', err); return null;`. Caller `src/ui/bindings/appStore.svelte.ts:113-117` already handles `null` return per NFR-9 — no caller change. Behavior now consistent with AD §9 line 981 (corrupt Player progress → silently drop entire blob).
- The prior inline comment `// null on invalid per FR-80` was a mis-citation: FR-80 is reducer-side black-cell drop (`apply-loaded-progress` reducer, AD §8.9), not parser-side invalid-letter handling. The throw path was always the correct parser-side semantics; the Letter.try silent-drop was the deviation.
- 1 test rewritten in `test/ui/bindings/persistenceScheduler.test.ts:214-220`: old `'parsePlayerProgress: invalid letter in playerLetters drops to null per FR-80 (Letter.try returns null on invalid)'` (asserted `result !== null` + `result.playerLetters[0][0] === null`) → new `'parsePlayerProgress: invalid letter in playerLetters returns null (NFR-9 corrupt-drop, consistent with row/cell throws)'` (asserts `parsePlayerProgress(json) === null` + `console.warn` called, mocking pattern matching the adjacent garbage-JSON test at lines 221-226). Other 24 tests in the file unchanged; round-trip (line 185) uses valid letters, shape-mismatch + garbage-JSON already assert null.
- No AD amendment: AD §9 line 981 already mandates corrupt-drop; this fix makes the codec agree with the AD.
- Verification (green): `npx vitest run test/ui/bindings/persistenceScheduler.test.ts` (25 passed), `npm run typecheck` (0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run ci` (77 files / 1032 tests + build). `grep -n "LetterCtor.try\|Letter.try" src/ui/bindings/persistenceCodec.ts` → one match (line 136, the new throw-guard).
- Out of scope (separate tasks): H1 (`brand<'PuzzleKey'>` bypass at line 128 — same fn, separate smell), F8 (App.svelte autosave `$effect` split), F9 (eager app state init at module import).

### F8. `App.svelte` autosave `$effect` schedules both builder & player save on every state tick 🟡 ✅ Resolved
`src/ui/app/App.svelte:15-20`. The single `$effect` reads both `getBuilder()` and `getPlayer()` then calls both `scheduleBuilderSave` and `schedulePlayerSave` unconditionally. Any builder keystroke re-schedules the player save timer (and vice versa). Scheduler coalesces so cost is bounded, but the effect body re-runs and re-arms two timers per change where one would do. Splitting into two effects — one per state slice — would cut half the redundant scheduling.

#### F8 — Fix
- `src/ui/app/App.svelte` lines 12-20 — replaced the single `$effect` (read `getBuilder()` + `getPlayer()`, call both `scheduleBuilderSave` + `schedulePlayerSave` unconditionally) with two per-slice `$effect`s: one calls `getScheduler().scheduleBuilderSave(getBuilder())`, the other calls `getScheduler().schedulePlayerSave(getPlayer())`. Each effect's reactive subscription is now scoped to a single substate property slot on the `appStore.svelte.ts` `$state` proxy; a change to `state.builder` fires only the builder effect, leaving the player timer untouched, and vice versa.
- **Relied-on invariant**: reducers preserve sibling substate refs on dispatch — `src/app/state/reducer.ts:39` `{ ...state, builder: r.state }` copies the `.player` ref unchanged; line 51 symmetric. Svelte 5 `$state` proxy compares `oldRef === newRef` per property to gate effect re-runs; an unchanged sibling ref skips re-execution. If a future reducer ever cloned both substates on every intent, the split would degenerate to the pre-fix behavior (both effects fire every tick). No compiler enforcement; flagged here as the relied-on contract.
- Behaviour preserved: builder save still debounced + latest-state-wins; player save still gated on `phase === 'solving'` inside `schedulePlayerSave`; both-change-in-same-tick (rare) still fires both effects, same end state. Scheduler semantics (`persistenceScheduler.ts`) untouched.
- No test changes: no test file exercises `App.svelte`'s `$effect` directly (grep-confirmed: no `App.svelte` under `test/`). Autosave behavior tested at the scheduler layer (`test/ui/bindings/persistenceScheduler.test.ts`) and store layer (`test/ui/bindings/appStore.test.ts:200,222` call `scheduleBuilderSave`/`schedulePlayerSave` directly). The `$effect` wiring was not directly tested; the split is a pure component refactor with no behaviour change observable through existing tests. Matches B6/B3 precedent for component refactors with no behaviour change.
- AD §4.5 line 968 amended: "runs a `$effect`" → "runs two `$effect`s — one over `state.builder` and one over `state.player` (split per-slice so a change to one slice does not re-arm the other's debounce timer)".
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run test` (77 files / 1032 tests), `npm run build`, `npm run ci` green. `grep -n "scheduleBuilderSave\|schedulePlayerSave" src/ui/app/App.svelte` → two call-sites, one per `$effect` (lines 18, 21).
- Out of scope (separate tasks): F9 (eager app state init at `appStore.svelte.ts:18` — still warms `getPorts()` at module import; F8 only touches the `$effect`), G5 (ToastHost `$effect` re-scheduling — separate component), G7 (`DownloadPort.download` silent-failure path).

### F9. `appStore.svelte.ts` eagerly initialises entire app state at module import 🟠 ✅ Resolved
`appStore.svelte.ts:19-21`. `let state: AppState = $state(AppStateCtor.blank(GridSizeCtor.of(15), PuzzleKeyCtor.generate(createBlankKeyRng())))` runs at import time: builds a 15×15 grid, mints a `PuzzleKey`, and calls `getPorts().rng` (warming the ports singleton). `bootApp` (line 27) then overwrites `state` with the caller's initial. Two full-state constructions per production boot; one wasted. Side effects at module top-level also complicate test isolation (`_resetAppStateForTests` is the band-aid at line 125). Lazy init (or null sentinel until `bootApp`) would remove the eager work.

#### F9 — Fix (narrow: null sentinel + ensure helpers)
- `src/ui/bindings/appStore.svelte.ts` lines 18-20 (module-level eager init) replaced with null sentinels + ensure helpers:
  ```ts
  let state: AppState | null = $state(null);
  let deps: AppDeps | null = $state(null);
  let scheduler: PersistenceScheduler | null = null;

  function ensureState(): AppState {
    if (state === null) throw new Error('appStore: bootApp() not called yet');
    return state;
  }

  function ensureScheduler(): PersistenceScheduler {
    if (scheduler === null) throw new Error('appStore: bootApp() not called yet');
    return scheduler;
  }
  ```
  No allocation at module import — `state`/`deps`/`scheduler` start `null`. `$state(null)` initializer is trivial; the 15×15 grid alloc + `PuzzleKey` mint + `getPorts()` warm no longer fire at `import` time.
- `bootApp` unchanged (assigns `AppState`/`AppDeps`/`PersistenceScheduler` to `* | null` slots — valid).
- All bare getters (`getAppState`, `getRoute`, `getToasts`, `getModal`, `getPendingConfirmIntent`, `getBuilder`, `getPlayer`, `getScheduler`) now delegate via `ensureState()` / `ensureScheduler()` — one-line guards, same return types. Pre-`bootApp` access throws `"appStore: bootApp() not called yet"` (correct: no prod path hits it, no test exercises it — all 5 test files call `bootApp` in `beforeEach`).
- `dispatch` guards at entry (`if (state === null || deps === null || scheduler === null) throw`), then captures narrowed locals `const d = deps; const sched = scheduler; let s: AppState = state;`. Work-queue loop reads `s` (non-null `AppState`), writes back `state = s` per iteration to preserve per-iteration reactivity (matches old behavior). `performExternalEvent(event, sched)` now takes `sched` as a param so the entry-guard narrowing propagates — avoids reading the nullable module-level `scheduler` from a separate function (TS narrowing does not cross function boundaries). `performExternalEvent` body: `scheduler.clearBuilder()` → `sched.clearBuilder()`, `scheduler.clearPlayer(event.key)` → `sched.clearPlayer(event.key)`. Download + load-player-progress cases unchanged (use `getPorts()`).
- `_resetAppStateForTests(next)` unchanged (`state = next` — `AppState` assignable to `AppState | null`). Still a legitimate test utility for mid-test state swaps, not just an eager-init band-aid.
- Removed now-unused imports: `AppState as AppStateCtor` (line 2), `GridSize as GridSizeCtor` (line 10), `PuzzleKey as PuzzleKeyCtor` (line 11) — all three consumed only by the deleted eager init expression. `getPorts` retained (used by `performExternalEvent` download case + `handleLoadPlayerProgress` storage).
- No consumer changes: `main.ts`, all 13 component files, all 5 test files, all 4 sub-store files — untouched. Bare exports remain the active interface; the singleton + bare-import coupling pattern is unchanged (see `llmworkspace/store_singleton_di_report.md` for the architectural problem and the DI fix path — separate effort, not F9).
- No AD amendment: AD §9 line 981 says "`main.ts` performs [initial construction]" — still true (`main.ts` calls `bootApp` which assigns the sentinels). Init mechanism below AD's abstraction level.
- Side benefit: real-timer + real-ports leak at module import eliminated. Tests' `vi.useFakeTimers()` in `beforeEach` now precedes any `now`/`rng` capture (was leaking real `Date.now` at import via eager `deps` init).
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run test` (77 files / 1032 tests), `npm run build`, `npm run ci` green. `grep -n "AppStateCtor\|GridSizeCtor\|PuzzleKeyCtor" src/ui/bindings/appStore.svelte.ts` → empty. `grep -n '\$state' src/ui/bindings/appStore.svelte.ts` → exactly 2 matches (lines 15-16, both `$state(null)`).
- Out of scope (separate effort, documented in `llmworkspace/store_singleton_di_report.md`): singleton store pattern + bare-import reaching — architectural problem broader than F9. DI fix (factory + props + presentational/container split) also fixes F9; this narrow fix addresses only the eager-init symptom. `deps` `$state` dead-reactivity cleanup also out of scope.

---

## G. Components / DOM coupling

### G1. Direct `document.getElementById('typing-surface-input')` focus coupling 🟠 ✅ Resolved
`src/ui/builder/BuilderShell.svelte:37`, `src/ui/builder/BuilderCluePanel.svelte:54`. Both components reach into the DOM by magic id string to focus the hidden input owned by `TypingSurface.svelte`. AD §7.4 designates `TypingSurface` as the single owner of the hidden input (G3); this cross-component DOM ID contract violates ownership and breaks if the id changes or two surfaces mount.

#### G1 — Fix
- Mechanism: **state-driven focus**. `TypingSurface` owns its own focus and re-focuses itself as a reactive effect of a new `cursor: Cursor` prop (the active typing position from view-model state). The existing `$effect` (already gating on `enabled` for focus/blur) now also reads `cursor`; Svelte 5 re-runs it whenever the `cursor` ref changes — exactly when `select-cell` / `click-clue-panel-word` reducers produce a new cursor. Children emit intents only; no child imperatively touches focus. No DOM id, no callback prop, no Svelte context. Honors AD §0 Principle 4 (View-models in / Intents out): focus is a derived reactive effect of view-model state, not an imperative cross-component call.
- `src/ui/shared/TypingSurface.svelte`: added `cursor: Cursor` prop; `import type { Cursor } from '../../domain/grid/Cursor'` (precedent: `gridVM.ts` type-imports `Cursor` from the same path; AD §2.3 permits UI→domain type imports). `$effect` body unchanged (`if (enabled) inputEl?.focus({ preventScroll: true }) else inputEl?.blur()`) but now reads `cursor` (track-only via `void cursor`). Deleted the `id="typing-surface-input"` attribute from the `<input>` — dead after rewire → closes G2 as a consequence.
- `src/ui/builder/BuilderShell.svelte` + `src/ui/player/PlayerShell.svelte`: `<TypingSurface>` invocation now passes `cursor={vm.grid.cursor}` (`GridVM.cursor` already carries the `state.cursor` ref unchanged from `gridVM.ts`; no VM changes). Deleted the `(document.getElementById('typing-surface-input') as HTMLInputElement | null)?.focus({ preventScroll: true })` line from `onCellClick` in both shells (Builder Fill branch + Player grid click).
- `src/ui/builder/ClueSection.svelte`: `dispatchRowClick` now ends after `dispatchBuilder({ kind: 'click-clue-panel-word', wordKey: entry.wordKey })`; deleted the imperative focus line. (B3 split moved the original `BuilderCluePanel.svelte:54` site here.)
- `src/ui/player/PlayerCluePanel.svelte`: deleted the imperative focus line from both inline row `onclick` handlers (Across list + Down list); each handler now only dispatches `click-clue-panel-word`. The scroll-into-view `document.getElementById(id)` in the `$effect` (line ~28, resolves a clue-row `<li id>` for scroll, not the typing surface) was left untouched — separate smell, out of scope.
- **Accepted behaviour change**: Builder clue-panel row click during `join`/`reattach` subMode no longer refocuses the typing surface, because `resolveJoin`/`resolveReattach` mutate `subMode` but do NOT produce a new `cursor` ref — so the surface's `$effect` does not refire. Accepted as beneficial: user stays oriented after a structural op; clicks a cell/clue to refocus, which now works via state. No `focusTrigger` composite or other workaround added.
- No new tests: reactive refactor with no behaviour change covered by the existing suite. No `@testing-library/svelte` component-render infra in repo (precedent: B3/B6/C4/C5). Existing reducer tests (`test/builder/state/internal/fillMode.test.ts`, `test/player/state/internal/solving.test.ts`) already assert the `cursor` mutations that drive the new focus effect; they stay green unchanged.
- AD §7.4 `TypingSurface.svelte` row amended: props `enabled: boolean; cursor: Cursor`; notes rewritten to describe state-driven focus + G1/G2 closure + accepted behaviour change.
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run test` (77 files / 1032 tests), `npm run ci` green. `grep -rn "typing-surface-input\|getElementById('typing-surface-input')" src/` → empty.
- Out of scope (separate tasks): G3 (`drafts` Map reactivity), shell-switch `default: const _x: never = intent` exhaustiveness hardening (B6 carryover), clue-panel scroll-into-view `getElementById(rowId)` (G3-adjacent).

### G2. `TypingSurface.svelte` input id hard-coded to `typing-surface-input` global singleton 🟡 ✅ Resolved
`TypingSurface.svelte:109`. Assumes exactly one instance; no scoped id. Two grids in DOM (Builder + Player not simultaneously, but landing could theoretically host both later) would collide.

#### G2 — Fix
- Closed as a consequence of the G1 fix. The `id="typing-surface-input"` attribute was removed from `TypingSurface.svelte`'s `<input>` once the cross-component focus coupling was replaced with state-driven focus (consumers no longer look the input up by id). No scoped id was introduced because no consumer needs to address the input by id anymore. `grep -rn "typing-surface-input" src/` → empty.

### G3. `BuilderCluePanel.svelte` mutates `drafts: Map` held in `$state(new Map())` and reads via `valueFor` 🟠 ✅ Resolved
`BuilderCluePanel.svelte:9,29-31,113`. Svelte 5 runes do NOT observe internal `Map` mutation; `drafts.set(...)` does not trigger reactivity. The input is bound `value={valueFor(...)}` (one-way) and user-typed DOM value persists visually, so it happens to work, but `valueFor` re-reads on parent re-render only. Fragile: any future `$derived` reading `drafts` would not update on `.set`.

#### G3 — Fix
- Replaced `const drafts = $state(new Map<string, string>())` with `const drafts = new SvelteMap<string, string>()` (imported from `svelte/reactivity`). `SvelteMap` is Svelte 5's official reactive `Map` subclass — `.has()`/`.get()` register dependencies, `.set()`/`.delete()` notify Svelte's reactivity. Same `Map` API, so all call sites (`drafts.has(id)`, `drafts.get(id)!`, `drafts.set(canonicalId(wordKey), value)`, `drafts.delete(canonicalId(wordKey))`) are unchanged. Self-reactive — no `$state` wrapping needed.
- This was the only `$state(new Map())` in the codebase (verified: `grep -rn '\$state(new Map' src/` → empty after fix). `SvelteMap` availability in the installed Svelte 5 verified via `require('svelte/reactivity')`.
- **Behaviour**: normal case (chain head edit succeeds) — no visible change; `setDraft` is now reactive but the input already shows the typed value (browser DOM retains it) and `valueFor` returns the same draft → `value={draft}` sets the same value → no DOM mutation. Edge case (edit-clue rejected, defensive) — `clearDraft` is now reactive → input resets to `entry.displayClue` instead of retaining stale draft in DOM. More correct; accepted (same precedent as G1's accepted Builder join/reattach behaviour change). `drafts` keying unchanged: `canonicalId` = `${row}_${col}_${direction}`.
- No new tests: no `@testing-library/svelte` component-render infra in repo (precedent: B3/B6/C4/C5/G1/G8/G9). No test exercises the drafts Map (grep `drafts\|valueFor\|setDraft\|clearDraft` in `test/` empty). Existing suite stays green unchanged.
- AD §7.2 `BuilderCluePanel.svelte` row amended: notes now describe `drafts` as `SvelteMap<string, string>` from `svelte/reactivity` (reactive Map; G3 closed).
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run test` (77 files / 1032 tests), `npm run ci` green. `grep -rn '\$state(new Map' src/` → empty. `grep -n "SvelteMap" src/ui/builder/BuilderCluePanel.svelte` → 2 matches (import line 4, usage line 15).

### G4. `Modal.svelte` calls `modalVM()` twice in the render branch 🟡 ✅ Resolved
`Modal.svelte:29-30`: `{#if modalVM() !== null}` then `{@const vm = modalVM()!}`. Double derivation; trivial cost, mild smell.

#### G4 — Fix
- `src/ui/shared/Modal.svelte` script block: added `const vm = $derived(modalVM());` (single derivation per tick; `modalVM` already imported from `../bindings/modalStore.svelte`). Template `{#if modalVM() !== null}` → `{#if vm !== null}`; deleted the `{@const vm = modalVM()!}` line. Svelte 5 narrows `vm: ModalVM | null` to the non-null variant inside the `{#if vm !== null}` block, so the `!` non-null assertion is gone. Template body (`{vm.title}`, `{vm.body}`, `{vm.cancelLabel}`, `{vm.confirmLabel}`, backdrop, buttons, a11y comments) unchanged.
- Mechanism choice: `$derived(modalVM())` (not `$derived.by(() => modalVM())`) — `modalVM()` is a single expression returning the value; no statements needed before the return, so the `.by` arrow wrapper would be pure noise. Same reactivity engine, same dep tracking (reads `getModal()` → `appStore` `$state` proxy → refires on modal change). Idiom matches G8 (`$state({})` refs), G3 (`SvelteMap`), ToastHost (`$effect` over `getToasts()`).
- No new tests: no `@testing-library/svelte` component-render infra in repo (precedent: B3/B6/C4/C5/G1/G8/G9). Existing `test/ui/bindings/modalStore.test.ts` (13 tests) + `test/ui/bindings/viewmodels/modalVM.test.ts` (8 tests) cover `modalVM()` and `deriveModalVM` at the bindings/viewmodel layer; untouched, stay green. Fix is a template-only refactor with no behaviour change.
- AD §7 line 1269 `Modal.svelte` row amended: `(G4)` → `(G4 closed: single $derived derivation, no double-call)`.
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` clean), `npm run test` (77 files / 1032 tests), `npm run ci` green. `grep -n 'modalVM()' src/ui/shared/Modal.svelte` → exactly one match (line 4, the `$derived` line); zero template matches.
- Out of scope (separate tasks): G5 (ToastHost `$effect` re-schedule), G6 (BuilderToolbar nested ternary), G7 (DownloadPort silent failure).

### G5. `ToastHost.svelte` re-runs `$effect` on whole toast-list change; re-schedules timers for all toasts each run 🟡 ✅ Resolved
`ToastHost.svelte:7-16`. Cleanup clears prior timers (correct), but every list mutation re-asserts timers for the full set. Acceptable but wasteful at high toast churn.

#### G5 — Fix
- `src/ui/shared/ToastHost.svelte` `<script>` block: replaced the single `$effect` (cleared ALL timers in its cleanup-return, then rescheduled ALL toasts fresh `t.ttlMs` on every refire) with a persistent per-toast timer map + diff scheduling. New body: `const timers = new Map<ToastId, ReturnType<typeof setTimeout>>()` at module-script scope; `$effect` reads `getToasts()`, builds a `liveIds` set, iterates `timers` clearing+deleting any id not in `liveIds` (dismissed), then iterates `toasts` setting a `setTimeout(() => dismissToast(t.id), t.ttlMs)` only for ids not already in `timers` (new). `onDestroy` (imported from `svelte`) clears all timers on unmount; the `$effect` has NO cleanup-return (Svelte 5 cannot distinguish re-run-cleanup from unmount-cleanup, and clearing all timers on re-run is the bug). Template `<div>` + `{#each toastVMs() as toast (toast.id)}` unchanged.
- Behaviour fix: each toast gets exactly one timer scheduled when it first appears; sibling add/dismiss mutations no longer extend every other toast's effective deadline by the elapsed time. Deadline ≈ `createdAt + ttlMs` (timer set once at first-seen ≈ createdAt; diff-based scheduling already fixes the drift the old clear-all-then-reschedule caused). `t.ttlMs` read directly (not `createdAt + ttlMs - Date.now()`) — simpler, no `Date.now()` read, matches original semantics.
- Mechanism notes: `timers` is a plain `Map`, NOT `$state`/`SvelteMap` — never read in markup, only inside the effect, so no reactive wrapping needed (differs from G3 where `SvelteMap` was required because markup read the map). Deleting from a `Map` during `for...of` iteration is spec-safe in JS. `ToastId` type import from `domain/notifications/ToastId` — precedent `toastStore.svelte.ts:3` already type-imports from the same path; AD §2.3 permits UI→domain type-only imports.
- Relied-on invariant: F8's per-property ref-equality gating holds — `reduceApp` (`src/app/state/reducer.ts:29` dismiss filter, `src/app/state/effects.ts:17` append) produces a fresh `toasts` array only on actual toast add/dismiss, NOT on per-keystroke dispatches. So the `$effect` refires only when the toast set genuinely changes, not every dispatch. Same invariant G8's `BuilderCluePanel` and F8's split autosave rely on; unenforced by compiler.
- No new tests: no `@testing-library/svelte` component-render infra in repo (precedent: B3/B6/C4/C5/G1/G8/G9/G4). Existing `test/ui/bindings/toastStore.test.ts` (5 tests) covers `toastVMs()`/`dismissToast` at the bindings layer; untouched, stays green. The `$effect` timer logic was never directly tested (component not mounted in tests); unchanged.
- AD §7 line 1270 `ToastHost.svelte` row amended: notes now describe per-toast diff scheduling + G5 closure.
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` clean — 113 files), `npm run test` (77 files / 1032 tests), `npm run ci` green. `grep -n 'return () =>' src/ui/shared/ToastHost.svelte` → empty (no cleanup-return). `grep -n 'onDestroy\|timers.has\|timers.delete' src/ui/shared/ToastHost.svelte` → 4 matches (import, delete, has, onDestroy).
- Out of scope (separate tasks): G6 (BuilderToolbar nested ternary), G7 (DownloadPort silent-failure path), J1 (`Chain.headOf` O(n²) caching).

### G6. `BuilderToolbar.svelte` marker flag → marker-field mapping uses nested ternary 🟡 ✅ Resolved
`BuilderToolbar.svelte:119-127`. Four-way flag-to-`CellMarker` field dispatch via `'space-right' ? … : 'space-bottom' ? … : … : 'hyphenBottom'`. Brittle; would slip silently if a fifth marker flag added. A record map `flag → markerKey` would be safer.

#### G6 — Fix
- `src/ui/builder/BuilderToolbar.svelte`: added `import type { CellMarkerFlag } from '../../domain/grid/CellMarkerFlag'` + `import type { CellMarker } from '../../domain/grid/CellMarker'` (AD §2.3 permits UI→domain type-only imports; `Toast.svelte:6` `Record<ToastVM['kind'], string>` is the inline-Record precedent). Added `const markerFlagToKey: Record<CellMarkerFlag, keyof CellMarker> = { 'space-right': 'spaceRight', 'space-bottom': 'spaceBottom', 'hyphen-right': 'hyphenRight', 'hyphen-bottom': 'hyphenBottom' }` after the existing `markerButtons` array. Template marker button `class` attribute: replaced the 4-way nested ternary `vm.markerFlags[flag === 'space-right' ? 'spaceRight' : ... : 'hyphenBottom']` with `vm.markerFlags[markerFlagToKey[flag]]`. `markerButtons` (iteration order + labels) left as-is — the Record is the type-relationship gate, not a replacement for the presentation array.
- Safety: `Record<CellMarkerFlag, keyof CellMarker>` is compile-exhaustive over the `CellMarkerFlag` union — adding a 5th flag variant breaks the build (missing key). The old ternary's silent fall-through-to-`hyphenBottom` risk is gone. `Record` indexed by `flag: CellMarkerFlag` returns `keyof CellMarker` (no `undefined` — concrete Record over a finite union key set, not an index signature; `noUncheckedIndexedAccess` only affects index signatures/arrays). `vm.markerFlags[key]` where `key: keyof CellMarker` → `boolean`. No `!`, no guard.
- Behaviour identical: same 4 flags → same 4 field lookups → same booleans → same button classes.
- No new tests: no `@testing-library/svelte` component-render infra in repo (precedent: B3/B6/C4/C5/G1/G8/G9/G4/G5). Existing `test/ui/bindings/viewmodels/builderVM.test.ts` covers VM derivation, not the template. Template-only refactor, no behaviour change.
- AD §7 line 1244 `BuilderToolbar.svelte` row amended: notes now describe the `Record<CellMarkerFlag, keyof CellMarker>` compile-safe map.
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` clean), `npm run test` (77 files / 1032 tests), `npm run ci` green. `grep -n "flag === 'space-right'" src/ui/builder/BuilderToolbar.svelte` → empty. `grep -n 'markerFlagToKey' src/ui/builder/BuilderToolbar.svelte` → 2 matches (declaration + template use).
- Out of scope (separate tasks): G7 (DownloadPort silent-failure path), J1 (`Chain.headOf` O(n²) caching), H2 (`withinBounds` idiom).

### G7. `DownloadPort.download` is `void`-returning; both port impl and `appStore` swallow errors with no user feedback 🟠
`src/domain/ports/ports.ts:12-13` `download(filename, content): void` — no `Result` channel. `src/ports/downloadPort.ts:6-18` wraps the DOM Blob/anchor dance in `try/catch` → `console.warn` only. `src/ui/bindings/appStore.svelte.ts:75-81` adds a second `try/catch` that also just `console.warn`s. Effect: a user-initiated download that fails (rare, but possible: blocked focus, sandbox, store API throw) leaves the user with zero UI signal — no toast, no modal, no inline state change. Failed irreversible user action disappears silently. **Fix path: widen the port signature to `Result<null, DownloadError>` (or `DownloadError` discriminated union) and emit a `toast` event on failure from `appStore.performExternalEvent`; this requires a new `DownloadError` domain type + a reducer `DomainEvent` variant for the toast — surface as design amendment if needed.**

### G8. `BuilderCluePanel.svelte` scroll-into-view reaches into child `ClueSection.svelte`'s DOM by magic id string 🟠 ✅ Resolved
`src/ui/builder/BuilderCluePanel.svelte:25` does `document.getElementById(rowId(entry))` to scroll a clue row into view, but the `<li id={rowId(entry)}>` is rendered by the child `src/ui/builder/ClueSection.svelte:66` (moved there by the B3 extraction). The parent computes the same id string (`rowId` duplicated at `BuilderCluePanel.svelte:14` + `ClueSection.svelte:17`) and looks up the child's element in the global DOM. This is the same cross-component DOM-id-contract flaw G1 fixed for focus, applied to scroll. The B3 split preserved the scroll `$effect` in the parent while moving the `<li id>` into the child — the B3 fix note (line 97) even states `document.getElementById` "still resolves children's `<li id>`", treating the cross-component id coupling as fine. If `ClueSection` changes its id format, the parent scroll breaks silently with no compiler link. Two copies of the id scheme must stay in lock-step.

#### G8 — Fix
- Root cause: the B3 component boundary cut ownership of things that must move together (one `<aside>` scroll container + the scrolled `<li>`s). The original G8 fix path sketched above (lift the `$effect` into `ClueSection`, pass `highlightedWordKey` down + a `getScrollContainer` callback) would have removed the id coupling but introduced a different cross-component contract — a callback returning a DOM node — which is glue wiring two components' DOM together rather than a clean ownership boundary. Rejected by the lead.
- Adopted fix: **collapse `ClueSection.svelte` back into `BuilderCluePanel.svelte`** via a Svelte 5 `{#snippet clueRow(entry)}`. `BuilderCluePanel.svelte` is now the single owner of the `<aside>` scroll container, all `<li>` refs (`bind:this` keyed by the existing `canonicalId(entry.wordKey)` — the same key the `{#each}` already uses), the scroll-into-view `$effect`, `isInJoinMode` derived, the per-row `drafts` Map, and all per-row dispatch helpers. No cross-component DOM of any kind — not id, not callback, not ref. The snippet deduplicates the per-row `<li>` body (rendered in both the Across `<ul>` and the Down `<ul>`), preserving B3's dedup goal without a component boundary.
- `src/ui/builder/ClueSection.svelte`: deleted (only importer was `BuilderCluePanel.svelte`).
- `src/ui/builder/BuilderCluePanel.svelte`: absorbed all of `ClueSection`'s script logic + markup. Replaced the old scan-`[...vm.across, ...vm.down]`-match-`getElementById(rowId(entry))` `$effect` with: `const key = vm.highlightedWordKey; if (key === null) return; const el = liRefs[canonicalId(key)]; if (panelEl !== null && el !== undefined) { panelEl.scrollTop += el.getBoundingClientRect().top - panelEl.getBoundingClientRect().top; }`. Reading `vm.highlightedWordKey` makes Svelte 5 refire on change; `liRefs[id]` resolves the `<li>` directly. Deleted the `rowId` fn (dead — its only consumer was the `getElementById` call). Each `<li>` lost `id={rowId(entry)}` and gained `bind:this={liRefs[canonicalId(entry.wordKey)]}`.
- **Behaviour preserved exactly**: scroll math identical (manual delta on `panelEl`, NOT native `scrollIntoView` — that would scroll all ancestors including the window, an explicitly rejected behaviour change). `drafts` Map: was two instances (one per `ClueSection`), now one Map in `BuilderCluePanel` keyed by `canonicalId` = `${row}_${col}_${direction}` — direction is in the key so Across and Down entries never collide; `valueFor`/`setDraft`/`clearDraft` lookups return identical results. No `id` attribute anywhere (it was only ever a scroll handle; no `#across-`/`#down-` CSS selectors exist). Per-row dispatch intents unchanged.
- No new tests: reactive presentational refactor with no behaviour change. No `@testing-library/svelte` component-render infra in repo (precedent: B3/B6/C4/C5/G1). Existing suite stays green unchanged.
- AD §7.2 `BuilderCluePanel.svelte` row rewritten (single owner of scroll + `<li>` refs + snippet); `ClueSection.svelte` row removed; §9.3 file tree `ClueSection.svelte` removed from `ui/builder/`; new "Markup dedup guidance (from G8)" paragraph added after the §7.2 Builder table blessing `{#snippet}` as the approved markup-dedup mechanism and warning against extracting a child component solely to dedup markup when the parent must still reach into the child's DOM.
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles — 113 files, one fewer than pre-fix as expected), `npm run test` (77 files / 1032 tests), `npm run ci` green. `grep -rn "getElementById\|ClueSection\|rowId" src/ui/builder/` → empty.
- Out of scope (separate tasks): G3 (`drafts` Map reactivity — relocates with the snippet, stays open), G9 (`PlayerCluePanel` intra-component scroll — separate).

### G9. `PlayerCluePanel.svelte` uses `document.getElementById` for own scroll-into-view instead of `bind:this` 🟡 ✅ Resolved
`src/ui/player/PlayerCluePanel.svelte:28` looks up `document.getElementById(id)` to scroll a clue row into view. Unlike G8, this is intra-component — the same file renders the `<li id={rowId}>` (lines 46, 72) and looks it up — so there is no cross-component ownership violation. Mild smell: a global DOM lookup for an element the component itself owns, where a `bind:this` ref (or a keyed refs map) would be the idiomatic Svelte 5 path and would also drop the `id` attribute (currently only used as a scroll handle, not for CSS or accessibility). Lower priority than G8; can be cleaned up alongside a G8 fix for consistency, or left.

#### G9 — Fix
- Mechanism mirrors G8's `BuilderCluePanel` pattern (intra-component only — no child component involved). Replaced `document.getElementById` + the `highlightedId()` scan helper + the `${direction}-${number}` `id` attribute scheme with a `bind:this` keyed-refs map.
- `src/ui/player/PlayerCluePanel.svelte`: added `import type { WordKey } from '../../domain/word/WordKey'` (AD §2.3 permits UI→domain type-only imports; G8 precedent). Added `function canonicalId(k: WordKey): string { return `${k.startRow}_${k.startCol}_${k.direction}`; }` (same keying as G8). Added `let liRefs: Record<string, HTMLElement> = $state({});`. Deleted the entire `highlightedId()` fn (it scanned `vm.across`/`vm.down` matching on `startRow`/`startCol`/`direction` — the exact three fields in `canonicalId`, so `canonicalId(vm.highlightedWordKey)` resolves the same `<li>` with no scan). Replaced the `$effect` with: `const key = vm.highlightedWordKey; if (key === null) return; const el = liRefs[canonicalId(key)]; if (panelEl !== null && el !== undefined) { panelEl.scrollTop += el.getBoundingClientRect().top - panelEl.getBoundingClientRect().top; }` (`liRefs[id]` yields `undefined` for a missing key — guard `!== undefined`; `panelEl` stays `!== null`). Each `<li>` lost `id={rowId}` + the `{@const rowId = ...}` line and gained `bind:this={liRefs[canonicalId(entry.wordKey)]}`.
- **Behaviour preserved exactly**: scroll math identical (manual delta on `panelEl`, NOT native `scrollIntoView` — that would scroll all ancestors including the window, an explicitly rejected behaviour change). `canonicalId(vm.highlightedWordKey)` resolves the same `<li>` the old `highlightedId()` scan found. Missing `<li>`: old returned `null` → no-op; new returns `undefined` → guard no-op. Refire semantics unchanged (old `$effect` read `highlightedId()` which read `vm.highlightedWordKey`; new reads `vm.highlightedWordKey` directly). `id` attribute removal safe — grep confirmed no `#across-`/`#down-` CSS selectors and no `aria`/`label[for]` consumers. Per-row dispatch intent `click-clue-panel-word` payload unchanged.
- No new tests: reactive presentational refactor with no behaviour change. No `@testing-library/svelte` component-render infra in repo (precedent: B3/B6/C4/C5/G1/G8). Existing suite stays green unchanged.
- AD §7.3 `PlayerCluePanel.svelte` row amended: notes add "Owns `<li>` refs via `bind:this` keyed by `canonicalId`; scroll-into-view `$effect` driven by `vm.highlightedWordKey` (G9 — no DOM id, no `getElementById`)."
- Verification (green): `npm run typecheck` (svelte-check 0 errors / 0 warnings), `npm run lint` (eslint + `madge --circular` no cycles), `npm run test` (77 files / 1032 tests). `grep -rn "getElementById\|highlightedId\|rowId" src/ui/player/PlayerCluePanel.svelte` → empty. `grep -rn "bind:this={liRefs" src/ui/player/PlayerCluePanel.svelte` → 2 matches (one per `<li>`).

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
`eslint.config.js:205-206` (DRN item 6). Regex enumerates exact allowed paths (`src/domain/ports/ports.ts`, `src/domain/rng/Rng.ts`, `src/domain/puzzle/PuzzleKey.ts`) with `.ts` suffix. The `.ts`-extension convention is inconsistent across layer boundaries (other rules use globs). Operationally fine; stylistic inconsistency.

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
- ~~`converted-puzzles/` directory listed, missing (see C2).~~ Resolved via C2 — AD §9.3 tree no longer lists `converted-puzzles/` or `scripts/migrate-puzzles.ts`.

### K2. `version_stamp_plan.md` not implemented 🟡
Plan describes baked git-commit-hash/timestamp footer + `VersionStamp.svelte` + `vite.config.ts` inline plugin. Repo `vite.config.ts:1-18` has no `define` block; no `src/ui/shared/VersionStamp.svelte`; no `vite-env.d.ts` ambient declarations. `git log` shows "add git stamp design doc" commit but no implementation commit. Feature gap between plan and code.

### K3. DRN follow-up items + AD-internal contradictions un-addressed 🟡
- DRN item 4 follow-up: "Retrofit `AppState.blank` ... to call `BuilderState.blank` and `PlayerState.importScreen` as values, eliminating the inlined construction." Done — `app/state/state.ts:21-29` does call both. ✔ Resolved.
- DRN item 5 open question: file-format should it drop `number`? Not addressed. Open.
- DRN item 7: `CONFIRMABLE_INTENT_KINDS` derived from type — **closed** (see D1, resolved 2026-08-10).
- DRN item 8 open: harden `Puzzle.withGrid` — not addressed (see D3).
- DRN item 9: `'landing'` ambiguous routing — **closed** (see D2, resolved 2026-08-10: throw on ambiguous kind during landing).
- AD §0 principle 4 internal contradiction: AD's own §3.3 type catalogue uses plain `number` (`Word.length`, `AnagramEntry.position`, `Toast.createdAt/ttlMs`, `Rng.nextInt`) violating the binding principle — see H4. Fix requires AD §3.3 amendment.
- `DownloadPort.download` silent-failure path: no `Result` channel, double-swallowed errors, zero UI feedback on failed irreversible user action — see G7. Fix may require new `DownloadError` type + `DomainEvent` variant (design amendment).

---

## Summary

Top 5 by impact:
1. **A1** missing boundary self-test — design claims self-verification that doesn't exist. ✅ Resolved.
2. **C1** `DisplacedClueId` non-UUID format diverges from AD §6.1. ✅ Resolved.
3. **D1/D2/D3** reducer-dispatch string sets, ambiguous routing, `Puzzle.withGrid` gridSize drift — three DRN items that compounded dispatch/invariant-correctness risk. **D1 ✅ Resolved** (DRN item 7 closed); **D2 ✅ Resolved** (DRN item 9 closed, 2026-08-10); **D3 ✅ Resolved** (DRN item 8 closed, 2026-08-10 — `withGrid` now re-syncs `gridSize` from `g.length`; redundant `change-grid-size` local patch removed).
4. **B1/B2/B3** algorithm/UI duplication (findContainingWord ×4, cellsOfChain ×2, clue-panel sections) — structural maintenance load. **B1 ✅ Resolved** (2026-08-10: extracted to `domain/word/WordSelection.ts`, 4 sites replaced, AD amended); **B2 ✅ Resolved** (2026-08-10: extracted to `domain/chain/ChainCells.ts`, 2 sites replaced, AD amended); **B3 ✅ Resolved** (2026-08-13: extracted `ui/builder/ClueSection.svelte`, BuilderCluePanel composes two children, AD §7.2 + §9.3 amended).
5. **A3** Cursor misplaced in Builder state module, type-imported everywhere. **✅ Resolved** (2026-08-13: `Cursor` hoisted to `src/domain/grid/Cursor.ts`; all 10 importers re-pointed; `WordSelection.findContainingWord` + `GridVM.cursor` folded to the named `Cursor` type (B1 workaround retired); AD §1.3, §3.2, §3.3, §4.3, §5.2, §9.3 amended).

Acknowledged-but-accepted (no action needed unless revisiting): K2/K3 open items, F3.