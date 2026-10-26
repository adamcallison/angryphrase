# angryphrase — Code Reduction Audit Resolutions

Companion to `code_reduction_audit.md` (and its companion `code_reduction_audit_architectural_changes.md`).
Each entry records how one audit item was resolved: the site inventory, the decision per site (options
considered, what was chosen, what was deferred and where), the design as implemented, deliberate behaviour
changes, the verification evidence, and the sites that were **not** addressed, with the reason for each.

Conventions: no line-number references (they rot); functions, modules, and test names are the anchors.

The house process for an entry is the one recorded in `archive/architecture_smell_resolutions.md`
(Appendix — "Resolution process (gates)"), applied to audit items instead of smell findings.

Resolved so far: O2 (brand-type boilerplate), O3 (delete dead / test-only API surface), O4 (dissolve the `GridOps` wrapper; array-iteration rewrite of the grid scan sites).

---

## O3 — Delete dead / test-only API surface — resolved 2026-10-25

### The item (recap)

`code_reduction_audit.md` O3 proposes deleting production API that has no production caller, on the
premise that "since tests are out of scope, this is pure deletion". The item's table listed 14 rows
(≈170 LOC) and noted that `intentKinds.ts` (61 LOC) would be deleted whole.

Two of the item's premises did not survive verification, and are corrected by this entry:

1. **"Tests are out of scope" is false for this item.** Deleting the production API breaks the tests that
   consume it, so the test tree is necessarily in scope. The item's own risk note and verification plan
   say so ("the implementing engineer must delete/rewrite the affected suites in the same commits"), but
   the header frames it as pure deletion. Measured cost: 21 test cases deleted, 14 further call sites
   rewritten, 8 files edited — against ~225 LOC of production code removed.
2. **The table was incomplete.** A scan of every exported object-literal member in `src/` (method name
   qualified by its owning module, references counted outside the owning file) found one dead member the
   table missed: `LengthPattern.forActiveClueBanner` — zero callers in `src/`, four test cases. It had
   already been flagged by the earlier architecture audit (`archive/architecture_smells.md`: "Dead/unused
   public API found during the audit … `LengthPattern.forActiveClueBanner`") and never closed. It is
   site S24 below.

### Site inventory (Gate 0)

Every row is a concrete site. The audit's own count (14 rows / ≈170 LOC) is not trusted; the inventory is
what coverage is measured against.

| # | Site | File | Outcome |
|---|---|---|---|
| S1 | `GridOps.neighbours` | `domain/grid/GridOps.ts` | deleted |
| S2 | `GridOps.neighboursInDirection` | `domain/grid/GridOps.ts` | deleted |
| S3 | `GridOps.clone` | `domain/grid/GridOps.ts` | deleted |
| S4 | `GridOps.equals` | `domain/grid/GridOps.ts` | deleted |
| S5 | `Direction.opposite` | `domain/word/Direction.ts` | deleted |
| S6 | `Direction.isAcross` | `domain/word/Direction.ts` | deleted |
| S7 | `Anagram.validateInput` | `domain/anagram/Anagram.ts` | deleted |
| S8 | `WordMap.set` | `domain/word/WordMap.ts` | deleted |
| S9 | `WordMap.remove` | `domain/word/WordMap.ts` | deleted |
| S10 | `DurationMs.try` | `domain/time/DurationMs.ts` | deleted |
| S11 | `DurationMs.of` | `domain/time/DurationMs.ts` | deleted |
| S12 | `EpochMs.try` | `domain/time/EpochMs.ts` | deleted |
| S13 | `Position.try` | `domain/anagram/Position.ts` | deleted |
| S14 | `Position.equals` | `domain/anagram/Position.ts` | deleted |
| S15 | `WordLength.try` | `domain/word/WordLength.ts` | deleted |
| S16 | `WordLength.equals` | `domain/word/WordLength.ts` | deleted |
| S17 | `WordNumber.try` | `domain/word/WordNumber.ts` | deleted |
| S18 | `DisplacedClue.withText` | `domain/builder/DisplacedClue.ts` | deleted |
| S19 | `PlayerState.loaded` | `player/state/state.ts` | **kept — production now calls it** (the duplicated literal in `player/state/internal/lifecycle.ts` was deleted instead) |
| S20 | `CompletenessCheck.isComplete` | `domain/puzzle/CompletenessCheck.ts` | deleted |
| S21 | `Toast.create`'s `ttlMs` parameter | `domain/notifications/Toast.ts` | deleted |
| S22 | `AppStore.getState()` | `ui/bindings/appStore.svelte.ts` | deleted; 28 test reads re-pointed |
| S23 | `app/state/intentKinds.ts` (whole module) + its test | `app/state/intentKinds.ts` | deleted |
| S24 | `LengthPattern.forActiveClueBanner` | `domain/chain/LengthPattern.ts` | deleted — **site the audit's table omitted** |
| S25 | citations of the deleted `AMBIGUOUS_INTENT_KINDS` set | `builder/state/intents.ts` | comments rewritten |
| S26 | `Anagram.buildWordModel` | `domain/anagram/Anagram.ts` | **kept** — see decision |
| S27 | `ChainCells.cellsOfWord` | `domain/chain/ChainCells.ts` | **kept** — see decision |

Test-side sites (the inventory's other half — a production deletion is not complete until the tree that
consumed it is consistent):

| # | Site | File | Outcome |
|---|---|---|---|
| T1 | 8 `GridOps` cases (neighbours ×2, neighboursInDirection ×2, clone ×2, equals ×2) | `test/domain/grid/GridOps.test.ts` | deleted |
| T2 | 2 "does not mutate the input grid or cursor" cases | `test/domain/grid/GridInteraction.test.ts` | kept; instrumentation replaced (`structuredClone` + `toEqual`) |
| T3 | 5 `GridOps.equals` reads | `test/domain/grid/WordTopology.test.ts`, `test/domain/puzzle/Puzzle.test.ts`, `test/player/state/internal/anagram.test.ts`, `test/ui/bindings/persistenceCodec.test.ts`, `test/ui/bindings/persistenceScheduler.test.ts` | rewritten to `toEqual`; the WordTopology case gained a real deep snapshot (it previously compared the grid with itself) |
| T4 | 2 `Direction` cases | `test/domain/word/Direction.test.ts` | deleted |
| T5 | 5 `validateInput` cases | `test/domain/anagram/Anagram.test.ts` | deleted |
| T6 | 5 `WordMap.set`/`remove` cases | `test/domain/word/WordMap.test.ts` | deleted |
| T7 | 4 + 2 + 3 + 2 + 2 brand cases (`DurationMs.try/of`, `EpochMs.try`, `Position.try/equals`, `WordLength.try/equals`, `WordNumber.try`) | `test/domain/time/*.test.ts`, `test/domain/anagram/Position.test.ts`, `test/domain/word/WordLength.test.ts`, `test/domain/word/WordNumber.test.ts` | deleted |
| T8 | 1 `Toast.create` custom-ttl case | `test/domain/notifications/Toast.test.ts` | deleted (the default-ttl case already pins 3500) |
| T9 | 2 `DisplacedClue.withText` cases | `test/domain/builder/DisplacedClue.test.ts` | deleted |
| T10 | 3 `CompletenessCheck.isComplete` cases | `test/domain/puzzle/CompletenessCheck.test.ts` | deleted |
| T11 | 4 `forActiveClueBanner` cases | `test/domain/chain/LengthPattern.test.ts` | deleted |
| T12 | 2 `DurationMs.of` toast fixtures | `test/ui/bindings/viewmodels/toastVM.test.ts`, `test/ui/bindings/toastFacade.test.ts` | rewritten to `DurationMs.DEFAULT` |
| T13 | the whole file | `test/app/state/intentKinds.test.ts` | deleted |
| T14 | 28 `store.getState()` reads | `test/ui/bindings/appStore.test.ts`, `modalFacade.test.ts`, `toastFacade.test.ts`, `filePickActions.test.ts` | re-pointed at the getters production uses |
| T15 | 1 test title citing `Anagram.validateInput` | `test/ui/bindings/viewmodels/anagramVM.test.ts` | retitled to `Anagram.validateChainInput` (§14 citation rule) |
| T16 | 1 test title naming `getAppState` | `test/ui/bindings/appStore.test.ts` | retitled |

### Decision

**Scope of the item — executed as written.** The audit's O3 overlaps three other items: `GridOps` is
deleted wholesale by O4, `domain/anagram/Position.ts` is deleted wholesale by O2.2, and
`Anagram.validateInput` is also listed by O17.1. The item was executed as written; the overlapping rows
were landed here once and the later items must not re-cut them (their landing-site pointers are in the
"Not addressed" table below).

**Per-site decisions on the contested rows:**

- **S19 `PlayerState.loaded` — kept, production inverted.** Options: (a) delete the factory as the audit
  proposes; (b) keep the factory and make production use it; (c) leave both the factory and the
  duplicated literal in place. (a) was rejected: the factory is the *only* single owner of the
  solving-phase state shape, and deleting it would leave that shape as a 5-field literal at 20 test call
  sites (21 copies of the union variant, and a 6th field would mean 21 edits). (c) was rejected: it keeps
  two copies of one concept. (b) was chosen, and it matches the convention already in the same file —
  `PlayerState.importScreen()` is called by production everywhere (`app/state/state.ts`, `boot.ts`,
  `player/state/internal/lifecycle.ts`), so the inline literal was the anomaly, not the factory. Chosen
  because it also removes the "production API called only by tests" smell without losing the API.
- **S22 `AppStore.getState()` — deleted.** Every other store getter has a production caller
  (`getToasts` → `toastFacade`; `getModal`/`getPendingConfirmIntent` → `modalFacade`;
  `getBuilder`/`getPlayer` → facades and the persistence scheduler; `getRoute` → `App.svelte`;
  `getScheduler` → `teardown.ts`; `getPorts` → the store's external-event path). `getState()` had none —
  only tests. The store's raw getters exist "for the bindings layer's own use" (architecture.md §6), so
  the whole-state read had no owner. Options: (a) keep it; (b) delete it and re-point the test reads at
  the narrow getters; (c) delete it and leave the tests asserting nothing. (c) was rejected outright.
  (a) was rejected: it preserves a production API whose only callers are tests, and lets a consumer
  depend on the identity of the state object — which nothing in the app does. (b) was chosen. The three
  whole-state identity assertions became slice-identity assertions, which is the property autosave
  actually depends on (architecture.md §8 compares `state.builder` / `state.player` references to decide
  whether to schedule a save).
- **S23 `app/state/intentKinds.ts` — deleted.** The module was a hand-written mirror of the intent-kind
  lists; its only consumer was a test holding a *second* mirror and comparing the two. Both guarantees it
  carried are compile-time and live elsewhere: kind coverage by the reducers' exhaustive switches
  (`default: assertUnreachable(intent)`, `assertUnreachable(value: never)`), and the `target` literal by
  the union plus `reduceApp`'s `switch (intent.target)` routing. The project already recorded this
  position in `archive/architecture_smell_resolutions.md` §3 ("TS refuses to compile if the literal is
  missing, widened, or wrong-valued"); the module was residue of the `AMBIGUOUS_INTENT_KINDS` machinery
  that resolution removed.
- **S24 `LengthPattern.forActiveClueBanner` — deleted (added by this resolution).** The audit's table
  omitted it; the inventory scan found it. The two live call sites (`viewmodels/cluePanelVM.ts`,
  `viewmodels/playerVM.ts`) already inline the head-check the member wrapped.
- **S26 `Anagram.buildWordModel` — kept.** Public, but it has a live *internal* caller
  (`buildChainModel`) and two direct test consumers (`test/player/state/reducer.test.ts`,
  `test/player/state/internal/anagram.test.ts`). Not dead; narrowing its visibility would be a different
  change that trades direct coverage for nothing.
- **S27 `ChainCells.cellsOfWord` — kept.** Public, with a live internal caller (`cellsOfChain`) and three
  direct test cases. Same reasoning as S26.
- **S3/S4 `GridOps.clone` / `GridOps.equals` — deleted, but not as "dead code".** These two were also the
  test suite's only deep-grid comparison, used as the instrument for the "does not mutate the input grid
  or cursor" assertions. Deleting them without a replacement would have silently weakened the guard for
  domain purity (architecture.md §2 principle 2). The assertions were kept and their instrumentation
  replaced with an independent snapshot plus deep equality (`structuredClone` + `toEqual`). One case
  (`test/domain/grid/WordTopology.test.ts`) previously compared the grid with itself — the replacement
  gives it a real snapshot, so that assertion is now stronger than before.

### Design as implemented

Nothing new was designed. The change is a set of deletions plus the decisions above. Two production
behaviours changed shape, not value:

- `src/player/state/internal/lifecycle.ts` now builds the solving-phase state through
  `PlayerState.loaded(result.puzzle)` instead of an inline literal with the same five fields.
- `src/ui/bindings/appStore.svelte.ts` no longer exposes `getState()`; the `AppStore` type and the
  implementation both lose the member.

`tools/boundaries.js` needs no change: the brand-owner list is unaffected (every brand module keeps its
`of`/`DEFAULT` minting and still imports `domain/brand`), and the layer areas are path prefixes, so
`src/app/state/intentKinds.ts` was never enumerated individually.

### Deliberate behaviour changes

None. No user-visible behaviour, no wire format, no failure message, and no domain rule changed. The
`Toast` ttl is now the single canonical `DurationMs.DEFAULT` (3500 ms) — the parameter was never passed
by any caller.

### Files

Production — 17 files changed (7 insertions, 253 deletions): `src/app/state/intentKinds.ts` (deleted),
`src/builder/state/intents.ts`, `src/domain/anagram/Anagram.ts`, `src/domain/anagram/Position.ts`,
`src/domain/builder/DisplacedClue.ts`, `src/domain/chain/LengthPattern.ts`, `src/domain/grid/GridOps.ts`,
`src/domain/notifications/Toast.ts`, `src/domain/puzzle/CompletenessCheck.ts`, `src/domain/time/DurationMs.ts`,
`src/domain/time/EpochMs.ts`, `src/domain/word/Direction.ts`, `src/domain/word/WordLength.ts`,
`src/domain/word/WordMap.ts`, `src/domain/word/WordNumber.ts`, `src/player/state/internal/lifecycle.ts`,
`src/ui/bindings/appStore.svelte.ts`.

Tests — 27 files (26 changed, 1 deleted; 54 insertions, 576 deletions):
`test/app/state/intentKinds.test.ts` (deleted), `test/domain/anagram/Anagram.test.ts`,
`test/domain/anagram/Position.test.ts`, `test/domain/builder/DisplacedClue.test.ts`,
`test/domain/chain/LengthPattern.test.ts`, `test/domain/grid/GridInteraction.test.ts`,
`test/domain/grid/GridOps.test.ts`, `test/domain/grid/WordTopology.test.ts`,
`test/domain/notifications/Toast.test.ts`, `test/domain/puzzle/CompletenessCheck.test.ts`,
`test/domain/puzzle/Puzzle.test.ts`, `test/domain/time/DurationMs.test.ts`,
`test/domain/time/EpochMs.test.ts`, `test/domain/word/Direction.test.ts`,
`test/domain/word/WordLength.test.ts`, `test/domain/word/WordMap.test.ts`,
`test/domain/word/WordNumber.test.ts`, `test/player/state/internal/anagram.test.ts`,
`test/ui/bindings/appStore.test.ts`, `test/ui/bindings/filePickActions.test.ts`,
`test/ui/bindings/modalFacade.test.ts`, `test/ui/bindings/persistenceCodec.test.ts`,
`test/ui/bindings/persistenceScheduler.test.ts`, `test/ui/bindings/toastFacade.test.ts`,
`test/ui/bindings/viewmodels/anagramVM.test.ts`, `test/ui/bindings/viewmodels/toastVM.test.ts`.

Docs: `llmworkspace/architecture.md` (§3 Layer 0 `domain/grid`/`domain/word`/`domain/anagram`/`domain/time`,
§3 Layer 1 module list, §5 routing, §6 `AppStore` type and the no-whole-state-getter rule, §13 file map),
`llmworkspace/future_considerations.md` (the `GridOps.clone` reference in "Things that would change under
scale"), this file.

### Verification

All three project commands, run from the repository root after the last change:

| Command | Before | After |
|---|---|---|
| `npm run test` | 93 files / 1381 tests pass | **92 files / 1332 tests pass** (one file deleted with its module; 49 cases deleted with the members they covered) |
| `npm run typecheck` | 0 errors, 0 warnings | **0 errors, 0 warnings** |
| `npm run lint` | clean, no cycles | **clean, no cycles** (`madge --circular` on 126 files) |

Closure audit (grep over `src/` and `test/` for every removed symbol — the old encoding must be gone,
not merely unused): `GridOps.neighbours`, `neighboursInDirection`, `GridOps.clone`, `GridOps.equals`,
`Direction.opposite`, `isAcross`, `validateInput`, `WordMap.set`, `WordMap.remove`, `DurationMs.try`,
`DurationMs.of`, `EpochMs.try`, `Position.try`, `Position.equals`, `WordLength.try`, `WordLength.equals`,
`WordNumber.try`, `withText`, `isComplete`, `forActiveClueBanner`, `intentKinds`,
`BUILDER_INTENT_KINDS`, `PLAYER_INTENT_KINDS`, `AMBIGUOUS_INTENT_KINDS`, `getState` — **0 references each**.
`PlayerState.loaded` is retained and now has a production caller as well as its 20 test callers.

Size: production −246 net LOC (7 insertions, 253 deletions across 17 files); tests −522 net LOC
(54 insertions, 576 deletions across 27 files); **−768 net LOC over 43 files**. The audit estimated
−170 LOC for the production side only; the production figure came out larger because the audit's
per-row LOC numbers were approximations and the whole `intentKinds.ts` module (61 LOC) counted.

### Consequence

The domain's public surface is smaller by 25 members and one module, and the two places where a concept
had two owners now have one: the solving-phase player state (`PlayerState.loaded`) and the intent-kind
list (gone entirely — the unions are the list). Touch costs that change:

- **Adding an intent kind** now touches two places (the union, the reducer case) instead of four (union,
  kind record, the test's copy of the kind list, and the `AMBIGUOUS_INTENT_KINDS`-era bookkeeping). The
  compiler still refuses an unhandled kind and a wrong `target` literal.
- **Adding a domain constructor** now has one shape to follow: `of` (minting, range-checked). The `try`
  (nullable) variant survives only on `Letter`, `GridSize`, `Row`, `Col`, `Title`, `Author`,
  `PuzzleKey`, `DisplacedClueId` — the ones a caller may legitimately fail. `DurationMs` is now a brand
  with a single inhabitant (`DEFAULT`), which is worth a look when O2's `intBrand` factory lands.
- **Asserting on store state** in tests now goes through the same getters production uses
  (`getModal`, `getToasts`, `getBuilder`, `getPlayer`, `getRoute`), so a test cannot depend on a
  whole-state read that the app itself does not use.
- **Comparing grids** in tests uses `toEqual` plus an independent snapshot (`structuredClone`) rather
  than a production `clone`/`equals` pair; the WordTopology immutability case, which previously compared
  the grid with itself, now compares against a real snapshot.
- **Unchanged:** the grid's call sites still went through `GridOps` at the time of this change
  (its dissolution is O4's, and O4 dissolved it on 2026-10-26 — the "88 call sites" figure quoted
  here was already stale; the wrapper actually had 381), `Anagram.validateChainInput` keeps its name
  (O17.1's). The `Position` brand existed at the time of this change and was removed afterwards by
  O2 — together with the dead `AnagramEntry.position` field.

### Not addressed

| Site | Reason | Landing site |
|---|---|---|
| `GridOps` module dissolution (the 5 leaf-accessor re-exports and `isSelectable`) | O3 removes the dead members only; the module itself is dissolved by O4, which also moves `isSelectable` to `WordTopology` | closed by audit O4 (2026-10-26) |
| `domain/anagram/Position.ts` deletion (`Position` brand → plain `number`) | O3 removes `Position.try`/`Position.equals`; the brand itself was removed by O2 — together with the dead `AnagramEntry.position` field | closed by audit O2 (2026-10-26) |
| `Anagram.validateChainInput` → `Anagram.validate` rename | O3 removes the dead word-form entry point; the rename belongs to O17.1 | audit O17.1 |
| S26 `Anagram.buildWordModel` | retained: live internal caller (`buildChainModel`) and direct test consumers | — (closed by decision, not deferred) |
| S27 `ChainCells.cellsOfWord` | retained: live internal caller (`cellsOfChain`) and direct test cases | — (closed by decision, not deferred) |

---

## O2 — Brand-type boilerplate: generic constructor factory + removal of ceremony brands — resolved 2026-10-26

### The item (recap)

`code_reduction_audit.md` O2 proposes five changes (est. −150 to −200 LOC):

1. delete the `Title` and `Author` brands, keeping the names as `type Title = string` / `type Author = string` aliases in `Puzzle.ts`;
2. delete the `Position` brand, replacing it with plain `number`;
3. mint `ToastId`s with `uuidv4()` instead of an inline hex generator;
4. share one UUID-v4 regex between `PuzzleKey.try` and `DisplacedClueId.try`;
5. replace the hand-written `try`/`of` blocks of `Row`, `Col`, `GridSize`, `EpochMs`, `DurationMs`, `WordNumber` and `WordLength` with one generic `intBrand(tag, min, max)` factory in `domain/brand.ts`.

The item's premise: "The 14 branded types each carry a hand-written `try`/`of` + `RangeError` block — near identical code repeated ~10 times (~120 LOC of pure boilerplate), plus several brands that add no safety at all."

Three of the five parts did not survive verification and are corrected by this entry:

1. **Part 5's module list is wrong.** `DurationMs` has **no constructor** — its `try`/`of` were deleted by O3 and only the `DEFAULT` constant remains, so it is not a factory candidate at all. `WordLength`, `WordNumber` and `EpochMs` also lost their `try` halves in O3; a blanket factory returning `{ try, of }` would have **re-added** dead API two items after O3 deleted it as dead.
2. **Part 1 conflates the brand with the constructor.** "Title.try validates nothing" is true — but the *type* `Brand<'Title', string>` is what makes `Title` and `Author` non-interchangeable, and `type Title = string` is **not** a distinct type: it is `string` under another name, so it restores no protection at all. The item's own header claims "no guard, contract, or documented property is traded for line count"; deleting these two brands trades architecture.md §2 principle 4 ("`Title`, `Author` … are branded types"; "Plain `string`/`number` do not appear in domain signatures") for 14 production lines. The real defect is narrower: the *constructor* is named `try` although it cannot fail, and the codebase has already paid for that lie — `builderFacade` carries two unreachable `=== null` branches.
3. **Part 2 understates the problem.** `AnagramEntry.position` is not a branded index — it is a **dead field**. Nothing reads it outside `Anagram.ts`; the anagram view-model derives a tile's slot from the array index, and the player state keeps only `e.letter`. Unbranding it to `number` would keep dead state alive.

The LOC estimate is also roughly 3× optimistic, and in the wrong direction overall: the landed change is
**−45 production lines** but **+79 test lines** — the test tree grew, because the properties the item
proposed to drop are now pinned by tests — so the change is **+33 lines in total**. See "Consequence".

### Site inventory (Gate 0)

The audit's own framing ("14 branded types … repeated ~10 times") is not trusted; the inventory below is what coverage is measured against.

| # | Site | File | Outcome |
|---|---|---|---|
| S1 | `Row.try` / `Row.of` hand-written block | `domain/grid/Row.ts` | migrated to `intBrand` |
| S2 | `Col.try` / `Col.of` hand-written block | `domain/grid/Col.ts` | migrated to `intBrand` |
| S3 | `GridSize.try` / `GridSize.of` hand-written block (+ `MIN`/`MAX`/`DEFAULT`/`invalidMessage`) | `domain/grid/GridSize.ts` | migrated to `intBrand`; the other four members kept |
| S4 | `EpochMs.of` hand-written block | `domain/time/EpochMs.ts` | migrated to `intBrand` |
| S5 | `WordLength.of` hand-written block | `domain/word/WordLength.ts` | migrated to `intBrand` |
| S6 | `WordNumber.of` hand-written block | `domain/word/WordNumber.ts` | migrated to `intBrand` |
| S7 | the `Position` brand module | `domain/anagram/Position.ts` | **deleted** |
| S8 | `AnagramEntry.position` — the only consumer of S7 | `domain/anagram/AnagramEntry.ts` | **deleted** (dead field) |
| S9 | `buildChainModel`'s offset re-mint `Position.of(Number(entry.position) + offset)` | `domain/anagram/Anagram.ts` | deleted with S8 |
| S10 | `Title.try` — a constructor that validates nothing, named `try` | `domain/puzzle/Title.ts` | brand **kept**; constructor renamed `Title.of` |
| S11 | `Author.try` — same | `domain/puzzle/Author.ts` | brand **kept**; constructor renamed `Author.of` |
| S12 | the two unreachable `if (t === null) return;` / `if (a === null) return;` branches | `ui/bindings/builderFacade.ts` | deleted |
| S13 | `Title.try('')` / `Author.try('')` | `domain/puzzle/Puzzle.ts` | → `Title.of('')` / `Author.of('')` |
| S14 | `Title.try(titleRaw)` / `Author.try(authorRaw)` | `domain/format/v1.ts` | → `.of` |
| S15 | `ToastId.generate`'s inline 16-byte hex generator | `domain/notifications/ToastId.ts` | replaced by `uuidv4(rng)` |
| S16 | `PuzzleKey.try`'s inline UUID-v4 regex | `domain/puzzle/PuzzleKey.ts` | → `isUuidV4(s)` |
| S17 | `DisplacedClueId.try`'s inline UUID-v4 regex (duplicate of S16) | `domain/builder/DisplacedClueId.ts` | → `isUuidV4(s)` |
| S18 | `domain/uuid/uuidv4.ts` — gains the validation half of the concept | `domain/uuid/uuidv4.ts` | new export `isUuidV4` |
| S19 | `domain/brand.ts` — the escaper module | `domain/brand.ts` | gains `intBrand`; `Brand`/`brand` unchanged |
| S20 | the brand-owner list in the boundary spec | `tools/boundaries.js` | 14 → 13 owners (S7 removed) |
| S21 | `Letter`'s constructor | `domain/letter/Letter.ts` | **kept** — not an integer brand; case-folds and validates A–Z, and owns `from`/`equals` |
| S22 | `DurationMs` | `domain/time/DurationMs.ts` | **kept** — constant-only module; no constructor to consolidate |
| S23 | the toast-id format assertion | `domain/notifications/Toast.ts` (consumer) | unaffected in source; the format assertion moved (see T5) |

Test-side sites — a production change is not complete until the tree that consumed it is consistent:

| # | Site | File | Outcome |
|---|---|---|---|
| T1 | the whole file | `test/domain/anagram/Position.test.ts` | deleted |
| T2 | the `position` literals and the "re-numbers position 0..N-1" case | `test/domain/anagram/Anagram.test.ts` | rewritten; the case was retitled `'buildChainModel concatenates entries head→tail'` and its position assertion replaced by a `fixed`-flag-sequence assertion that still proves head→tail order |
| T3 | six brand suites — `Row`, `Col`, `GridSize`, `EpochMs`, `WordLength`, `WordNumber` | `test/domain/grid/`, `test/domain/time/`, `test/domain/word/` | **unchanged** — the migrations are behaviour-preserving, and the unchanged suites are the proof |
| T4 | the toast-id format assertions | `test/domain/notifications/ToastId.test.ts` | rewritten for the UUID-v4 shape |
| T5 | the toast-id format assertion | `test/domain/notifications/Toast.test.ts` | rewritten — **a site the audit did not name**; it pinned the same 32-hex format |
| T6 | `isUuidV4` coverage | `test/domain/uuid/uuidv4.test.ts` | three cases added |
| T7 | `Title`/`Author` suites | `test/domain/puzzle/Title.test.ts`, `Author.test.ts` | renamed to the new constructor name, plus one brand-safety case each |
| T8 | eight call-site suites | `test/domain/puzzle/Puzzle.test.ts`, `test/domain/format/v1.test.ts`, `test/builder/state/reducer.test.ts`, `test/app/state/reducer.test.ts`, `test/ui/bindings/builderFacade.test.ts`, `test/ui/bindings/viewmodels/builderVM.test.ts`, `test/ui/bindings/viewmodels/playerVM.test.ts`, `test/ui/bindings/playerFacade.test.ts` | call sites renamed |

### Decision

**S10 / S11 — the `Title` and `Author` brands: kept.** Options: (a) delete the brands and alias them to `string`, as the audit proposes; (b) keep the brands and delete only the misleading `try` name; (c) leave both untouched. (a) was rejected: it makes `Title` and `Author` mutually assignable, puts a plain `string` in two domain signatures, and contradicts a principle the architecture states explicitly — for 14 production lines. (c) was rejected: the constructor name is actively wrong and has already produced unreachable code. (b) was chosen: the brand stays, the constructor becomes `Title.of` / `Author.of`, and the two dead branches in `builderFacade` go with it. This matches the codebase's own convention, which the audit did not identify — `try` returns `T | null` and never throws (the failure-as-data constructor, used at trust boundaries), `of` returns `T` and never returns null (used where the value is derived internally, or where there is nothing to reject). architecture.md §2 now states that convention, and `Title`/`Author` are its worked example.

**S7 / S8 / S9 — `Position`: the brand *and* the field deleted.** Options: (a) delete the brand, keep the field as `number`, as the audit proposes; (b) delete the brand and the field. (a) was rejected: the field is read nowhere — `deriveAnagramModalVM` derives a tile's slot from the array index, and `handleAnagramScramble` keeps only `e.letter` — so unbranding it keeps dead state alive and preserves a redundant `Number(...)` re-mint. (b) was chosen. The `AnagramEntry` shape is now `{ fixed: true; letter: Letter } | { fixed: false; letter: Letter | null }`, discriminated by `fixed` as before.

**S15 — `ToastId`: minted through `uuidv4`.** Options: (a) `uuidv4(rng)`; (b) keep the 32-char hex and leave the RNG-draw idiom duplicated. (a) was chosen: it leaves one id-minting path in the domain. The audit's stated reason ("ids become collision-safe") is **wrong** and is not the reason — the previous generator already drew 16 bytes (128 bits) from the same rng, and `uuidv4` sets version and variant bits, so it carries slightly *fewer* entropy bits. The change is a **format change** (see "Deliberate behaviour changes"), not a safety fix.

**S19 — the factory's shape.** `intBrand(tag, min, max)` lives in `domain/brand.ts` beside `Brand` and `brand`. Options: (a) a new module (e.g. `domain/brandFactory.ts`); (b) extend `domain/brand.ts`. (a) was rejected: the ESLint brand ban lists exactly one module, so a second one would need the boundary spec extended and its self-test taught a second ban — machinery for no gain. (b) was chosen: the brand-owner list already contains every module that needs the factory, so no boundary change is required. The tag argument doubles as the type tag (one source of truth), the `RangeError` message is `Invalid ${tag}: ${n}` — byte-identical to the messages it replaces — and `max` defaults to unbounded. The of-only owners (`EpochMs`, `WordLength`, `WordNumber`) expose **only** `of`, so the `try` halves O3 deleted are not resurrected.

**S1–S6 — the migrations.** Behaviour-identical by construction: the same predicate, the same bounds, the same message. Every owner keeps its explicit `export const X: { … }` manifest — the architecture treats that block as the per-module documentation of what the module owns, and the rejected-changes list says so explicitly.

### Design as implemented

- `domain/brand.ts` exports `Brand`, `brand` (unchanged) and `intBrand(tag, min, max) → { try, of }`. `try` returns `null` on invalid input; `of` throws `RangeError` with the message `Invalid ${tag}: ${n}`.
- `Row`, `Col`, `GridSize`, `EpochMs`, `WordLength`, `WordNumber` are one-line delegations to `intBrand`, each keeping its manifest, its bounds and its extra members (`GridSize.MIN`/`MAX`/`DEFAULT` keep their literal types; `invalidMessage()` is unchanged).
- `domain/uuid/uuidv4.ts` is the single owner of the UUID-v4 concept: `uuidv4(rng)` mints, `isUuidV4(s)` validates. The shared regex is byte-identical to the two inline copies it replaces.
- `Title`/`Author` are total constructors named `of`; the brands are unchanged nominal types.
- `AnagramEntry` carries no position field; a tile's slot is its index in the entries array.
- The brand-owner list in `tools/boundaries.js` is 13 entries — `domain/anagram/Position.ts` is gone.

### Deliberate behaviour changes

1. **Toast id format.** A toast id is now a UUID-v4 string (36 chars, dashed) instead of a 32-char lowercase hex string. The id is opaque — it is a Svelte keyed-list key, a `Map` key, and the argument to `dismiss(id)`; nothing parses it.
2. **No other behaviour changes.** Every `RangeError` message, every parse-failure message, and every `RangeError` from a brand constructor is byte-identical to before.

### Files

18 production modules changed, 1 deleted; 14 test files changed, 1 deleted, 1 added; 1 tooling file changed.

- `domain/brand.ts` (`intBrand`), `domain/grid/Row.ts`, `domain/grid/Col.ts`, `domain/grid/GridSize.ts`, `domain/time/EpochMs.ts`, `domain/word/WordLength.ts`, `domain/word/WordNumber.ts`
- `domain/anagram/AnagramEntry.ts`, `domain/anagram/Anagram.ts`; `domain/anagram/Position.ts` **deleted**
- `domain/puzzle/Title.ts`, `domain/puzzle/Author.ts`, `domain/puzzle/Puzzle.ts`, `domain/puzzle/PuzzleKey.ts`, `domain/builder/DisplacedClueId.ts`, `domain/notifications/ToastId.ts`, `domain/format/v1.ts`, `domain/uuid/uuidv4.ts`
- `ui/bindings/builderFacade.ts`
- `tools/boundaries.js`
- tests: `test/domain/brand.test.ts` (new), `test/domain/anagram/Anagram.test.ts`, `test/domain/anagram/Position.test.ts` **deleted**, `test/domain/uuid/uuidv4.test.ts`, `test/domain/notifications/ToastId.test.ts`, `test/domain/notifications/Toast.test.ts`, `test/domain/puzzle/Title.test.ts`, `test/domain/puzzle/Author.test.ts`, `test/domain/puzzle/Puzzle.test.ts`, `test/domain/format/v1.test.ts`, `test/builder/state/reducer.test.ts`, `test/app/state/reducer.test.ts`, `test/ui/bindings/builderFacade.test.ts`, `test/ui/bindings/playerFacade.test.ts`, `test/ui/bindings/viewmodels/builderVM.test.ts`, `test/ui/bindings/viewmodels/playerVM.test.ts`
- `architecture.md` — §2 principle 4 (the branded-type list, plus the `try`/`of` constructor contract), §3 (`domain/brand.ts`, `domain/grid/`, `domain/anagram/`, `domain/uuid/`), §4 (the brand ban: 14 → 13 owners), §5 (the constructors the bindings layer may call), §12 (coverage of the factory's range checks and each brand's constructor contract)

### Verification

- `npm run ci` green: `eslint .` + `madge --circular` (no cycles) + `svelte-check` + `vitest run` (**92 files, 1342 tests** — the baseline before this item was 92 files / 1332 tests) + `vite build` (`dist/index.html` 233.72 kB, gzip 102.90 kB; the baseline was 234.50 kB / 102.96 kB).
- **Behaviour preservation, proven by untouched suites.** The `Row`, `Col`, `GridSize`, `EpochMs`, `WordLength` and `WordNumber` suites pass **without a single edit** — the migrations changed no observable behaviour.
- **Message identity, checked mechanically.** The shared UUID-v4 regex was compared byte-for-byte against both inline copies it replaces; all three are identical. Every brand's `RangeError` message is derived from its tag, so `Invalid Row:`, `Invalid Col:`, `Invalid GridSize:`, `Invalid EpochMs:`, `Invalid WordLength:` and `Invalid WordNumber:` are unchanged.
- **The brand guards are load-bearing, proven by mutation.** Degrading `intBrand` to return plain `number` makes `test/domain/brand.test.ts` fail to compile (`Unused '@ts-expect-error' directive`) — the case now asserts on the factory's return type, not on the `Brand` alias, so it catches exactly the regression it exists for. Degrading `Title` to `type Title = string` makes `test/domain/puzzle/Title.test.ts` fail to compile the same way. The `@ts-expect-error` brand cases in `Row`, `Col`, `Letter`, `EpochMs`, `WordLength`, `WordNumber` and `DurationMs` still fail to compile as intended.
- **The boundary spec tracks the repository.** `validateBoundaries` accepts the 13-owner list, and the boundary self-test asserts it against the repository in both directions.

### Consequence

- **−45 production lines** (72 added, 117 deleted across 19 production files) and **+79 test lines**
  (173 added, 94 deleted across 16 test files, including the new `test/domain/brand.test.ts`);
  `tools/boundaries.js` −1. **The change is +33 lines in total.** The audit's "−150 to −200" was not
  met and was not met for the reason the item assumed: the explicit per-module manifests were kept, so
  most of the boilerplate the factory removed was replaced by the manifest rather than deleted — and the
  shared factory, now the single place where seven brands' validation lives, earned its own test file
  (`src/domain/brand.ts` had none before). The item's *quality* claim — one shape for brand
  construction — is met; its *quantity* claim was not.
- The test tree grew, and that is the point of the guards added: the `intBrand` range checks, the
  `isUuidV4` cases, and the `Title`/`Author` brand-safety cases are the evidence that the properties
  this item proposed to discard are still enforced.
- The `Position` removal closes the pointer that O3's entry left open for O2.2; O3's "Not addressed" table now records it as closed here.
- `Title`/`Author` are the codebase's worked example of a brand with **no runtime validation**: the type provides nominal distinction, the constructor provides none. architecture.md §2 now says so, so the next reader does not have to re-derive it.

### Not addressed

| Site | Reason | Landing site |
|---|---|---|
| S21 `Letter`'s constructor | not an integer brand: it case-folds, validates A–Z, and owns `from`/`equals` — the integer-range factory does not fit it | — (closed by decision, not deferred) |
| S22 `DurationMs` | the audit lists it as a factory candidate, but it has no constructor — O3 removed its `try`/`of` and only `DEFAULT` remains | — (closed by decision, not deferred) |
| the audit's O2.1 — deleting the `Title`/`Author` brands | declined: it trades the title/author distinction and architecture.md §2 principle 4 for 14 production lines | — (closed by human decision, recorded in the audit's status line) |
| S26 `GridOps` module dissolution | out of this item's scope | closed by audit O4 (2026-10-26) |
| `Anagram.validateChainInput` → `Anagram.validate` rename | out of this item's scope | audit O17.1 |

---

## O4 — Dissolve the `GridOps` wrapper layer; array-iteration rewrite of the grid scan sites — resolved 2026-10-26

### The item (recap)

`code_reduction_audit.md` O4 has two parts (est. −150 LOC):

1. **Dissolve the wrapper.** After O3 deleted `neighbours`, `neighboursInDirection`, `equals` and `clone`, the item observes that `src/domain/grid/GridOps.ts` is left with five pure delegations to `GridAccess` (`blank`, `cellAt`, `setCell`, `updateCells`, `withinBounds` — "kept only for 'back-compat with 88 call sites' per architecture.md §3") plus exactly one real function, `isSelectable`. The item proposes moving `isSelectable` into `WordTopology` "beside `partOfRun`/`partOfRunMask` — it is the same rule family", deleting the module, and pointing all call sites at `GridAccess`.
2. **Kill the per-cell scan ceremony.** Six loops "pay `Row.of(r)`/`Col.of(c)`/`GridOps.cellAt` per cell of loops that are in bounds by construction" and are to be rewritten with array iteration, which "hands over both the element and its indices with no non-null assertions, so the sanctioned-site lint rule is untouched".

Five of the item's premises did not survive verification, and are corrected by this entry:

1. **The site list is incomplete: there are seven scan sites, not six.** `buildSerializedOutput` in `domain/format/v1.ts` — the export serializer — has the identical shape (a `size × size` loop minting `Row.of(r)`/`Col.of(c)` to read the grid it is iterating) and is not named by the item. Gate 0 requires the inventory to be complete, so it was included.
2. **"Neither relaxes any lint rule" is true of the scan rewrites but not of the deletion.** `eslint.config.js` sanctioned `src/domain/grid/GridOps.ts` for the `@typescript-eslint/no-non-null-assertion` ban, and that file has contained no non-null assertion since O3 deleted `equals` and `clone` — the entry's comment ("legacy equals non-nulls") was already stale. Deleting the module therefore removes a **sanctioned site**: a net tightening, and the only lint-config change in the item. The item does not mention it; it mentions only `tools/boundaries.js`, which in fact does not reference `GridOps` at all.
3. **The `isSelectable` move hides two redundancies the item does not notice.** (a) `isSelectable` performed `withinBounds` and `isWhite` before delegating to `partOfRun` — which performs **both** itself, so those two checks were duplicates. (b) `GridInteraction.select` called `isSelectable` (two `partOfRun` scans) and then computed `inAcross`/`inDown` itself (two more): **four scans where two suffice**, and the two extra are exactly the two it already had.
4. **The "88 call sites" figure the item quotes from architecture.md §3 is wrong by a wide margin.** At the item's starting state the wrapper had **381** call sites — 56 production across 17 files, 325 test across 33 files. The doc's "88" was stale before this item.
5. **The LOC estimate is ~1.6× optimistic.** The landed change is **−93 production lines** (−44 from the module dissolution, −49 from the scan rewrites), not −150.

### Site inventory (Gate 0)

The item's own counts are not trusted; the inventory below is what coverage is measured against.

**Part 1 — the wrapper module.**

| # | Site | File | Outcome |
|---|---|---|---|
| W1 | `GridOps.blank` — pure delegation | `domain/grid/GridOps.ts` | migrated to `GridAccess.blank`; delegation deleted with the module |
| W2 | `GridOps.cellAt` — pure delegation | `domain/grid/GridOps.ts` | migrated to `GridAccess.cellAt`; delegation deleted with the module |
| W3 | `GridOps.setCell` — pure delegation | `domain/grid/GridOps.ts` | migrated to `GridAccess.setCell`; delegation deleted with the module |
| W4 | `GridOps.updateCells` — pure delegation | `domain/grid/GridOps.ts` | migrated to `GridAccess.updateCells`; delegation deleted with the module |
| W5 | `GridOps.withinBounds` — pure delegation | `domain/grid/GridOps.ts` | migrated to `GridAccess.withinBounds`; delegation deleted with the module |
| W6 | `GridOps.isSelectable` — the module's one real function | `domain/grid/GridOps.ts` | **moved** to `WordTopology.isSelectable`; its redundant `withinBounds`/`isWhite` checks dropped |
| W7 | the module file | `domain/grid/GridOps.ts` | **deleted** |
| W8 | the non-null-assertion sanction for `GridOps.ts` | `eslint.config.js` | **removed** — one fewer sanctioned site (tightening) |

**Part 2 — the grid scan sites.**

| # | Site | File | Outcome |
|---|---|---|---|
| S1 | `buildDomainGrid` | `domain/format/v1.ts` | migrated to array iteration; the `gridSize` parameter dropped |
| S2 | `buildSerializedOutput` | `domain/format/v1.ts` | migrated to array iteration — **a site the item did not name** |
| S3 | `CompletenessCheck.check` | `domain/puzzle/CompletenessCheck.ts` | migrated to array iteration |
| S4 | `handleCheck` | `player/state/internal/solving.ts` | migrated to array iteration |
| S5 | `handleConfirmResetPlayer` | `player/state/internal/lifecycle.ts` | migrated to array iteration |
| S6 | `serializePlayerProgress` | `ui/bindings/persistenceCodec.ts` | migrated to array iteration |
| S7 | `deriveGridVM` | `ui/bindings/viewmodels/gridVM.ts` | migrated to array iteration |

**Sites found by inspection that the item did not name.**

| # | Site | File | Outcome |
|---|---|---|---|
| S8 | `GridInteraction.select` — four `partOfRun` scans where two suffice | `domain/grid/GridInteraction.ts` | fixed: the two axis answers are computed once |
| S9 | `isSelectable`'s duplicate `withinBounds` + `isWhite` checks | `domain/grid/GridOps.ts` | dropped (folded into W6) |
| S10 | the `GridOps.ts` entry in the non-null-assertion sanction list | `eslint.config.js` | removed (folded into W8) |
| S11 | the `GridOps` clause and the `partOfRun` consumer list in the `domain/grid/` module row | `architecture.md` §3 | amended |
| S12 | "all `GridOps` accessors" in the coverage paragraph | `architecture.md` §12 | amended — **a site the item did not name** |

**Test-side sites** — a production change is not complete until the tree that consumed it is consistent.

| # | Site | File | Outcome |
|---|---|---|---|
| T1 | the whole file (6 `isSelectable` cases) | `test/domain/grid/GridOps.test.ts` | **deleted** — the 6 cases were exact duplicates of 6 of the 7 now in `WordTopology.test.ts`; the accessor coverage it leaned on already lived in `GridAccess.test.ts` |
| T2 | `isSelectable` coverage | `test/domain/grid/WordTopology.test.ts` | 7 cases added (the 6 mirrored cases plus an out-of-bounds case) |
| T3 | 325 call sites across 32 files | `test/**` | re-pointed to `GridAccess` / `WordTopology.isSelectable`; **no assertion, fixture or structural change** — proved by reverse-rename (below) |
| T4 | 3 test titles citing `GridOps.isSelectable` | `test/ui/bindings/viewmodels/gridVM.test.ts` | retitled to `WordTopology.isSelectable` (architecture.md §14: a test title is a citation and must resolve to something live) |

### Decision

**W6 — the owner of the selectability rule: `WordTopology`.** Options: (a) `WordTopology`; (b) `GridAccess`; (c) keep it in `GridOps`. (c) is the status quo the item dissolves. (b) was rejected: `GridAccess` is the raw-indexing leaf — its documented job is `blank`/`cellAt`/`setCell`/`updateCells`/`withinBounds`, and "is this cell in a length-≥-2 run" is a question about word geometry, not about indexing. (a) was chosen: `WordTopology` is documented as "the single source of grid-level word geometry" and already owns `partOfRun` (the per-axis form) and `partOfRunMask` (the bulk either-axis form); §3 already described the two predicates as one rule. `isSelectable` is the either-axis per-cell form and now sits with them.

**S9 — the redundant checks inside `isSelectable`: dropped.** `partOfRun` performs `withinBounds` and `isWhite` itself and returns `false` for out-of-bounds coordinates without throwing — pinned by an existing case in `WordTopology.test.ts`. The body is therefore exactly `partOfRun(across) || partOfRun(down)`.

**S8 — `GridInteraction.select`: one computation, not four.** Options: (a) leave the four scans; (b) compute the two axis answers once and derive selectability from them. (b) was chosen. Equivalence: `isSelectable` ≡ `withinBounds ∧ isWhite ∧ (acrossRun ∨ downRun)`, and `partOfRun(axis)` ≡ `withinBounds ∧ isWhite ∧ runLength ≥ 2`, so `inAcross ∨ inDown` ≡ `isSelectable` exactly. The two removed calls were not merely redundant — `select` was computing the axis answers twice and using one copy.

**S2 — the seventh scan site: included.** Same kind as the six named ones (a loop whose index *is* the grid coordinate being read). Excluding it would have closed the item with an unexamined same-kind site, which Gate 1 forbids.

**The guard retired at the seven scan sites: `GridAccess.cellAt`'s `RangeError`.** The item's admission criterion is that no guard is traded for line count, so this was checked site by site. At all seven the loop index is the grid coordinate being read and the grid is square by construction (`Puzzle.blank` and `Puzzle.withGrid` both keep `gridSize === grid.length`; `validateGrid` rejects any file whose grid is not `gridSize × gridSize`), so the check was unreachable. The two sites that looped on `gridSize` while reading the grid (`serializePlayerProgress`, `buildSerializedOutput`) now take their bound from the grid itself, so the guard and the data source agree **by construction** rather than by convention.

**W8 / S10 — the ESLint sanction: removed.** `src/domain/grid/GridAccess.ts` remains the only sanctioned site for the non-null-assertion ban, which is what it is for: it is the raw-indexing leaf. Before this item the list had two entries, the second of which had been stale since O3.

**The iteration idiom: `map` for a value per cell, `entries()` for an accumulator.** Chosen so that the two idioms are distinguishable by what the loop *produces* rather than by taste, and so the branded coordinate is minted only where it is emitted.

### Design as implemented

- `WordTopology.isSelectable(grid, row, col): boolean` — `partOfRun(across) || partOfRun(down)`. The single owner of the selectability rule.
- `GridAccess` is the single grid-accessor module: `blank`, `cellAt`, `setCell`, `updateCells`, `withinBounds`.
- The seven scan sites read the grid by iterating it. `Row.of`/`Col.of` survive only where a branded coordinate is **emitted** — the `CompletenessViolation` records, the `GridAccess.updateCells` payloads, the `CheckResult` cell lists.
- `src/domain/grid/GridOps.ts` is deleted; `src/domain/grid/` holds 11 files.
- `eslint.config.js` sanctions `src/domain/grid/GridAccess.ts` alone for the non-null-assertion ban.
- `architecture.md` §3 names `WordTopology.isSelectable` as the selectability rule's owner and `GridAccess` as the single accessor module; §12 names the accessor coverage and the new predicate's coverage.

### Deliberate behaviour changes

**None.** No parse-failure message, no `RangeError` message, no emitted JSON, and no view-model field value changed. Two notes, neither a behaviour change:

1. The `GridAccess.cellAt` `RangeError` is no longer *reachable* at the seven scan sites. It was already unreachable there — the indices are in bounds by construction — so no observable difference exists today. What changed is where the invariant lives: it is now carried by the construction sites (`validateGrid`, `Puzzle.blank`, `Puzzle.withGrid`) rather than re-checked per cell.
2. `serializePlayerProgress` keeps its `String(...)` conversion of each letter, folded into the single mapping pass. `Letter` is `Brand<'Letter', string>` and the runtime value is already a string, so the conversion is a no-op; keeping it costs nothing and leaves the persisted-blob contract explicit.

### Files

18 production modules changed (13 re-pointed, 1 gained `isSelectable`, 1 changed `select`, 1 deleted, plus `v1.ts`, `CompletenessCheck.ts`, `solving.ts`, `lifecycle.ts`, `persistenceCodec.ts`, `gridVM.ts`); 34 test files changed; 1 tooling file changed; 1 doc file changed.

- deleted: `src/domain/grid/GridOps.ts`, `test/domain/grid/GridOps.test.ts`
- `src/domain/grid/WordTopology.ts` (gains `isSelectable`), `src/domain/grid/GridInteraction.ts` (`select`)
- `src/domain/format/v1.ts`, `src/domain/puzzle/CompletenessCheck.ts`, `src/domain/puzzle/Puzzle.ts`, `src/domain/anagram/Anagram.ts`, `src/domain/chain/LengthPattern.ts`
- `src/builder/state/internal/designMode.ts`, `fillMode.ts`, `joinSubMode.ts`, `reconcileWords.ts`
- `src/player/state/internal/solving.ts`, `src/player/state/internal/lifecycle.ts`
- `src/ui/bindings/persistenceCodec.ts`, `src/ui/bindings/viewmodels/gridVM.ts`, `src/ui/bindings/viewmodels/builderVM.ts`, `src/ui/bindings/builderFacade.ts`
- `eslint.config.js`
- `architecture.md` — §3 (`domain/grid/` module row), §12 (coverage)

### Verification

- `npm run ci` green: `eslint .` + `madge --circular` (**no cycles**) + `svelte-check` (**0 errors, 0 warnings**) + `vitest run` (**91 files / 1343 tests**; the baseline before this item was 92 files / 1342 tests) + `vite build` (`dist/index.html` 232.75 kB, gzip 102.60 kB).
- **Mechanical-ness proved, not assumed.** Every changed `src/` and `test/` file was mechanically reverse-renamed back to its `HEAD` content and compared byte-for-byte: all 32 re-pointed test files and the pure-rename parts of the 13 re-pointed source files match `HEAD` exactly. No assertion, fixture, control-flow or formatting change exists anywhere in the re-point. The call-site accounting closes exactly — `GridAccess.cellAt` 12 → 33 (11 in `WordTopology.ts` + 1 delegation removed with the module + 23 re-pointed, less the 1 that `isSelectable` stopped making), `withinBounds` 12 → 16, `blank` 1 → 2, `setCell` 1 → 8, `updateCells` 1 → 4, `WordTopology.isSelectable` 0 → 3. Nothing invented, nothing lost.
- **Behaviour preservation proved empirically, not by assertion.** Two old-vs-new comparisons were run under the item's own code and its `HEAD` code:
  - the parser and both serializers over all seven canonical `puzzles/*.json` — **558,261 bytes, byte-for-byte identical**;
  - `deriveGridVM` (three variants: answer letters, player letters, cursor-selected hilite, in-word hilite, null cursor) and `serializePlayerProgress` over a fixture with black cells, both letter kinds and both marker kinds — **byte-for-byte identical**.
- **The unchanged suites are the proof.** `test/domain/grid/GridInteraction.test.ts`'s `select` suite, `test/domain/format/v1.test.ts`'s byte-equality cases, `test/domain/puzzle/CompletenessCheck.test.ts` and `test/player/state/internal/solving.test.ts`'s ordered `incorrectCells`/`emptyCells` assertions all pass **without a single edit**.
- **Closure audit.** `grep` for `GridOps` over `src/`, `test/`, `eslint.config.js` and `architecture.md`: **0 references**. The old encoding is gone, not merely unused.

### Consequence

- **−93 production lines** (133 added, 226 deleted across 19 files) and **−13 test lines** (407 added, 420 deleted across 34 files) — **−106 net**, plus this entry and the audit's status line. The item estimated −150 production lines; the landed figure is smaller because the scan rewrites saved ~49 lines rather than the ~100 estimated, and because the module dissolution added back the `isSelectable` implementation and its manifest lines.
- **One module fewer and one fewer sanctioned lint site.** `src/domain/grid/` holds 11 files; `GridAccess` is the only file exempt from the non-null-assertion ban, which is the exemption it actually needs.
- **The selectability rule now has one owner and one implementation.** Before this item the rule was expressed three times — `GridOps.isSelectable`, `GridInteraction.select`'s private re-derivation, and `WordTopology.partOfRun` — with `GridOps.isSelectable` duplicating `partOfRun`'s own bounds and whiteness checks. It is now expressed once, in `WordTopology`, and consumed by name.
- Touch costs that change:
  - **Reading a grid cell** is `GridAccess.cellAt` — there is no second name for it.
  - **Reading a grid in a loop** no longer mints brands or re-checks bounds; the loop reads the array it is iterating.
  - **Emitting a cell coordinate** still mints `Row.of`/`Col.of` — the branding is untouched, and it is only for output.
- **Unchanged:** `Row`/`Col` branding; `GridAccess` as the raw-indexing leaf; `partOfRun` and `partOfRunMask` (O9 owns those); `WordTopology`'s bulk-mask form, which remains the source of `selectable` in the grid view-model — the scan rewrite did not replace it with a per-cell call.

### Not addressed

| Site | Reason | Landing site |
|---|---|---|
| `handleApplyLoadedProgress` — the grid read at the saved blob's coordinates | **decided out, not overlooked.** Its loop indexes the *saved progress array*, not the grid; the grid read is a point lookup at externally-driven coordinates, exactly like the sites below. It was migrated to `GridAccess.cellAt` (the bounds check is load-bearing there — the saved blob's dimensions are not the grid's) | — (closed by decision, not deferred) |
| `normalizeV1ChainBoundaries` — the grid read at a word's last cell | a point lookup at a word-derived coordinate, not a scan: the loop iterates words, not cells. Migrated to `GridAccess.cellAt` | — (closed by decision, not deferred) |
| `Anagram.buildWordModel` / `buildChainModel`, `LengthPattern.separatorAt`, `joinSubMode`'s marker helpers, `reconcileWords`'s end-cell reads | the same kind: point lookups at word-derived coordinates, where the bounds check is the guard. All migrated to `GridAccess.cellAt` | — (closed by decision, not deferred) |
| `GridInteraction.move` / `typeLetter` / `backspace` — `isSelectable` at a cursor-derived coordinate | the same kind: a point predicate at an externally-driven coordinate. Migrated to `WordTopology.isSelectable` | — (closed by decision, not deferred) |
| `builderFacade.setMarker`, `builderVM`'s marker flags, `fillMode`'s letter write, `designMode`'s toggle | the same kind: point reads at cursor- or intent-derived coordinates. All migrated to `GridAccess.cellAt` | — (closed by decision, not deferred) |
| `WordTopology.partOfRun`'s own O(n) scan implementation, and `partOfRunMask`'s per-direction variant | out of this item's scope: O9 owns `partOfRun`'s implementation. The bulk mask is deliberately left as the source of `selectable` in the view-model | audit O9 |
| the `GridOps` name itself — a friendlier name for the surviving accessor | deliberately deferred by the human; `GridAccess` stands as the single grid-accessor name | — (open, for a future decision) |
