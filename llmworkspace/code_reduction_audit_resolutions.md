# angryphrase — Code Reduction Audit Resolutions

Companion to `code_reduction_audit.md` (and its companion `code_reduction_audit_architectural_changes.md`).
Each entry records how one audit item was resolved: the site inventory, the decision per site (options
considered, what was chosen, what was deferred and where), the design as implemented, deliberate behaviour
changes, the verification evidence, and the sites that were **not** addressed, with the reason for each.

Conventions: no line-number references (they rot); functions, modules, and test names are the anchors.

The house process for an entry is the one recorded in `archive/architecture_smell_resolutions.md`
(Appendix — "Resolution process (gates)"), applied to audit items instead of smell findings.

Resolved so far: O1 (v1.ts parser/serializer consolidation), O2 (brand-type boilerplate), O3 (delete
dead / test-only API surface), O4 (dissolve the `GridOps` wrapper; array-iteration rewrite of the
grid scan sites), O7 (persistence plumbing duplication), O8 (player solving handlers: one
cursor-change fold), O13 (boot.ts `freshBlank` removal).

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

> **Subsequent change (2026-10-26).** After this entry was written, the human decided to give the
> surviving accessor a friendlier name: `GridAccess` became `Grid`, and the accessors moved into
> `src/domain/grid/Grid.ts` beside the `Grid` type, leaving `src/domain/grid/GridAccess.ts` deleted.
> That is the convention every other value object here already follows — a type and its same-named
> constructor namespace in one file (`Cell.ts`, `Row.ts`, `Col.ts`, `CellMarker.ts`, `GridSize.ts`).
> This entry is left as the record of what O4 did: at O4's close the target was `GridAccess`.

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
| the `GridOps` name itself — a friendlier name for the surviving accessor | closed: after this entry, the accessor namespace was renamed `GridAccess` → `Grid` and moved into `src/domain/grid/Grid.ts` beside the `Grid` type (2026-10-26) | — (closed, not deferred) |

## O1 — `domain/format/v1.ts` parser/serializer consolidation — resolved 2026-11-01

### The item (recap)

O1 proposed six sub-items inside `src/domain/format/v1.ts`, estimating **−180 LOC** on the premise
"no behavior change required; all failure strings can stay byte-identical". Five of the item's
premises did not survive verification against the file as it stood (the item was written before
O2/O3/O4 landed; the file was 749 lines, not 774, and its `buildDomainGrid` had already been
rewritten):

1. **Item 4 (`buildDomainGrid`) was stale.** O4's resolution (2026-10-26) had already rewritten it
   as a direct nested `map` over validated data — the exact shape O1 sketched. Zero work; recorded
   as site S11.
2. **Item 5 as written was a wire-format bug.** "Give `buildSerializedOutput` a `displacedClues`
   argument of `[]` for the complete case and delete the destructure" would emit
   `displacedClues: []` in complete files — which `parsePuzzleShape` rejects
   (`Complete puzzles must not include displacedClues.`) and architecture.md §10 forbids
   ("Complete: … no `displacedClues` field"). The app would have emitted files its own parser
   refuses, breaking the export→import round-trip and the field-set and byte-equality tests. The
   audit's own rejected list ("`serializeCompleteShape` keeping `displacedClues: []` —
   wire-format compatibility; leave") contradicts the item. Declined in that form.
3. **Item 1's helper sketch matched only one of the five sites.** The cell site reports only the
   *first* unknown key and aborts the cell; the word, `nextWord`, displaced-clue and top-level
   sites report *all* unknown keys. The sketched `rejectUnknownFields` (push one, return false)
   applied uniformly would silently drop failures — against §10's "strict — the failure list is
   the contract".
4. **Item 3's "dead" re-checks are live for the type-checker.** The second guard block is
   unreachable at runtime but exists to narrow `GridSize | null` etc. after the
   accumulate-then-return pattern; deleting it outright fails `typecheck`, and replacing it with
   per-field early returns would stop top-level failures accumulating (a hostile file with bad
   version + bad key + bad size must get all three at once).
5. **The estimate was wrong by two orders of direction.** The landed change is **+6 production
   lines** (749 → 755; 96 added, 90 deleted) — not −180, and not the −55 of the pre-implementation
   plan either. The structural reason: each extraction *adds* a helper body and multi-line call
   sites (the repo's formatting), while the item counted only the deleted lines. Same correction
   pattern as O2 (−150 claimed, +33 landed).

### Site inventory (Gate 0)

| # | Site | Sub-item | Outcome |
|---|---|---|---|
| S1 | unknown-key loop, `validateTopLevelExtras` | 1 | migrated to `unknownKeys`; `displacedClues` exemption stays at the site |
| S2 | unknown-key loop, `validateCell` | 1 | migrated; stays first-failure-only via the first element of the helper's result |
| S3 | unknown-key loop, word branch of `validateWords` | 1 | migrated; reports all keys |
| S4 | unknown-key loop, `nextWord` branch of `validateWords` | 1 | migrated; reports all keys |
| S5 | unknown-key loop, `validateDisplacedClues` | 1 | migrated; constant message, one per unknown key |
| S6 | `startRow`/`startCol`/`direction` checks, word branch | 2 | migrated to `validateKeyedCoordinates(word, \`Word ${i}:\`, …)` |
| S7 | the same three checks, `nextWord` branch | 2 | migrated to `validateKeyedCoordinates(nextWord, \`Word ${i}: nextWord\`, …)` |
| S8 | second guard block in `parsePuzzleShape` | 3 | deleted; conditions folded into the single early-return guard |
| S9 | 7-field destructure/re-pack in `serializeCompleteShape` | 5 | replaced by one-line rest-omit; **not** the item's `[]` form |
| S10 | two conflict branches in `markerFromJson` | 6 | collapsed to a loop over the two axes; right-before-bottom order kept |
| S11 | `buildDomainGrid` construction ceremony | 4 | **already migrated by O4** — no work, no duplication left |

### Decision

- **S1–S5: the helper owns the loop and the Set check only.** `unknownKeys(obj, allowed): string[]`
  hands the keys back; every site keeps its own message text, failure count and control flow. This
  is the whole difference between this and the item's sketch: message construction and
  early-return-vs-continue are site semantics, not shared mechanics, and folding them into the
  helper is what would have changed failure lists.
- **S6–S7: one keyed-coordinate validator, called twice.** `validateKeyedCoordinates(obj,
  baseMessage, size, failures): KeyedCoords | null` — `baseMessage` is the full label before the
  field name (`Word ${i}:` / `Word ${i}: nextWord`), which keeps both message families
  byte-identical, including the `direction` line, without string surgery. It accumulates all three
  failures before returning null; at the word site a null sets `wordError` but does not skip the
  `length`/`clue` checks, and at the `nextWord` site it leaves `parsedNextWord` null under the
  existing `if (!wordError)` guard.
- **S8: merge, don't delete.** All narrowing conditions joined the existing early return as
  disjuncts; TypeScript narrows every binding through the negated disjunction, so no casts and no
  `!` were needed. The invariant that makes it safe: every added disjunct is true only when a
  failure was already pushed, so `failures.length > 0` already covers it — the merged guard is
  truth-functionally identical at runtime.
- **S9: omit by rest-pattern, keep the wire shape.** `const { displacedClues: omitted, ...rest } =
  buildSerializedOutput(p, 'complete', []); return rest;` — insertion order is preserved by the
  rest spread, so the emitted bytes are unchanged. The binding is named (`omitted`) with
  `void omitted;` because the repo's `no-unused-vars` has no rest-sibling exemption; no lint rule
  was touched.
- **S10: axis loop.** Right-before-bottom order and first-conflict-early-return preserved.

### Design as implemented

`src/domain/format/v1.ts` only. Two new module-private helpers (`unknownKeys`,
`validateKeyedCoordinates`), one module-private type alias (`KeyedCoords`), one merged guard, one
rest-omit. No public export added, removed, or changed; no import changed; no layer, boundary or
lint movement. The `v1.ts`/`v1Json.ts` split is untouched (the audit's rejected list already
protects it).

### Deliberate behaviour changes

**None.** Every failure list and every serializer byte is proven unchanged (see Verification).

### Files

- `src/domain/format/v1.ts` — the only file changed. **No test file was touched** — the first
  audit item so far to land with a completely untouched test tree (O3 and O4 both had the test
  tree in scope; O1 deletes no consumed API).

### Verification

- `npm run ci` green: `eslint .` + `madge --circular` (**no cycles**) + `svelte-check` (**0 errors,
  0 warnings**) + `vitest run` (full suite) + `vite build`.
- **Behaviour preservation proved empirically, not by assertion.** A throwaway probe compared
  `parsePuzzleShape` failure lists and both serializers' bytes between `HEAD` and the working
  tree, over a hostile corpus: every unknown-field site exercised with *multiple* unknown keys
  (the case where the item's sketch would have dropped failures), cell marker conflicts
  (right/bottom/both), mixed multi-rule accumulations, `nextWord`-not-an-object, a
  complete-file-with-`displacedClues`, a many-bad-top-level-fields file, plus all seven
  `puzzles/*.json` re-parsed and re-serialized. **Byte-for-byte identical** — run once per landed
  sub-task (after each of the four dispatches) and cumulatively at the end.
- **The unchanged suite is the proof.** `test/domain/format/v1.test.ts` passes without a single
  edit — 51 tests, including the byte-equality case (`serializeCompleteShape`'s
  `JSON.stringify` matches `serializeComplete` byte-for-byte), the field-set case (complete output
  carries no `displacedClues` — the case the item's original item-5 form would have broken), and
  the strict `letter`-field and non-head-clue rejections. The audit's verification-plan prediction
  ("parser tests still pass unchanged") held exactly.

### Consequence

- **+6 production lines** (749 → 755; 96 added, 90 deleted), 0 test lines, plus this entry and the
  audit's status line. The item estimated −180; the plan corrected it to −55; the landed figure is
  +6. Approximate per-task attribution: items 1+6 ≈ 0, item 2 ≈ +10 (the helper body and call
  formatting outweigh the two deleted check triples), item 3 ≈ −2, item 5 ≈ −8. The item's
  *quantity* claim was wrong for a structural reason worth recording: an extraction's cost is a
  helper plus call sites; a per-site deletion estimate that counts only the removed lines will
  overshoot every time in this formatting regime.
- **The item's quality claims are met.** Four rules that each had a second expression now have
  one owner: the unknown-key loop (five hand-rolled copies → one helper), keyed-coordinate
  validation (two copies → one), the top-level validity guard (two expressions → one), and the
  complete-shape `displacedClues` omission (a 7-field re-pack → a one-line omit). `markerFromJson`
  writes its two axes once.
- **No guard was traded for any of it.** The cell site's first-failure-only behavior, the
  accumulate-don't-return semantics at every level, and the failure-list contract are all
  preserved and pinned by the old-vs-new proof.
- Touch costs that change: adding a new keyed field to a validation site means touching the
  `Set` and the site's message, not a hand-rolled loop; adding a third keyed-coordinate shape
  (none exists today) means a third call to `validateKeyedCoordinates`, not a third copy of three
  checks.

### Not addressed

| Site | Reason | Landing site |
|---|---|---|
| `buildDomainGrid` (item 4) | already migrated by O4's array-iteration rewrite; recorded, not deferred | O4 resolution (closed) |
| item 5's `displacedClues: []` form | **declined by decision** — it changes the complete-file wire shape to one the app's own parser rejects; the omission is a §10 rule, not a style choice | — (closed by decision, not deferred) |
| `length`/`clue` casts (`as number` / `as string`) at the word `result.push` | word-site-specific checks, not the keyed-coordinate shape; absorbing them would widen the helper past its rule | — (closed by decision, not deferred) |

---

## O7 — Persistence plumbing duplication — resolved 2026-11-01

### The item (recap)

`code_reduction_audit.md` O7 proposes four changes (est. −120 LOC): (1) a slice factory replacing the
cloned builder/player halves of `persistenceScheduler.ts`; (2) a latch factory replacing
`builderLatch`/`playerLatch` + the branchy `handleWriteResult` in `appStore.svelte.ts`; (3)
`coerceError` + a `guard<T>` wrapper collapsing `localStoragePort.ts`'s six re-inlined
`try/catch` blocks, and keep the factory only if `test/ports/` uses it; (4) single-cast wrapper
locals replacing the repeated `(parsed as { kind?: unknown }).kind` casts in `persistenceCodec.ts`,
plus turning `serializePlayerProgress`'s "20 lines of loops" into `.map`.

Four of the item's premises did not survive verification, and are corrected by this entry:

1. **The sketch's `clear(): void` is wrong.** `clearPlayer` takes a `PuzzleKey`; `clearBuilder` takes
   nothing. A factory collapsing both to `clear(): void` cannot back the frozen
   `PersistenceScheduler` interface. The factory must be generic over the clear-argument type.
2. **The sketch's factory blanket-calls `onWriteResult` after `doSave`.** `doSavePlayer` early-returns
   when `serializePlayerProgress` yields `null` (phase ≠ 'solving') and must fire **no**
   `onWriteResult` in that case (architecture.md §8: reminders ride on *attempted* writes). The
   slice-specific save function owns the report decision; a blanket report would fabricate write
   attempts that never reached storage.
3. **Part 3's generic `guard<T>` would flatten a load-bearing asymmetry.** A failed *load* warns
   (`console.warn`) and returns `{ kind: 'failed' }`; a failed *save/clear* returns the error
   silently — `localStoragePort.test.ts` asserts `warnSpy` is *not* called for save/clear failures.
   One generic wrapper needs a mode flag to preserve that; key-addressed primitives
   (`loadKey`/`saveKey`/`removeKey`) preserve it by construction. The audit's shape was rejected for
   the cleaner one. The factory-vs-singleton question resolves to *keep both*:
   `test/ports/localStoragePort.test.ts` calls `createLocalStoragePort()` 14×.
4. **Part 4's "20 lines of loops" claim is stale.** `serializePlayerProgress` was already
   `.map`-based (3 lines) before this change — there was no loop consolidation to do. The real win was
   only the repeated casts. The per-cell `Letter.try` validation loop in `parsePlayerProgress` is
   load-bearing (it rejects invalid letters on reload) and stays as is.

### Site inventory (Gate 0)

| # | Site | File | Outcome |
|---|---|---|---|
| S1 | `scheduleBuilderSave` timer+pending+coalesce body | `ui/bindings/persistenceScheduler.ts` | migrated to factory |
| S2 | `schedulePlayerSave` timer+pending+coalesce body | `ui/bindings/persistenceScheduler.ts` | migrated to factory |
| S3 | `clearBuilder` cancel+clear body | `ui/bindings/persistenceScheduler.ts` | migrated to factory |
| S4 | `clearPlayer(key)` cancel+clear body | `ui/bindings/persistenceScheduler.ts` | migrated to factory (clear-arg generic) |
| S5 | `flush`'s builder half | `ui/bindings/persistenceScheduler.ts` | migrated to factory |
| S6 | `flush`'s player half | `ui/bindings/persistenceScheduler.ts` | migrated to factory; builder-first ordering kept |
| S7 | `doSaveBuilder` / `doSavePlayer` | `ui/bindings/persistenceScheduler.ts` | **kept as slice closures** — not duplication: they differ per slice (blob kind, per-key address, null-blob silence) |
| S8 | `builderLatch` / `playerLatch` literals | `ui/bindings/appStore.svelte.ts` | migrated to `makeLatch` factory |
| S9 | `handleWriteResult`'s four `slice === 'builder'` branches | `ui/bindings/appStore.svelte.ts` | migrated; one branch remains (latch *selection* only) |
| S10 | `loadBuilder` / `loadPlayerProgress` try/catch bodies | `ports/localStoragePort.ts` | migrated to `loadKey` |
| S11 | `saveBuilder` / `savePlayerProgress` try/catch bodies | `ports/localStoragePort.ts` | migrated to `saveKey` |
| S12 | `clearBuilder` / `clearPlayerProgress` try/catch bodies | `ports/localStoragePort.ts` | migrated to `removeKey` |
| S13 | six inline `err instanceof Error ? …` coercions | `ports/localStoragePort.ts` | migrated to module-local `coerceError` |
| S14 | `parseBuilderSnapshot`'s five `snap as { … }` casts | `ui/bindings/persistenceCodec.ts` | single cast to wrapper local `w` |
| S15 | `parsePlayerProgress`'s five `parsed as { … }` casts | `ui/bindings/persistenceCodec.ts` | single cast to wrapper local `w` + `keyRaw`/`gridSizeRaw`/`rawLetters` consts |
| S16 | `serializePlayerProgress`'s `String()` conversions | `ui/bindings/persistenceCodec.ts` | dropped — brands are strings at runtime, `JSON.stringify` byte-identical (proved below); `Number(gridSize)` kept (real coercion) |

### Decision

All sixteen sites migrated or explicitly kept. The contested calls:

- **Factory reporting shape (S1–S7).** Options: (a) the audit's sketch — `doSave`/`doClear` return
  values, factory calls `onWriteResult` centrally; (b) both callbacks `void`, each slice closure calls
  `onWriteResult` itself. (a) was rejected: it forces the factory to know the report policy, and the
  player save's null-blob silence (premise 2) would need a special-case return convention. (b) was
  chosen — reporting decisions live with the slice-specific code that knows whether a write was
  attempted, and the factory is pure timer/pending/cancel/flush mechanics, which is exactly the
  responsibility split architecture.md gives it ("Holds no failure policy").
- **Key-addressed primitives over generic `guard<T>` (S10–S13).** See premise 3. The six public
  methods become one-line delegations; the load-warns/write-silent asymmetry and the exact key
  composition (`PLAYER_PREFIX + String(key)`) are preserved by construction.
- **`String()` drops (S16).** Kept `Number(gridSize)`; dropped the two `String()` calls. Chosen
  because the byte-diff proof (below) shows identical output; rejected keeping them because they
  implied the brands needed conversion when the runtime never does.
- **Scheduler LOC.** The factory nets **+3** lines (113→116): the duplication halved, but a fully
  typed generic factory carries ceremony (a `SliceScheduler<S, C>` alias, two generic
  instantiations, a `void`-arg wrapper for `clearBuilder`) that two bare clones did not. Accepted:
  the item's goal is that the halves cannot drift, and the invariant set (one timer per slice,
  coalescing, clear-cancels-pending, builder-first flush) is now single-copy. Line count was never
  the real currency here — see Verification.

### Design as implemented

- `persistenceScheduler.ts`: internal `createSliceScheduler<S, C>(doSave, doClear, debounceMs)`
  returning `{ schedule, clear(arg), flush }`, instantiated as
  `createSliceScheduler<BuilderState, void>` and `createSliceScheduler<PlayerState, PuzzleKey>`.
  The public `PersistenceScheduler` interface and `createPersistenceScheduler` signature are frozen
  and unchanged; the returned object delegates. `doSavePlayer` narrows `state.phase === 'solving'`
  before reading `state.puzzle.key`, which removes the `as Extract<PlayerState, …>` cast the old
  code carried — a cast deleted, not added.
- `appStore.svelte.ts`: `makeLatch(warnPrefix, failureIntent)` returns `{ report(err) }` with the
  three-case policy (disarm on success / silent within cadence / warn + toast). `retoastMs` stays a
  store-level concern read by closure. The scheduler wiring keeps exactly one `slice` branch, which
  selects the latch.
- `localStoragePort.ts`: module-local `coerceError` (same shape as `filePickPort.ts`'s private
  one), `loadKey` (sole warner), `saveKey`, `removeKey`. Factory + singleton both kept.
- `persistenceCodec.ts`: each parser casts once after its `typeof`/null guard into a wrapper local
  typed with only the fields it reads; field reads go through consts so `typeof`/`Array.isArray`
  narrow without further casts. The guard-before-cast order is load-bearing and unchanged: the cast
  shapes, the guard validates.

### Deliberate behaviour changes

None. No user-visible behaviour, no wire format, no failure message changed. The
`console.warn` label on a failed load changed from two method-specific strings
(`'localStoragePort.loadBuilder failed:'` / `'…loadPlayerProgress failed:'`) to one
(`'localStoragePort.load failed:'`) — the tests pin call-count, not the string, and no other
consumer reads it.

### Files

Production — 4 files (153 insertions, 164 deletions): `src/ports/localStoragePort.ts` (66→66),
`src/ui/bindings/appStore.svelte.ts` (205→201), `src/ui/bindings/persistenceCodec.ts` (138→128),
`src/ui/bindings/persistenceScheduler.ts` (113→116).

Tests — **zero files touched**. This is the proof item for the behaviour-preservation claim: the
suites that pin every one of these behaviours (`persistenceScheduler.test.ts` 34 cases,
`persistenceCodec.test.ts`, `appStore.test.ts`'s six latch cases, `localStoragePort.test.ts` 14
cases) pass without a single edit.

Docs: this file.

### Verification

| Command | Result |
|---|---|
| `npm run test` | 91 files / 1343 tests pass — no test file edited |
| `npm run typecheck` | 0 errors, 0 warnings |
| `npm run lint` (incl. `madge --circular`) | clean, no cycles |

**Old-vs-new byte diff (the strong proof for the blob claim).** A scratch harness (created for this
verification, deleted after) built three deterministic fixtures via `SeededRng` — a blank builder
state, a builder state with black cells / words / a displaced clue / fill mode, and a solving player
state with two typed letters — and captured `serializeBuilderSnapshot` ×2 and
`serializePlayerProgress` outputs under both code versions (working tree stashed for the old
capture). **Outputs byte-identical** (8,299 bytes each, `diff` empty) across all three fixtures.
This covers the `String()`-drop claim (S16) and the unchanged wrapper shapes directly, not just via
assertions.

Closure audit: grep over `src/` confirms the old encodings are gone — `handleWriteResult` (0 refs),
`builderLatch`/`playerLatch` as object literals (0 refs; the names now bind `makeLatch` results),
the five-per-parser `as { … }` casts in `persistenceCodec.ts` (replaced by exactly one wrapper cast
per parser — 2 refs total, the S14/S15 end state, down from 10), and the inline
`err instanceof Error ? err : new Error(String(err))` coercion in `localStoragePort.ts` (one copy,
inside `coerceError`). Accountings close: `StoragePort`,
`PersistenceScheduler`, and the codec's four functions + two types keep their exact signatures and
call-site counts.

Size: **−11 net LOC** (522→511 across the four files). The audit estimated −120; the estimate
double-counted (it subtracted the duplicated lines while ignoring the ceremony a fully typed
factory costs, and its part-4 premise was stale). The delivered value is structural: one copy of
the debounce/coalesce/cancel/flush mechanics, one copy of the latch policy, one coercion function,
one cast per parser.

### Consequence

- **A new persistence slice** (if one is ever added) is a third `createSliceScheduler` instantiation
  plus two delegating methods — not a third hand-written copy of timer/pending/clear/flush.
- **The latch policy** (disarm / cadence / warn+toast) has one owner; a cadence change edits one
  closure, not four branches.
- **The port's asymmetry** (loads warn, writes stay silent) is now visible in the code shape itself
  (`loadKey` warns; `saveKey`/`removeKey` do not) rather than implied by six repetitive bodies.
- **Unchanged:** architecture.md §8's descriptions remain accurate as written — the factory is
  internal to `persistenceScheduler.ts`, which §3 still describes as "mechanical
  debounce/serialize/coalesce/cancel-on-clear/flush; holds no failure policy (the latches live in
  the appStore)".

### Not addressed

| Site | Reason | Landing site |
|---|---|---|
| `coerceError` duplicated between `filePickPort.ts` and `localStoragePort.ts` (two private 3-line copies) | a shared `src/ports/` error module is a new cross-module boundary for two 3-line functions; each file's copy stays private where a reader looks for it | — (closed by decision, not deferred) |
| audit item O13 (paired with O7 in the audit's implementation order) | separate audit item, not part of O7's site inventory | audit O13 — resolved 2026-11-01, see the O13 entry below |
| `serializePlayerProgress` loop→`.map` consolidation (part 4's headline) | premise stale — the code was already `.map`-based; there was nothing to consolidate | — (closed: nothing to do) |

---

## O13 — `boot.ts`: `freshBlank` duplicates `AppState.blank` — resolved 2026-11-01

### The item (recap)

`code_reduction_audit.md` O13 claims `freshBlank` in `src/ui/bindings/boot.ts` re-sets four fields
that `AppState.blank` already returns, proposes deleting the helper, and further proposes rewriting
the restore branch as `AppState.blank(...)` with the `builder` field overridden — "whole file 41 →
~20 lines", est. −15 LOC, "Risk: none".

### Site inventory (Gate 0)

| # | Site | File | Outcome |
|---|---|---|---|
| S1 | `freshBlank` helper (spread + four overrides) | `src/ui/bindings/boot.ts` | deleted; blank path returns `AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(deps.rng))` directly |
| S2 | the two blank-path call sites (`result.kind !== 'loaded'` and `snapshot === null`) | `src/ui/bindings/boot.ts` | collapsed into one via a `const snapshot = result.kind === 'loaded' ? parseBuilderSnapshot(result.value) : null` ternary |
| S3 | the restore branch's 12-field `AppState` literal | `src/ui/bindings/boot.ts` | **kept as an explicit literal** — see decision; now spells `player`/`toasts`/`modal`/`pendingConfirmIntent` itself (it previously inherited them from the blank spread through `freshBlank`'s return) |

### Decision

**Part 1 (delete `freshBlank`) — executed, claim verified.** `AppState.blank` in
`src/app/state/state.ts` sets exactly `player: PlayerState.importScreen()`, `toasts: []`,
`modal: null`, `pendingConfirmIntent: null` — value-identical to the four overrides, and
`PlayerState.importScreen()` is pure (no rng/clock). The overrides were pure redundancy; deleting
them changes nothing observable.

**Part 2 (restore branch as `AppState.blank(...)` + `builder` override) — rejected.** Two options
were considered and both fail:

- *Naive form* — `AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(deps.rng))` on the restore
  path calls `deps.rng` when a snapshot loaded. That breaks a pinned property:
  `test/ui/bindings/boot.test.ts` "rng is NOT called on the loaded-snapshot path", and the
  documented invariant in `archive/architecture_smell_resolutions.md` #8 ("`deps.rng` is called
  exactly once on the blank path … and not at all on the loaded-snapshot path").
- *Snapshot-key workaround* — reuse `snapshot.puzzle.key` so rng stays silent. This constructs a
  full blank `BuilderState` (15×15 grid via `Puzzle.blank`) only to discard its `builder` field,
  and converts the restore literal into a blank-then-discard spread. architecture.md §3 names
  `boot.ts` the "Sole owner of the `BuilderState` reload shape"; the explicit literal **is** that
  ownership made legible. Rejected on both counts — wasted construction and obscured ownership —
  for ~5 lines.

**Estimate corrected.** The item's "−15 LOC, whole file 41 → ~20" is wrong arithmetic: the restore
literal stays and gains four spelled fields it used to inherit. Delivered: **−13 net production
lines** (41 → 28; 2 insertions, 15 deletions), one file. Test tree untouched.

### Design as implemented

`createInitialAppState` now reads: load builder slice → `snapshot = result.kind === 'loaded' ?
parseBuilderSnapshot(result.value) : null` → `snapshot === null` ⇒ return
`AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(deps.rng))` → otherwise return the explicit
restore literal (subMode forced `{ kind: 'none' }`, `cursor: null`, wrapper fields spelled).
Exactly one `PuzzleKey.generate` call site, on the blank path only.

### Deliberate behaviour changes

None. Blank path returns a deep-equal `AppState` on every branch (absent / failed / corrupt /
complete-file snapshots); restore path byte-identical.

### Files

- Modified: `src/ui/bindings/boot.ts` (only file; no test, doc, or sibling changes).

### Verification

| Command | Result |
|---|---|
| `npx vitest run test/ui/bindings/boot.test.ts` | 9/9 pass — **zero test edits**, the behaviour-preservation proof |
| `npm run ci` | lint + madge clean; svelte-check 0/0; 1343 tests green; single-file build OK |

`git diff --stat` closes the accounting: one file, 2 insertions / 15 deletions. The rng-count pins
(blank path 16 draws, loaded path 0) pass unchanged.

### Consequence

- `AppState.blank` is the sole owner of the fresh-boot wrapper shape; `boot.ts` no longer re-states
  it. `boot.ts` remains the sole owner of the `BuilderState` reload shape, now more legible (the
  literal spells every field).
- The rng-silence-on-restore invariant survives with one construction site to audit.

### Not addressed

| Site | Reason | Landing site |
|---|---|---|
| restore-branch rewrite as `AppState.blank(...)` + `builder` override (item's second sentence) | rejected — breaks the pinned rng-silence property in its naive form; the snapshot-key workaround builds a blank `BuilderState` to discard it and obscures the documented reload-shape ownership | — (closed by decision, not deferred) |

---

## O8 — Player solving handlers: one fold instead of five copies — resolved 2026-11-01

### The item (recap)

`code_reduction_audit.md` O8 claims `solving.ts` repeats a five-step pattern (phase guard →
`GridInteraction` call → null-check → spread with `checkResult: null` and
`anagramAfterCursorChange(...)`) across five handlers, proposes one private `applyCursorChange`
helper (~est. −70 LOC), suggests the same for the builder's `fillMode` cursor handlers (~20 LOC),
and hedges that `handleClickCluePanelWord`'s flow "differs slightly — keep it explicit or adapt the
helper".

### Site inventory (Gate 0)

| # | Site | File | Outcome |
|---|---|---|---|
| S1 | `handleSelectCell` | `src/player/state/internal/solving.ts` | migrated — calls the fold with `{ cursor }` |
| S2 | `handleMoveCursor` | `src/player/state/internal/solving.ts` | migrated — calls the fold with `{ cursor }` |
| S3 | `handleClickCluePanelWord` | `src/player/state/internal/solving.ts` | migrated — word lookup and the cursor literal stay explicit, then `{ cursor: newCursor }` |
| S4 | `handleTypeLetter` | `src/player/state/internal/solving.ts` | migrated — passes the `WriteOutcome` as `{ grid, cursor }` |
| S5 | `handleBackspace` | `src/player/state/internal/solving.ts` | migrated — same as S4 |
| S6 | `fillMode`'s four cursor handlers (`select-cell`/`move-cursor`/`type-letter`/`backspace`) | `src/builder/state/internal/fillMode.ts` | **not migrated — see decision** |

### Decision

**Player half (S1–S5) — executed, core claim verified.** All five tails are value-identical
(spread + optional `Puzzle.withGrid` + `cursor` + `checkResult: null` + anagram re-eval against the
post-change puzzle). The check-clear-on-change and anagram re-eval rules now have exactly one owner,
the private `applyCursorChange` fold. No new exports; handler names and signatures unchanged.

**Builder half (S6) — declined.** Options considered: (a) a second fold in `fillMode.ts` mirroring
the player's; (b) a shared fold in `domain/` consumed by both; (c) skip. Chosen: skip.

- (a) is LOC-neutral at best: the `fillMode` sites are already ternary one-liners; the fold saves
  ~6 lines against a ~10-line helper, and leaves the fold *concept* (post-outcome state assembly)
  expressed twice — once with the check-clear/anagram resets, once without — which is the
  duplication this item exists to remove.
- (b) is blocked architecturally: `builder/state` and `player/state` may not import each other
  (architecture.md §3), and the shared core cannot live in `domain/` because the `checkResult` /
  `anagram` resets are state-layer policy, not domain rules. The fold is a player-state concept and
  stays in `solving.ts`.
- O18's note that `fillMode` handlers "collapse to the point where inlining is defensible **with
  O8's shared fold**" concerns the builder half only and is unaffected: O18 remains viable on its
  own terms (body-shrinking via the O6.2 `Extract` aliases), and its own text says "whether to
  inline is taste — keep the files, shrink the bodies".

**`handleClickCluePanelWord` hedge — resolved by adapting.** The item's "keep it explicit" option
was unnecessary: the only per-site logic (word lookup, cursor construction from the word key) stays
in the handler; the shared tail folds. The audit's own risk note anticipated this correctly.

### Corrections to the item

1. **The sketch's cursor guard is wrong twice.** `...(out.cursor !== undefined && { cursor:
   out.cursor })` guards against `undefined`, which cannot occur (the field is required), and would
   *silently spread a `null` cursor* if the value were null, since `Cursor` is a nullable union.
   The `out.cursor ?? state.cursor` fallback is likewise dead. Fixed by typing the fold's input
   `cursor: NonNullable<Cursor>` — null is unrepresentable at the fold boundary. The invariant
   carrying it: every **non-null** `GridInteraction` outcome carries a non-null cursor
   (`typeLetter`/`backspace` return `null`, not a null-cursor outcome, when the cursor is null);
   `WriteOutcome.cursor`'s declared type is wider than its runtime value, so `handleTypeLetter` /
   `handleBackspace` destructure and guard `cursor === null` before calling the fold — a
   type-required, runtime-dead guard that returns state unchanged (same reference), with no
   non-null assertions.
2. **The estimate is corrected from "−70 LOC" to −12 production lines** (202 → 190; 28 insertions,
   40 deletions, one file). The per-site deletion accounting assumed each handler collapses to
   "guard + one call (~8 lines → 4)", but each retains its own guard(s), its own
   `GridInteraction`/lookup call, and the `Result.ok` wrapper — the realistic per-site shrink is
   2–4 lines, plus the fold adds 15. (The lead's pre-dispatch estimate of −30 to −40 was wrong for
   the same reason.) The item's *quality* claim — one owner of the repeated rule — is met; its
   quantity claim was not. This is the fourth consecutive O-item whose estimate missed high (O1
   −180 → +6; O2 −150 → +33; O13 −15 → −13).

### Design as implemented

`solving.ts` gains two private type aliases (`SolvingState = Extract<PlayerState, { phase:
'solving' }>`, `CursorChange = { grid?: Grid; cursor: NonNullable<Cursor> }`) and the private fold:
null outcome ⇒ return `state` (same reference); otherwise `puzzle = out.grid ?
Puzzle.withGrid(state.puzzle, out.grid) : state.puzzle`, then spread `{...state, puzzle, cursor:
out.cursor, checkResult: null, anagram: anagramAfterCursorChange(state.anagram, puzzle,
out.cursor)}`. The anagram re-eval reads the *post-change* puzzle for grid-changing sites and the
incoming puzzle for cursor-only sites — encoded once, in the fold's `puzzle` local. `handleCheck`
and `handleClearErrors` are not cursor-change handlers and were correctly excluded by the item.

### Deliberate behaviour changes

None. No-op paths return the same state reference; every outcome path is value-identical
(the no-op assertions in the suite are `toBe` identity checks, not deep equality).

### Files

- Modified: `src/player/state/internal/solving.ts` (only file).
- Not modified: `test/player/state/internal/solving.test.ts` — zero edits, by design (see
  Verification).
- `llmworkspace/code_reduction_audit.md` — status line added; `llmworkspace/architecture.md` — §3
  `solving.ts` line and §7 check-clear wording updated to name the fold (lead-owned doc edits).

### Verification

| Command | Result |
|---|---|
| `npx vitest run test/player/state/internal/solving.test.ts` on the **pre-change** code (`git stash`) | 85/85 pass |
| `npx vitest run test/player/state/internal/solving.test.ts` on the **post-change** code | 85/85 pass — **the same suite, zero edits, green on both sides of the change** — the behaviour-preservation proof |
| `npm run typecheck` | 0 errors, 0 warnings |
| `npm run lint` | clean, `madge --circular` finds no cycles |
| `npm run test` | 1343/1343 pass (91 files) |

`git diff --stat` closes the accounting: one file, 28 insertions / 40 deletions.

### Consequence

- The check-clear-on-change and anagram-re-eval rules have one implementation site instead of five;
  a future change to either rule (e.g. a different clear policy) edits one function.
- The fold is player-only and private: no domain export, no cross-state-module dependency, no
  change to the reducer's dispatch surface.

### Not addressed

| Site | Reason | Landing site |
|---|---|---|
| `fillMode` cursor handlers (item's "same idea applies to the builder" sentence) | declined — LOC-neutral at best, and a second fold would re-duplicate the concept the item removes; sharing is blocked by the sibling-import boundary and wrong-layered for `domain/` | `code_reduction_audit.md` O18 (builder body-shrinking via O6.2 aliases — independent of this item) |
