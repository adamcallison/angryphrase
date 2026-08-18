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
`src/domain/ports/ports.ts:12-13` `download(filename, content): void` — no `Result` channel. `src/ports/downloadPort.ts:6-18` wraps the DOM Blob/anchor dance in `try/catch` → `console.warn` only. `src/ui/bindings/appStore.svelte.ts:75-81` adds a second `try/catch` that also just `console.warn`s. Effect: a user-initiated download that fails (rare, but possible: blocked focus, sandbox, store API throw) leaves the user with zero UI signal — no toast, no modal, no inline state change. Failed irreversible user action disappears silently. **Fix path: widen the port signature to `Result<null, DownloadError>` (or `DownloadError` discriminated union) and emit a `toast` event on failure from `appStore.performExternalEvent`; this requires a new `DownloadError` domain type + a reducer `DomainEvent` variant for the toast — surface as design amendment if needed.**

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
- `converted-puzzles/` directory listed, missing (see C2).

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