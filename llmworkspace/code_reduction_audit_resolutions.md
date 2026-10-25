# angryphrase — Code Reduction Audit Resolutions

Companion to `code_reduction_audit.md` (and its companion `code_reduction_audit_architectural_changes.md`).
Each entry records how one audit item was resolved: the site inventory, the decision per site (options
considered, what was chosen, what was deferred and where), the design as implemented, deliberate behaviour
changes, the verification evidence, and the sites that were **not** addressed, with the reason for each.

Conventions: no line-number references (they rot); functions, modules, and test names are the anchors.

The house process for an entry is the one recorded in `archive/architecture_smell_resolutions.md`
(Appendix — "Resolution process (gates)"), applied to audit items instead of smell findings.

Resolved so far: O3 (delete dead / test-only API surface).

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
- **Unchanged:** the grid's 88 call sites still go through `GridOps` (its dissolution is O4's), the
  `Position` brand still exists (O2.2's), `Anagram.validateChainInput` keeps its name (O17.1's).

### Not addressed

| Site | Reason | Landing site |
|---|---|---|
| `GridOps` module dissolution (the 5 leaf-accessor re-exports and `isSelectable`) | O3 removes the dead members only; the module itself is dissolved by O4, which also moves `isSelectable` to `WordTopology` | audit O4 |
| `domain/anagram/Position.ts` deletion (`Position` brand → plain `number`) | O3 removes `Position.try`/`Position.equals`; the brand itself is removed by O2.2 | audit O2.2 |
| `Anagram.validateChainInput` → `Anagram.validate` rename | O3 removes the dead word-form entry point; the rename belongs to O17.1 | audit O17.1 |
| S26 `Anagram.buildWordModel` | retained: live internal caller (`buildChainModel`) and direct test consumers | — (closed by decision, not deferred) |
| S27 `ChainCells.cellsOfWord` | retained: live internal caller (`cellsOfChain`) and direct test cases | — (closed by decision, not deferred) |
