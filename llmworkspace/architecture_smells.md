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

**Status (2026-10-11): addressed** — resolution in `architecture_smell_resolutions.md`.

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

**Status (2026-10-12): addressed** — resolution in `architecture_smell_resolutions.md`. (The audit's framing of divergence 2 as drift was corrected during resolution: displaced-clue omission from complete files is specified behaviour — FR-59/FR-63 in the archived requirements — not an accident; the fix de-silences it instead of blocking it.)

---

## 3. Intent identity is not unique — collision is absorbed by runtime route-dispatch machinery

**Category:** identity/namespace design. **Risk:** medium-high; silent behaviour change on accidental collision; dispatch totality depends on component mounting.

`BuilderIntent` and `PlayerIntent` share eight kind strings (`select-cell`, `move-cursor`, `type-letter`, `backspace`, `escape`, `click-clue-panel-word`, `report-import-read-failure`, `report-pick-failure`). `reduceApp` therefore needs `AMBIGUOUS_INTENT_KINDS` (the computed intersection, `intentKinds.ts:73-74`), route-based disambiguation (`reducer.ts:76-86`), and `intent as unknown as BuilderIntent` double-casts at both dispatch sites (`reducer.ts:45, 57`) — the string-set membership is the only thing standing between the cast and a wrong-typed intent reaching a sub-reducer.

Three specific fragilities:

- **Accidental collisions are silent.** If a new Builder kind string happens to match a Player kind, it is absorbed into `AMBIGUOUS_INTENT_KINDS` with no error; routing flips to `state.route` with no announcement. The `satisfies Record<Kind, null>` records guarantee each *record* covers its union — nothing guards the unions against each other.
- **Dispatch totality rests on mounting topology.** An ambiguous kind dispatched on `'landing'` throws (`reducer.ts:82-85`). Today that is impossible only because the facades that emit ambiguous kinds are reachable solely from shells that are unmounted on landing. The dispatch system's correctness depends on the component tree's shape, not on anything the state layer controls.
- **Failure-reporting has two architectures for one concept.** Port-operation failures become intents — but `report-download-failure` is an `AppIntent` handled directly by `reduceApp` (`reducer.ts:31-32`), while `report-pick-failure` / `report-import-read-failure` exist *in both* experience unions and round-trip through sub-reducers to emit near-identical toasts (`importExport.ts:57-63`, `player/.../lifecycle.ts:91-103`). No criterion decides which layer a failure report belongs to; the split is the direct cause of the duplicated facade policy in #1.

This smell and #1 share a root (per-experience taxonomies for shared concepts) but are distinct mechanisms: #1 is duplicated *behaviour*, #3 is the *identity and routing* model that duplication forced into existence.

**Note (2026-10-11, from the #1 fix):** deduplicating the twin failure-message constants (`IMPORT_READ_FAILURE_MSG` / `PICK_FAILURE_MSG`, the #1 table's last row) was proposed and deliberately deferred to this smell — the constants are a leaf symptom of the `report-*` twin architecture described above, so fixing them here should ride along with the routing/identity decision, not precede it.

**Status (2026-10-12): addressed** — resolution in `architecture_smell_resolutions.md`.

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

**Status (2026-10-13): addressed** — resolution in `architecture_smell_resolutions.md`.

---

## 5. The event-fold pipeline has two owners and a redundant stage

**Category:** smeared responsibility. **Risk:** medium — pipeline invariants live in two places; the redundancy itself signals unclear ownership.

`ReducerResult` promises `(state, events) → { state, events: DomainEvent[] }`. In practice the meaning of `events` depends on who produced it:

- `reduceApp`'s `routeToBuilder`/`routeToPlayer` already fold the sub-reducer's events into `AppState` via `applyEventsToApp` and return only the *leftovers* as events (`reducer.ts:44-66`).
- The appStore then runs `applyEventsToApp` **again** on those same events (`appStore.svelte.ts:88-89`) — a guaranteed no-op pass that re-classifies external events into the leftover pile a second time.

So "who folds events into AppState" has two answers, and the store's loop contains a dead stage that exists only because the reducer's return contract is overloaded (sometimes fresh events, as with the AppIntent `report-*` toast events at `reducer.ts:31-36`; sometimes already-folded leftovers).

The same fold-adjacent duplication appears in the confirm-clearing logic: the `CONFIRMABLE_INTENT_KINDS` check + `modal: null, pendingConfirmIntent: null` reset is copy-pasted into both routing helpers (`reducer.ts:47-53` and `59-65`) — the per-experience parallelism of #1 surfacing again at the app layer.

**Status (2026-10-13): addressed** — resolution in `architecture_smell_resolutions.md`.

---

## 6. The confirm-intent contract is declared twice, checked in only one direction

**Category:** duplicated contract with weak compiler tie. **Risk:** medium — a silent miss degrades modal behaviour with no error anywhere.

`ConfirmableIntent` (`domain/notifications/Event.ts:13-17`) is a hand-maintained duplicate of the `confirm-*` variants of the two intent unions (`builder/state/intents.ts:16,44,52-53`; `player/state/intents.ts:28-30`) — including payload fields (`confirm-import-puzzle { fileContent }` is spelled out in both places).

The enforcement chain is one-directional: `confirmableKindRecord` `satisfies Record<ConfirmableIntentKind, null>` (`intentKinds.ts:62-67`) proves the record covers `ConfirmableIntent`'s kinds — but nothing proves `ConfirmableIntent` is a subset of the real unions, or that payload shapes stay in sync. Add a `confirm-foo { payload }` to `BuilderIntent` and forget `Event.ts`: `CONFIRMABLE_INTENT_KINDS` silently lacks it, so `reduceApp` stops clearing `modal`/`pendingConfirmIntent` after Confirm (the modal closes only via the next `cancel-modal`), and `pendingConfirmIntent`'s payload type never sees the new field. No test, type, or lint rule notices.

The whole modal pipeline (state field → event → kind-set membership → facade confirm → re-dispatch) hangs on string-set membership agreements across three layers, of which exactly one is compiler-checked.

**Status (2026-10-14): addressed** — resolution in `architecture_smell_resolutions.md`. The runtime kind set was deleted and modal lifecycle moved to the bindings layer's dispatch loop; the chain now runs state field → event → facade confirm → re-dispatch, all four layers structurally checked.

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

**Status (2026-10-14): addressed** — resolution in `architecture_smell_resolutions.md`. The fix moves the storage-read failure channel into the type (`LoadResult<T>`), drops every consumer-side try/catch and per-branch `console.warn` around port reads and parse calls, and collapses the `phase !== 'solving'` invariant to its single owner (`serializePlayerProgress`).

---

## 8. Persistence lifecycle is incomplete: `flush()` is dead, and the boot-time data-loss window is unwired

**Category:** unfinished mechanism / lifecycle gap. **Risk:** medium — silent loss of the last ≤400 ms of work; doc describes a mechanism that does not exist.

- `PersistenceScheduler.flush()` (`persistenceScheduler.ts:94-113`, interface at `:19`) is called **nowhere in `src/`** — only in its own tests. `architecture.md` describes it as "used by boot/teardown" (§3 Layer 2 table) and §8 discusses flush results — but no teardown exists. There is no `beforeunload`/`pagehide` flush anywhere, so any debounced-but-unfired save (up to the 400 ms debounce) is silently dropped when the tab closes or navigates. The mechanism was built and tested; the wiring was never done.
- Restore-side invariants are enforced twice, in two layers, by hand: `subMode` forced to `'none'` on **save** (`persistenceCodec.ts:32-34`) and again on **load** (`main.ts:69`); cursor omitted on save and re-nulled on load (`main.ts:70`). Each pair is a belt-and-braces duplication of the same invariant across the seam.
- `main.ts:65-71` reconstructs `BuilderState` field-by-field — knowledge of the BuilderState shape (and its reload rules) living outside the module that owns the type, in the one file with no lint boundary of its own.
- *(Audit correction, 2026-10-14.)* The fourth audit item — "`persistenceCodec.ts` is the only source module without a mirrored test file" — is stale at HEAD: `test/ui/bindings/persistenceCodec.test.ts` exists and covers both `parseBuilderSnapshot` and `parsePlayerProgress`. The other three items still stand and are addressed by the resolution.

**Status (2026-10-14): addressed** — resolution in `architecture_smell_resolutions.md`. The fix wires `flush()` into a `pagehide` listener (via `installTeardown(store)` in `ui/bindings/teardown.ts`, called once by `main.ts`), moves the `BuilderState` boot path into a new `createInitialAppState(ports, deps)` in `ui/bindings/boot.ts` (sole owner of the `BuilderState` reload shape), drops the duplicated `subMode: 'none'` / cursor-omission enforcement from the persistence wrapper (the wire blob no longer carries the field, so it has no place to drift), and gives `main.ts` no domain knowledge at all.

---

## 9. The persistence blob couples two formats through JSON string round-trips

**Category:** seam friction between formats. **Risk:** low-medium — correctness fine today, but the shape of the seam guarantees waste and blocks structured evolution.

The builder snapshot embeds a domain-format artifact as a nested object, while the domain format API is string-in/string-out. The result is a round-trip on every path:

- Save: `serializeIncomplete` → JSON **string** → `JSON.parse` back to an object → embed → `JSON.stringify` wrapper (`persistenceCodec.ts:23-36`).
- Load: `JSON.parse` wrapper → `JSON.stringify` the embedded object → `parsePuzzle`, which `JSON.parse`s it again (`persistenceCodec.ts:38-57`, `v1.ts:579-583`).

Every autosave serializes the puzzle twice and parses it once more than necessary; every boot parses the snapshot twice. The deeper issue is structural: the two persistence representations (file format and localStorage blob) share no common structured form, so they can only interoperate by re-encoding through the string boundary. A future format change (e.g. the anticipated v3 in `future_considerations.md`) must keep the embed/extract round-trip coherent or corrupt every stored snapshot.

*(Audit correction, 2026-10-18.)* The line citations in the bullet above (`persistenceCodec.ts:23-36` / `:38-57` and `v1.ts:579-583`) are stale after the resolution: `persistenceCodec.ts` was rewritten to use the structural format layer directly, and the structural body of `parsePuzzle` is now in `v1Json.ts` (the structural layer in `v1.ts` exposes `parsePuzzleShape(parsed: unknown)` instead). The smell's *substantive* points — the wasted round-trip, the lack of a shared structured form — are addressed by the resolution; see below.

**Status (2026-10-18): addressed** — resolution in `architecture_smell_resolutions.md`. The fix splits `domain/format/` into a structural layer (`v1.ts` — `parsePuzzleShape`, `serializeIncompleteShape`, `serializeCompleteShape`; no `JSON.parse`/`JSON.stringify`) and a JSON-I/O adapter (`v1Json.ts` — the original string functions plus `Filename`, each delegating to the structural layer). `persistenceCodec.ts` now uses the structural layer directly: the round-trip on save (`serializeIncomplete` → `JSON.parse`) and on load (`JSON.stringify` → `parsePuzzle`) is deleted. File import/export and player lifecycle keep the string API (their I/O is string-shaped by the browser); the file format and the `localStorage` blob format share one structural form by construction. Wire JSON is byte-identical before and after.

---

## 10. Word-membership and white-run semantics are implemented four ways

**Category:** concept spread within the domain. **Risk:** low-medium at current scale; consistency is by convention.

"Which white cells form a word / is this cell part of a word" is derived independently by:

1. `GridOps.isSelectable` — inline left/right/up/down run scans (`GridOps.ts:129-177`).
2. `WordDerivation.derive` — maximal-run scan with its own white-run loop (`WordDerivation.ts:15-64`).
3. `partOfAcross`/`partOfDown` neighbour checks — duplicated in *both* state trees (see #1).
4. `WordSelection.findContainingWord` — start-cell + length bounds arithmetic (`WordSelection.ts:7-22`), a fifth encoding of the same geometry (`ChainCells.cellsOfWord`, `LengthPattern`, `Anagram.buildWordModel` each walk word coordinates again with their own advance loops).

These must agree for selection, derivation, highlighting, and clue-affordances to be mutually consistent. They agree today by convention and testing, not by construction.

*(Audit correction, 2026-10-18.)* The line citations in the bullets above are stale after the resolution, and one of the four items was re-scoped: `GridOps.isSelectable` no longer scans runs inline — it delegates to `WordTopology.partOfRun`; `WordDerivation.derive` no longer owns a white-run loop — it is expressed over `WordTopology.runs`; the `partOfAcross`/`partOfDown`/`hasWhiteNeighbour` checks were already collapsed into `GridInteraction` by #1, and that module now calls `WordTopology.partOfRun` as well. The three word-walking sites named in item 4 (`ChainCells.cellsOfWord`, `LengthPattern.separatorAt`, `Anagram.buildWordModel`) now share one iterator, `WordGeometry.cells`. Item 4's own site, `WordSelection.findContainingWord`, was left unchanged by the original resolution and closed by a follow-up on 2026-10-24 — see the resolution's post-resolution follow-up.

**Status (2026-10-18): addressed** — resolution in `architecture_smell_resolutions.md`. Grid-level white-run semantics now have one owner: the new `WordTopology` (`runs` + `partOfRun`), which depends only on the new `GridAccess` raw-indexing leaf; `GridOps.isSelectable`, `WordDerivation.derive`, and `GridInteraction.select` all delegate to it, so the three grid-level encodings can no longer drift apart. Word-coordinate walking likewise has one owner: the new `WordGeometry` (`cells`, `contains`, `lastCell`), consumed by `ChainCells`, `LengthPattern`, the `Anagram` word/chain builders, and `WordSelection`. The one leftover the original resolution deferred — `WordSelection.findContainingWord`'s hand-rolled start-cell + length arithmetic — was closed by a follow-up on 2026-10-24: the per-word "does this word cover this cell" test now lives in `WordGeometry.contains` (the list search and the cursor-direction filter stay in `WordSelection`), and `Anagram.buildChainModel`'s last-cell lookup goes through `WordGeometry.lastCell` instead of `Direction.advance`. The resolution also records the process lesson: the first implementation pass folded the run-discovery primitives into `GridOps` to break an import cycle, and that absorption was reverted in favour of extracting the `GridAccess` leaf.

---

## 11. Traceability rot: live code cites an archived requirements vocabulary

**Category:** documentation-set coherence. **Risk:** low for behaviour, real for onboarding and future audits.

The active doc set is `architecture.md` + `future_considerations.md` ("This document is self-contained"). But the code is saturated with requirement IDs whose defining documents now live only in `llmworkspace/archive/`:

- `FR-*` / `NFR-*` / `C6` / `B5` / `H3` / `H1` / `G7` / `P3` / `W1` / `P4` / `AD §1.1 B3` appear across `main.ts`, `intents.ts` (both), `fillMode.ts`, `joinSubMode.ts`, `reattachSubMode.ts`, `lifecycle.ts` (both), `anagram.ts`, `importExport.ts`, `eslint.config.js`, and more — dozens of sites.
- Two comments point at llmworkspace files that no longer exist at those paths: `main.ts:86` → `llmworkspace/code_smells.md`; `domain/rng/Rng.ts:1-3` → `llmworkspace/design_review_notes.md` (both archived).
- `eslint.config.js:398` anchors on a line number (`src/main.ts:84`) that has drifted (the assertion is now at line 87).

An auditor (or a future maintainer, or an LLM agent — this repo's doc set is clearly written for all three) cannot resolve any of these references without the archive the project told them to ignore. Scaffolding leftovers (`.gitkeep` in `app/state`, `builder/state`, `domain`, `player/state`, `ports`, `ui/bindings`) are the same rot in miniature.

*(Audit correction, 2026-10-24.)* The bullet above understates and mis-describes the finding in three ways, and omits one category outright. The verified inventory at resolution time:

- **Scale.** 122 occurrences of retired requirement identifiers, not "dozens": 25 in `src/`, 97 in `test/`, across 36 distinct identifiers (`FR-9`…`FR-99`, `NFR-9`). 89 of the 97 test-side occurrences sit inside `it(...)` titles, so the vocabulary was woven into the test suite's naming, not only into comments.
- **Two retired vocabularies, not one.** The requirement identifiers (`FR-*` / `NFR-*`) are one; the archived code-smell log's identifiers (`P1`–`P4`, `G7`, `W1`, `F6`, `H1`, `H3`, `H4`, `C5`, `C6`, `B5`) are a second, with 13 further sites. The audit listed a few of the second vocabulary's tokens inline with the first, as though they were one space.
- **A third category, missed entirely: position and section anchors.** Sixteen sites cite a *position* rather than a concept — `§830`, `§908` (×8), `§4.5`, `§7.2`, `§4.1`, `§6.1`, `§6.2`, `§8.9a` (section numbers in the archived design document) and `architecture.md §187` (a line number in a live document that no longer has one). This is the same rot as the identifiers, and the one that had already produced a wrong claim inside this very document: the audit asserted the `eslint.config.js` anchor had drifted to line 87; by resolution time the referenced assertion had moved again, to line 30.
- **The vocabulary had leaked into product output.** Two identifiers appeared inside *user-visible* strings — the `edit-clue` rejection toast and `ChainAdmission`'s `target-non-head` message both ended "(FR-31)" — and a third inside a `console.warn`. The audit read them as comments.

The audit's own file list is also stale: it named `lifecycle.ts` (both), `anagram.ts` and `importExport.ts` as citation sites, none of which carries a retired identifier at resolution time.

**Status (2026-10-24): addressed** — resolution in `architecture_smell_resolutions.md`. The requirement identifier space is retired (the project has no specification layer; behavioural rules live in the code that implements them), the second vocabulary is retired with it, every position and section anchor is re-homed to a live named section or dropped, and `architecture.md` §14 now states the doc-set and citation rules as a convention.

---

## 12. Boundary enforcement config is triplicated and slightly overclaims

**Category:** enforcement maintainability. **Risk:** low — but every new branded type or layer edit touches a hand-synced config.

`eslint.config.js` (406 lines) encodes each boundary as per-glob regex blocks. Two structural costs:

- The 15-file brand-owner allow-list exists **twice** (the `ignores` of the domain block at `:19-35` and the `files` of the owner block at `:76-92`) and must also stay in sync with the list in `architecture.md` §4. The brand-ban regex is repeated verbatim in eight blocks. Adding branded type #16 is a three-site edit (plus the doc) with no cross-check.
- `architecture.md` §4's table claims `domain/**` is blocked from "DOM globals" — no rule does this. Only *imports* are restricted; `window`/`document` references in domain code would pass lint and types. The boundary is real where tested (`test/boundary/imports.test.ts` covers import edges) and aspirational where not.

**Status (2026-10-24): addressed** — resolution in `architecture_smell_resolutions.md`.

---

## 13. The VM contract erodes at the leaf edges

**Category:** contract drift, small instances. **Risk:** low individually; each instance is a precedent.

The stated contract (§9): components receive leaf-shaped VMs and invoke bags; "a component contains no business logic: … no domain-value computation." Edge cases where the contract bends:

- `BuilderCluePanel.svelte:17-19` and `PlayerCluePanel.svelte:11-13` each hand-roll `canonicalId` — a re-implementation of `WordKey.toCanonical` — because components may import domain *types* but not *values*, and the VM does not carry a stable row id. The layer rule pushed a trivial derivation into copy-paste in two components.
- `AnagramModal.svelte` `onInput` re-implements input sanitisation (A–Z filter, uppercase, clamp to word length) that the reducer performs authoritatively (`player/state/internal/anagram.ts:33-58`) — the FR-83 rule lives in both layers.
- `BuilderShell.svelte:17-23,54-55` reads raw state via `builderFacade.getBuilderState()` for control flow (design/fill mode, typing-surface enablement) even though mode is already in `BuilderToolbarVM` — the facade state getters offer a documented but contract-eroding bypass of the VM layer.
- `playerVM.ts:75-103` fabricates placeholder VMs (fake 2×2 grid, empty panels) for the import phase so `PlayerShellVM` stays one uniform type; module-level constants derived by calling `deriveGridVM`/`deriveAnagramModalVM` at import time bend §3's "nothing runs at import time" (harmlessly, but the stated invariant is now false as written).
- `App.svelte:41-46` hosts the autosave `$effect`s — the one piece of orchestration logic living in the component layer rather than the bindings seam (documented as an exception in §6, but it is a standing exception to "the UI layer is as thin as possible").

**Note (2026-10-24, from the #12 resolution):** the boundary-enforcement work does not address this finding. Its instances are intra-layer contract erosion, which import-level rules cannot detect; the new rules add coverage the old configuration lacked (path-resolved allowlists, dynamic `import()`, DOM globals, unlayered-file detection), and none of that overlaps these instances. No instance below was fixed by that work. The adjacent item fixed there — the Builder facade's throwing grid-size constructor — is not one of these instances.

Deferred, with the approach already chosen; each stays open until its instance is closed:

- `BuilderShell.svelte` reading raw state through the facade: delete the facade's raw-state getters, read mode from the toolbar VM, and assert through the store in tests.
- Two canonical word-key encodings (`WordKey.toCanonical` in the domain, `canonicalWordKeyId` in the shared UI helper): carry a plain `id` on each clue entry in the VM and delete the UI-side helper.
- `AnagramModal.svelte` re-implementing the reducer's input sanitisation: dispatch raw input and display the reducer-sanitised value.
- `playerVM.ts` deriving import-phase placeholder view-models at module load: make the player shell view-model phase-discriminated so the placeholders cannot exist.
- `App.svelte` hosting the autosave effects: move autosave into the store, driven by dispatch (accepted behaviour change: no snapshot write on mount).

`architecture.md` §3 now states the module-load exception explicitly instead of claiming otherwise; the code change stays deferred.

### Supplementary findings (added 2026-10-24, at implementation start)

Added when work on this finding began. The five instances above are the audit's. The entries below were found while planning the implementation, by re-reading every component under `src/ui`, both shared helpers, every view-model module and every facade module against the component contract in `architecture.md` §9. They are **additional instances of the same class** — contract erosion at the leaf edges — recorded here rather than folded into the audit's text above. Where the audit's text has drifted from the code, the correction is noted in the relevant entry.

- **S6 — the letter rule has three owners, one of them a component.** `ui/shared/TypingSurface.svelte` filters characters with its own `isLetter` test and uppercases them before dispatch; `ui/bindings/gridActions.ts` re-validates the same characters through `Letter.try`; the domain owns the rule in `domain/letter/Letter.ts`. Partial instance: the character-class test is input-edge work — it decides whether the keystroke is a letter the surface should consume — but the uppercasing is a duplicated rule. Landing approach: the component dispatches the raw character; validation and casing belong to the facade/domain owner.

- **S7 — view-models carry domain branded types, so components unwrap them.** `architecture.md` §9 describes view-models as plain, leaf-shaped, serializable values, but `GridVM` and `GridCellVM` (`ui/bindings/viewmodels/gridVM.ts`) carry `GridSize`, `Row`, `Col` and `WordNumber`; `ClueEntryVM` (`ui/bindings/viewmodels/cluePanelVM.ts`) carries `WordNumber`; `ActiveClueBannerVM` (`ui/bindings/viewmodels/playerVM.ts`) carries `WordNumber`; `ToastVM` (`ui/bindings/viewmodels/toastVM.ts`) carries `DurationMs`; and `ui/shared/Modal.svelte` receives a `ConfirmableIntent` prop that it only null-checks. Components unwrap these brands with `Number(...)` / `String(...)` at nine sites across `Grid.svelte`, `PlayerCluePanel.svelte`, `BuilderCluePanel.svelte`, `ActiveClueBanner.svelte`, `JoinReattachBanner.svelte`, `ToastHost.svelte` and `AnagramModal.svelte`. This is the general form of the first instance above: where the view-model does not hand the leaf a ready value, the leaf computes one. Landing approach: display values become plain primitives in the view-model; identifiers that action calls need (`WordKey`, `DisplacedClueId`, `ToastId`) stay branded.

- **S8 — the facade's grid actions throw on out-of-range coordinates.** `createGridActions` in `ui/bindings/gridActions.ts` builds `select-cell` intents with `Row.of` / `Col.of`, both of which throw `RangeError` (`domain/grid/Row.ts`, `domain/grid/Col.ts`), so the action's correctness depends on the caller passing valid coordinates. This is the same shape as the grid-size action, which was made total by switching to `GridSize.try` during the boundary-enforcement resolution. Landing approach: `Row.try` / `Col.try`, invalid coordinates ignored, as `GridSize.try` does.

- **Correction to the first instance above.** Its text says both clue panels "hand-roll `canonicalId`". That was true when the audit was written; the grid-interaction resolution later extracted a single shared UI helper, `canonicalWordKeyId` in `ui/shared/clueScroll.ts`. The duplication is therefore now UI-versus-domain, not UI-versus-UI. The instance stands; the duplication it describes no longer exists in that shape.

- **Accepted by decision — recorded, not proposed as work.** `ui/builder/GridSizeControl.svelte` clamps the grid-size input and `ui/bindings/builderFacade.ts` clamps it again. That duplication was considered and accepted when the grid-size action was made total ("the component's clamp stays as presentation"). Listed here so the inventory is complete; no change is proposed.

**Status (2026-10-24): addressed** — all five instances above and the three supplementary instances recorded below are closed; resolution in `architecture_smell_resolutions.md` (entry: "The VM contract erodes at the leaf edges"). Nothing from this finding is left open. Two further duplications this work turned up are closed as well: the grid-size range was stated in the view-model as literals (now read from `GridSize.MIN` / `GridSize.MAX`), and the grid-size validity rule was evaluated twice — by the domain and again by the control that clamped its own draft. The control now submits what the user typed, the facade is the single evaluator, and the app explains a rejected size with the domain's own message.

---

## 14. VM derivation is a full recompute per dispatch, with no memoization seam

**Category:** derivation architecture. **Risk:** low today — bounded by the 25×25 grid maximum and explicitly accepted by `future_considerations.md` ("scale is not a concern"). Recorded because it is structural, not incidental.

Each shell mounts a single `$derived` over its whole VM tree (`BuilderShell.svelte:13`, `PlayerShell.svelte:14`), so every state change — each keystroke — recomputes the entire derivation chain, with no caching layer anywhere between state and VM:

- `deriveBuilderToolbarVM` runs `CompletenessCheck.check` on every reactive update (`builderVM.ts:60`) — a full grid scan plus a per-word `Chain.isHead` linear scan (`CompletenessCheck.ts:21-44`), on every letter typed.
- `deriveCluePanelVM` rebuilds `WordMap.fromWords`, then per word runs `DisplayClue.forWord` (another linear `isHead` scan) and `LengthPattern.forWord` (a chain walk with per-cell `GridOps.cellAt`) (`cluePanelVM.ts:44-103`).
- `deriveGridVM` calls `GridOps.isSelectable` per white cell — each an independent run scan (`gridVM.ts:111`).
- `WordMap.fromWords` is rebuilt at least three times per Player keystroke (banner `playerVM.ts:119`, anagram VM `anagramVM.ts:60`, clue panel `cluePanelVM.ts:44`), and again inside several reducers (`solving.ts:67` per cursor change, `fillMode.ts:248`).

At 25×25 this is milliseconds and the doc accepts it. The structural point: the bindings layer has no seam where derivation cost could be bounded independently of dispatch frequency, so any future feature that multiplies per-cell or per-word derivation work (overlays, chain visualizations, search) inherits full-tree recompute on every keystroke by default.

**Corrections to this finding's evidence (added 2026-10-24, when work on it began).**

- The line anchors had drifted: `builderVM.ts:60` → `builderVM.ts:84`; `playerVM.ts:119` → `playerVM.ts:84`; `anagramVM.ts:60` → `anagramVM.ts:57`; `gridVM.ts:111` → `gridVM.ts:112`; `CompletenessCheck.ts:21-44` → `26-46`. The named symbols are correct.
- The reducer hit is `fillMode.ts:125`, inside `handleEditClue` — it runs per **clue edit**, not per keystroke.
- The anagram view-model's word-map rebuild only happens while the anagram modal is open, so it is not part of every keystroke.
- One site was missed: `domain/chain/ChainCells.ts:22` rebuilt the word map on **every dispatch in both shells** (it feeds the grid's highlighted-word cell set), so the per-keystroke rebuild count is higher than stated.
- The finding names the *symptom* (full-tree recompute) where the *cause* is narrower and fixable: the domain answers structural questions by re-deriving structure per question — "is this word a chain head?" scans every word, once per word; "is this cell selectable?" scans runs, once per cell — which makes the per-dispatch work quadratic in words and cubic in cells. The recompute is what makes that cost visible. The frequency half of the finding stands on its own and is tracked separately below.

**Status (2026-10-24): the cost shape is addressed; the frequency half remains open** — resolution in `architecture_smell_resolutions.md` (entry: "VM derivation is a full recompute per dispatch, with no memoization seam"). The chain structure of a word list now has one owner (`src/domain/chain/ChainIndex.ts`), the grid run predicate has a bulk form (`WordTopology.partOfRunMask`), and the per-cell and per-word scans are gone; the grid view-model derivation dropped 5× and the whole Builder shell derivation 40% on a dense 25×25 fixture. **Still open:** the whole view-model tree is still rebuilt on every dispatch, and the rebuilt objects carry fresh identities, so the renderer still re-evaluates every cell (measured: 625 of 625 cell items per keystroke). Splitting the shell's single `$derived` does **not** fix that on its own — the reducer replaces the state root on every dispatch, so every derived that reads it is invalidated regardless. That half is carried as an open item in the resolution's "Not addressed" table, to be closed when a feature adds per-cell work to the derivation path or when a measurement shows the render side dominating.

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
