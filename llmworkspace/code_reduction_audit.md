# angryphrase — Code Reduction Audit

**Scope:** all of `src/` (117 files, ≈8,240 LOC). Tests excluded per instruction, but note that
many deletions below remove prod API that `test/` consumes; those tests must be updated or
deleted alongside (flagged per finding). No significant architectural changes: the five-layer
shape (domain → state reducers → bindings → components → ports), the reducer/intent/event
model, and the port contracts stay. Boundaries *inside* layers (file splits, module
boundaries, wrapper layers) are fair game — but no guard, contract, or documented
property is traded for line count (see the rejected list at the end).

**Baseline (LOC per area, from full read of every file):**

| Area | Files | LOC |
|---|---|---|
| `src/domain/` | 57 | ≈3,030 |
| `src/builder/state/` + `player/state/` + `app/state/` | 27 | ≈1,985 |
| `src/ui/bindings/` | 18 | ≈1,720 |
| `src/ui/` components + shared helpers | 30 | ≈1,280 |
| `src/ports/` + `main.ts` | 5 | ≈225 |
| **Total** | **117** | **≈8,240** |

**Estimated total reduction from this report: ≈1,400–1,700 LOC (17–21%) plus ~27 fewer files.**

Findings are ordered largest-first. "Risk: none" means behavior-identical pure deletion or
refactor with no observable difference; higher risks say what can drift.

Every item in this report is a strict improvement or at worst LOC-neutral-to-positive —
none trades a guard, a contract, or a documented property for line count. The three
candidates that did were rejected outright (see "Explicitly considered and NOT
recommended").

---

## O1. `domain/format/v1.ts` — parser/serializer consolidation (est. −180 LOC)

`src/domain/format/v1.ts` (774 lines) is the largest file in the repo and is internally
repetitive. No behavior change required; all failure strings can stay byte-identical.

1. **Unknown-field checking (5 copies).** `TOP_LEVEL_KEYS`/`CELL_KEYS`/`WORD_KEYS`/
   `NEXT_WORD_KEYS`/`DISPLACED_CLUE_KEYS` each get their own inline `for…of Object.keys`
   loop. Extract one helper:

   ```ts
   function rejectUnknownFields(obj: Record<string, unknown>, allowed: Set<string>, prefix: string, failures: ParseFailure[]): boolean {
     for (const key of Object.keys(obj)) {
       if (!allowed.has(key)) { failures.push({ message: `${prefix}unknown field "${key}".` }); return false; }
     }
     return true;
   }
   ```
   This alone collapses ~30 lines. (Top-level keeps its special `displacedClues` exemption
   as a pre-check.)

2. **Word-key validation duplicated between word and `nextWord` (~40 LOC).**
   `validateWords` checks `startRow`/`startCol`/`direction` in-bounds, then repeats the exact
   three checks for `nextWord`. Extract `validateKeyedCoord(prefix, obj, size, failures): {startRow, startCol, direction} | null`
   and call it twice.

3. **Double-guarded top-level fields (~15 LOC).** `parsePuzzleShape` checks `titleRaw`/
   `authorRaw` typeof and `gridSize`/`puzzleKey` non-null twice (once before the early
   return, once after). The second block (`if (gridSize === null || puzzleKey === null)` …
   and the repeated title/author typeof) is dead given the earlier `failures.length > 0`
   return. Delete the re-checks.

4. **`buildDomainGrid` constructs via 225 `Row.of`/`Col.of` + `GridOps.setCell` calls (~15 LOC).**
   The function builds a fresh grid from validated data — it can construct the `Cell[][]`
   directly in one nested `map` and skip per-cell bounds-checked `setCell`:

   ```ts
   function buildDomainGrid(cells: CellJson[][], gridSize: GridSize): Grid {
     return cells.map(row => row.map(cd => cd.black
       ? Cell.black()
       : Cell.setMarker(Cell.setAnswerLetter(Cell.white(), cd.puzzleLetter === null ? null : Letter.try(cd.puzzleLetter)), cd.marker)));
   }
   ```
   (Plain array iteration — no lint rule change needed; see O4.)

5. **`serializeCompleteShape` destructuring trick (~10 LOC).** It destructures
   `buildSerializedOutput`'s seven fields to omit `displacedClues`. Give
   `buildSerializedOutput` a `displacedClues` argument of `[]` for the complete case and
   delete the destructure/re-pack.

6. **`markerFromJson`/`markerToJson` (~10 LOC).** Symmetric encode/decode of four booleans
   into two `CellSeparator`s. Keep, but the "conflicting markers" two-branch can be a
   single expression: `space && hyphen` check per axis via a tiny loop over the two axes.

**Risk:** low. Failure-message byte-equality is preserved by every remaining item. Parser
tests must be updated where they assert exact failure counts (the double-guard and
shared-validation refactors alter *which* code emits a given message, never the message).

---

## O2. Brand-type boilerplate: generic constructor factory + removal of ceremony brands (est. −150 to −200 LOC)

The 14 branded types each carry a hand-written `try`/`of` + `RangeError` block — near
identical code repeated ~10 times (~120 LOC of pure boilerplate), plus several brands that
add no safety at all.

1. **`Title` and `Author` brands are pure ceremony.** `Title.try(s)` unconditionally
   succeeds (it brands any string, "validating" nothing). Every construction site is
   `Title.try(x)` where `x: string` is already known. Delete the brand and the calls, but
   **keep the names in the API** via trivial aliases declared once in `Puzzle.ts` —
   `type Title = string; type Author = string;` — so `Puzzle.title: Title` and the
   intent fields stay self-documenting while `Title.ts`, `Author.ts` (18 lines) and every
   `try` call disappear. Simplifies `Puzzle`, `v1.ts`, `builderFacade.ts`,
   `builder/state/reducer.ts`, `intents.ts`.
   **Risk:** none at runtime (the brand never rejected anything); signatures read the same.

2. **`Position` brand in the anagram domain adds nothing.** Positions are array indices
   of `entries`; the brand appears in `AnagramEntry` and is minted/unminted with
   `Number(...)` casts on the very next line in `buildChainModel`. Replace with `number`,
   delete `domain/anagram/Position.ts` (22 lines). **Risk:** none.

3. **`ToastId.generate` reimplements UUID hex generation.** It mints 16 random bytes as
   hex — the same shape `uuidv4()` produces. Use `brand<'ToastId', string>(uuidv4(rng))`
   and delete the inline generator body (~8 LOC, and ids become collision-safe).

4. **`PuzzleKey.try` and `DisplacedClueId.try` duplicate the identical UUID-v4 regex.**
   Move `isUuidV4(s)` (or `uuidTryPattern`) into `domain/uuid/uuidv4.ts` and call it from
   both (~10 LOC, one source of truth for "valid key").

5. **One generic factory replaces ~8 hand-written constructor pairs.**
   `Row`, `Col`, `GridSize`, `EpochMs`, `DurationMs`, `WordNumber`, `WordLength` share the
   shape `try: int && n ≥ min (&& n ≤ max)` / `of: throw RangeError`. One helper in
   `brand.ts`:

   ```ts
   export function intBrand<Tag extends string, T = Brand<Tag, number>>(
     tag: Tag, min: number, max = Number.POSITIVE_INFINITY,
   ) {
     const valid = (n: number) => Number.isInteger(n) && n >= min && n <= max;
     return {
       try: (n: number) => (valid(n) ? (brand(n) as T) : null),
       of: (n: number) => { if (!valid(n)) throw new RangeError(`Invalid ${tag}: ${n}`); return brand(n) as T; },
     };
   }
   ```
   Each owner module collapses to the brand type + `MIN/MAX/DEFAULT` constants + whatever
   extra methods it really has. ~120 → ~40 LOC across 7 modules. Note `WordLength`'s
   `equals` and the `try`s listed in O3 are dead and get deleted first, shrinking this
   further.

**Risk:** low; type-level only. Many domain unit tests construct these values and must be
updated.

---

## O3. Delete dead / test-only API surface (est. −170 LOC, verified by grep across `src/`)

All of the following have **zero call sites in `src/`** (their only consumers are
co-located unit tests). Since tests are out of scope, this is pure deletion:

| API | File | Lines |
|---|---|---|
| `GridOps.neighbours`, `GridOps.neighboursInDirection`, `GridOps.equals`, `GridOps.clone` | `domain/grid/GridOps.ts` | ~75 |
| `Direction.opposite`, `Direction.isAcross` | `domain/word/Direction.ts` | ~10 |
| `Anagram.validateInput` (word form; only `validateChainInput` is used) | `domain/anagram/Anagram.ts` | ~12 (see O17) |
| `WordMap.set`, `WordMap.remove` (only `fromWords`/`get`/`has` are used) | `domain/word/WordMap.ts` | ~12 |
| `DurationMs.try`, `DurationMs.of`, `EpochMs.try`, `Position.try`, `Position.equals`, `WordLength.try`, `WordLength.equals`, `WordNumber.try` | various | ~35 |
| `DisplacedClue.withText` | `domain/builder/DisplacedClue.ts` | ~4 |
| `PlayerState.loaded` | `player/state/state.ts` | ~9 |
| `CompletenessCheck.isComplete` | `domain/puzzle/CompletenessCheck.ts` | ~4 |
| `Toast.create` `ttlMs?` parameter (never passed; always `DEFAULT`) | `domain/notifications/Toast.ts` | ~4 |
| `AppStore.getState()` (no callers; facades use the specific getters) | `ui/bindings/appStore.svelte.ts` | ~4 |
| `BUILDER_INTENT_KINDS` / `PLAYER_INTENT_KINDS` + the two kind records (only `test/app/state/intentKinds.test.ts` consumes them) | `app/state/intentKinds.ts` | 61 (whole file) |

**Risk:** none in production. Breaks the corresponding test files — delete or rewrite
those tests in the same commit. `intentKinds.ts` deletion also removes it from the
boundary spec's layer map (update `tools/boundaries.js` accordingly if it enumerates the
file).

**Status (2026-10-25): addressed** — resolution in `code_reduction_audit_resolutions.md`
("O3 — Delete dead / test-only API surface"). Corrections to this item, made during the
resolution: (a) "since tests are out of scope, this is pure deletion" is wrong — deleting the
production API breaks the tests that consume it, so the test tree is in scope (21 cases deleted,
14 call sites rewritten, 8 files edited, against ~225 production LOC removed); (b) the table was
incomplete — `LengthPattern.forActiveClueBanner` is also dead (zero callers in `src/`) and was
deleted; (c) `PlayerState.loaded` was kept and production was changed to call it, instead of the
audit's proposal to delete it (which would have left the solving-state shape as a 5-field literal
at 20 test call sites); (d) `AppStore.getState()` was deleted — every other store getter has a
production caller, this one had none. Leftovers: none. Overlap with later items is recorded in the
resolution's "Not addressed" table — O4 (dissolve `GridOps`), O2.2 (delete the `Position` brand)
and O17.1 (rename `Anagram.validateChainInput`) must not re-cut the rows landed here.

---

## O4. Dissolve the `GridOps` wrapper layer; kill per-cell scan ceremony with array iteration (est. −150 LOC)

Two parts. **Neither relaxes any lint rule, guard, or boundary** — the non-null-indexing
sanction stays exactly where it is.

1. **After O3, `GridOps` is a wrapper module.** With `neighbours`,
   `neighboursInDirection`, `equals`, and `clone` deleted (dead, O3), what remains is
   five pure delegations to `GridAccess` (`blank`, `cellAt`, `setCell`, `updateCells`,
   `withinBounds` — kept only for "back-compat with 88 call sites" per architecture.md
   §3) plus exactly one real function, `isSelectable`. Dissolve it:
   - move `isSelectable` into `WordTopology` beside `partOfRun`/`partOfRunMask` — it is
     the same rule family ("white ∧ in a length-≥2 run on either axis") and
     architecture.md §3 already describes the two predicates as one rule;
   - delete the module; point all call sites at `GridAccess`.
   One module and one mental layer gone, no behavior change.

2. **Six scan sites pay `Row.of(r)`/`Col.of(c)`/`GridOps.cellAt` per cell** of loops that
   are in bounds by construction:
   - `v1.ts` `buildDomainGrid` (O1 item 4)
   - `CompletenessCheck.check`
   - `player/state/internal/solving.ts` `handleCheck`
   - `player/state/internal/lifecycle.ts` `handleConfirmResetPlayer`
   - `persistenceCodec.serializePlayerProgress`
   - `viewmodels/gridVM.deriveGridVM` (mints `Row.of(r)` + `Col.of(c)` per cell just to
     read the array it is iterating)

   None of these needs index arithmetic at all: array iteration (`forEach`/`map`/
   `flatMap`) hands over both the element and its indices **with no non-null assertions**,
   so the sanctioned-site lint rule is untouched. Example,
   `handleConfirmResetPlayer` (24 lines → 6):

   ```ts
   const updates = state.puzzle.grid.flatMap((row, r) =>
     row.flatMap((cell, c) => (!cell.black && cell.playerLetter !== null)
       ? [{ row: Row.of(r), col: Col.of(c), cell: Cell.setPlayerLetter(cell, null) }] : []));
   ```

   `Row.of`/`Col.of` remain only where a branded coordinate must be *constructed for
   output* (the updates array above); reading cells needs neither the brands nor the
   bounds-checked accessor. `deriveGridVM` drops both `Row.of` and `Col.of` entirely.
   Saves ~15–25 LOC per site (≈100 total) and is faster (no re-validation of
   loop-internal indices).

**Risk:** low. No lint-rule or boundary change; branded `Row`/`Col` remain the intent
payload currency — only internal scan ceremony goes away. `tools/boundaries.js` and the
§3 module table may reference the deleted `GridOps` path and need a mechanical update.

---

## O5. Consolidate type-only micro-modules (est. −80 to −120 LOC, −22 files)

File-count itself is a maintenance cost here: several domain files hold nothing but a
type alias or a tiny branded constructor. **Scope rule for this item: merge only
type-only/constructor micro-files; every behavior module keeps its own file.** This
preserves the architecture.md §3 module map as a map of *behavior owners* while removing
files that never earned one. No merged file exceeds ~120 lines.

| Merge | Files | Note |
|---|---|---|
| `domain/notifications/` 6 files → 1 `notifications.ts` (84 LOC total today, largest file 34) | −5 | `Event.ts` already hosts `ReducerResult`/`Result`/`IntentTarget` — it is the de-facto module |
| `domain/grid/` *type* files → one `gridTypes.ts` (`Grid`, `Cell`, `CellMarker`, `CellSeparator`, `Cursor`, `Row`, `Col`, `GridSize`) | −7 | behavior modules (`GridAccess`, `GridInteraction`, `WordTopology`) stay separate |
| `domain/word/` type+ctor files → one `wordTypes.ts` (`Word`, `WordKey`, `WordNumber`, `WordLength`, `Direction`, `DerivedWord`) | −5 | behavior modules (`WordGeometry`, `WordDerivation`, `Numbering`, `WordMap`, `WordSelection`) stay separate |
| `domain/time/` 2 → 1 | −1 | 38 LOC total |
| `domain/builder/` 2 → 1 | −1 | |
| `domain/anagram/` 2 → 1 (after the `Position` deletion, O2.2) | −1 | |
| `viewmodels/toastVM.ts` + `modalVM.ts` fold into `toastFacade.ts` / `modalFacade.ts` (both VMs are trivial; the facades are their only consumers) | −2 | see also O6.4 |

Public symbols stay the same, so call-site churn is import paths only (mechanical,
~60 files). The `domain/brand` owner list in `tools/boundaries.js` must be re-pointed at
the new module paths. **Risk:** none at runtime. Do last, after the deletions above have
shrunk the content, so rebase conflicts stay shallow.

---

## O6. Facade / action-bag / intent-type boilerplate (est. −150 LOC)

1. **Target-stamping repeated ~40 times.** Both facades open every action body with
   `dispatch({ target: 'builder', kind: '…' })`. One curried helper per facade, typed
   without casts — define once in `intents.ts`:

   ```ts
   export type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
   export type BuilderIntentMinusTarget = DistributiveOmit<BuilderIntent, 'target'>;
   ```
   ```ts
   const d = (partial: BuilderIntentMinusTarget) => appStore.dispatch({ target: 'builder', ...partial });
   ```
   Each action body loses its stamp and the file loses ~30 lines. Same for the player
   facade (~25). Dispatch stays fully type-checked — an invalid kind/payload combination
   is still a compile error at the call site.

2. **Named `Extract` type aliases.** Every internal handler repeats
   `intent: Extract<BuilderIntent, { kind: 'set-marker' }>` (~30 sites across
   `builder/player` internals, 2 lines each). Define once in each `intents.ts`:
   `export type SetMarkerIntent = Extract<BuilderIntent, { kind: 'set-marker' }>;` … or a
   single mapped export: `export type BuilderIntentOf<K extends BuilderIntent['kind']> = Extract<BuilderIntent, { kind: K }>;`
   (~60 LOC saved across handlers).

3. **`AnyIntent` alias.** `AppIntent | BuilderIntent | PlayerIntent` is spelled out in 6
   places (`appStore`, both facades, `filePickActions`, `reduceApp`, tests). One
   `export type AnyIntent = AppIntent | BuilderIntent | PlayerIntent;` in
   `app/state/intents.ts` (~8 LOC + readability).

4. **`toastFacade` + `toastVM` merge** (see O5): the facade is 32 lines wrapping one
   derivation and one action. Merged file ≈ 25 lines total instead of 45 across two.
   Same for `modalFacade` (37) + `modalVM` (45) → one ~55-line file.

5. **`app/state/reducer.ts` routing (~15 LOC).** The inner `routeToBuilder`/`routeToPlayer`
   function declarations plus `default: throw` can be a direct 8-line switch on
   `intent.target` calling the sub-reducers inline. The `default` arm's cast gymnastics
   (`(intent as { kind: string }).kind`) goes away — `target` is the discriminator.

**Risk:** low, type-level.

---

## O7. Persistence plumbing duplication (est. −120 LOC)

1. **`persistenceScheduler.ts` — builder and player halves are clones** (timer + pending
   state + clear + flush logic, ~55 lines duplicated). One **fully typed** slice factory,
   instantiated twice — no `unknown`, no casts, identical public interface:

   ```ts
   function createSliceScheduler<S>(doSave: (s: S) => void, debounceMs: number,
                                   onResult: (err: Error | null) => void) {
     /* timer + pending + schedule/clear/flush — one copy instead of two */
     return { schedule(state: S): void; clear(): void; flush(): void; };
   }
   const builderSide = createSliceScheduler(doSaveBuilder, debounceMs, err => onWriteResult('builder', err));
   const playerSide  = createSliceScheduler(doSavePlayer,  debounceMs, err => onWriteResult('player',  err));
   ```
   ~40 LOC out and the two halves can no longer drift.

2. **`appStore.svelte.ts` — `builderLatch`/`playerLatch` + branchy `handleWriteResult`.**
   Same shape: one `makeLatch(warnPrefix, failureIntent)` factory returning a
   `report(err)` function (the two `console.warn` strings and two intents become the
   factory's arguments). One code path, keyed per slice by construction. ~15 LOC and
   removes the four `if (slice === 'builder') …` branches.

3. **`localStoragePort.ts` — six methods each re-inline `try/catch` +
   `err instanceof Error ? err : new Error(String(err))`.** One `coerceError` (as
   `filePickPort.ts` already has) + one `guard<T>(fn): LoadResult<T> | Error | null`
   wrapper cuts the file from 66 to ~40 lines. Also the module exports both a factory and
   a singleton; production uses only the singleton (the factory's only non-test consumer
   is the singleton line itself) — keep the factory only if `test/ports/` uses it.

4. **`persistenceCodec.ts` (147 lines) — repeated `(parsed as { kind?: unknown }).kind`
   casts.** Both parsers re-cast the same object five times. Parse once into a
   `unknown`-safe local and use a small `isRecord` + field accessors, or type the wrapper
   minimally:

   ```ts
   const w = snap as { kind?: unknown; version?: unknown; puzzle?: unknown; mode?: unknown };
   if (w.kind !== 'builder-snapshot' || w.version !== 1) return null;
   ```
   `serializePlayerProgress` (20 lines of loops) becomes
   `state.puzzle.grid.map(row => row.map(c => c.playerLetter))` + the `String` conversions
   only where JSON needs them (it doesn't — brands are strings at runtime). ~35 LOC total.

**Risk:** low. Persistence-scheduler tests are the main re-verification burden
(`test/ui/bindings/persistenceScheduler.test.ts` asserts per-slice behavior).

---

## O8. Player solving handlers: one fold instead of five copies (est. −70 LOC)

`solving.ts` repeats the same five-step pattern in `handleSelectCell`,
`handleMoveCursor`, `handleClickCluePanelWord`, `handleTypeLetter`, `handleBackspace`:

guard `phase !== 'solving'` → run `GridInteraction.*` → null-check → spread with
`checkResult: null` and `anagramAfterCursorChange(...)` (~100 lines total). One helper:

```ts
function applyCursorChange(state: SolvingState, out: { grid?: Grid; cursor: Cursor } | null): PlayerState {
  if (out === null) return state;
  const puzzle = out.grid ? Puzzle.withGrid(state.puzzle, out.grid) : state.puzzle;
  return {
    ...state,
    puzzle,
    ...(out.cursor !== undefined && { cursor: out.cursor }),
    checkResult: null,
    anagram: anagramAfterCursorChange(state.anagram, puzzle, out.cursor ?? state.cursor),
  };
}
```

Each handler becomes guard + one call (~8 lines → 4). Same idea applies to the builder's
`fillMode` cursor handlers (they lack the checkResult/anagram resets, so the win is
smaller — ~20 LOC).

**Risk:** low; `handleClickCluePanelWord`'s flow differs slightly (constructs cursor
directly) — keep it explicit or adapt the helper.

---

## O9. `WordTopology.partOfRun` — 60 lines doing a 2-line job (est. −60 LOC)

`partOfRun` walks backward to the run start, then forward to the run end, with
`Row.try`/`Col.try`/`withinBounds` calls per step (~60 lines) — to answer "is this white
cell in a length-≥2 run along an axis". Equivalent formulation:

```ts
const whiteAt = (g: Grid, r: number, c: number): boolean => {
  const cell = g[r]?.[c];   // optional chaining: no non-null assertions, sanctioned rule untouched
  return cell !== undefined && !cell.black;
};

export function partOfRun(grid: Grid, row: Row, col: Col, direction: Direction): boolean {
  const r = Number(row), c = Number(col), dc = direction === 'across' ? 1 : 0, dr = 1 - dc;
  return whiteAt(grid, r, c) && (whiteAt(grid, r - dr, c - dc) || whiteAt(grid, r + dr, c + dc));
}
```

A cell is in a maximal run of length ≥ 2 iff itself white and (previous or next along the
axis is white). This is exactly what the current scan computes. Verify with the existing
conformance test (it already proves `partOfRun` ≡ `partOfRunMask` on every cell).
**Risk:** low — the equivalence is mathematically direct and the existing test pins it.

---

## O10. `WordGeometry` consolidation (est. −45 LOC)

- `cells()` has two near-identical loops (across/down branches) — one loop with a delta:
  ```ts
  const dr = word.key.direction === 'down' ? 1 : 0, dc = 1 - dr;
  return Array.from({ length: Number(word.length) }, (_, i) => ({
    row: Row.of(Number(word.key.startRow) + i * dr),
    col: Col.of(Number(word.key.startCol) + i * dc),
    offset: i,
  }));
  ```
  (~35 → 12 lines)
- `lastCell(word)` is exactly `cells(word)[length - 1]` (9 lines → 2; `Anagram.buildChainModel` keeps its call).
- `contains()` is already O(1) arithmetic — keep.

**Risk:** none.

---

## O11. Chain-boundary marker logic exists three times (est. −70 LOC, DRY)

"Compute a linked word's last cell, read/write the separator marker on the axis its
direction implies" is implemented independently in:

- `builder/state/internal/joinSubMode.ts` — `sourceLastCell` + `directionAxis` +
  `materializeJoinMarker` + `clearBoundaryMarker` (~45 lines)
- `builder/state/internal/reconcileWords.ts` — `directionAxis` + `applyBoundaryMarkerRule`
  re-implements advance/read/write (~60 lines of its 227)
- `domain/format/v1.ts` — `normalizeV1ChainBoundaries` (~25 lines)

And `directionAxis(direction) = direction === 'across' ? 'right' : 'bottom'` is spelled out
**four** times (those three + `LengthPattern.separatorAt`).

Fix: one domain module (e.g. `domain/chain/ChainMarker.ts` or extend `WordGeometry`):
`endCell(word): {row, col}`, `axisFor(direction): CellMarkerAxis`,
`separatorAtWordEnd(grid, word): CellSeparator`,
`setWordEndSeparator(grid, word, sep): Grid`. The three consumers become thin calls.
~70 LOC out and one owner of the rule. This *adds* an export to `domain/` and removes
duplicated state-layer logic — consistent with the layering rules.

**Risk:** low; behavior pinned by `reconcileWords` and `joinSubMode`/`v1` tests.

---

## O12. View-model redundancy (est. −50 LOC)

All verified by grep against component usage:

1. **`BuilderToolbarVM.exportCompleteViolations` and `.exportCompleteCounts` are unused
   by any component** — only `canExportComplete` and `violationSummary` are rendered.
   Delete both fields from the VM type + derivation (`builderVM.ts`). `CompletenessCheck.groupByKind`
   then has one consumer left (the summary builder) — keep or inline the counting into
   `violationSummaryFromCounts` (drop `CompletenessViolationCounts` from the public
   surface). ~25 LOC.
2. **`PlayerShellVM.bottomBanner` is literally `topBanner`** (assigned, then rendered by
   the second banner). One `banner` field; `PlayerShell` uses it twice. ~5 LOC.
3. **`AnagramModalVM.inputLength`** = `input.length`; component can read
   `vm.input.length`. Drop the field (3 sites + CLOSED baseline). ~6 LOC.
4. **`CLOSED_BASELINE` (12 lines) vs `ModalVM`'s `null` convention.** Make the closed
   state `null` (like `ModalVM`) and drop `open: boolean` + the zero-filled baseline —
   the shell and `PlayerShell` already branch on phase before rendering. ~12 LOC.
5. **`PlayerCheckResultVM.colorClass`** is a Tailwind class computed in the bindings
   layer — presentation leaked into a VM (architecture.md §9 says VMs are serializable
   data). Move the 4-case color mapping into `PlayerToolbar.svelte` keyed on
   `classification`. LOC-neutral, correctness-of-layering positive.
6. **`gridVM.ts`**: `deriveSeparatorRight`/`deriveSeparatorBottom` are one-line wrappers
   around `CellMarker.read` — call `CellMarker.read(cell.marker, 'right')` inline; unify
   the black/white cell construction (black branch spells out 8 fields that the white
   branch's defaults already cover). ~15 LOC.

**Risk:** none (fields unused or trivially substituted).

---

## O13. `boot.ts`: `freshBlank` duplicates `AppState.blank` (est. −15 LOC)

`AppState.blank()` already returns exactly what `freshBlank` re-sets (player import
screen, empty toasts/modal/pending). `freshBlank` is redundant; the restore branch can
also be written as `AppState.blank(...)` with the `builder` field overridden, deleting the
hand-built 12-field object literal. Whole file 41 → ~20 lines.

**Risk:** none.

---

## O14. Delete `typingIntent.ts`; let `TypingSurface` drive the action bag directly (est. −35 LOC)

`TypingIntent` + `applyTypingIntent` exist only to decouple `TypingSurface` from the grid
action-bag shape — but `TypingActions` *is* structurally `GridActions`. Have
`TypingSurface` take `actions: TypingActions` (same structural type; builder's
`BuilderGridActions` satisfies it) and call `actions.typeLetter(key)` etc. directly in
the keydown switch. Deletes `typingIntent.ts` (31 lines) plus the `(intent) =>
applyTypingIntent(intent, …)` wrapper in both shells. The component stays presentational —
it invokes a prop bag, no domain imports.

**Risk:** none.

---

## O15. `PlayerCluePanel` — inline duplicate of the Across/Down sections (est. −30 LOC)

The Across and Down `<section>`s are byte-identical apart from the heading and list. Use
the same `{#snippet clueRow(entry)}`-per-list shape the builder panel already uses, or a
`{#snippet section(title, entries)}` — halves the 68-line file. (Mirrors the snippet
convention architecture.md §9 already documents for the Builder panel.)

**Risk:** none.

---

## O16. Guarded-action modal events: 4 copies of the same block (est. −30 LOC)

Each `request-*` handler repeats the 8-line `Result.withEvents(state, [{ kind:
'modal-request', modal: { kind: K }, confirmIntent: { target, kind: C, ...extra } }])`
construction (`designMode`, `importExport`, `lifecycle` × builder, `lifecycle` player). One
helper in `domain/notifications/Event.ts`:

```ts
export function confirmEvent(target: IntentTarget, modal: ModalKind, confirm: ConfirmableIntent): DomainEvent {
  return { kind: 'modal-request', modal: { kind: modal }, confirmIntent: confirm };
}
```

Each call site becomes 2–3 lines. (ModalKind and the confirm intent kind are 1:1; a
table-driven version could derive one from the other but is not worth it.)

**Risk:** none.

---

## O17. Small domain consolidations (est. −40 LOC combined)

1. **`Anagram.validateInput` vs `validateChainInput`** — two public methods delegating to
   the same private `validateAgainst`; the word form is dead (O3). Delete both, keep one
   `validate(totalLength, entries, input)`. ~12 LOC.
2. **`player/state/internal/anagram.ts`** — `handleAnagramInput` and
   `handleAnagramScramble` each rebuild `ChainIndex` + head + members (~8 lines each);
   one private `chainMembers(state)` shared. `handleEscape` ≡ `handleCloseAnagramHelper`
   (identical logic) — collapse to one handler behind two intent cases. ~20 LOC.
3. **`Numbering.assign` (62 lines)** — builds `startCellMap` with an inner
   `existing.some(toCanonical ===)` dedup (words can't duplicate keys — they come from
   `WordDerivation.derive`, one per run; the dedup is dead defensiveness), then walks
   every grid cell to find numbered starts. Simplify: sort a copy of `words` by
   (row, col, direction) — the run-derivation order — group by start cell, assign
   numbers, restore input order if needed. ~62 → ~40 LOC. (The final `sort` comparator is
   also re-implementing the run order.)
4. **Failure-message constants duplicated**: `IMPORT_READ_FAILURE_MSG` /
   `PICK_FAILURE_MSG` are defined identically in `builder/state/internal/importExport.ts`
   and `player/state/internal/lifecycle.ts`. One shared const (e.g. in
   `domain/notifications/Event.ts` or a `messages.ts`) — 6 LOC, but eliminates a
   message-drift bug class.
5. **`assertUnreachable`** duplicated in `reduceBuilder` and `reducePlayer` — shared
   helper in `domain` or accept the 5-line duplication (marginal).

**Risk:** low. `Numbering` has dedicated tests that pin output order — keep the sort
semantics identical.

---

## O18. `reducer.ts` wiring in both state modules (est. −40 LOC combined)

`reduceBuilder` (136 lines) and `reducePlayer` (102 lines) are 90% switch-case →
one-line delegation. With the `Extract` aliases (O6.2) the per-case intent types
disappear. Two further squeezes:

- Cases that are already pure one-liners stay inline; cases delegating to an internal
  handler in the *same* module cluster could be grouped (e.g. `fillMode.ts`'s
  `handleSelectCell`/`handleMoveCursor` are 8-line guards + delegation — with O8's
  shared fold they collapse to the point where inlining into the reducer is defensible;
  whether to inline is taste — the split is documented in architecture.md §3, so
  keep the files, shrink the bodies).
- The `import type { … } from '../intents'` + `Extract` ceremony on every internal
  handler signature is the real cost (covered by O6.2).

**Risk:** none beyond churn.

---

## O19. Odds and ends (est. −30 LOC combined)

- `PlayerToolbar`'s five buttons share a class string that differs only in bg color — a
  `{#snippet btn(label, color, disabled, onclick)}` or a small data array cuts ~15 lines
  of the 51-line file. Same pattern in `ImportScreen`/`BuilderToolbar` if desired.
- `domain/ports/ports.ts` `DroppedFileResult` is declared in the interface file but
  `filePickPort.ts` re-declares the union inline in its return type — use the named type.
- `main.ts` favicon link injection (8 lines) could move to `index.html` as a static tag
  (Vite inlines the asset either way for the single-file build — verify the plugin
  handles `<link>` hrefs; it does handle them for `singlefile`). Test before doing.

---

## Explicitly considered and NOT recommended (for the record)

- **Merging `validateNextWordReferences` into `validateChains` (`v1.ts`)** — rejected.
  `ChainValidation` already detects dangling links, but the dedicated check produces
  the *per-word-index* message (`Word i has a dangling nextWord reference.`), and the
  failure list is the parser's contract (architecture.md §10: "strict — the failure list
  is the contract"). Merging would degrade the message to the generic chain phrasing to
  save 18 lines. Keep both.
- **Merging `reconcileWords.describeViolation` with `v1.ts validateChains`'s
  kind-switch** — rejected. The two renderers serve different contracts: the reducer's
  is a developer-facing invariant message carrying canonical word keys; the parser's is
  a user-facing failure line. Any shared `describe()` changes one of them. Keep both.
- **Relaxing the non-null-indexing ESLint rule to all of `domain/**`** — rejected. The
  sanctioned-site rule is a mechanical guard; trading it for ~15 LOC of `grid[r]![c]!`
  scatters a bug class. O4 achieves the same LOC reduction with plain array iteration
  and no rule change.
- **`Result.ok` / `withEvents` / `ReducerResult`** — this is compression, not bloat;
  removing it would *grow* the codebase.
- **Merging `v1Json.ts` into `v1.ts`** — rejected. Saves only ~15–25 LOC of wrapper
  ceremony, but the file split is the mechanical enforcement of the structural layer's
  defining property ("no `JSON.parse`/`stringify` in `v1.ts`", architecture.md §10):
  merging converts that guarantee into convention, grows the repo's largest file (which
  O1 exists to shrink), and reverses a documented decision. The 45-line adapter file is
  the split working as designed — keep it.
- **`Cell` value-object setters** (`setAnswerLetter` etc. with black-cell guards) — small,
  and the guards are the "illegal states unrepresentable" principle in action.
- **The events-as-data model, port contracts, `LoadResult` unions** — core architecture,
  out of scope per instruction (see the companion doc).
- **`ClueEntryVM`'s always-false builder fields in Player** — deliberate per
  architecture.md §9 ("builder-only fields are simply false in Player"); splitting the VM
  types saves nothing at runtime and adds a type. Left to the companion doc.
- **`serializeCompleteShape` keeping `displacedClues: []`** — wire-format compatibility;
  leave.

---

## Verification plan

After each cluster of changes:

1. `npm run typecheck` (svelte-check) — the `Extract`/type-alias changes surface here.
2. `npm run lint` — includes `madge --circular`; catches import cycles after O5 merges and
   validates the boundary matrix after `tools/boundaries.js` updates.
3. `npm run test` — **will fail** wherever prod API deleted in O2/O3/O14 was consumed by
   tests. Per instruction tests are out of scope for the audit, but the implementing
   engineer must delete/rewrite the affected suites in the same commits (the affected
   files are enumerable: every `test/**` file importing a symbol in the O3 table; parser
   tests still pass unchanged since O1 preserves all failure messages byte-for-byte).
4. Manual smoke (no component harness exists): build ↔ fill toggle, import/export
   round-trip (`puzzles/*.json` re-parse), anagram open/type/scramble, autosave +
   reload (persistence codec changes), toast dismiss timers, modal confirm/cancel ×4.

## Suggested implementation order (each step leaves the app green)

1. O3 (pure deletions) + O17.1 — biggest safe win, no behavior questions.
2. O2 (brand factory + Title/Author/Position removal) — mechanical, typecheck-driven.
3. O4 (GridOps dissolution + array-iteration rewrite of the six scan sites) — touches
   many files; no lint-rule change involved.
4. O1 (v1.ts) — parser is the highest-risk refactor; do after the dead-code and index
   changes so the diff stays reviewable.
5. O7 + O13 (persistence plumbing).
6. O8, O9, O10, O11 (domain/handler consolidation).
7. O6, O12, O16, O18 (bindings/state boilerplate).
8. O14, O15, O19 (components/shared).
9. O5 (file merges) — last, purely mechanical, so rebase conflicts stay shallow.
