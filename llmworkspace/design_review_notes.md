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