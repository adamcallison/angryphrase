# angryphrase — Architecture Smells (ranked)

Companion to `architecture.md`. This document is an audit of the **architecture as built**, not a plan: each item is a smell — a structure that will hurt future change or has already produced drift — with evidence and consequences. Solutions are deliberately not specified; where a smell is hard to state without gesturing at one, the gesture is a single clause, not a proposal.

Scope rules:

- Architecture smells only. Code-level issues (naming, local duplication inside one module, style) are excluded unless they are symptoms of an underlying structure problem.
- `llmworkspace/archive/` is out of scope. Where the *live* code or docs reference archived material, that itself counts as a smell (see #11).
- `architecture.md` states "where it disagrees with the code, the code wins." Divergences are therefore recorded as evidence about the system, not as doc bugs — except where the divergence hides a real gap (see #7, #9, Appendix A).

Ranking criteria, in order: (1) present correctness risk, (2) cost of the next change (how many sites must move in lockstep), (3) blast radius if the sites drift apart.

## Audit completeness statement

So future readers can judge the gaps rather than trust the rank list blindly:

**Examined exhaustively** (every file read in full): all of `src/` — domain (45 modules), the three state trees, `ui/bindings`, `ui/` (every `.svelte` component), `ports/`, `main.ts` — plus `eslint.config.js`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, the deploy workflow, the `test/` tree structure, `test/boundary/imports.test.ts` in full, and the assertion content of four test files spot-checked where a smell required it (`v1.test.ts`, `reconcileWords.test.ts`, `importExport.test.ts`, `CompletenessCheck.test.ts` — the last two specifically for the #2 hole).

**Verified by execution** at HEAD on 2026-10-11: `npm run test` — 80 files, 1154 tests, all green; `npm run lint` — eslint + `madge --circular`, green.

**Judgment calls — findings deliberately not ranked as smells:**

- *VM derivation cost* was initially excluded because `future_considerations.md` declares scale a non-concern; promoted to #14 for completeness since it is a structural property, not an incidental one.
- *Dead domain API surface* (`GridOps.clone`, `CellIndex`, etc.) is recorded in Appendix A rather than as a ranked smell: it is a standing readability tax, not a drift risk.
- *Code-level items with no architectural driver* are excluded by the scope rules: `Title.try` that cannot return null, the repeated `fileType` validation inside `parsePuzzle`, the internal triplication inside `LengthPattern` (surfaced only as evidence within #4), Tailwind class repetition across components, a11y gaps the architecture doc itself scopes out.

**Not examined:** the assertion content of the remaining ~75 test files (trusted from names except where spot-checked); `puzzles/*.json` (doc: unreferenced by code); `dist/`; git history (no drift-over-time analysis); `llmworkspace/archive/` (excluded by instruction); runtime/browser behaviour (no manual pass — the doc's own manual checklist items were not executed); security beyond noting Svelte's text escaping covers current data flows.

---

## 1. The shared grid-interaction concept has no home — it is duplicated across both experience stacks

**Category:** missing abstraction / rule-incomplete hoisting. **Risk:** high (drift already started; every interaction change is a two-site change).

The module boundary rule (`architecture.md` §3 Layer 1): builder/state and player/state never import each other; "shared concepts (e.g. `Cursor`) live in `domain/`." Only the *data* concept (`Cursor`) was hoisted. The *behaviour* — how a cursor selects, moves, advances on typing, retreats on backspace over a grid — was left duplicated:

| Duplicated unit | Builder copy | Player copy |
|---|---|---|
| `DELTA` direction table | `fillMode.ts:20-23` | `solving.ts:19-22` |
| `partOfAcross` / `partOfDown` / `hasWhiteNeighbour` | `fillMode.ts:200-232` | `solving.ts:24-56` |
| select-cell (bounds, selectability, same-cell direction toggle) | `fillMode.ts:25-67` | `solving.ts:73-126` |
| move-cursor (clamp-or-rotate-direction) | `fillMode.ts:69-105` | `solving.ts:128-162` |
| type-letter (write + advance) | `fillMode.ts:107-134` | `solving.ts:191-228` |
| backspace (clear-or-retreat) | `fillMode.ts:136-176` | `solving.ts:230-281` |
| `select-cell` / `move-cursor` / `type-letter` / `backspace` / `escape` / `click-clue-panel-word` intent variants | `builder/state/intents.ts:21-35` | `player/state/intents.ts:18-23` |
| Grid action bag bodies (identical functions) | `builderFacade.ts:122-143` | `playerFacade.ts:81-99` |
| `pickFile` port-consumption policy (identical) | `builderFacade.ts:183-190` | `playerFacade.ts:142-149` |
| `importDroppedFile` (identical except intent kind) | `builderFacade.ts:111-119` | `playerFacade.ts:111-119` |
| `onTypingIntent` switch | `BuilderShell.svelte:25-40` | `PlayerShell.svelte:21-28` |
| Grid rendering component (~95% identical markup) | `BuilderGrid.svelte` | `PlayerGrid.svelte` |
| Clue-panel scroll-into-view `$effect` + panel scaffolding | `BuilderCluePanel.svelte:63-70` | `PlayerCluePanel.svelte:22-29` |
| Failure message constants | `importExport.ts:9-10` | `player/state/internal/lifecycle.ts:13-14` |

That is roughly 150 lines of identical navigation/typing algorithm plus five layers of twin plumbing, per interaction. Drift has already begun: the same-cell no-op branch returns `Result.ok(state)` in the Builder (`fillMode.ts:57`) but `Result.ok({ ...state, checkResult: null })` in the Player (`solving.ts:109-112`) — same skeleton, different no-op semantics, maintained by hand.

The reason this is architectural rather than incidental: the boundary rule created a vacuum. Behaviour shared by both experiences can only live in `domain/`, and `domain/` ended up owning value objects and word/chain algebra but no grid-*interaction* semantics. So each state tree re-implements them, and `ui/shared/` exists but is not used for the most obviously shared visual object (the grid).

Consequence quantified: one new keyboard interaction (e.g. tab-to-next-word) touches `typingIntent.ts`, both shells' switches, both facades' grid bags, both `intents.ts`, both `reducer.ts`, both internal handler files — seven files, twice over, plus one test file per state module. A change to cursor semantics (e.g. skip-black-cell behaviour) must be replicated exactly or the two experiences silently diverge.

---

## 2. "Complete puzzle" is defined twice, and the export gate is weaker than the import gate

**Category:** split invariant / duplicated rule with drift. **Risk:** high — the app can emit artifacts it itself rejects. Concrete, untested.

Two independent definitions of "complete" exist in the domain:

- `domain/puzzle/CompletenessCheck.ts:18-47` — the gate for `export-complete` (`builder/state/internal/importExport.ts:86-107`).
- `domain/format/v1.ts:453-482` (`validateClues`) plus the structural rules — the gate for `parsePuzzle`.

They disagree:

1. **Non-head chain clue.** The parser rejects a complete file whose non-head chain word has a non-empty clue (`v1.ts:471-479`, strict). `CompletenessCheck` never checks this — it only flags *missing* head clues (`CompletenessCheck.ts:35-44`). The Builder can legitimately hold such state: importing an **incomplete** file skips clue validation entirely (`v1.ts:454-456`), and no Builder operation empties pre-existing non-head clues (`edit-clue` blocks non-head *editing*, `fillMode.ts:249-257`, but preserves imported text). Export-complete then passes the gate and writes a complete file that `parsePuzzle` refuses on re-import — in either experience.
2. **Displaced clues.** A complete file must not contain `displacedClues` (`v1.ts:621-623`). `serializeComplete` silently omits them (`v1.ts:749-765`). `CompletenessCheck` does not flag a non-empty displaced-clue list, so the export gate can pass while clue text is silently dropped from the artifact.

No test covers either path (`test/.../importExport.test.ts` has no non-head-clue or non-empty-displaced export case; `CompletenessCheck.test.ts:107` explicitly asserts only the missing-head rule).

Why architectural: "what a complete puzzle is" is a domain invariant with two owners in two modules whose consumers point in opposite directions (one validates ingoing bytes, one gates outgoing bytes). Any future rule added to one definition (e.g. marker sanity, chain validity on export) has no structural reason to reach the other.

---

## 3. Intent identity is not unique — collision is absorbed by runtime route-dispatch machinery

**Category:** identity/namespace design. **Risk:** medium-high; silent behaviour change on accidental collision; dispatch totality depends on component mounting.

`BuilderIntent` and `PlayerIntent` share eight kind strings (`select-cell`, `move-cursor`, `type-letter`, `backspace`, `escape`, `click-clue-panel-word`, `report-import-read-failure`, `report-pick-failure`). `reduceApp` therefore needs `AMBIGUOUS_INTENT_KINDS` (the computed intersection, `intentKinds.ts:73-74`), route-based disambiguation (`reducer.ts:76-86`), and `intent as unknown as BuilderIntent` double-casts at both dispatch sites (`reducer.ts:45, 57`) — the string-set membership is the only thing standing between the cast and a wrong-typed intent reaching a sub-reducer.

Three specific fragilities:

- **Accidental collisions are silent.** If a new Builder kind string happens to match a Player kind, it is absorbed into `AMBIGUOUS_INTENT_KINDS` with no error; routing flips to `state.route` with no announcement. The `satisfies Record<Kind, null>` records guarantee each *record* covers its union — nothing guards the unions against each other.
- **Dispatch totality rests on mounting topology.** An ambiguous kind dispatched on `'landing'` throws (`reducer.ts:82-85`). Today that is impossible only because the facades that emit ambiguous kinds are reachable solely from shells that are unmounted on landing. The dispatch system's correctness depends on the component tree's shape, not on anything the state layer controls.
- **Failure-reporting has two architectures for one concept.** Port-operation failures become intents — but `report-download-failure` is an `AppIntent` handled directly by `reduceApp` (`reducer.ts:31-32`), while `report-pick-failure` / `report-import-read-failure` exist *in both* experience unions and round-trip through sub-reducers to emit near-identical toasts (`importExport.ts:57-63`, `player/.../lifecycle.ts:91-103`). No criterion decides which layer a failure report belongs to; the split is the direct cause of the duplicated facade policy in #1.

This smell and #1 share a root (per-experience taxonomies for shared concepts) but are distinct mechanisms: #1 is duplicated *behaviour*, #3 is the *identity and routing* model that duplication forced into existence.

---

## 4. Chain-boundary marker semantics are scattered across six sites with no owner

**Category:** scattered domain concept. **Risk:** medium-high — the marker rules must stay consistent across six implementations for chains to render, join, serialize, and reconcile correctly.

`CellMarker` is a dumb four-flag struct (`domain/grid/CellMarker.ts`). Every *interpretation* of those flags — "what a boundary marker means on a linked word's end cell" — is re-implemented wherever it is needed:

| Site | What it re-implements |
|---|---|
| `builder/state/internal/joinSubMode.ts:26-53` | empty-pair test, space materialization, marker clear (`isBoundaryPairEmpty`, `materializeJoinMarker`, `clearBoundaryMarker`) |
| `builder/state/internal/reconcileWords.ts:228-261` | boundary-kind read + clear/set patches (`readBoundaryKind`, `clearPatch`, `setPatch`) — a second marker-patch vocabulary |
| `domain/format/v1.ts:541-571` | v1 empty-pair normalization to space — a third empty-pair test |
| `domain/anagram/Anagram.ts:84-101, 138-154` | marker → `CellSeparator` derivation, twice |
| `ui/bindings/viewmodels/gridVM.ts:38-48` | marker → `CellSeparator` derivation, a third time |
| `domain/chain/LengthPattern.ts:11-117` | marker → pattern piece interpretation, with the same space/hyphen/run logic inlined three times within one function pair |

Related split in the same concept space: chain **structural** validation (cycle/branch/dangling/self-reference) lives in `domain/chain/ChainValidation.ts`, but chain **admission** rules (source ≠ target, no existing link, target not pointed-at, target is head — FR-35/FR-42) live only in `builder/state/internal/joinSubMode.ts:110-158` and `reattachSubMode.ts:54-104`. The domain layer can tell you a chain is *invalid*; only the Builder state layer knows what makes a link *admissible*. Nothing prevents a future caller (e.g. a Player-side chain feature, an import path, a scripting API) from constructing links the Builder would refuse, because the admission rules are unreachable from where links are represented.

Also adjacent: the "marker pair" idea (space and hyphen as mutually exclusive per direction) is encoded structurally only in `CellMarker.toggle`; every other site re-derives exclusivity by checking both booleans by hand.

---

## 5. The event-fold pipeline has two owners and a redundant stage

**Category:** smeared responsibility. **Risk:** medium — pipeline invariants live in two places; the redundancy itself signals unclear ownership.

`ReducerResult` promises `(state, events) → { state, events: DomainEvent[] }`. In practice the meaning of `events` depends on who produced it:

- `reduceApp`'s `routeToBuilder`/`routeToPlayer` already fold the sub-reducer's events into `AppState` via `applyEventsToApp` and return only the *leftovers* as events (`reducer.ts:44-66`).
- The appStore then runs `applyEventsToApp` **again** on those same events (`appStore.svelte.ts:88-89`) — a guaranteed no-op pass that re-classifies external events into the leftover pile a second time.

So "who folds events into AppState" has two answers, and the store's loop contains a dead stage that exists only because the reducer's return contract is overloaded (sometimes fresh events, as with the AppIntent `report-*` toast events at `reducer.ts:31-36`; sometimes already-folded leftovers).

The same fold-adjacent duplication appears in the confirm-clearing logic: the `CONFIRMABLE_INTENT_KINDS` check + `modal: null, pendingConfirmIntent: null` reset is copy-pasted into both routing helpers (`reducer.ts:47-53` and `59-65`) — the per-experience parallelism of #1 surfacing again at the app layer.

---

## 6. The confirm-intent contract is declared twice, checked in only one direction

**Category:** duplicated contract with weak compiler tie. **Risk:** medium — a silent miss degrades modal behaviour with no error anywhere.

`ConfirmableIntent` (`domain/notifications/Event.ts:13-17`) is a hand-maintained duplicate of the `confirm-*` variants of the two intent unions (`builder/state/intents.ts:16,44,52-53`; `player/state/intents.ts:28-30`) — including payload fields (`confirm-import-puzzle { fileContent }` is spelled out in both places).

The enforcement chain is one-directional: `confirmableKindRecord` `satisfies Record<ConfirmableIntentKind, null>` (`intentKinds.ts:62-67`) proves the record covers `ConfirmableIntent`'s kinds — but nothing proves `ConfirmableIntent` is a subset of the real unions, or that payload shapes stay in sync. Add a `confirm-foo { payload }` to `BuilderIntent` and forget `Event.ts`: `CONFIRMABLE_INTENT_KINDS` silently lacks it, so `reduceApp` stops clearing `modal`/`pendingConfirmIntent` after Confirm (the modal closes only via the next `cancel-modal`), and `pendingConfirmIntent`'s payload type never sees the new field. No test, type, or lint rule notices.

The whole modal pipeline (state field → event → kind-set membership → facade confirm → re-dispatch) hangs on string-set membership agreements across three layers, of which exactly one is compiler-checked.

---

## 7. Port consumers do not trust the port contract — defensive catches contradict it

**Category:** contract trust / boundary responsibility blur. **Risk:** medium — the failure-policy boundary is ambiguous, and the doc's stated contract is false in the field.

`architecture.md` §3 Layer 4 states the port contract plainly: never-throw adapters; "Consumers add no redundant catch layers — callers check returns, they do not catch." The implementations honour it (`localStoragePort.ts` catches and coerces everything; `filePickPort.ts` resolves failures as data).

The consumers do not believe it:

- `main.ts:46-51` — try/catch around `ports.storage.loadBuilder()`, with its own warn-and-fallback policy.
- `appStore.svelte.ts:132-138` — try/catch around `ports.storage.loadPlayerProgress(key)`, with its own warn policy.
- `persistenceCodec.ts` — broad try/catch in both parsers, with `console.warn`-per-branch inside (a third warn-once/always policy idiom, distinct from the appStore's latch policy and the port's own warns).

Two readings, both smell-worthy: either the contract is not believed (then it should be made compiler-checkable or the consumers cleaned up), or the contract is believed but not *legible* (then the real boundary of "who reports storage failures, how often, at what volume" is smeared across port, codec, appStore, and main.ts in four different policies). Note the port already warns on read failures itself (`localStoragePort.ts` warn in catch), so a read failure on the boot path can produce two warns by two layers.

The same defensive-layering instinct appears elsewhere in the persistence chain, uncoordinated: the precondition "player in import phase ⇒ nothing to save" is enforced independently in **three** places — `persistenceScheduler.ts:62` (`schedulePlayerSave` early-return), `persistenceScheduler.ts:40` (`doSavePlayer` early-return), and `persistenceCodec.ts:85` (`serializePlayerProgress` returns null) — each layer defending against the other two being wrong.

---

## 8. Persistence lifecycle is incomplete: `flush()` is dead, and the boot-time data-loss window is unwired

**Category:** unfinished mechanism / lifecycle gap. **Risk:** medium — silent loss of the last ≤400 ms of work; doc describes a mechanism that does not exist.

- `PersistenceScheduler.flush()` (`persistenceScheduler.ts:94-113`, interface at `:19`) is called **nowhere in `src/`** — only in its own tests. `architecture.md` describes it as "used by boot/teardown" (§3 Layer 2 table) and §8 discusses flush results — but no teardown exists. There is no `beforeunload`/`pagehide` flush anywhere, so any debounced-but-unfired save (up to the 400 ms debounce) is silently dropped when the tab closes or navigates. The mechanism was built and tested; the wiring was never done.
- Restore-side invariants are enforced twice, in two layers, by hand: `subMode` forced to `'none'` on **save** (`persistenceCodec.ts:32-34`) and again on **load** (`main.ts:69`); cursor omitted on save and re-nulled on load (`main.ts:70`). Each pair is a belt-and-braces duplication of the same invariant across the seam.
- `main.ts:65-71` reconstructs `BuilderState` field-by-field — knowledge of the BuilderState shape (and its reload rules) living outside the module that owns the type, in the one file with no lint boundary of its own.
- `persistenceCodec.ts` is the **only** source module without a mirrored test file under `test/` (compare the full tree; `architecture.md` §12 claims "one test file per source module under `test/` mirroring `src/`"). Its two parsers are non-trivial validators of user-persisted bytes.

---

## 9. The persistence blob couples two formats through JSON string round-trips

**Category:** seam friction between formats. **Risk:** low-medium — correctness fine today, but the shape of the seam guarantees waste and blocks structured evolution.

The builder snapshot embeds a domain-format artifact as a nested object, while the domain format API is string-in/string-out. The result is a round-trip on every path:

- Save: `serializeIncomplete` → JSON **string** → `JSON.parse` back to an object → embed → `JSON.stringify` wrapper (`persistenceCodec.ts:23-36`).
- Load: `JSON.parse` wrapper → `JSON.stringify` the embedded object → `parsePuzzle`, which `JSON.parse`s it again (`persistenceCodec.ts:38-57`, `v1.ts:579-583`).

Every autosave serializes the puzzle twice and parses it once more than necessary; every boot parses the snapshot twice. The deeper issue is structural: the two persistence representations (file format and localStorage blob) share no common structured form, so they can only interoperate by re-encoding through the string boundary. A future format change (e.g. the anticipated v3 in `future_considerations.md`) must keep the embed/extract round-trip coherent or corrupt every stored snapshot.

---

## 10. Word-membership and white-run semantics are implemented four ways

**Category:** concept spread within the domain. **Risk:** low-medium at current scale; consistency is by convention.

"Which white cells form a word / is this cell part of a word" is derived independently by:

1. `GridOps.isSelectable` — inline left/right/up/down run scans (`GridOps.ts:129-177`).
2. `WordDerivation.derive` — maximal-run scan with its own white-run loop (`WordDerivation.ts:15-64`).
3. `partOfAcross`/`partOfDown` neighbour checks — duplicated in *both* state trees (see #1).
4. `WordSelection.findContainingWord` — start-cell + length bounds arithmetic (`WordSelection.ts:7-22`), a fifth encoding of the same geometry (`ChainCells.cellsOfWord`, `LengthPattern`, `Anagram.buildWordModel` each walk word coordinates again with their own advance loops).

These must agree for selection, derivation, highlighting, and clue-affordances to be mutually consistent. They agree today by convention and testing, not by construction.

---

## 11. Traceability rot: live code cites an archived requirements vocabulary

**Category:** documentation-set coherence. **Risk:** low for behaviour, real for onboarding and future audits.

The active doc set is `architecture.md` + `future_considerations.md` ("This document is self-contained"). But the code is saturated with requirement IDs whose defining documents now live only in `llmworkspace/archive/`:

- `FR-*` / `NFR-*` / `C6` / `B5` / `H3` / `H1` / `G7` / `P3` / `W1` / `P4` / `AD §1.1 B3` appear across `main.ts`, `intents.ts` (both), `fillMode.ts`, `joinSubMode.ts`, `reattachSubMode.ts`, `lifecycle.ts` (both), `anagram.ts`, `importExport.ts`, `eslint.config.js`, and more — dozens of sites.
- Two comments point at llmworkspace files that no longer exist at those paths: `main.ts:86` → `llmworkspace/code_smells.md`; `domain/rng/Rng.ts:1-3` → `llmworkspace/design_review_notes.md` (both archived).
- `eslint.config.js:398` anchors on a line number (`src/main.ts:84`) that has drifted (the assertion is now at line 87).

An auditor (or a future maintainer, or an LLM agent — this repo's doc set is clearly written for all three) cannot resolve any of these references without the archive the project told them to ignore. Scaffolding leftovers (`.gitkeep` in `app/state`, `builder/state`, `domain`, `player/state`, `ports`, `ui/bindings`) are the same rot in miniature.

---

## 12. Boundary enforcement config is triplicated and slightly overclaims

**Category:** enforcement maintainability. **Risk:** low — but every new branded type or layer edit touches a hand-synced config.

`eslint.config.js` (406 lines) encodes each boundary as per-glob regex blocks. Two structural costs:

- The 15-file brand-owner allow-list exists **twice** (the `ignores` of the domain block at `:19-35` and the `files` of the owner block at `:76-92`) and must also stay in sync with the list in `architecture.md` §4. The brand-ban regex is repeated verbatim in eight blocks. Adding branded type #16 is a three-site edit (plus the doc) with no cross-check.
- `architecture.md` §4's table claims `domain/**` is blocked from "DOM globals" — no rule does this. Only *imports* are restricted; `window`/`document` references in domain code would pass lint and types. The boundary is real where tested (`test/boundary/imports.test.ts` covers import edges) and aspirational where not.

---

## 13. The VM contract erodes at the leaf edges

**Category:** contract drift, small instances. **Risk:** low individually; each instance is a precedent.

The stated contract (§9): components receive leaf-shaped VMs and invoke bags; "a component contains no business logic: … no domain-value computation." Edge cases where the contract bends:

- `BuilderCluePanel.svelte:17-19` and `PlayerCluePanel.svelte:11-13` each hand-roll `canonicalId` — a re-implementation of `WordKey.toCanonical` — because components may import domain *types* but not *values*, and the VM does not carry a stable row id. The layer rule pushed a trivial derivation into copy-paste in two components.
- `AnagramModal.svelte` `onInput` re-implements input sanitisation (A–Z filter, uppercase, clamp to word length) that the reducer performs authoritatively (`player/state/internal/anagram.ts:33-58`) — the FR-83 rule lives in both layers.
- `BuilderShell.svelte:17-23,54-55` reads raw state via `builderFacade.getBuilderState()` for control flow (design/fill mode, typing-surface enablement) even though mode is already in `BuilderToolbarVM` — the facade state getters offer a documented but contract-eroding bypass of the VM layer.
- `playerVM.ts:75-103` fabricates placeholder VMs (fake 2×2 grid, empty panels) for the import phase so `PlayerShellVM` stays one uniform type; module-level constants derived by calling `deriveGridVM`/`deriveAnagramModalVM` at import time bend §3's "nothing runs at import time" (harmlessly, but the stated invariant is now false as written).
- `App.svelte:41-46` hosts the autosave `$effect`s — the one piece of orchestration logic living in the component layer rather than the bindings seam (documented as an exception in §6, but it is a standing exception to "the UI layer is as thin as possible").

---

## 14. VM derivation is a full recompute per dispatch, with no memoization seam

**Category:** derivation architecture. **Risk:** low today — bounded by the 25×25 grid maximum and explicitly accepted by `future_considerations.md` ("scale is not a concern"). Recorded because it is structural, not incidental.

Each shell mounts a single `$derived` over its whole VM tree (`BuilderShell.svelte:13`, `PlayerShell.svelte:14`), so every state change — each keystroke — recomputes the entire derivation chain, with no caching layer anywhere between state and VM:

- `deriveBuilderToolbarVM` runs `CompletenessCheck.check` on every reactive update (`builderVM.ts:60`) — a full grid scan plus a per-word `Chain.isHead` linear scan (`CompletenessCheck.ts:21-44`), on every letter typed.
- `deriveCluePanelVM` rebuilds `WordMap.fromWords`, then per word runs `DisplayClue.forWord` (another linear `isHead` scan) and `LengthPattern.forWord` (a chain walk with per-cell `GridOps.cellAt`) (`cluePanelVM.ts:44-103`).
- `deriveGridVM` calls `GridOps.isSelectable` per white cell — each an independent run scan (`gridVM.ts:111`).
- `WordMap.fromWords` is rebuilt at least three times per Player keystroke (banner `playerVM.ts:119`, anagram VM `anagramVM.ts:60`, clue panel `cluePanelVM.ts:44`), and again inside several reducers (`solving.ts:67` per cursor change, `fillMode.ts:248`).

At 25×25 this is milliseconds and the doc accepts it. The structural point: the bindings layer has no seam where derivation cost could be bounded independently of dispatch frequency, so any future feature that multiplies per-cell or per-word derivation work (overlays, chain visualizations, search) inherits full-tree recompute on every keystroke by default.

---

## Verified sound (checked, not smells)

To keep future work calibrated, the following were examined and found as the doc claims:

- **CI legs executed green at audit time** — `npm run test` (80 files / 1154 tests) and `npm run lint` (eslint + madge, no cycles).
- **Layer boundaries hold.** No forbidden import exists in `src/`; the ESLint per-glob rules are real and the adversarial self-test (`test/boundary/imports.test.ts`, read in full) does drive the Linter API over fixtures with `filename` set so the per-glob rules apply, with negative controls.
- **Reducers are pure.** No side effects, no mutation of inputs, `deps` injection as described; the work-queue dispatch loop correctly prevents reentrant recursion (`appStore.svelte.ts:76-102`).
- **No module-level mutable state** anywhere in the store/facade/scheduler chain; multi-instance construction works as §6 claims.
- **Port implementations** are stateless and genuinely never-throw (the trust gap in #7 is on the consumer side, not the impl side).
- **Test mirror discipline** is near-complete (77 test files; the single lapse is #8's `persistenceCodec.ts`).
- **`reconcileWords`** matches its documented contract, including the post-hoc invariant throw; its edge-case suite is thorough.
- **Brand discipline**: `brand.ts` is imported only by the 15 owner modules + tests; no escaper leaks.

---

## Appendix A — architecture.md vs code, itemized

Recorded per the doc's own "code wins" rule; each row is either a doc-accuracy fix or, where noted, evidence for a ranked smell above.

| # | architecture.md claim | Code reality | Feeds smell |
|---|---|---|---|
| A1 | §2: "a small `clone` helper handles the few deep structures (grid)" | `GridOps.clone` is called nowhere; grid updates use structural-sharing `setCell`/`updateCells` | #9-adjacent (dead surface) |
| A2 | §3 Layer 4: "Consumers add no redundant catch layers — callers check returns, they do not catch" | `main.ts:46-51`, `appStore.svelte.ts:132-138` catch port calls | #7 |
| A3 | §3 Layer 2 table + §8: scheduler `flush()` "used by boot/teardown" | No caller in `src/`; no unload handler exists | #8 |
| A4 | §12: "One test file per source module under `test/` mirroring `src/` layout" | `persistenceCodec.ts` has none | #8 |
| A5 | §4: `domain/**` blocked from "DOM globals" | Only import restrictions exist; no global-usage rule | #12 |
| A6 | §7: "`unjoin` clears `source.nextWord` and its chain-boundary marker pair" | `joinSubMode.ts:97-101` also clears the downstream word's clue (a no-op under invariants, but undocumented) | — |
| A7 | §3 Layer 2: "no file holds module-level mutable state, nothing runs at import time" | `playerVM.ts:75-103` runs derivation functions at import time to build placeholder constants (immutable, benign) | #13 |
| A8 | §11 inventory: "`BuilderGrid` … uses `TypingSurface`" | `TypingSurface` is mounted by `BuilderShell.svelte:55`, a sibling of `BuilderGrid`, which receives an `onCellClick` callback | — |
| A9 | §3/§4: `CellIndex` is one of the 15 branded-type owner modules | `CellIndex` is imported by nothing in `src/` (only its own test); a phantom concept | #9-adjacent |
| A10 | §4 self-description: doc is "a map for navigating the codebase" | Code comments navigate to archived files (`main.ts:86`, `Rng.ts:1-3`) and drifted line anchors (`eslint.config.js:398`) | #11 |
| A11 | §4: the self-test "asserts each forbidden import — static or dynamic `import()` — triggers a `no-restricted-imports` error" | The suite contains exactly one dynamic-import fixture (bindings-from-leaf, `imports.test.ts:229-233`); the domain/state/ports edges are fixture-tested statically only | #12-adjacent |

Dead/unused public API found during the audit (all exported, all uncalled outside their own module or tests): `GridOps.clone/equals/neighbours/neighboursInDirection`, `Direction.opposite/isAcross`, `Anagram.validateInput` (only `validateChainInput` is used) and public `buildWordModel` (used only internally by `buildChainModel`), `WordLength.equals`, `EpochMs.try`, `DurationMs.try`, `LengthPattern.forActiveClueBanner`, `DisplacedClue.withText`, `CellIndex` (entire module). This is speculative surface on the domain layer — each member is a small standing tax on the "explicit types" principle, because every one of them looks load-bearing to a reader and none is.

---

*Reviewed 2026-10-11 against `src/` @ current HEAD, `architecture.md`, `future_considerations.md`, `eslint.config.js`, config files, and the `test/` tree. Verification executed: `npm run test` (80 files / 1154 tests, green) and `npm run lint` (eslint + madge, green). `llmworkspace/archive/` excluded per scope — see the audit completeness statement for everything else this audit did not cover.*
