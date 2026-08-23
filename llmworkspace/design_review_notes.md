# angryphrase — Design Review Notes

> Items deferred during implementation for later revisit. Each entry names the symptom, the underlying tension, and the options. Add new items at the bottom as they surface. This file is not authoritative — `architecture_design.md` is. Items here are open questions, not decisions.

---

## 1. `domain/persistence/` folder is misnamed

**Symptom.** During implementation of Tasks 14+17 (PuzzleKey + ports), madge flagged a cycle between `domain/persistence/ports.ts` and `domain/puzzle/PuzzleKey.ts`. Investigation revealed that the cycle exists because `Rng` was grouped with `StoragePort`/`DownloadPort`/`FilePickPort` under `domain/persistence/`, but `Rng` is not a port in the same sense — it's an injected determinism/knob abstraction that reducers call directly (`PuzzleKey.generate(rng)`, `Anagram.scramble(rng)`, `Toast.create(rng, …)`), whereas the design states "reducers never call ports." The other three interfaces are true side-effect ports; `Rng` is a deps-injection abstraction colocated with them only by loose usage of "port."

**Underlying tension.** The folder name `persistence/` is also a misnomer for `DownloadPort` and `FilePickPort` — neither persists anything (one writes a download file, one reads a picked file). `domain/persistence/` has been used in the design as a catch-all "side-effect port interfaces" folder, which admits `Rng` for ergonomic single-import purposes but breaks the strict "port = side-effect hole against the outside world" definition the design uses elsewhere.

**Temporary resolution applied on 2026-07-21.** `Rng` was moved out into its own `src/domain/rng/Rng.ts` so `PuzzleKey.ts` can depend on `Rng` without `ports.ts ↔ PuzzleKey.ts` traversing the same edge in both directions. `domain/persistence/ports.ts` now holds only the three true side-effect ports (`StoragePort`, `DownloadPort`, `FilePickPort`). `AppConfig.ports.rng` (§11.1) and `ports/rngPort.ts` (§2.1 Layer 4 table) still name/group `rng` with the ports for ergonomic config grouping; this is a leftover from when `Rng` was a peer of the side-effect ports in one file.

**Options for later.**

A. **Rename `domain/persistence/` → `domain/ports/`** and treat the folder as "side-effect port interfaces." Honest about `DownloadPort`/`FilePickPort` not being persistence. Costs a rename across `eslint.config.js` allow-paths, the §9 file tree, and `main.ts` import paths.

B. **Split port interfaces by concern** — e.g., `domain/ports/storage/`, `domain/ports/file/`, `domain/ports/download/`. More granular, but probably overkill for a four-interface codebase.

C. **Status quo.** Keep `domain/persistence/` for the three true ports; keep `Rng` in `domain/rng/`; accept that the folder name is historically loose. Cheapest, slightly inconsistent.

**Recommendation for later.** Option A if/when the next port arrives. Until then, C.

**Resolution applied on 2026-08-18.** Option A adopted. `src/domain/persistence/` renamed to `src/domain/ports/` (`git mv` preserved history). All 10 importer paths, the `eslint.config.js` `src/ports/**` allow-list regex + messages, and the §9.3 file tree + §1.3 module table + §3.7 heading/body + §9.2 boundary table in `architecture_design.md` were amended. `Rng.ts` comment re-pointed to the new former-path. DRN item 1: closed.

---

## 2. `DisplacedClue.create` signature in §3.5 omitted `rng`

**Symptom.** §3.5 listed `DisplacedClue.create(clue, direction)` — no `rng` parameter. §8.5 (reconciliation algorithm) says "`DisplacedClue.create(clue, direction)`, which calls `DisplacedClueId.generate(rng)` for the id" — which is impossible without `rng` being passed in. The two sections contradicted.

**Resolution applied on 2026-07-21.** §3.5 was amended to `DisplacedClue.create(rng: Rng, clue: string, direction: Direction)`. §8.5 prose is unchanged (it was the correct one). All callers in `reconcileWords` (Task pending) and `joinSubMode` will pass `deps.rng`. This matches the uniform pattern in §4 where every reducer takes `deps = { rng, now }` and threads `rng` through any id-minting call.

**Open question for later.** None.

---

## 3. `CellSeparator` type was defined in `ui/bindings/` but referenced by `domain/`

**Symptom.** §5.2 listed `export type CellSeparator = 'none' | 'space' | 'hyphen'` as part of the Grid VM contract (living in `ui/bindings/`). §8.8's `Anagram.buildWordModel` returns `{ entries: AnagramEntry[]; separators: CellSeparator[] }`, and §5.4's `AnagramModalVM.separators` is `CellSeparator[]`. That made `domain/anagram/Anagram.ts` import `CellSeparator` from `ui/bindings/`, which the ESLint `no-restricted-imports` boundary rule blocks (`domain/` may not import from `ui/`).

**Resolution applied on 2026-07-21.** `CellSeparator` was hoisted to `domain/grid/CellSeparator.ts` (§3.2 amended to declare it). §5.2's Grid VM type now states it re-exports from `domain/grid/CellSeparator.ts`. Dependency direction is restored to one-way (`domain` ← `ui/bindings`).

**Open question for later.** None.

## 4. `app/state/**` was restricted to type-only imports of builder/player state; §4.1 required runtime invocation of `reduceBuilder`/`reducePlayer`

**Symptom.** §1.3 and the original `eslint.config.js` forbade value imports from `src/builder/state/**` / `src/player/state/**` into `src/app/state/**` (`allowTypeImports: true` only). §4.1 step 1/2 requires `reduceApp` to invoke `reduceBuilder(state.builder, intent, deps)` and `reducePlayer(state.player, intent, deps)` at runtime — which requires value imports of the reducer functions. The contradiction surfaced in Task 23: `AppState.blank` needed to call `BuilderState.blank` / `PlayerState.importScreen` as values and could not, so the construction was inlined (duplicating the field shapes of both sub-states, a knowledge-duplication smell). Task 26 (`reduceApp` itself) was blocked for the same reason.

**Underlying tension.** §1.3 used a layer-boundary tool (type-only imports) to express a module-boundary constraint (don't reach into another module's internals). Two pure modules importing each other's exported functions is normal composition, not a layer violation; the right axis is published-API-vs-internal-helper, not type-vs-value.

**Resolution applied on 2026-07-21.** Adopted Layout B: each of `builder/state/`, `player/state/` publishes its public API at the folder root (`state.ts`, `intents.ts`, `reducer.ts`); implementation helpers live under `internal/` subfolders. `app/state/` (no `internal/` of its own) may value-import the root files of both other modules. Two ESLint regex patterns in two separate blocks forbid importing any `internal/` file cross-module: `src/app/state/**` forbids both `builder/state/internal/` and `player/state/internal/`; `src/builder/state/**` forbids `player/state/internal/`; `src/player/state/**` forbids `builder/state/internal/`. Each module's own `internal/` is importable from its own root files (a module consumes its own internals). §1.3 prose, the module table, §1.4 tree, §9.2 boundary table, and the `eslint.config.js` blocks for all three Layer-1 modules were amended. Tests may import from `internal/` freely — the `internal/` rule constrains only cross-module imports within `src/`.

**Follow-up.** Retrofit `AppState.blank` (Task 23) to call `BuilderState.blank` and `PlayerState.importScreen` as values, eliminating the inlined construction.

**Open question for later.** None.

## 5. `Word.number` was non-null but §8.5 required "new derived `Word[]` (no numbers yet)"; `reconcileWords` also needed a `Grid` it didn't have

**Symptom.** Two contradictions surfaced while writing `reconcileWords` (§8.5):

1. §3.4 declared `Word.number: WordNumber` (non-null), but §8.5 step 1 describes its `newWords` argument as "new derived `Word[]` (no numbers yet)." Newly-derived words from `WordDerivation.derive` had nowhere honest to put a number pre-`Numbering.assign`; the existing implementation papered over this with `number: WordNumber.of(1)` as a placeholder, which Numbering.assign then overwrote.

2. §8.5's `reconcileWords` signature did not include a `grid: Grid` parameter, but step 7 ("Run `Numbering.assign` on the new words") requires a `Grid` (§8.2 `Numbering.assign(grid, words)`). The grid is in `BuilderState.puzzle.grid` at the call site but was not threaded through to `reconcileWords`.

**Underlying tension.** Principle 3 ("illegal states unrepresentable where feasible") argues against making `Word.number: WordNumber | null`: every downstream consumer (`DisplayClue.forWord`, `LengthPattern.forWord`, `format/v1.ts`, `CompletenessCheck`, view-model derivation, the toast wording in `reconcileWords` itself) would have to grow a `null` branch or use a postfix `!` for a state that lasts only the few function calls between `derive` and `assign`. The cleaner fix is a separate type that models "derived but not yet numbered" without weakening `Word`.

**Resolution applied on 2026-07-21.** Introduced `DerivedWord` (§3.3, new type) — shape-identical to `Word` minus the `number` field. `WordDerivation.derive` now returns `DerivedWord[]`; `Numbering.assign` now takes `DerivedWord[]` and returns `Word[]`. `reconcileWords`'s signature now takes `grid: Grid` and `newWords: DerivedWord[]` (in addition to `oldWords: Word[]`, `oldDisplacedClues: DisplacedClue[]`, `rng: Rng`). §1.3 module table, §3.3 type definitions + signatures, §8.1, §8.2, §8.5 algorithm prose, and the §1.4 directory tree were amended. Step 2 of §8.5 now records `{ wordKey, direction, change }` entries and defers toast emission until after step 7 (`Numbering.assign`) so the toast can use the new `number`. `format/v1.ts`'s `buildDomainWords` returns `DerivedWord[]` (the parsed `number` from JSON is discarded before `Numbering.assign` recomputes it — preserving existing FR-98a behaviour).

**Open question for later.** The JSON file format (per §3.6 and `format/v1.ts`) still requires `number` as a field in each word object, even though `Numbering.assign` overwrites it on every load. Consider whether the file format should drop `number` (let `Numbering.assign` always recompute) or keep it as a redundancy check. Not addressed in this amendment.

---
## 6. `src/ports/**` ESLint allow-list needed `domain/puzzle/PuzzleKey.ts`

**Symptom.** Task 49 (`ports/localStoragePort.ts`) needed to import `PuzzleKey` type-only to satisfy the `StoragePort.loadPlayerProgress(key: PuzzleKey): string | null` interface signature. The original `src/ports/**` ESLint regex (line 205 of `eslint.config.js`) only allowed `../domain/persistence/ports.ts` and `../domain/rng/Rng.ts` cross-imports from ports — a tighter allow-list than the design's own `StoragePort` interface signature permits, since `StoragePort` itself takes a `PuzzleKey` parameter.

**Underlying tension.** The design's binding principle is "`src/ports/**` implements domain/persistence interfaces and `src/domain/rng/Rng`". Implementing an interface that takes a `PuzzleKey` parameter requires the type to be importable. Without it, either the port impl signature must drop down to `key: string` (breaking the interface's branded-type constraint) or the ESLint rule must be widened.

**Resolution applied on 2026-07-22.** Amended `eslint.config.js` line 205-206 to add `src/domain/puzzle/PuzzleKey.ts` and `../domain/puzzle/PuzzleKey.ts` to the negative-lookahead allow-list. The message update also names `PuzzleKey.ts` explicitly. This is a rule correction so the design's own interfaces are implementable in `src/ports/**`; it does not broaden the architectural boundary (PuzzleKey is a pure brand type with no behaviour, used only as a typing parameter).

**Related amendment.** `tsconfig.json` gained `"allowImportingTsExtensions": true` (compatible with the existing `moduleResolution: "Bundler"` + `noEmit: true`). This was needed because the (Task 48-vintage) `src/ports/**` ESLint regex explicitly enumerates allowed paths WITH the `.ts` suffix, so importing `../domain/rng/Rng.ts` etc. requires TypeScript to accept the suffix. (Type-only imports with `.ts` extensions also require this flag per TS docs.)

**Tooling addition.** Added `jsdom` as a dev-dependency (via `package.json`) for the `localStorage` port test, which uses `// @vitest-environment jsdom` per-file. Per Vitest 3.x docs, `jsdom` is the standard DOM environment. Test relies on a `beforeEach` mock because jsdom 29's `localStorage` doesn't expose enumerable accessors under Vitest — workaround tracked but not blocking.

**Open question for later.** Whether to extend the `.ts`-extension-required convention to OTHER layer boundaries (currently the `src/ports/**` regex is the only one that requires `.ts` extensions for allow-listed cross-layer imports, because it uses an explicit enumerate allow-list rather than a glob). If we adopt the convention everywhere, we'd update ALL `no-restricted-imports` regexes accordingly. Deferred.

**Resolution applied on 2026-08-23 (code smells I1).** Open question closed: convention NOT extended; instead the `src/ports/**` regex was aligned to the extensionless idiom used by every other layer block — `.ts` is now OPTIONAL in the allow-list lookahead (`ports(?:\.ts)?$` etc.), not required. The 5 `src/ports/*.ts` source imports + 1 `test/ports/localStoragePort.test.ts` import dropped their `.ts` suffix. `tsconfig.json` `allowImportingTsExtensions: true` was removed (its sole rationale was the former `.ts`-required ports regex; grep confirmed no other `.ts`-suffixed imports in `src/` or `test/`). `test/boundary/imports.test.ts` ports fixtures rewritten extensionless + 1 new PuzzleKey positive fixture (regex allowed it but no fixture asserted — gap closed). AD §9.2 boundary table row amended to list `PuzzleKey.ts` + an "Ports allow-list convention (I1)" note. The negative-lookahead structure is retained (unavoidable — `no-restricted-imports` has no allow-list primitive); only the `.ts` requirement was the smell.

## 7. `reduceApp` did not implement the "deferred confirm pass" — modal/pendingConfirmIntent never cleared on `confirm-*` dispatch

**Symptom.** Task 62 surfaced the bug: the bindings-layer `modalStore.confirmModal()` dispatches `state.pendingConfirmIntent` (a `confirm-*` intent variant). `reduceApp` routes that intent through `reduceBuilder`/`reducePlayer` cleanly, but never clears `AppState.modal` or `AppState.pendingConfirmIntent` — even though §1.1 G4 + §4.1 both say the modal is "cleared by `cancel-modal` or by the deferred confirm pass." As a result the modal stayed open after Confirm was clicked.

**Underlying tension.** The four `confirm-*` intent kinds live in `BuilderIntent`/`PlayerIntent` and individually do NOT emit a "modal cleared" event (sub-reducers don't know they'reModal-residents — they just execute the guarded action unconditionally per §4.1). `applyEventsToApp` only mutates `modal`/`pendingConfirmIntent` on `modal-request` events (it never sees a "modal-closed" event because there isn't one). The intent of this `confirm-*` path is "modal lifecycle concludes" — but that conclusion needs to be enacted somewhere, and the existing reducer had no branch for it.

**Resolution applied on 2026-07-22.** Added a `CONFIRMABLE_INTENT_KINDS` string set to `src/app/state/reducer.ts` enumerating `'confirm-switch-to-design'`, `'confirm-import-puzzle'`, `'confirm-reset-builder'`, `'confirm-reset-player'` — aliased to the `ConfirmableIntent` union from `domain/notifications/Event`. In both the Builder and Player branches of `reduceApp`, after `applyEventsToApp` runs and the result is computed, if the dispatched intent kind is in this set, the returned `state` is reshaped with `modal: null` and `pendingConfirmIntent: null`. Safe because `confirm-*` reducers never re-emit `modal-request` (no `force`, no recursive guard re-fire per §4.1). 4 tests added to `src/app/state/reducer.test.ts`.

**Open question for later.** The `CONFIRMABLE_INTENT_KINDS` string set must stay in sync with the `ConfirmableIntent` union at `domain/notifications/Event`. If a fifth confirmable action is ever added, both arrays must be updated. A static type-derived set would be safer; deferred to a future clean-up.

**Resolution applied on 2026-08-10.** Closed by the D1 fix (code smells `D1`). All four kind sets (`BUILDER_INTENT_KINDS`, `PLAYER_INTENT_KINDS`, `CONFIRMABLE_INTENT_KINDS`, `AMBIGUOUS_INTENT_KINDS`) were extracted to a new `src/app/state/intentKinds.ts` module. The first three are now built from a `Record<Kind, null>` record literal annotated with `satisfies` so `tsc` fails the build when the record literal omits a union member or carries an extra key — the union is the source of truth and the set is a derived view, no manual string maintenance. `AMBIGUOUS_INTENT_KINDS` is computed at module load as the runtime intersection of the Builder and Player sets (`new Set([...BUILDER].filter(k => PLAYER.has(k)))`), so adding a new shared kind to both unions automatically enrols it in the ambiguous set. `reduceApp` imports the sets rather than redeclaring them. §9.3 file tree and the §1.3 `app/state/` module table were amended to list `intentKinds.ts`. Drift path closed.


## 8. `Puzzle.withGrid` does not sync `gridSize` — surfaced by builderStore.change-grid-size test

**Symptom.** Task 63 surfaced by writing builderStore tests: dispatching `{ kind: 'change-grid-size', size: GridSize.of(20) }` produced `state.builder.puzzle.grid.length === 20` (the new Grid has the right shape) but `state.builder.puzzle.gridSize === GridSize(15)` (the branded `gridSize` field retained its original value). This invariant mismatch would later cause `serializePlayerProgress` (Task 59) to size `playerLetters` from the stale `gridSize` and emit a corrupt blob.

**Underlying tension.** `Puzzle.withGrid(p, g) = { ...p, grid: g }` does not update `puzzle.gridSize`. The Puzzle aggregate has two representations of "size": implicit via `grid.length` and explicit via the `gridSize` branded field. Only `Puzzle.blank(size, key)` sets them in sync. Every other `Puzzle.withGrid` call-site assumes you're swapping same-sized grids, but `change-grid-size` is the one call-site that does change the outer dimension.

**Resolution applied on 2026-07-22.** In `src/builder/state/internal/designMode.ts`, the `handleChangeGridSize` reducer case now constructs: `{ ...Puzzle.withGrid(state.puzzle, newGrid), gridSize: intent.size }`. Explicit re-sync avoids collateral: other `Puzzle.withGrid` call-sites continue to swap same-sized grids unchanged.

**Open question for later.** Whether to broaden this to `Puzzle.withGrid` itself (always re-sync from `g.length`). The "you shouldn't be able to swap a grid whose length disagrees with the field" property argues for hardening in one place, but that means changing the contract of `Puzzle.withGrid` and auditing every other call-site (most are same-size swaps but `lifecycle.ts` line 88 / 152 are guaranteed safe because the puzzle is freshly-imported). Deferred.

**Resolution applied on 2026-08-10 (DRN item 8 closed, code-smell D3 resolved).** `Puzzle.withGrid` now re-syncs `gridSize` from `g.length` via `GridSize.of(g.length)` (src/domain/puzzle/Puzzle.ts). `GridSize.of` throws `RangeError` for out-of-range/non-integer `g.length`, so an invariant-breaking caller fails loudly rather than silently corrupting downstream state (e.g. `serializePlayerProgress`, which sizes `playerLetters` from `gridSize`). The redundant `gridSize: intent.size` re-write in `src/builder/state/internal/designMode.ts:71` (`change-grid-size`) is removed — `Puzzle.withGrid` now carries the invariant. All other 11 `withGrid` call-sites swap same-size grids and are unaffected. The test at `test/domain/puzzle/Puzzle.test.ts:100` that asserted `p2.gridSize === p.gridSize` after a size-3→size-4 swap (encoding the bug) is flipped to assert `p2.gridSize === GridSize.of(4)` plus an invariant assertion `Number(p2.gridSize) === p2.grid.length`; a new test asserts the re-sync for a size-3→size-5 swap. `designMode.test.ts` and `reducer.test.ts` `change-grid-size` tests gain `gridSize` assertions. AD §3.6 `withGrid` comment amended to "re-syncs gridSize from g.length (invariant §3.6)".


## 9. `reduceApp` ambiguous-intent-kind disambiguation via `state.route`

**Symptom.** Task 64 (playerStore) surfaced an architectural illusion: Builder and Player share six intent kinds (`select-cell`, `move-cursor`, `type-letter`, `backspace`, `escape`, `click-clue-panel-word`) that are indistinguishable at runtime. The old `reduceApp` checked `BUILDER_INTENT_KINDS.has(kind)` before `PLAYER_INTENT_KINDS.has(kind)` — every ambiguous kind was silently routed to Builder. So `dispatchPlayer({ kind: 'select-cell' })` did nothing to `state.player`. The bindings store also couldn't reliably communicate scope to the reducer.

**Underlying tension.** §4.1 design prose ("If intent is a BuilderIntent: invoke reduceBuilder — same for PlayerIntent") treated the union types as runtime-disjoint, but the runtime dispatcher must select a sub-reducer by kind alone. To stay statically typed per §0 Principle 3 the design uses simple kind-string dispatch — but the dual-purpose kinds break the dispatch assumption.

**Resolution applied on 2026-07-22.** Added an `AMBIGUOUS_INTENT_KINDS` set (the intersection of the two existing sets, hardcoded six string literals) in `src/app/state/reducer.ts`. The dispatcher now:
1. Routes AppIntent kinds (`navigate`, `cancel-modal`, `dismiss-toast`) as before.
2. Routes unique Builder kinds to `reduceBuilder`; unique Player kinds to `reducePlayer`.
3. For ambiguous kinds, routes based on `state.route`: `'play' → reducePlayer`, `'build' → reduceBuilder`, `'landing' → reduceBuilder` (back-compat default at time of writing — existing reducer/store tests dispatch ambiguous kinds on `route='landing'` expecting Builder behaviour). **Superseded 2026-08-10: the `'landing'` branch now throws (see resolution below; DRN item 9 closed, code-smell D2 resolved).**

Also extracted `routeToBuilder`/`routeToPlayer` in-reducer helpers that re-apply the deferred-confirm-pass pattern (Task 62a) to keep the new code DRY.

4 test cases added to `src/app/state/reducer.test.ts` covering ambiguous dispatch on each route. 2 previously-failing `playerStore` tests now `navigate` to `'play'` before dispatching ambiguous kinds.

**Open question for later.** Whether `'landing'` should route ambiguous kinds to Builder silently or throw. The 'play'-intent-dispatched-without-route-'play' case (e.g., a stray dispatch while in landing) currently silently routes to Builder. Strict semantics could throw and require a navigate intent first. Deferred — would need every test that dispatches ambiguous kinds during landing to first `navigate`. Cost-benefit currently tips toward back-compat.

**Resolution applied on 2026-08-10 (DRN item 9 closed, code-smell D2 resolved).** The `'landing'` route now **throws** on ambiguous intent kinds instead of silently routing to `reduceBuilder`. Rationale: FR-1/FR-2 require the landing screen to present only Build/Play `navigate` actions; no Builder or Player UI is mounted on landing, so an ambiguous kind (`select-cell`, `move-cursor`, `type-letter`, `backspace`, `escape`, `click-clue-panel-word`) dispatched while `route === 'landing'` can only be a bug — there is no legitimate grid interaction to forward. The previous silent routing hid such bugs and mutated `state.builder` without any user-visible signal. The decision reverses the original back-compat stance: the single test asserting landing→Builder behaviour (`test/app/state/reducer.test.ts:245`) is rewritten to assert the throw, and no other test, store, or UI path dispatches ambiguous kinds during landing. `src/app/state/reducer.ts:69-77` now reproduces the unknown-kind throw pattern already used at line 66. AD §4.1 amended to state `'landing'` throws. **DRN item 9: closed.**

## 10. `move-cursor` intent lacked a sign field; arrow keys could only go forward along each axis

**Symptom.** Smoke-testing surfaced that arrow keys Up and Left moved the cursor in the wrong direction (Up did what Down should, Left did what Right should). Down and Right worked correctly. The four arrow keys produced only two distinct outcomes, not four.

**Underlying tension.** §4.3 (`BuilderIntent`) and §4.4 (`PlayerIntent`) both defined `{ kind: 'move-cursor'; direction: Direction }` — only the **axis** (`'across' | 'down'`), not the **sign** (positive or negative along that axis). FR-14 requires four arrow-key behaviours: Left (−1 col, direction='across'), Right (+1 col, 'across'), Up (−1 row, 'down'), Down (+1 row, 'down'). The reducers in `fillMode.ts` and `solving.ts` hardcoded `DELTA[direction] = (+1, axis)` — so a `move-cursor` intent could only ever move forward (right/down), never backward. Existing tests never asserted negative-direction movement because the intent had no vocabulary to express it. TypingSurface's four arrow key handlers dispatched `{ direction: 'across' }` for both Left and Right and `{ direction: 'down' }` for both Up and Down, collapsing the four arrow keys to two intents at the UI layer before the reducer ever saw them.

**Resolution applied on 2026-07-22.** Added a required `sign: -1 | 1` field to `move-cursor` in both `src/builder/state/intents.ts` and `src/player/state/intents.ts`. The reducers in `fillMode.ts` and `solving.ts` now compute the target as `cursor.row + sign * DELTA[direction].dr, cursor.col + sign * DELTA[direction].dc`. The cursor direction still updates to `intent.direction` per FR-14 (so pressing Left while in Down mode keeps the cell but flips direction to 'across'). TypingSurface's four arrow handlers now emit the four distinct `{direction, sign}` pairs. All existing `move-cursor` call sites (reducer tests, the bindings store primitive-helper `dispatchMoveCursor`, view-model tests that pass `move-cursor` through `reduceApp`) were updated to include `sign: 1` for the forward case (preserve semantics), and new test cases added for `sign: -1`. §4.3 line 792 and §4.4 line 889 of `architecture_design.md` were amended to carry the new `sign` field. `dispatchMoveCursor` in `builderStore.svelte.ts`/`playerStore.svelte.ts` now takes `(direction, sign)`.

**Open question for later.** None — `sign` is the minimal additive change and preserves the existing `Direction` vocabulary.

## 11. `CellHilite` post-Check per-cell colouring leaked the answer back to the player

**Symptom.** Smoke-testing surfaced that running Check colour-filled cells: originally correct cells got pale green (`bg-green-200`) and incorrect cells pale red (`bg-red-200`), giving the solver extra information beyond what FR-75 requires. The user reported this as a bug ("Check shouldn't show correct letters/words in blue" — `llmworkspace/bugs.txt`), then extended it to the red hilite too.

**Underlying tension.** §5.2 line 954 defined `CellHilite = 'none' | 'selected' | 'in-word' | 'correct' | 'incorrect'`, and line 955 explicitly mandated that "correct/incorrect: only after Check on the Player grid (FR-74/FR-75)." `deriveGridVM` (`src/ui/bindings/viewmodels/gridVM.ts`) accordingly set `hilite = 'correct'` for filled non-incorrect cells and `hilite = 'incorrect'` for incorrect cells once `checkResult` was present; `PlayerGrid.svelte` mapped correct→`bg-green-200` and incorrect→`bg-red-200`. FR-75 only requires "a distinct message and colour per classification" — and that classification display lives in the toolbar via `deriveCheckResultVM` (`src/ui/bindings/viewmodels/playerVM.ts` lines 152-172, `colorClass` per-classification). Per-cell colouring was extra, undesired help. The `clear-errors` action (FR-75) operates against `CheckResult.incorrectCells` in `PlayerState` — that is reducer data, not visual hilite — so removing the visual marks does not affect Clear Errors.

**Resolution applied on 2026-07-22.** Removed both `'correct'` and `'incorrect'` variants from `CellHilite` in §5.2 of `architecture_design.md` (line 954). The type is now `'none' | 'selected' | 'in-word'` — the only grid hilitres are cursor yellow and in-word pale yellow. `deriveGridVM` no longer consults `checkResult` for hilitre decisions (the parameter was removed entirely; `incorrectKeys` set computation removed; `playerVM.ts`/`builderVM.ts` callers updated to drop the argument). `PlayerGrid.svelte` and `BuilderGrid.svelte` drop their `'correct'` and `'incorrect'` colour cases (the `cellColor` switch now covers only `selected | in-word | none`). `gridVM.test.ts` assertion for the previously-incorrect cell now expects `hilite='none'`; the test name was updated. FR-75's toolbar classification message/colour (FR-74 classifications) is unchanged. `CheckResult` state shape (§4.4) is unchanged — only the visual mapping at the grid-VM layer changed.

**Open question for later.** None — both positive- and negative-cell-colour removal align with the user's spec; FR-75's toolbar messaging still satisfies the "distinct message and colour per classification" requirement.

