# angryphrase — Architecture Smell Resolutions

Companion to `architecture_smells.md`. Each entry records how a ranked smell was resolved: the decision (options considered, what was chosen, what was deferred and why), the design as implemented, any deliberate behaviour changes, and the verification evidence. Entries are written after the fact and describe the code as it now stands — where this document and the code disagree, the code wins (the same rule `architecture.md` declares for itself).

Conventions: no line-number references (they rot — see smell #11); functions, modules, and test names are the anchors.

Resolved so far: #1 (grid-interaction duplication), #2 (duplicate "complete puzzle" definitions), #3 (intent identity collision), #4 (chain-boundary marker semantics + link admission), #5 (event-fold pipeline had two owners and a redundant stage), #6 (confirm-intent contract declared twice, checked in only one direction), #7 (port consumers do not trust the port contract), #8 (persistence lifecycle incomplete: `flush()` dead, boot-time data-loss window unwired, reload invariants duplicated, `main.ts` re-constructs `BuilderState`).

---

## 1. The shared grid-interaction concept has no home — resolved 2026-10-11

### The smell (recap)

The cursor/typing algorithm — direction deltas, white-neighbour checks, select-cell (bounds, selectability, same-cell direction toggle), move-cursor (clamp-or-rotate), type-letter (write + advance), backspace (clear-or-retreat) — was implemented twice, once per experience stack (`builder/state/internal/fillMode.ts` vs `player/state/internal/solving.ts`), with five more layers of twin plumbing (intent variants, facade action bags, `pickFile` policy, shell typing-intent switches, near-identical grid components, clue-panel scroll effects, failure message constants). See `architecture_smells.md` §1 for the full evidence table. Drift had already begun, and was worse than the audit recorded: Player's `handleSelectCell` no-op semantics were internally inconsistent — out-of-bounds and unselectable clicks returned state untouched, while a same-cell re-click without a toggle available cleared `checkResult` — a copy-paste artifact, not a design.

### Decision

Options considered and their fates:

- **A1 — hoist primitives only** (`DELTA`, neighbour checks, step math to `domain/`): rejected as an end state. The skeleton — the part that actually drifts — would remain duplicated; only the leaf helpers would be shared.
- **A2 — hoist full transitions to the domain; state handlers become thin policy adapters**: **chosen**.
- **B — shared "grid session" engine** (one reducer core owning the grid+cursor slice, per-experience policy config objects): rejected. Expressing the Player's check-clear and anagram re-evaluation rules (which need `WordMap`/`Chain` context) as policy callbacks would cost more indirection than the duplication it removes.
- **C — conformance tests only** (same scenarios through both reducers, assert equivalence): rejected as a fix. It pins the symptom while keeping the fourteen-site change cost; useful only as a migration aid, and not needed since the algorithm became single-site.
- **D — fix smell #3 first** (intent identity/routing), then ride #1 on top: rejected as a sequencing constraint. A2 is independent of #3; only intent-*payload* sharing overlaps, and that was scoped to keep kind strings and routing untouched.

Approved package: **A2 + I1 (shared intent payload variants) + P1 (shared grid component) + P2 (`applyTypingIntent`) + P3 (facade action factories) + P4 (clue-scroll helper)**, plus one deliberate behaviour unification (below). **P5 — deduplicating the twin failure-message constants — was proposed and deferred to smell #3**, where the `report-*` intent twins that own those constants will be decided; the deferral note lives in `architecture_smells.md` §3.

### Design as implemented

**Domain core — `src/domain/grid/GridInteraction.ts`.** One module owns the shared transitions and the shared intent payloads:

```ts
select(grid, cursor, row, col): Cursor | null          // null = no-op
move(grid, cursor, direction, sign): Cursor           // null cursor in → null out
typeLetter(grid, cursor, letter, slot): WriteOutcome | null
backspace(grid, cursor, slot): WriteOutcome | null

type LetterSlot = {
  read: (cell: Cell) => Letter | null;   // which letter field the interaction reads
  set: (cell: Cell, letter: Letter | null) => Cell;
};
type WriteOutcome = { grid: Grid; cursor: Cursor };
```

The `null`-return contract is the load-bearing piece: *every* no-op path (out of bounds, unselectable, black cell, same-cell re-click without a toggle, blocked advance/retreat) collapses to a single `null`, and the caller decides what "no-op" means for its own state. The algorithm bodies were ported verbatim from the twins (private `DELTA`, `hasWhiteNeighbour`, `partOfAcross`/`partOfDown`); `Row`/`Col`/`GridOps`/`Cell` usage is identical to the originals. The module is not a brand owner and never imports `domain/brand`.

**Shared intent payload variants (I1) — same module.** `SelectCellIntent`, `MoveCursorIntent`, `TypeLetterIntent`, `BackspaceIntent`, `EscapeIntent`, `ClickCluePanelWordIntent`, and their union `GridInteractionIntent`. Both `builder/state/intents.ts` and `player/state/intents.ts` now compose their unions from these variants. The kind *strings* are unchanged, so `app/state/intentKinds.ts` (the `satisfies Record<Kind, null>` records and `AMBIGUOUS_INTENT_KINDS` route-disambiguation) compiled untouched. Deliberately **not** shared: `click-grid-word` (no Player counterpart) and the `report-*` variants (smell #3's territory).

**Builder adapters — `fillMode.ts`.** A module-level `ANSWER_SLOT` (`read: c.answerLetter`, `set: Cell.setAnswerLetter`); each of the four handlers gates on `mode === 'fill'`, calls the core, and folds a non-null outcome into `Puzzle.withGrid` + cursor. Builder behaviour is byte-identical to before (it never had `checkResult`); every pre-existing `fillMode` test passed unchanged.

**Player adapters — `solving.ts`.** A module-level `PLAYER_SLOT`; handlers gate on `phase === 'solving'` and apply the **unified rule**:

- `null` outcome → state returned unchanged (no `checkResult` clear, no anagram re-evaluation);
- non-null outcome → `checkResult: null` and `anagramAfterCursorChange` run against the new puzzle/cursor.

`anagramAfterCursorChange` now runs on *every* non-null outcome, including backspace-clears-current (previously skipped there). This is behaviour-equivalent: a re-evaluation with an unchanged cursor finds the same containing word and head, so the anagram state is preserved exactly.

**Bindings factories — `gridActions.ts` / `filePickActions.ts`.**

- `createGridActions(dispatch: (intent: GridInteractionIntent) => void): GridActions` builds the five grid bag methods (`selectCell` via `Row.of`/`Col.of`, `typeLetter` via `Letter.try` with silent drop of invalid input, `backspace`/`moveCursor`/`escape`). Both facades compose it: the Builder spreads it and adds `toggleDesignCell`; the Player uses it directly (shapes identical). No casts anywhere — a `(intent: BuilderIntent) => void` is assignable to the factory's parameter type by contravariance, because `GridInteractionIntent`'s variants are union members of both intent unions.
- `createFilePickActions(appStore, label, dispatchFailure, onRead)` owns the port-consumption policy once: `pickFile` → `'picked'` returns text, `'cancelled'` returns silent `null`, `'failed'` warns once + dispatches `report-pick-failure` + returns `null`; `importDroppedFile` → `'read'` calls `onRead(text)`, `'failed'` warns + dispatches `report-import-read-failure`. The `label` parameter is spliced into the warn prefixes (`'builderFacade'` / `'playerFacade'`) so `console.warn` output is byte-identical to the pre-refactor twins. Per-facade differences now live in one place each: the `onRead` callback (`request-import-puzzle` vs `import-puzzle`).

**UI.**

- `ui/shared/Grid.svelte` — the single crossword grid leaf. Props `{ vm, onCellClick, allCellsClickable? }`; `allCellsClickable` (true only in Builder design mode) replaces the old `mode` prop's clickability branch. Markup ported verbatim; `BuilderGrid.svelte` and `PlayerGrid.svelte` deleted.
- `ui/shared/typingIntent.ts` gains `TypingActions` (a structural five-method shape — no facade types imported) and `applyTypingIntent(intent, actions)`, an exhaustive switch. Both shells' local `onTypingIntent` switches are gone; `TypingSurface`'s `onDispatch` is now `(intent) => applyTypingIntent(intent, <facade>.actions.grid)`.
- `ui/shared/clueScroll.ts` — `canonicalWordKeyId(wordKey)` (the panels' former `canonicalId`) and `scrollRowIntoView(panelEl, liRefs, id)`. Both clue panels keep their own `$effect` (with the null-highlight guard) and call the helper; everything else in the panels is untouched.

### Deliberate behaviour changes

Exactly two, both Player, both instances of the agreed unification "clear `checkResult` iff the interaction changed cursor or grid" (previously those paths cleared `checkResult` despite changing nothing):

1. `select-cell` on the already-selected cell of a single-direction word → state fully unchanged.
2. `backspace` with an empty current cell and blocked retreat (at word start, or previous cell black) → state fully unchanged.

Both are pinned by updated cases in `test/player/state/internal/solving.test.ts`: *"clicking already-selected cell that is in only one word → state unchanged, checkResult preserved"*, *"when current cell empty and previous is at grid start, state unchanged, checkResult preserved"*, *"when current cell empty and previous is black, state unchanged, checkResult preserved"*. `checkResult` drives only the toolbar message/colour and the clear-errors affordance — never grid colouring — so the deltas are invisible in the grid. All other behaviour, including everything in the Builder, is unchanged and was required to pass its pre-existing tests without assertion edits (the `fillMode` suite passed untouched).

### Files

Created: `src/domain/grid/GridInteraction.ts`; `src/ui/bindings/gridActions.ts`; `src/ui/bindings/filePickActions.ts`; `src/ui/shared/Grid.svelte`; `src/ui/shared/clueScroll.ts`; and mirrored test files `test/domain/grid/GridInteraction.test.ts`, `test/ui/bindings/gridActions.test.ts`, `test/ui/bindings/filePickActions.test.ts`, `test/ui/shared/typingIntent.test.ts`, `test/ui/shared/clueScroll.test.ts`.

Modified: `src/builder/state/intents.ts`; `src/player/state/intents.ts`; `src/builder/state/internal/fillMode.ts`; `src/player/state/internal/solving.ts`; `test/player/state/internal/solving.test.ts` (the three cases above); `src/ui/bindings/builderFacade.ts`; `src/ui/bindings/playerFacade.ts`; `src/ui/shared/typingIntent.ts`; `src/ui/builder/BuilderShell.svelte`; `src/ui/player/PlayerShell.svelte`; `src/ui/builder/BuilderCluePanel.svelte`; `src/ui/player/PlayerCluePanel.svelte`; `llmworkspace/architecture.md` (§3 Layer 0/1/2, §7 check-clear rule, §11 inventory, §12 coverage, §13 map).

Deleted: `src/ui/builder/BuilderGrid.svelte`; `src/ui/player/PlayerGrid.svelte`.

### Verification

- `npm run ci` at close: eslint + `madge --circular` clean; `svelte-check` 0 errors / 0 warnings; **85 test files / 1210 tests green** (from 80 files / 1154 tests before — the five new modules each carry a mirrored test file, +56 tests); the single-file production build succeeded.
- The `GridInteraction` suite runs every `typeLetter`/`backspace` case through **both** letter slots (answer + player), proving the policy injection is behaviour-neutral; it also asserts input immutability. One drafted case — retreat target unselectable — was cut as unreachable for valid inputs (a white previous cell adjacent to a white cursor cell is always selectable); the black-retreat-target case exercises the same guard.
- Process: five implementation tasks (domain core → builder adapters + player adapters + bindings factories in parallel → UI plumbing), each verified by the implementer and re-run by the reviewer before acceptance, then a full `ci` pass at close. Existing suites were required to stay green without weakened assertions except the three named Player cases.

### Consequence (change cost after)

A new keyboard interaction now touches: `GridInteraction` (+ its test), the shared variant type and the kind records in `app/state/intentKinds.ts`, a thin per-tree adapter only if policy differs, `typingIntent.ts` if the surface mapping changes, and the `GridActions` factory — one site per concept instead of fourteen. A cursor-semantics change (e.g. skip-black-cell advance) is a change to one function. The remaining #1-adjacent duplication is exactly what was deferred: the `report-*` intent twins and their failure-message constants (smell #3).

---

## 2. "Complete puzzle" is defined twice, and the export gate is weaker than the import gate — resolved 2026-10-12

### The smell (recap)

Two independent definitions of "complete" existed: `CompletenessCheck` (`domain/puzzle/`) gated `export-complete`, and `v1.parsePuzzle`'s complete-mode rules (`domain/format/`) gated import. They disagreed in two ways: (1) the parser strictly rejects a non-head chain word carrying a non-empty clue, but `CompletenessCheck` never checked it — and the Builder could legitimately hold that state (an incomplete import skips clue validation entirely; no Builder operation empties a pre-existing non-head clue), so the app could emit a complete file its own parser refused, in either experience; (2) `serializeComplete` silently omitted displaced clues while the parser forbids the field in complete files. No test covered either path. See `architecture_smells.md` §2.

One audit finding was corrected during resolution: divergence (2) is not drift. The archived requirements (FR-59/FR-63) specify displaced-clue omission from complete files as deliberate — they are a Builder-only concept, preserved in Builder state and the incomplete format, and must not block export. The real defect in that half was the *silence*, not the omission; the fix de-silences it. Recording the rationale here so it survives the archive (smell #11).

### Decision

Options considered and their fates:

- **A — single domain owner, parser delegates (layered, mirroring #1's chosen shape): chosen.** `CompletenessCheck` owns the domain-level clue rules of a complete puzzle; `v1`'s complete-mode clue validation consumes them, keeping byte-shape rules to itself. Both gates then share one definition by construction.
- **B — close the state hole at the import boundary (displace non-head clues when importing an incomplete file): rejected as primary.** It fixes today's instance but not the split — the next rule added to one gate still has no structural reason to reach the other (the smell's own thesis); it makes incomplete import stop being byte-faithful to the user's file; and it would add a fourth site maintaining the non-head-clue-empty invariant (join, unjoin, reconcile, import) — more scattering, not less.
- **C — round-trip conformance tests: included** as a regression net over A (pins that a gate-passing puzzle always serializes to parser-accepted bytes, in both directions of drift). Rejected as a fix alone, per the #1 precedent ("pins the symptom").
- **D — branded `CompletePuzzle` type** (`serializeComplete` only accepts gate-passing puzzles): rejected. Compile-time enforcement for one call site, at the cost of brand owner #16 — the exact three-site config tax smell #12 documents — plus parser return-type churn; and it cannot cover the displaced-clue half (not part of `Puzzle`).
- **E — runtime self-check (serialize then re-parse in the export handler before downloading): rejected.** A runtime patch over a structural split; failure surfaces as "we made a file we refuse" at the user's face.

Displaced-clue half: omission retained (specified behaviour, above); **de-silenced** with a non-blocking `warning` toast on export-complete when displaced clues exist (wording W1, human-selected); blocking export on displaced clues was rejected as contradicting the specified behaviour.

Remedy sub-decision (the gate now blocks the imported non-head-clue state, so the Builder needed an in-app fix that does not destroy the text): **unjoin now displaces a non-empty downstream clue** instead of silently blanking it — the same policy join already uses, consistent with displaced-clue semantics; approved as a deliberate behaviour change. Allowing edit-clue on non-head words was rejected (it would muddy the heads-only clue-editing rule).

### Design as implemented

**`src/domain/puzzle/CompletenessCheck.ts`** — the single owner of the complete-puzzle clue rules. `CompletenessViolation` gains `{ kind: 'non-head-clue'; wordNumber; direction }`. New `clueViolations(words)` walks words in order: head with empty (or whitespace-only) clue → `missing-clue`; non-head with non-empty clue → `non-head-clue`. `check(p)` = letter scan (row-major, unchanged) + `clueViolations(p.words)` — ordering contract preserved. New `message(v)` renders every violation kind as user-facing text (exhaustive switch, no default), following the `v1.ts` precedent of domain-owned message strings; the former twin mapping in `importExport.ts` is deleted.

**`src/domain/format/v1.ts`** — `validateClues` (complete branch) delegates to `CompletenessCheck.clueViolations` and maps violations to the exact pre-existing `ParseFailure` strings, so parser behaviour and messages are byte-identical (the full `v1` suite passed without a single test edit). The incomplete-file early return is untouched; byte-shape rules stay in the parser.

**`src/builder/state/internal/importExport.ts`** — the export gate consumes the strengthened `CompletenessCheck` unchanged in structure: violations → error toasts via `CompletenessCheck.message`; no download. On success with `state.displacedClues.length > 0`, the download event is followed by a `warning` toast: `Exported without N displaced clue(s). They remain in the Displaced Clues panel.` (singular/plural interpolated; first use of the `warning` toast kind).

**`src/builder/state/internal/joinSubMode.ts` + `reducer.ts`** — `handleUnjoin` takes `rng` (threaded from `deps.rng` like the other rng-consuming handlers) and, when the downstream word's clue is non-empty, appends `DisplacedClue.create(rng, clue, direction)` before blanking it — mirroring `resolveJoin`'s displace policy exactly. Under normal invariants the downstream clue is always empty, so the change is unobservable except in imported edge states, where it converts silent data loss into a recoverable displaced entry.

**`src/ui/bindings/viewmodels/builderVM.ts` + `src/ui/builder/BuilderToolbar.svelte`** — `BuilderToolbarVM` gains `exportCompleteMessages: string[]` (derived from the single `check` call already in the derivation, mapped via `CompletenessCheck.message`; the structured `exportCompleteViolations` field is retained). The toolbar renders the messages below the export row whenever the gate fails. This completes the specified "display all blocking errors" behaviour, which had been half-implemented: the VM carried the violations but no component rendered them, so a blocked user saw only a disabled button with no explanation — a latent gap the fix surfaced (the new rule would otherwise have been illegible).

### Deliberate behaviour changes

1. **Unjoin displaces instead of destroying.** A non-empty downstream clue becomes a displaced-clue entry (text + direction preserved, reattachable) instead of being silently blanked. Unobservable under builder-maintained invariants; data-preserving in imported edge states. Pinned by new `joinSubMode` tests.
2. **Export-complete is blocked by the non-head-clue rule.** A state that previously exported a parser-rejected artifact now yields error toasts and (via the toolbar) visible blocking messages, with unjoin as the in-app remedy. Pinned by the round-trip suite.
3. **Export-complete with displaced clues emits a `warning` toast** naming the count and where the clues remain. Non-blocking; specified omission behaviour unchanged. Pinned by two new `importExport` tests.

Also found and fixed during implementation: the `importExport` test fixture `completeStateWithChain` was itself constructing the smell's violating state — it set a clue on every word while they were standalone heads, then linked one word to another without blanking the linked-to word's clue. The test name claimed "non-heads empty"; the fixture lied. The new rule caught it on first run; the fixture now blanks the tail's clue at link time, mirroring what a real join does.

### Files

Modified: `src/domain/puzzle/CompletenessCheck.ts`; `src/domain/format/v1.ts`; `src/builder/state/internal/importExport.ts`; `src/builder/state/internal/joinSubMode.ts`; `src/builder/state/reducer.ts`; `src/ui/bindings/viewmodels/builderVM.ts`; `src/ui/builder/BuilderToolbar.svelte`; `test/domain/puzzle/CompletenessCheck.test.ts`; `test/builder/state/internal/joinSubMode.test.ts`; `test/builder/state/internal/importExport.test.ts`; `test/ui/bindings/viewmodels/builderVM.test.ts`; `llmworkspace/architecture.md` (§3 domain/puzzle + domain/format rows, §7 unjoin rule + builder import/export row + `BuilderToolbar` inventory row, §12 coverage); `llmworkspace/architecture_smells.md` (§2 status line).

No new source modules; no intent, event, or port changes; `v1.test.ts` untouched.

### Verification

- `npm run ci` at close: eslint + `madge --circular` clean; `svelte-check` 0 errors / 0 warnings; **1229 tests green** (from 1210 after #1 — +19: 7 `CompletenessCheck`, 4 `joinSubMode`, 2 export-toast, 3 round-trip conformance, 3 `builderVM`); the single-file production build succeeded.
- Round-trip conformance (new, in `importExport.test.ts`): a gate-passing chained puzzle's `serializeComplete` output re-parses cleanly and deep-equals the source puzzle; the non-head-clue state is blocked by the gate *and* rejected by the parser with matching wording — the two gates cannot drift apart silently again; the displaced-omission artifact carries no `displacedClues` field and re-parses cleanly.
- Existing suites stayed green without weakened assertions except the one named fixture correction above. Parser rejection messages are byte-identical (zero `v1` test edits).
- Process: six implementation tasks (domain rule → export gate/toast + unjoin in parallel → parser delegation + toolbar in parallel → round-trip suite), each verified by the implementer and re-run by the reviewer before acceptance; one mid-flight review correction (a dead `default` branch in the delegated switch, removed).

### Consequence (change cost after)

A future rule of "what a complete puzzle is" lands in `CompletenessCheck` once; the export gate, the toolbar display, and the parser's complete-file validation all inherit it (the parser adds only a message mapping). The round-trip suite fails CI if either gate drifts. Displaced clues remain deliberately outside the gate; their omission is now user-visible and their rationale is recorded here rather than only in the archived requirements. The smell-#2-adjacent leftover is none; the next ranked smell is #3 (intent identity/routing), which also owns the deferred `report-*` twin constants from #1.

### Post-resolution correction (2026-10-12)

The original §2 fix made `BuilderToolbarVM.exportCompleteMessages` a `string[]`, mapping each `CompletenessViolation` to its single-violation message via `CompletenessCheck.message`, and `BuilderToolbar.svelte` rendered one `<p>` per message. On an empty 25×25 grid this produced roughly 550 lines of red text — noise, not signal.

The correction replaces that list with grouped counts. `CompletenessCheck.groupByKind(violations): CompletenessViolationCounts` returns `Readonly<Record<CompletenessViolationKind, number>>` with one key per kind and zero for absent kinds. `BuilderToolbarVM` now derives one summary line per non-zero kind (for example, "500 missing answer letters", "50 missing clues", "1 non-head word with stray clue text"). `exportCompleteMessages: string[]` is removed; `exportCompleteViolations: CompletenessViolation[]` is kept because `canExportComplete` still depends on its length.

No domain semantics changed: the export gate and parser validation are unchanged. This is presentation-only. The design was discussed as part of the smell #3 follow-up work.

---

## 3. Intent identity is not unique — collision is absorbed by runtime route-dispatch machinery — resolved 2026-10-12

### The smell (recap)

`BuilderIntent` and `PlayerIntent` shared eight kind strings — the six grid-interaction kinds (`select-cell`, `move-cursor`, `type-letter`, `backspace`, `escape`, `click-clue-panel-word`) and the two port-failure kinds (`report-import-read-failure`, `report-pick-failure`). `reduceApp` therefore needed `AMBIGUOUS_INTENT_KINDS` (the runtime intersection in `app/state/intentKinds.ts`) and a `state.route`-based switch (`reducer.ts`) to disambiguate; the function signatures took `(intent: AppIntent | BuilderIntent | PlayerIntent)` and the two route helpers had to use `intent as unknown as BuilderIntent` / `as unknown as PlayerIntent` casts because TS could not narrow by `AMBIGUOUS_INTENT_KINDS.has`. Three fragilities: (1) silent collisions — a Builder kind string matching an existing Player kind was absorbed into the ambiguous set with no signal at the addition site; (2) mounting topology — the `'landing'` throw depended on no Builder/Player shell being mounted, a property of the UI tree rather than the state layer; (3) two architectures for one concept — `report-download-failure` / `report-builder-save-failure` / `report-player-save-failure` lived in `AppIntent` and were handled centrally, while `report-pick-failure` / `report-import-read-failure` lived in *both* experience unions and round-tripped through sub-reducers with near-identical toast emissions (plus Player's `lastImportError` write). See `architecture_smells.md` §3 for the full evidence.

### Decision

Options considered and their fates:

- **A — status quo + type-level disjointness safety net** (split the `satisfies Record<Kind, null>` records into `Exclude`-narrowed unique records plus a shared-kind record so a kind appearing in both unions fails `tsc`): rejected. Fixes fragility 1 at compile time but leaves the dispatch model untouched; fragility 2 (mounting topology) and the `'landing'` throw remain, and the `as unknown as` casts stay because `state.route` is still the only dispatch discriminator.
- **B — lift the two `report-*` failure kinds into `AppIntent`**: rejected as a *primary* fix. Architecturally attractive (collapses fragility 3 by removing the duplication), but it loses Player's `lastImportError` inline error on file-read failure — the user gets a toast but the import screen no longer shows the persistent error, a UX regression. The criterion that emerged from the existing code (AppIntent for failures whose effect is constant across experiences; experience union for failures that mutate experience-specific state) is satisfied by the existing placement; the asymmetry is principled. Kept as a partial finding (see "Two architectures" below) but not chosen.
- **C — hoist the eight shared kinds into a third union `SharedIntent`** routed through a shared handler that injects the right `LetterSlot` or experience-specific behaviour: rejected. The six grid kinds have different behaviour per experience (Builder does not clear `checkResult`; Player does; backspace no-op semantics differ; the unified rule from #1 fixes the algorithm but each experience still wraps it differently). The shared handler would have to branch by target anyway, ending in a re-routed dispatch with extra indirection.
- **D — `target: 'builder' | 'player'` literal discriminator on every Builder/Player intent variant**: **chosen**. Eliminates fragility 1 by construction (adding a kind to one union that matches the other produces a TS error — both unions carry the literal, the discriminator resolves at the dispatch site, no string-set membership is consulted). Eliminates fragility 2 (no route-based fallback; an ambiguous dispatch cannot reach `reduceApp` because the discriminator is set by the facade that knows its experience, not by `state.route`). The `as unknown as` casts are gone — TS narrows on the literal `target`. The criterion for AppIntent vs experience-union placement is unchanged (the smell's re-reading showed it was already principled); the duplicated message constants ride along as P5.
- **E — per-reducer dispatch table** (each sub-reducer registers `canHandle: (kind: string) => boolean`; first match wins): rejected. Loses the compile-time kind-coverage guarantee the `satisfies Record<Kind, null>` records give today; trades a known mechanism for an unprincipled one.
- **F — combined A + B + C**: rejected. Cheaper than D but accepts fragility 2 and a UX regression; not "good code".
- **G — D with named-alias factory contracts** (`type TargetedGridIntent = { target: 'builder' | 'player' } & GridInteractionIntent` and analogous for `filePickActions`): **chosen addition to D**. The target discriminator breaks the contravariance that lets the current factory dispatch `(intent: GridInteractionIntent) => void` accept a facade dispatch `(intent: BuilderIntent) => void` (a BuilderIntent grid variant now has a `target` field that GridInteractionIntent lacks). The named alias names the seam; the factory takes a `target` parameter and stamps it on every dispatched intent, restoring assignability. Same shape as an inline intersection but spelled out — the seam is named, not spelled.
- **H — return-intent factory** (factories produce typed intent values; the caller dispatches): rejected. Most architecturally pure (the factory becomes a pure constructor with no side-effect knowledge) but every call site changes from `actions.selectCell(...)` to `dispatch(actions.selectCell(...))` — `applyTypingIntent` in `ui/shared/typingIntent.ts` and every grid click handler. Acceptable churn is more than we want for the same architectural outcome D already delivers.

Approved package: **D + G + P5 + doc amendment**.

**Two architectures (the smell's fragility 3, re-read):** the criterion that emerges from the existing placement is sound — AppIntent holds port-failure reports whose effect is constant across experiences (`report-download-failure`, `report-builder-save-failure`, `report-player-save-failure` emit only toasts; neither slice's state changes); experience unions hold port-failure reports that mutate experience-specific state (`report-pick-failure` / `report-import-read-failure` additionally write Player's `lastImportError`, which has no Builder counterpart). The smell's framing of "two architectures for one concept" partially dissolves under closer reading — the criterion is coherent, the asymmetry is principled. What remains concrete is the duplicated message constants (the deferred P5 from #1's resolution) and the duplicated toast-emission shape. Both are addressed by P5 and D's literal-tag unification respectively.

### Design as implemented

**Discriminator type — `src/domain/notifications/Event.ts`.** New `export type IntentTarget = 'builder' | 'player';` (a literal union, not `string`). Both `intents.ts` files import it. `ConfirmableIntent` gains `target` on every variant: `confirm-switch-to-design` / `confirm-import-puzzle` / `confirm-reset-builder` carry `target: 'builder'`; `confirm-reset-player` carries `target: 'player'`. `IntentTarget` lives in `domain/notifications/` because both intent unions need it and neither can import from `app/state/` (the existing layer rule).

**BuilderIntent — `src/builder/state/intents.ts`.** Every variant carries `target: 'builder'` as a literal. The six shared grid-interaction variants are expressed via intersection: `{ target: 'builder' } & SelectCellIntent | { target: 'builder' } & MoveCursorIntent | ...` — TS distributes the intersection over the union, giving each variant `target: 'builder'` as a literal.

**PlayerIntent — `src/player/state/intents.ts`.** Symmetric pattern with `target: 'player'`.

**Kind sets — `src/app/state/intentKinds.ts`.** `AMBIGUOUS_INTENT_KINDS` is deleted. `BUILDER_INTENT_KINDS`, `PLAYER_INTENT_KINDS`, `CONFIRMABLE_INTENT_KINDS` remain — the last is still used by `reducer.ts` to clear `state.modal` / `state.pendingConfirmIntent` after a `confirm-*` intent executes. The `satisfies Record<Kind, null>` records still prove each union's coverage.

**Dispatch — `src/app/state/reducer.ts`.** The switch over `intent.kind` covers all six AppIntent variants (`navigate`, `cancel-modal`, `dismiss-toast`, `report-download-failure`, `report-builder-save-failure`, `report-player-save-failure`) and returns in each case. After the switch, `intent` is `BuilderIntent | PlayerIntent`; both carry `target`. The dispatch is now:

```ts
if (intent.target === 'builder') return routeToBuilder(intent);
return routeToPlayer(intent);
```

The `state.route` switch (`'build' | 'play' | 'landing'`) is gone. The `case 'landing'` throw is gone (no longer applicable — every dispatch reaches a sub-reducer or throws an unreachable-kind error before reaching `reducer.ts` from a non-mounted shell). The `intent as unknown as BuilderIntent` and `intent as unknown as PlayerIntent` casts in `routeToBuilder` / `routeToPlayer` are gone — TS narrowing by the literal `target` provides the correct type. The unreachable-branch throw at the bottom of the function (the pre-existing `unknown intent kind` guard) is preserved as a defensive end-of-function check.

**Factory contracts — `src/ui/bindings/gridActions.ts` and `src/ui/bindings/filePickActions.ts`.** Each introduces a local (non-exported) named alias:

```ts
// gridActions.ts
type TargetedGridIntent = { target: 'builder' | 'player' } & GridInteractionIntent;
// filePickActions.ts
type TargetedFilePickIntent = { target: 'builder' | 'player' } & FilePickFailureIntent;
```

The factory signatures take `target: 'builder' | 'player'` as a parameter; the dispatch parameter is typed against the alias. Every action-method body stamps `target` on the dispatched intent literal. The facade call sites (`builderFacade.ts`, `playerFacade.ts`) pass `'builder'` / `'player'` to the factories. Public facade `dispatch` signatures remain `(intent: BuilderIntent) => void` / `(intent: PlayerIntent) => void`; the internal `dispatch` callback passed to the factory is widened to `BuilderIntent | PlayerIntent` to satisfy `strictFunctionTypes` contravariance — this is invisible at the facade's API surface.

**Shared message constants — `src/domain/notifications/ErrorMessages.ts`** (new). Owns `IMPORT_READ_FAILURE_MSG` and `PICK_FAILURE_MSG`. `src/builder/state/internal/importExport.ts` and `src/player/state/internal/lifecycle.ts` import from it; the locally-declared copies (formerly `importExport.ts:8-9` and `lifecycle.ts:13-14`) are deleted. This lands the P5 deferred from #1's resolution.

**Docs — `llmworkspace/architecture.md`.** §3 Layer 1's trailing clause ("the kind strings and the routing model are unchanged") is replaced with a paragraph describing the `target` discriminator and the fact that the 8 shared kind strings still appear in both unions (same `kind`, different `target`). §5's `Routing.` paragraph is rewritten to describe target-based dispatch and to state that no `AMBIGUOUS_INTENT_KINDS` set exists and no route-based fallback remains. No other section was touched.

### Deliberate behaviour changes

None. The dispatch path now reads `intent.target` instead of consulting `state.route`, but every intent reaches the same sub-reducer as before — no observable behaviour change. The Player `lastImportError` write on file-read failure is preserved (B was rejected on this ground).

### Files

Created: `src/domain/notifications/ErrorMessages.ts`.

Modified: `src/domain/notifications/Event.ts`; `src/app/state/intentKinds.ts`; `src/app/state/reducer.ts`; `src/builder/state/intents.ts`; `src/player/state/intents.ts`; `src/ui/bindings/gridActions.ts`; `src/ui/bindings/filePickActions.ts`; `src/ui/bindings/builderFacade.ts`; `src/ui/bindings/playerFacade.ts`; `src/ui/bindings/appStore.svelte.ts`; `src/builder/state/internal/designMode.ts`; `src/builder/state/internal/importExport.ts`; `src/builder/state/internal/lifecycle.ts`; `src/player/state/internal/lifecycle.ts`. Test files: `test/app/state/{reducer,intentKinds,effects}.test.ts`; `test/builder/state/{reducer,state}.test.ts`; `test/builder/state/internal/{designMode,fillMode,importExport,joinSubMode,lifecycle,reattachSubMode,reconcileWords}.test.ts`; `test/player/state/{reducer,state}.test.ts`; `test/player/state/internal/{anagram,lifecycle,solving}.test.ts`; `test/ui/bindings/{appStore,modalFacade,playerFacade,builderFacade,toastFacade,gridActions,filePickActions}.test.ts`; `test/domain/notifications/Event.test.ts`. Docs: `llmworkspace/architecture.md` (§3 Layer 1, §5 routing); `llmworkspace/architecture_smells.md` (§3 status line).

No source modules deleted. No new intent kinds, no new event variants, no port contract changes, no UI/bindings API changes visible at the component layer.

### Verification

- `npm run ci` at close: eslint + `madge --circular` clean; `svelte-check` 0 errors / 0 warnings; **85 test files / 1229 tests green** (no net test count change from after #2 — +2 new TS-level target assertions in `intentKinds.test.ts` ("every BuilderIntent variant carries target: 'builder'", "every PlayerIntent variant carries target: 'player'"), -1 removed AMBIGUOUS_INTENT_KINDS case, -1 removed `'landing route throws'` reducer case = 0 net); the single-file production build succeeded (`dist/index.html` 237.92 kB, gzip 103.34 kB).
- Type-level proof of the discriminator: the `_BuilderTargetCheck` / `_PlayerTargetCheck` assertions in `intentKinds.test.ts` (TS conditional types `AssertTarget<T, Expected>`) compile only if every variant of `BuilderIntent` / `PlayerIntent` carries the literal `target` value. Any future regression — adding a variant without `target`, or widening the literal — fails `tsc`.
- Discriminator at dispatch sites: every `dispatch({...})` literal at a facade or factory site carries `target`. The facades' public `dispatch` signatures still accept the full union; the factories' `dispatch` parameter type uses the named alias; TS rejects any future dispatch literal missing `target` at compile time.
- Process: six implementation tasks (ErrorMessages consolidation → Builder intent type + Builder dispatch sites + Builder tests in parallel with Player intent type + Player dispatch sites + Player tests → ConfirmableIntent + intentKinds + reducer rewrite + shared test files in parallel with factory target-stamping + facade call sites + factory tests → doc amendment → CI verification), each verified by the implementer; one mid-flight rejection (the Player task's first pass used `target?: 'player'` (optional) instead of the required literal — caught at review against the spec, corrected in a tiny follow-up). One process observation: tasks 4 and 5 ran in parallel and observed each other's intermediate states; the final state is clean and was verified by the reviewer running `npx tsc --noEmit` and `npm run ci` directly.

### Consequence (change cost after)

A new intent kind lands in exactly one of the two unions; the property carries `target: 'builder'` or `target: 'player'` as required by the union. TS refuses to compile if the literal is missing, widened, or wrong-valued. Adding the same kind string to both unions (should a future feature require shared payload but experience-specific dispatch) is permitted — each variant carries its own `target` literal and the dispatch site picks the right one. The `AMBIGUOUS_INTENT_KINDS` set is gone, the route-based dispatch switch is gone, the `as unknown as` casts are gone, and the dispatch layer's correctness no longer depends on the UI tree's mounting topology. The "two architectures" criterion for failure reports is now coherent by construction — `AppIntent` for effect-constant failures, experience unions for state-mutating failures — and the duplicated message constants have a single owner. The deferred P5 from #1 lands here; the smell-#3-adjacent leftover is none.

---

## 4. Chain-boundary marker semantics are scattered across six sites — resolved 2026-10-13

### The smell (recap)

`CellMarker` was a four-boolean struct (`spaceRight`, `spaceBottom`, `hyphenRight`, `hyphenBottom`). Every interpretation of those flags — "what a boundary marker means on a linked word's end cell" — was re-implemented at six sites: `joinSubMode.ts` (empty-pair test + marker materialize/clear), `reconcileWords.ts` (a second marker-patch vocabulary), `v1.ts` (a third empty-pair normalization), `Anagram.ts` (marker→`CellSeparator` derivation, twice), `gridVM.ts` (a third derivation), and `LengthPattern.ts` (the same space/hyphen/run logic inlined three times). The "marker pair" mutual-exclusion rule existed only in `CellMarker.toggle`; every other site re-derived it by hand. See `architecture_smells.md` §4 for the full evidence table.

The same concept space had a second, related split: chain **structural** validation lived in `domain/chain/ChainValidation.ts`, but the chain **admission** rules (`source has no nextWord`, `target not already linked`, `target clue empty`, `target is a chain head` — FR-35/FR-42) lived only in `builder/state/internal/joinSubMode.ts` and `reattachSubMode.ts`. The domain could tell you a chain was invalid; only Builder state knew what made a link admissible, so future callers had no way to enforce the same policy.

### Decision

**Marker shape options:**

- **A1 — keep the four booleans and extract helper functions:** rejected. The root cause was representation: the booleans still made invalid combinations (`spaceRight && hyphenRight`) representable, and every consumer still had to know the precedence rule.
- **A2 — introduce a separate `ChainBoundary` value object:** rejected. It would own the linked-word end-cell concept but would leave standalone-word markers and the six call sites' re-derivation largely intact.
- **A3 — make `CellSeparator` the internal representation:** **chosen**. `CellMarker` becomes `{ right: CellSeparator, bottom: CellSeparator }`; mutual exclusion is a type-level fact. The v1 file format stays four-boolean on disk; an adapter pair local to `v1.ts` bridges the two shapes.

**Chain admission options:**

- **B1 — keep the rules in Builder state:** rejected. Leaves the split untouched; future callers cannot reuse the policy.
- **B2 — extract a pure domain predicate, keep mutation in Builder state:** **chosen**. Admission is a dependency-free predicate over a `words` snapshot; mutation still needs `Rng` for `DisplacedClue` UUIDs and belongs in Builder state.
- **B3 — make admission an aggregate-level operation that also performs the link/reattach mutation:** rejected. It would pull `Rng` and `BuilderState` knowledge into `domain/chain/`, violating the domain's framework-free, port-free boundary.

### Design as implemented

**`src/domain/grid/CellMarker.ts`** — the single owner of marker read/write semantics.

```ts
export type CellMarker = { right: CellSeparator; bottom: CellSeparator };

export const CellMarker = {
  EMPTY: { right: 'none', bottom: 'none' },
  read(marker, axis: 'right' | 'bottom'): CellSeparator,
  write(marker, axis, separator: CellSeparator): CellMarker,
  isEmpty(marker, axis): boolean,
};
```

`CellMarkerFlag.ts` and `CellMarker.toggle` are deleted. `Cell.EMPTY.marker` is `CellMarker.EMPTY`.

**`src/domain/format/v1.ts`** — wire-format adapter pair. The on-disk cell shape stays four-boolean for backward compatibility:

```ts
function markerFromJson(spaceRight, spaceBottom, hyphenRight, hyphenBottom, r, c, failures)
  : CellMarker | null
function markerToJson(marker: CellMarker)
  : { spaceRight, spaceBottom, hyphenRight, hyphenBottom }
```

`markerFromJson` rejects any cell carrying both `space*` and `hyphen*` on the same axis (`"Cell (r, c) has conflicting right/bottom markers."`). Previously that malformed state was silently collapsed using the implicit "space wins" rule; it is now a parse failure.

**Migrated call sites:**

- `builder/state/internal/joinSubMode.ts` — `isBoundaryPairEmpty`, `materializeJoinMarker`, and `clearBoundaryMarker` now call `CellMarker.isEmpty` / `.write`.
- `builder/state/internal/reconcileWords.ts` — the old `readBoundaryKind` / `clearPatch` / `setPatch` vocabulary is replaced by `CellMarker.read` / `.write`.
- `domain/format/v1.ts` — four-boolean normalization is replaced by `markerFromJson` / `markerToJson`.
- `domain/anagram/Anagram.ts` — the two inlined marker→separator derivations now call `CellMarker.read`.
- `ui/bindings/viewmodels/gridVM.ts` — `separatorRight` / `separatorBottom` now come from `CellMarker.read`.
- `domain/chain/LengthPattern.ts` — the inlined space/hyphen/run logic now reads `CellSeparator` via a single `separatorAt` helper that calls `CellMarker.read`.

**`src/domain/chain/ChainAdmission.ts`** — the single owner of admission policy.

```ts
export type AdmissionReason =
  | 'source-not-found' | 'target-not-found' | 'source-has-link' | 'target-already-linked'
  | 'clue-not-found' | 'target-has-clue' | 'target-non-head';

export type AdmissionResult = { ok: true } | { ok: false; reason: AdmissionReason };

export const ChainAdmission = {
  canLink(words, source, target): AdmissionResult,
  canReattach(words, displacedClues, displacedClueId, target): AdmissionResult,
  message(result): string,
};
```

`canLink` enforces: source exists, target exists, source has no `nextWord`, no other word already points to target. `canReattach` enforces: displaced clue exists, target exists, target clue is empty, target is a chain head (no word points to it). `message` returns the exact user-facing strings; the toast messages that were previously inlined in `joinSubMode.ts` and `reattachSubMode.ts` now live here.

**Builder-layer handling.** `joinSubMode.resolveJoin` and `reattachSubMode.resolveReattach` call `ChainAdmission` and branch:

- Self-link (`source === target`) is handled in `resolveJoin` before calling `canLink` — it is a UX-level cancel (FR-34), not an admission outcome.
- `source-not-found` / `target-not-found` / `clue-not-found` → silent `Result.ok(state)` (defensive no-ops for stale UI dispatches).
- Every other rejection → `Result.withEvents(state, [{ kind: 'toast', toastKind: 'error', message: ChainAdmission.message(result) }])`.
- Success path is unchanged: it still mutates `words`, grid markers, displaced clues, and `subMode`, using `deps.rng` where needed.

### Deliberate behaviour changes

None for in-app paths. The marker migration is observationally identical except that v1 import now rejects cells with conflicting markers on the same axis — a new strictness rule for malformed files, not a change to any path the app itself produces. The chain-admission refactor preserves the exact toast strings, the same defensive no-ops, and the same success path. The self-link cancel behaviour is unchanged.

### Files

Created: `src/domain/chain/ChainAdmission.ts`; `test/domain/chain/ChainAdmission.test.ts`.

Modified: `src/domain/grid/CellMarker.ts` (rewrite); `src/domain/format/v1.ts` (adapter pair); `src/domain/anagram/Anagram.ts`; `src/domain/chain/LengthPattern.ts`; `src/ui/bindings/viewmodels/gridVM.ts`; `src/builder/state/internal/joinSubMode.ts`; `src/builder/state/internal/reconcileWords.ts`; `src/builder/state/internal/fillMode.ts`; `src/builder/state/internal/reattachSubMode.ts`; `src/builder/state/intents.ts`; `src/builder/state/reducer.ts`; `src/app/state/intentKinds.ts`; `src/ui/bindings/builderFacade.ts`; `src/ui/bindings/viewmodels/builderVM.ts`; `src/ui/builder/BuilderToolbar.svelte`.

Deleted: `src/domain/grid/CellMarkerFlag.ts`.

Test files modified in proportion: `test/domain/grid/CellMarker.test.ts`; `test/domain/grid/Cell.test.ts`; `test/domain/grid/GridOps.test.ts`; `test/domain/format/v1.test.ts`; `test/domain/anagram/Anagram.test.ts`; `test/domain/chain/LengthPattern.test.ts`; `test/ui/bindings/viewmodels/gridVM.test.ts`; `test/ui/bindings/viewmodels/builderVM.test.ts`; `test/ui/bindings/builderFacade.test.ts`; `test/builder/state/internal/fillMode.test.ts`; `test/builder/state/internal/joinSubMode.test.ts`; `test/builder/state/internal/reconcileWords.test.ts`; `test/ui/bindings/viewmodels/anagramVM.test.ts`; `test/app/state/intentKinds.test.ts`; `test/builder/state/reducer.test.ts`. Docs: `llmworkspace/architecture.md`; `llmworkspace/architecture_smells.md`.

### Verification

- `npm run ci` at close: eslint + `madge --circular` clean; `svelte-check` 0 errors / 0 warnings; **86 test files / 1249 tests green** (from 85 files / 1229 tests after #3 — +1 file `ChainAdmission.test.ts`, +20 tests: +21 new admission tests, −1 vacuous mutual-exclusion case that became unrepresentable); the single-file production build succeeded.
- `ChainAdmission.test.ts` pins every `canLink` and `canReattach` outcome and the exact `message` text for every reason code.
- Existing suites stayed green without weakened assertions; no source-file edits were needed outside the marker/admission migration.

### Consequence (change cost after)

A new marker-related feature (e.g. diagonal markers or user-defined marker glyphs) touches: `CellSeparator` (if new kinds), `CellMarker` (add axis or new separator), the v1 format adapter (`markerFromJson` / `markerToJson`), and the call sites that render the new separator. A new admission rule (e.g. "no link between two parallel words of the same length") touches `ChainAdmission.canLink` and its `message` function. The Builder handlers stay thin. The six-site marker-interpretation drift and the unreachable admission policy are gone.

---

## 5. The event-fold pipeline has two owners and a redundant stage — resolved 2026-10-13

### The smell (recap)

`ReducerResult<S>` promised `(state, events) → { state, events: DomainEvent[] }`, but `events` meant two things depending on the caller. Sub-reducers returned their *fresh* events (toasts, modal-requests, external effects) under that field; `reduceApp`'s `routeToBuilder` / `routeToPlayer` ran `applyEventsToApp` on the sub-reducer's events and returned only the *leftovers* (external effects) under the same field. The store then ran `applyEventsToApp` **again** on those leftovers — a guaranteed no-op pass, since the only kinds that survived into it (`download`, `clear-builder-storage`, `clear-player-storage`, `load-player-progress`) fell straight through `applyEventsToApp`'s `leftover.push(e)` branch. The duplicated confirm-clearing (`CONFIRMABLE_INTENT_KINDS` check + `modal: null, pendingConfirmIntent: null` reset, copy-pasted between `routeToBuilder` and `routeToPlayer`) was the per-experience parallelism of smell #1 surfacing at the app layer. See `architecture_smells.md` §5 for the original audit.

### Decision

Options considered and their fates:

- **A — fold only in the store; reducer returns raw events** (single owner = store, matching §3 Layer 2's stated ownership): **chosen**. `reduceApp`'s job becomes state composition + post-`confirm-*` clear; sub-reducer events bubble up raw. The store's `applyEventsToApp` call becomes the single fold site. `events` means one thing at every call site. The implicit contract "sub-reducers do not emit `modal-request` events for `confirm-*` intents" was already upheld (the confirm handlers run their action; they don't open another modal) and is unchanged by this fix.
- **B — fold only in the reducer; store consumes leftovers**: rejected. The architecture doc §3 Layer 2 already named the store as the event folder; folding in the reducer would have contradicted the doc and would have made the reducer responsible for both state composition and external-world interpretation — two concerns instead of one.
- **C — minimum diff (delete only the store's second `applyEventsToApp` call)**: rejected as an end state. The dual ownership (reducer folding *and* store folding — though now the store would do nothing meaningful) remained, and `events` still meant two things. Cheaper than A but accepted the smell's structural failure.
- **D — rename `ReducerResult.events` to `leftoverEvents` (or split into `stateUpdates` + `externalEffects`)**: rejected as a fix. Renaming alone doesn't change the contract — the reducer still had to interpret events into one bucket or another; A solves the underlying problem more directly. Splitting into two fields is a future option if a new event kind blurs the line, but right now `DomainEvent`'s two-bucket taxonomy (state-affecting vs external) is small and stable.

The duplicated confirm-clearing was not its own option — every option in the above set had to address it, since the rule applies to *both* routing helpers regardless of who folds. Extracted into a local `clearPendingConfirm(s: AppState): AppState` helper in `reducer.ts` so the rule is named once and applied twice.

### Design as implemented

**`src/app/state/reducer.ts`** — `reduceApp` no longer imports or calls `applyEventsToApp`. The top-of-function App-level intent switch (`navigate`, `cancel-modal`, `dismiss-toast`, `report-*-failure`) is unchanged — those cases always returned raw events. `routeToBuilder` and `routeToPlayer` are now thin policy adapters:

```ts
function clearPendingConfirm(s: AppState): AppState {
  return { ...s, modal: null, pendingConfirmIntent: null };
}

function routeToBuilder(intent: BuilderIntent): ReducerResult<AppState> {
  const r = reduceBuilder(state.builder, intent, deps);
  const merged = { ...state, builder: r.state };
  const final = CONFIRMABLE_INTENT_KINDS.has(intent.kind) ? clearPendingConfirm(merged) : merged;
  return { state: final, events: r.events };
}
```

`routeToPlayer` is the symmetric shape. The two helpers share only the `clearPendingConfirm` rule (the per-experience parallelism of smell #1 that surfaced here is now down to one line: the sub-reducer call and the slice field). The implicit contract "sub-reducers don't emit `modal-request` events for `confirm-*` intents" remains a property of the sub-reducers (none do); no defensive stripping is needed.

**`src/app/state/effects.ts`** — unchanged. The function still does exactly what its name promises (apply events to AppState, separating folded state from leftover external events); it just has one caller now instead of two.

**`src/ui/bindings/appStore.svelte.ts`** — unchanged. Its dispatch loop (`reduceApp` → `applyEventsToApp` → set rune → iterate leftovers) is now the *only* fold path, which is what §3 Layer 2 has always described.

**`src/app/state/intentKinds.ts`** — unchanged. `CONFIRMABLE_INTENT_KINDS` is still consulted by `reduceApp` for the post-`confirm-*` clear.

### Deliberate behaviour changes

None. Every dispatch reaches the same state and the same observable side effects as before. The dead pass is removed; the store's `applyEventsToApp` call now actually does work on every dispatch that produces sub-reducer events (toast and modal-request events).

### Files

Modified: `src/app/state/reducer.ts`; `test/app/state/reducer.test.ts` (the two `report-import-read-failure` / `report-pick-failure` tests that asserted on folded `state.toasts` now assert on raw `result.events`; one new test `'reduceApp: returns sub-reducer toast events raw (state.toasts unchanged; fold happens in the store)'` pins the new contract); `llmworkspace/architecture.md` (§5 `reduceApp fold` and `AppStore performs external side effects` paragraphs rewritten to describe raw-events-out / single-fold-in and to make the store's role as sole interpreter explicit); `llmworkspace/architecture_smells.md` (§5 status line); this file (header status list).

No source modules deleted; no new source modules created; no new intent kinds, no new event variants, no port contract changes, no UI/bindings API changes.

### Verification

- `npm run ci` at close: eslint + `madge --circular` clean; `svelte-check` 0 errors / 0 warnings; **86 test files / 1250 tests green** (from 86 / 1249 after #4 — net +1: one new reducer test pinning the raw-events contract); the single-file production build succeeded (`dist/index.html` 237.35 kB, gzip 103.49 kB).
- The single new test case (`reducer.test.ts:375`, `'reduceApp: returns sub-reducer toast events raw …'`) dispatches `request-import-puzzle { fileContent: 'not valid json' }`, which the sub-reducer turns into a `toast` event; the test asserts the event is present in `result.events` and that `result.state.toasts` and `result.state.builder` are reference-equal to the input — the new contract pinned by construction.
- The two updated tests (the `report-import-read-failure` / `report-pick-failure` ones) switched from asserting `result.state.toasts` (folded) to asserting `result.events.toContainEqual({ kind: 'toast', … })` (raw). All other assertions in those tests (sub-slice state changes, `lastImportError` writes, builder identity) are unchanged.
- Existing suites stayed green without weakened assertions. The store's `applyEventsToApp` call (unchanged in source) continues to produce the same folded `AppState` after a dispatch — proven by the unchanged `appStore.test.ts` (24 tests) and `effects.test.ts` (8 tests).
- Process: two implementation tasks in sequence (reducer.ts → reducer.test.ts), each verified by the implementer with `tsc --noEmit` and the relevant `vitest run`; the reviewer re-ran `npm run ci` for the final green.

### Consequence (change cost after)

A new event kind that updates `AppState` (e.g. an `aria-live` announcement, an undo entry) lands in `DomainEvent`, gets a case in `applyEventsToApp`'s switch, and the store's fold handles it automatically — no reducer change. A new event kind that needs external performance (e.g. a copy-to-clipboard) follows the same shape; `applyEventsToApp` puts it in the leftover pile and `performExternalEvent` adds a case. The `ReducerResult.events` field means one thing at every call site, and the store's dispatch loop reads as a single fold + single perform, exactly as the architecture doc has always described.

---

## 6. The confirm-intent contract is declared twice, checked in only one direction — resolved 2026-10-14

### The smell (recap)

`ConfirmableIntent` (`domain/notifications/Event.ts`) was a hand-maintained duplicate of the `confirm-*` variants of `BuilderIntent` and `PlayerIntent` (`builder/state/intents.ts:23, 51, 60`; `player/state/intents.ts:34`), including payload fields (`confirm-import-puzzle { fileContent }` spelled out in both places). The runtime check `CONFIRMABLE_INTENT_KINDS.has(intent.kind)` in `reduceApp` (`reducer.ts:41, 48`) decided whether to clear `state.modal` and `state.pendingConfirmIntent` after a `confirm-*` dispatch. The enforcement was one-directional: `confirmableKindRecord satisfies Record<ConfirmableIntentKind, null>` (`intentKinds.ts:62-67`) proved the record covered `ConfirmableIntent`'s kinds, but nothing proved `ConfirmableIntent` was a subset of the actual intent unions, or that payload shapes stayed in sync. Adding `confirm-foo { payload }` to `BuilderIntent` and forgetting `Event.ts` was a silent failure: `CONFIRMABLE_INTENT_KINDS` lacked the new kind, the modal-closing string-match returned false, the modal didn't close on Confirm (only on the next `cancel-modal`), and `pendingConfirmIntent`'s payload type never saw the new field. The whole modal pipeline hung on string-set membership agreements across three layers (state field → event payload → runtime kind set → facade dispatch → re-dispatch), of which exactly one was compiler-checked. See `architecture_smells.md` §6.

### Decision

The smell was first re-read as a **type-derivation problem**: two places declared the same contract, only one was checked, so fix the derivation. Three options in that framing, all rejected as primary:

- **A — derive `ConfirmableIntent` from the intent unions filtered by the `confirm-` kind prefix** (`Extract<BuilderIntent | PlayerIntent, { kind: \`confirm-${string}\` }>`): rejected as primary. Removed the duplication, but the behaviour modifier ("this intent closes a modal") was hidden inside the kind string — a string prefix acting as a behaviour modifier is a hack. Renaming `confirm-import-puzzle` to `confirm-puzzle-import` would silently change the confirmable set; the convention was load-bearing, undocumented outside one `Extract` call, and grep-resistant.
- **B — keep `ConfirmableIntent` explicit, make `BuilderIntent` / `PlayerIntent` reference it** (each confirm variant becomes `Extract<ConfirmableIntent, { target: 'builder' }>` or equivalent intersection): rejected. More code than A for the same property, strictly weaker: still requires an explicit `Equal<...>` assertion to prove the source-of-truth unions haven't drifted past `ConfirmableIntent`.
- **C — hybrid: derive, then `Assert<Equal<derived, curated>>`**: rejected. The curated list added no design value over the derivation — either it matched (ceremony) or it didn't (incoherence). Preserved a layering choice the code didn't actually need.

The re-reading that changed the framing: `CONFIRMABLE_INTENT_KINDS` and the string-match in `reduceApp` exist for **one reason** — to let the pure reducer decide whether to clear modal state. The reducer is the wrong place to make that decision. Modal lifecycle is a UI concern; the bindings layer already owns the dispatch loop, the event fold, and the modal-state mutation on the open side (`effects.ts:21-23`). The smell is a symptom of modal lifecycle being split between the reducer (close side, via string-match) and the bindings layer (open side, via event fold).

Three options in the architectural-placement framing:

- **D — move modal-clearing into the bindings layer, delete the runtime kind set entirely**: **chosen**. The bindings layer's dispatch loop already observes "did the dispatched intent consume the pending modal" via the UI invariant ("while a modal is open, other actions are disabled" — `architecture.md` §187). With that invariant, any dispatch while a modal is open must be either `cancel-modal` or the `confirm-*` intent; either way the modal closes. The rule is structural, not a string-match. `CONFIRMABLE_INTENT_KINDS` and `confirmableKindRecord` are deleted; `ConfirmableIntent` stays as the type for `AppState.pendingConfirmIntent` and `modal-request.confirmIntent` (the compiler still enforces it at the reducer emit site). The reducer's `cancel-modal` case becomes a no-op (modal clearing moves out entirely); the `routeToBuilder` / `routeToPlayer` helpers lose the `CONFIRMABLE_INTENT_KINDS.has(...) ? clearPendingConfirm(...) : merged` line and the `clearPendingConfirm` helper.
- **E — keep the string-match, fix only the type-drift risk** (marker interface on each confirm variant, derive `ConfirmableIntent`): rejected. Closes one half of the drift surface (the type side) while leaving the architectural confusion (modal lifecycle split across layers) intact. Lower churn than D but accepts the structural failure the smell is really about.
- **F — push the modal state out of `AppState` into the bindings layer entirely** (modal and pendingConfirmIntent become local to the store, not part of the AppState shape): rejected. Architecturally clean, but touches the `AppState` shape, the `dispatch` work-queue's `state` variable, every test fixture that constructs an `AppState`, and the `Modal.svelte` / `modalFacade` / `appStore` read paths. D achieves the same layering improvement at a fraction of the surface area; F is a future option if modal state ever needs to grow beyond what fits in two nullable fields.

D was chosen because it eliminates the runtime kind set (the load-bearing piece of the smell), moves modal lifecycle to its natural owner (the bindings layer), and reduces test surface rather than expanding it. The cost is one new observation step in the bindings layer's dispatch loop, one local helper deleted from `reducer.ts`, and the deletion of two runtime exports (`CONFIRMABLE_INTENT_KINDS`, `ConfirmableIntentKind`) plus their hand-maintained record. No new types, no new event variants, no new intent kinds, no `Assert<Equal<...>>` machinery, no template-literal-type tricks, no string-prefix-as-behaviour-modifier.

**The marker-interface proposal (E's mechanism, considered as a follow-up):** with D chosen, the type-drift risk for `ConfirmableIntent` is caught at the reducer emit site (each reducer that emits `modal-request` must pass a value assignable to `ConfirmableIntent`; the type is hand-listed). Adding `confirm-foo { payload }` to `BuilderIntent` and forgetting to extend `ConfirmableIntent` makes the emit fail to typecheck — caught at compile time, with a clear error pointing at the emit site. That is sufficient enforcement for the smell.

A marker interface (`__confirmable: true` on each confirm variant; `ConfirmableIntent = Extract<BuilderIntent, { __confirmable: true }> | Extract<PlayerIntent, { __confirmable: true }>`) would additionally make `ConfirmableIntent` self-maintaining: forgetting to mark a new confirm variant would silently exclude it from the union. The marker adds one compile-time guarantee (the kind-list is auto-derived from the marker) at the cost of a phantom field on every confirm variant and one more piece of type machinery. **Not adopted in this fix.** The drift surface it would close is already closed by D's emit-site enforcement. If a future contributor wants the kind list to be a *property* of each variant rather than a hand-maintained union, the marker is a low-cost follow-up; the present fix leaves `ConfirmableIntent` as a hand-listed type and records this rationale so the choice survives.

### Design as implemented

**`src/app/state/reducer.ts`** — `reduceApp` no longer imports `CONFIRMABLE_INTENT_KINDS`. The `cancel-modal` case in the top-of-function `AppIntent` switch becomes a no-op (`return { state, events: [] }`) — modal clearing moves out of the reducer entirely. The local `clearPendingConfirm` helper is deleted. `routeToBuilder` and `routeToPlayer` are reduced to their core responsibility (compose the sub-reducer's state and pass its events through raw):

```ts
function routeToBuilder(intent: BuilderIntent): ReducerResult<AppState> {
  const r = reduceBuilder(state.builder, intent, deps);
  return { state: { ...state, builder: r.state }, events: r.events };
}

function routeToPlayer(intent: PlayerIntent): ReducerResult<AppState> {
  const r = reducePlayer(state.player, intent, deps);
  return { state: { ...state, player: r.state }, events: r.events };
}
```

The `switch (intent.target)` dispatch at the bottom is unchanged. The end-of-function unknown-kind throw is preserved as a defensive guard.

**`src/app/state/intentKinds.ts`** — `CONFIRMABLE_INTENT_KINDS`, `ConfirmableIntentKind`, the `import type { ConfirmableIntent }` line, and the `confirmableKindRecord satisfies Record<...>` are deleted. `BUILDER_INTENT_KINDS` and `PLAYER_INTENT_KINDS` remain; they are still consulted by `intentKinds.test.ts` for the kind-set coverage assertions and are still exported (future tests may need them).

**`src/domain/notifications/Event.ts`** — `ConfirmableIntent` is unchanged. It is still the type of `AppState.pendingConfirmIntent` (`app/state/state.ts:15`) and the type of `modal-request.confirmIntent` (`Event.ts:9`). The compiler enforces it at every reducer that emits `modal-request`: each such emit site assigns a `BuilderIntent` / `PlayerIntent` variant to the `confirmIntent` field, which must be assignable to `ConfirmableIntent`. Drift in the type side (forgetting to extend `ConfirmableIntent` when adding a confirm variant) produces a typecheck error at the emit site, not a runtime bug.

**`src/ui/bindings/appStore.svelte.ts`** — the dispatch work-queue gains one observation step after `applyEventsToApp` folds the sub-reducer's events:

```ts
while (activeQueue.length > 0) {
  const next = activeQueue.shift();
  if (next === undefined) break;
  const modalWasOpen = s.modal !== null;
  const result = reduceApp(s, next, d);
  const folded = applyEventsToApp(result.state, result.events, d);
  s = folded.state;
  // Any dispatch while a modal is open closes it. The UI invariant from
  // architecture.md §187 says other guarded controls are disabled while a
  // modal is open, so the only legal dispatches are cancel-modal or the
  // stashed confirm intent — both of which must clear the modal state.
  if (modalWasOpen) {
    s = { ...s, modal: null, pendingConfirmIntent: null };
  }
  state = s;
  for (const event of folded.leftoverEvents) {
    const followup = performExternalEvent(event);
    if (followup !== null) {
      activeQueue.push(followup);
    }
  }
}
```

The `modalWasOpen` snapshot is taken before `reduceApp` runs, so even a no-op reducer return (or a reducer that returns state unchanged) clears the modal — the user's confirm intent is consumed regardless of whether the sub-reducer acted on it. `cancel-modal` still clears the modal because the reducer's case is now a no-op (it returns state unchanged) and the bindings layer's `modalWasOpen` check fires anyway.

**`src/ui/shared/Modal.svelte` / `src/ui/bindings/modalFacade.ts`** — unchanged. The facade still exposes `getPendingConfirm()` and `actions.confirm()` / `actions.cancel()`; the dispatched intent type is unchanged; `ModalActions.confirm()` still dispatches `pendingConfirmIntent`.

### Deliberate behaviour changes

None. Every dispatch reaches the same state and the same observable side effects as before. The post-confirm modal clear that was previously performed inside `reduceApp`'s string-match now happens in the bindings layer's dispatch loop, after `reduceApp` returns — same outcome (modal closed, `pendingConfirmIntent` null), different mechanism. The `cancel-modal` clear moves from "handled by reducer case" to "handled by bindings layer observation" — same outcome. The reducer's `clearPendingConfirm` helper is deleted; its single call site (the two routing helpers) is replaced by an unconditional pass-through of the sub-reducer's state.

The drift scenario in the smell (add `confirm-foo` to `BuilderIntent`, forget `Event.ts`) now has a single failure mode: the reducer that emits `modal-request` with `confirm-foo` fails to typecheck, naming the emit site. The smell's documented runtime failure ("the modal closes only via the next `cancel-modal`") is structurally impossible — there is no string-match that can return false for a missing kind.

### Files

Modified: `src/app/state/reducer.ts` (deleted `clearPendingConfirm`; `cancel-modal` now returns `{ state, events: [] }` with a comment pointing to the bindings layer; `routeToBuilder` / `routeToPlayer` lost the `CONFIRMABLE_INTENT_KINDS.has(...)` conditional; removed the `CONFIRMABLE_INTENT_KINDS` import); `src/app/state/intentKinds.ts` (deleted `ConfirmableIntentKind`, the `import type { ConfirmableIntent }` line, `confirmableKindRecord`, `CONFIRMABLE_INTENT_KINDS`); `src/ui/bindings/appStore.svelte.ts` (dispatch loop gained the `modalWasOpen` snapshot and the post-fold clear step); `test/app/state/reducer.test.ts` (deleted the four `'reduceApp: confirm-* clears modal and pendingConfirmIntent'` tests; renamed and rewrote the `'cancel-modal'` test to `'cancel-modal returns state unchanged; modal clearing happens in bindings layer'`, asserting `result.state === state`); `test/app/state/intentKinds.test.ts` (deleted the `CONFIRMABLE_INTENT_KINDS` import, the `CONFIRMABLE_KINDS` array, the `'CONFIRMABLE_INTENT_KINDS contains exactly the ConfirmableIntent kinds'` test, the `'every ConfirmableIntent kind is a Builder or Player kind'` test, and the `CONFIRMABLE_INTENT_KINDS.has(kind)` line in the AppIntent-not-in-any-set test); `test/ui/bindings/appStore.test.ts` (added the four modal-clearing observation tests: `'appStore: dispatching a confirm-* intent while a modal is open closes the modal and clears pendingConfirmIntent'`, `'appStore: dispatching cancel-modal while a modal is open closes the modal and clears pendingConfirmIntent'`, `'appStore: dispatching a non-modal action while no modal is open leaves modal and pendingConfirmIntent null'`, `'appStore: dispatching a confirm-* intent while no modal is open leaves modal and pendingConfirmIntent null'`); `llmworkspace/architecture.md` (§5 `reduceApp` paragraph: removed the post-`confirm-*` clause and added a sentence pointing to the bindings layer; §5 `Routing` paragraph: replaced the `CONFIRMABLE_INTENT_KINDS remain as the kind-set records` sentence with one noting `CONFIRMABLE_INTENT_KINDS` is no longer exported; §5 `Confirmation modals as state` paragraph: removed the `clearing both fields` clause from the `cancel-modal` description and added the structural-rule explanation); `llmworkspace/architecture_smells.md` (§6 status line); this file (header status list).

No new source modules; no intent, event, or port contract changes; no UI component changes; no `Modal.svelte` / facade API changes; no `AppState` shape changes.

### Verification

- `npm run ci` at close: eslint + `madge --circular` clean; `svelte-check` 0 errors / 0 warnings; **86 test files / 1248 tests green** (from 86 files / 1250 tests after #5 — net −2: −4 deleted reducer tests, −2 deleted intentKinds tests, +4 new appStore tests, +1 renamed reducer test net-zero on count); the single-file production build succeeded (`dist/index.html` 235.96 kB, gzip 103.24 kB).
- The four new appStore tests pin the bindings-layer observation directly: each constructs an `AppState` with a non-null `modal` / `pendingConfirmIntent`, dispatches an intent via `store.dispatch(...)`, and asserts the post-dispatch `getModal()` and `getPendingConfirmIntent()` return `null`. The "non-modal action while no modal is open" test asserts the new code path is a no-op when no modal is present (the `modalWasOpen` snapshot is false). The "confirm-* intent while no modal is open" test asserts the symmetrical no-op and additionally pins that the sub-reducer's effect still ran (`store.getBuilder().mode === 'design'`) — important because the bindings-layer rule fires on `modalWasOpen`, not on intent kind, so a stale dispatched confirm-* intent after the modal was already closed (e.g. a race) cannot accidentally clear state that was already null, and the sub-reducer must still act on the dispatched intent.
- Type-level proof: with `ConfirmableIntent` unchanged as a hand-listed union, the existing emit-site enforcement applies — every reducer that emits `modal-request` (`builder/state/internal/designMode.ts`, `builder/state/internal/importExport.ts`, `builder/state/internal/lifecycle.ts`, `player/state/internal/lifecycle.ts`) must pass a value assignable to `ConfirmableIntent`. Adding `confirm-foo { payload }` to `BuilderIntent` without extending `ConfirmableIntent` causes `tsc` to fail at the emit site naming the new variant, with the fix message pointing at `Event.ts`. No runtime drift is possible because the runtime kind set no longer exists.
- Process: three implementation tasks dispatched in parallel (reducer.ts + reducer tests; intentKinds.ts + intentKinds tests; appStore.svelte.ts + new appStore tests), each verified by the implementer with `npx tsc --noEmit` and the relevant `vitest run`; one mid-flight observation (a pre-existing `appStore: dispatch cancel-modal clears getModal() and getPendingConfirmIntent()` test was previously failing because it relied on the reducer's modal-clearing behaviour and now passes as a side effect of the bindings-layer observation — no test edit was needed, the change in behaviour is exactly what the test always intended to assert); the reviewer re-ran `npm run ci` for the final green.

### Consequence (change cost after)

A new guarded user action (a fifth request/confirm pair, e.g. "really discard the in-progress anagram?") lands in three places: a `request-*` intent in the appropriate union, a `confirm-*` intent variant in the appropriate union, and a matching entry in `ConfirmableIntent` (`Event.ts`). The emit site that emits `modal-request` is where the type-checked reference happens — the compiler names `Event.ts` in the error if the `ConfirmableIntent` entry is forgotten. No runtime kind set to keep in sync; no string-match to verify; no `satisfies Record<Kind, null>` to update. Modal lifecycle is now owned by exactly one layer (the bindings layer's dispatch observation), with the reducer no longer carrying any modal-state mutation in its post-routing logic. If a future contributor wants the `ConfirmableIntent` kind list to be auto-derived from a marker on each confirm variant (closing the only remaining drift surface — the type's hand-maintained entries), the marker-interface proposal in the Decision section is a low-cost follow-up; it is not adopted here because the emit-site enforcement already catches the same drift vector with lower type-system surface area. The smell-#6-adjacent leftover is none.

---

## 7. Port consumers do not trust the port contract — resolved 2026-10-14

### The smell (recap)

`architecture.md` §3 Layer 4 stated the port contract plainly: port methods never throw; storage reads return `string | null`; "Consumers add no redundant catch layers — callers check returns, they do not catch." The port implementations honoured it (`localStoragePort` caught and coerced everything; `filePickPort` resolved failures as data). The consumers did not.

- `main.ts` wrapped `ports.storage.loadBuilder()` in a try/catch with its own warn-and-fall-back policy.
- `appStore.svelte.ts` wrapped `ports.storage.loadPlayerProgress(key)` in a try/catch with its own warn policy.
- `persistenceCodec.ts` parsers wrapped the entire body (including `JSON.parse`) in try/catch with per-branch `console.warn` calls — a third warn policy, distinct from the appStore's and the port's.
- The "player in import phase ⇒ nothing to save" invariant was enforced at **three** layers (`persistenceCodec.ts:85`, `persistenceScheduler.ts:62`, `persistenceScheduler.ts:40`) — each defending against the other two being wrong.
- Two reads, three warn policies, four sites of defensive duplication, and the doc said otherwise. See `architecture_smells.md` §7 for the evidence table and the per-site line-number inventory.

### Decision

The smell was first read as a **defensive-layering problem**: callers wrap port calls and parser calls in try/catch because they don't trust the type signature to express failure. Two readings, both surface-level:

- **(rejected)** "Trust the contract; just delete the catches." The minimum-churn option closes the symptom (fewer `try` blocks) but does not close the root cause — the failure channel is still invisible to the compiler. A future port that breaks the contract (e.g. IndexedDB exception surfaces that localStorage doesn't) would only blow up at runtime, where the consumer's catch might mask it. Not enough.
- **(rejected)** "Document the read-failure policy explicitly; unify the warns via a single helper." This accepts the defensive posture as authoritative and centralises the warn site. It papers over the same hole that produced the smell — the type doesn't carry the failure channel, so future ports will keep re-fanning out.
- **(chosen) A — make the contract compile-checkable.** Introduce `LoadResult<T>` (a discriminated union carrying `loaded` / `absent` / `failed`) for storage reads. The port returns the union; consumers pattern-match. Centralise the *port-level* diagnostic in one place (the adapter's own `console.warn` on `failed`); consumers do not warn on load. Centralise the *parse-level* diagnostic in one place (the consumer's "parse returned null" warn, kept where it already was); the codec is silent.

Why A wins: the smell's root cause is that the failure channel was invisible at the type level, so each consumer re-decided what to do on failure. With `LoadResult<T>`, the compiler enforces the contract, and the duplication collapses by construction. The 'absent' and 'failed' arms stay distinguishable in the union (not collapsed to a single shape) so a future port that surfaces a meaningful difference does not require another breaking change. The third "phase !== 'solving'" guard survives as the single owner of that invariant (the serializer); the two scheduler copies are deleted.

A was chosen over "minimum-churn" because the user explicitly framed this work as architecture improvement, not as small diff. The cost is one new exported type, two consume-site refreshes, a codec-silence pass, and a scheduler dedupe — well-scoped and all in the original `ui/bindings/` / `domain/ports/` surface that the smell itself identified.

A was also chosen over "introduce a runtime helper to consolidate warns." The warns are *deliberately* at two layers (port-level failure vs. parse-level corruption) — those are distinct concepts and stay separately visible. A shared helper that swallowed both would lose the distinction and re-obscure the boundary the fix is meant to clarify.

### Design as implemented

**`src/domain/ports/ports.ts`** — new exported union, alongside `PickResult` and `DroppedFileResult`:

```ts
export type LoadResult<T> =
  | { kind: 'loaded'; value: T }    // bytes successfully read
  | { kind: 'absent' }              // nothing stored under this key — silent
  | { kind: 'failed'; error: Error }; // the underlying primitive threw
```

`StoragePort.loadBuilder()` and `StoragePort.loadPlayerProgress(key)` both now return `LoadResult<string>`. Write-method signatures are unchanged (`saveBuilder`, `clearBuilder`, `savePlayerProgress`, `clearPlayerProgress` keep `Error | null`).

**`src/ports/localStoragePort.ts`** — implements the new shape. The `failed` arm still carries the existing single `console.warn` (this is the "warn once in the adapter" the doc specifies). Write paths are byte-identical to before:

```ts
loadBuilder(): LoadResult<string> {
  try {
    const value = localStorage.getItem(BUILDER_KEY);
    return value === null ? { kind: 'absent' } : { kind: 'loaded', value };
  } catch (err) {
    console.warn('localStoragePort.loadBuilder failed:', err);
    return { kind: 'failed', error: err instanceof Error ? err : new Error(String(err)) };
  }
},
// loadPlayerProgress is structurally identical
```

Non-`Error` throws are coerced to `Error` at the boundary, exactly as before.

**`test/fakes/InMemoryStoragePort.ts`** — implements the new shape. The `throwOnNextLoad: boolean` mechanism (which simulated a port-author contract violation by throwing) is replaced with `simulateFailure: Error | null` — the next load returns `{ kind: 'failed', error: simulateFailure }` and clears the flag. The fake never throws, in line with the contract. `nextWriteError` on write methods is unchanged.

**`src/main.ts`** — `loadInitialAppState` now consumes `LoadResult` directly. The try/catch around the port call is deleted. The single remaining warn ("main: parseBuilderSnapshot returned null; starting fresh.") is the parse-corruption diagnostic, distinct from the port-level warn that lives in `localStoragePort.loadBuilder`:

```ts
const result = ports.storage.loadBuilder();
if (result.kind !== 'loaded') {
  return freshBlank();    // 'absent' or 'failed' — same fresh-start response
}
const snapshot = parseBuilderSnapshot(result.value);
if (snapshot === null) {
  console.warn('main: parseBuilderSnapshot returned null; starting fresh.');
  return freshBlank();
}
```

**`src/ui/bindings/appStore.svelte.ts`** — `handleLoadPlayerProgress` gets the same shape. The try/catch and the `let blob: string | null` intermediate are gone; the port-failure warn at the old line 144 is gone (the port already warned); the parse-null warn stays:

```ts
const result = ports.storage.loadPlayerProgress(key);
if (result.kind !== 'loaded') {
  return null;    // 'absent' silent; 'failed' was warned once by localStoragePort
}
const parsed = parsePlayerProgress(result.value);
if (parsed === null) {
  console.warn('appStore: parsePlayerProgress returned null (NFR-9 silent drop)');
  return null;
}
```

The two warn policies are now legible: port-level failure lives at the adapter (`localStoragePort`); parse-level corruption lives at the consumer's "parse returned null" line in each call site.

**`src/ui/bindings/persistenceCodec.ts`** — parsers become total: every shape-mismatch path returns `null` silently. The outer try/catch around each parser is collapsed to a single `try { parsed = JSON.parse(blob); } catch { return null; }` over just the JSON parse step. The manual `throw new Error(...)` calls in `parsePlayerProgress` (three sites — row-not-array, cell-not-string, invalid-letter) are replaced with a manual nested loop that returns `null` on first invalid leaf. The `GridSizeCtor.of(...)` call (which threw on bad input) is changed to `GridSizeCtor.try(...)` so the symmetric `null`-on-failure idiom holds across the type system. External signatures are unchanged (`parseBuilderSnapshot(blob: string): BuilderSnapshot | null`, `parsePlayerProgress(blob: string): PlayerProgressBlob | null`). The `serializePlayerProgress` `phase !== 'solving'` guard is preserved verbatim — it is now the single owner of that invariant.

**`src/ui/bindings/persistenceScheduler.ts`** — the two redundant guards are deleted (`schedulePlayerSave`'s top-of-function `if (state.phase !== 'solving') return;` and `doSavePlayer`'s `if (state.phase !== 'solving') return;`). Observable behaviour is preserved: a non-solving state still produces no write. In `doSavePlayer`, the `state.puzzle.key` read is moved below `serializePlayerProgress`'s null-check and narrowed with `Extract<PlayerState, { phase: 'solving' }>` so the compiler can see that the access is sound without re-introducing the phase guard. `flush()` is untouched. `scheduleBuilderSave` / `doSaveBuilder` are untouched (the codec's serialization is total — no null return path).

**`test/ui/bindings/persistenceCodec.test.ts`** — new file, mirroring the source. 19 test cases: round-trip on Builder snapshot and Player progress; shape-mismatch returns null; serializer returns null for non-`solving` PlayerState (single-owner assertion); every "no warn" assertion uses `vi.spyOn(console, 'warn')` to assert silence. The pre-existing test file `test/ui/bindings/persistenceScheduler.test.ts` had four warn-expectations on the codec path; those are flipped to silence assertions after the codec change.

### Deliberate behaviour changes

- Port reads no longer log a second warn at the consumer. Previously a storage read failure produced two warns (port + consumer); now exactly one (port). The pre-existing `appStore.test.ts` assertion that the consumer does not throw on storage failure is retained; the assertion that the consumer did *log* on storage failure is flipped to `not.toHaveBeenCalled()` to pin the new contract.
- `parseBuilderSnapshot` and `parsePlayerProgress` are now silent on shape mismatch. Previously each branch emitted its own `console.warn`; the parse failure was — by volume — the loudest path in the persistence chain. The single consumer-side warn ("parse returned null") carries the diagnostic from now on. Tests pin this with `vi.spyOn(console, 'warn')`.
- A non-`solving` PlayerState now flows through `schedulePlayerSave` (sets the pending snapshot, arms the 400 ms timer) without an early return. The timer fires, `serializePlayerProgress` returns `null`, the save is a no-op. Cosmetically a 400 ms timer + a no-op write per dispatched event during the import phase; observably identical to before. The third "phase guard" disappears with the scheduler copies.

### Files

- `src/domain/ports/ports.ts` — `LoadResult<T>` added; `StoragePort` read signatures updated.
- `src/ports/localStoragePort.ts` — implements `LoadResult` on both reads; existing single warn preserved.
- `src/main.ts` — `loadInitialAppState` consumes `LoadResult` directly; one try/catch and one intermediate `let` removed.
- `src/ui/bindings/appStore.svelte.ts` — `handleLoadPlayerProgress` consumes `LoadResult` directly; one try/catch and one intermediate `let` removed.
- `src/ui/bindings/persistenceCodec.ts` — parsers are total and silent; `phase` guard is now the single owner of the import-phase invariant.
- `src/ui/bindings/persistenceScheduler.ts` — two redundant `phase` guards deleted; `Extract<PlayerState, { phase: 'solving' }>` cast added at the post-serialize access site.
- `test/fakes/InMemoryStoragePort.ts` — `throwOnNextLoad` replaced with `simulateFailure`.
- `test/ports/localStoragePort.test.ts` — 14 tests rewritten to assert on `LoadResult` (kind discriminators and union members).
- `test/fakes/InMemoryStoragePort.test.ts` — 6 tests rewritten for `LoadResult`; the "throws when throwOnNextLoad is set" case is replaced with "returns failed when simulateFailure is set, then clears the flag".
- `test/ui/bindings/appStore.test.ts` — 1 test renamed/adapted; `throwOnNextLoad` replaced with `simulateFailure`; the consumer-no-warn assertion pinned.
- `test/ui/bindings/persistenceCodec.test.ts` — new, 19 tests.
- `test/ui/bindings/persistenceScheduler.test.ts` — 4 warn-expectations flipped to silence assertions after the codec change.
- `llmworkspace/architecture.md` §3 Layer 4 (port contract) — the "Storage reads" bullet and the "Consumers add no redundant catch layers" bullet amended to specify the new shape and the type-enforced contract.

### Verification

- `npm run test`: 87 files, 1266 tests, all green (was 80 files / 1154 tests before this resolution; the 19-test codec mirror file is the bulk of the growth, the rest comes from other in-flight resolutions).
- `npm run lint`: clean (eslint + madge, no cycles).
- `npx tsc --noEmit`: clean.
- `npx vitest run test/ui/bindings/persistenceCodec.test.ts test/ui/bindings/persistenceScheduler.test.ts`: 53 passed (the new 19 + the existing 34).
- `npx vitest run test/ports test/fakes`: 53 passed (Task 1's contribution, preserved end-to-end).
- `npx vitest run test/ui/bindings/appStore.test.ts`: 28 passed, including the renamed silent-failure case.
- Process: four implementation tasks. Task 1 (type + port impl + fake + port tests) ran first, was verified at 53 passing locally before Tasks 2/3/4 were dispatched. Tasks 2 (main.ts), 3 (appStore), 4 (codec + scheduler + codec tests) ran in parallel and each self-verified the file it touched typecheck-clean and lint-clean; the reviewer re-ran `npm run test` and `npm run lint` for the final green at 1266 + clean.

### Consequence (change cost after)

Adding a new storage read (e.g. a `loadAppSettings()` slot in a future feature) is a single interface change. The port's new method returns `LoadResult<T>`; the caller pattern-matches; the port warns once on `failed`. No "where do I add the catch?" decision; no "which warn policy does this consumer use?" decision; no "is the `phase` guard supposed to be here?" question. The four sites of defensive duplication collapse: `main.ts` is silent on load, `appStore` is silent on load, the codec is silent on parse failure, the scheduler is silent on the import phase. Two distinct warn sites remain — the port's adapter warn and the two existing parse-null warns at each consumer — and they correspond to two genuinely distinct concepts: port-level storage failure versus parse-level data corruption.

A future port author who breaks the never-throw contract (e.g. an IndexedDB port that lets a `DOMException` escape) will surface as a non-matching `kind` at every caller — which, under the new signature, *is a compile error* on the call site that catches it, rather than a runtime surprise eaten by a defensive try/catch. The contract is now load-bearing in the type system, not aspirational.

The smell-#7-adjacent leftovers are none: the load-side and save-side invariants are now each owned by exactly one layer; the "absence of redundant catch layers" rule is type-enforced rather than by-convention; and the test mirror discipline (smell #8's separate concern) is restored for `persistenceCodec.ts` via the new test file.

---

## 8. Persistence lifecycle is incomplete: `flush()` is dead, and the boot-time data-loss window is unwired — resolved 2026-10-14

### The smell (recap)

Four sub-issues on the persistence seam, all recorded in `architecture_smells.md` §8. Three still stood at HEAD; the fourth (the test-mirror claim against `persistenceCodec.ts`) had become stale between the audit and the resolution — `test/ui/bindings/persistenceCodec.test.ts` exists, so that sub-issue is now closed by an earlier resolution (#7's "Files" list names it) and is recorded here only as an audit-correction. The three live sub-issues:

1. `PersistenceScheduler.flush()` was defined, exported, and tested — and called by nothing in `src/`. The architecture doc described it as "used by boot/teardown" (§3 Layer 2 table) and §8 discussed flush results — but no teardown existed. No `beforeunload`, no `pagehide`, no `visibilitychange`. Any debounced-but-unfired save (up to 400 ms of work) was silently dropped when the tab closed or navigated. The mechanism was built and tested; the wiring was never done.
2. Reload invariants were enforced twice, by hand, in two layers: `subMode: 'none'` was forced on **save** (`persistenceCodec.ts:32-34`) and again on **load** (`main.ts:69`); `cursor` was omitted on save and re-nulled on load (`main.ts:70`). Two hand-sync points for the same invariant.
3. `main.ts:65-71` reconstructed `BuilderState` field-by-field — `puzzle`, `displacedClues`, `mode`, `subMode`, `cursor`, plus the `AppState` wrapper with `route`, `player`, `toasts`, `modal`, `pendingConfirmIntent`. The `BuilderState` shape and its reload rules lived in the one file with no lint boundary of its own (Layer 5 is a free-import layer; the `no-restricted-imports` rules don't constrain it).

### Decision

The four sub-issues are the same seam from four angles — an unwired lifecycle, duplicated invariants across the seam, knowledge of the post-load shape escaping the seam, and a stale audit claim. Treating them as a single resolution is the architecturally correct move: the seam is the unit, and any partial fix leaves a half-fixed boundary that future work will keep tripping over. The same logic the user applied to every prior resolution (#1-#7) — "we are not trying to get it fixed asap, we are improving the architecture" — applied here too.

Options considered and their fates:

- **A — wire only `flush()` (pagehide handler).** Cheapest. Closes sub-issue 1 only. Leaves sub-issues 2 and 3 untouched. The doc still describes a mechanism ("used by boot/teardown") that doesn't match the code; `main.ts` still hand-assembles `BuilderState`; `subMode: 'none'` is still enforced twice. *Rejected* as the default per the user's framing — minimum diff is not the goal here. Recorded as a fall-back in case the broader fix proved impractical (it did not).
- **B — A + collapse the duplicated reload invariants into the codec.** `parseBuilderSnapshot` returns a full `BuilderState` directly (with `subMode: { kind: 'none' }` and `cursor: null` baked in); the serialize side drops the `subMode: 'none'` wire field. `main.ts` becomes a single call. Closes 1 + 2 + (most of) 3. *Strong fallback.* Picked up almost verbatim in the chosen package, but with the seam ownership moved one layer further: the codec stays a pure round-tripper, and the `BuilderState` reconstruction moves to a new `boot.ts`.
- **C — B + introduce `createInitialAppState(ports, deps)` in `ui/bindings/`, drop the hand-assembly in `main.ts` entirely.** Closes all three live sub-issues: the seam has a single owner (`boot.ts`), the codec stays pure, `main.ts` holds no domain knowledge. The `BuilderState` reload shape lives in one place and is named in the architecture doc. The change to a new module costs about 40 lines of new code (the factory + 9 tests) and removes about 30 lines from `main.ts`. **Chosen.**
- **D — C + extract the pagehide wiring into a `teardown.ts` peer module (`installTeardown(store)`).** Closes the testability gap on the teardown side: `main.ts` is currently untested (the only source file with no test mirror), and the pagehide wiring is a meaningful behavioural contract. A two-line extraction lets `test/main.test.ts` test the wiring without importing `main.ts` and triggering its module-level DOM side effects in the node test environment. *Adopted during implementation* — the Senior extracted it as the cleanest way to satisfy the new test cases. The cost is one extra module; the benefit is testable teardown.

Approved package: **C + D**, with A as a documented fallback (not used).

### Design as implemented

**`src/ui/bindings/boot.ts` (new).** Sole owner of the `BuilderState` reload shape.

```ts
export function createInitialAppState(ports: AppPorts, deps: AppDeps): AppState;
```

The function: calls `ports.storage.loadBuilder()` (`LoadResult<string>` from the #7 fix). On `'absent'`, `'failed'`, or `parseBuilderSnapshot` returning `null`, returns `AppState.blank(GridSize.DEFAULT, PuzzleKey.generate(deps.rng))` with `player: PlayerState.importScreen()`, `route: 'landing'`, `toasts: []`, `modal: null`, `pendingConfirmIntent: null`. On a valid snapshot, returns the full `AppState` with `builder: { puzzle, displacedClues, mode, subMode: { kind: 'none' }, cursor: null }`, `player: PlayerState.importScreen()`, `route: 'landing'`. The `subMode: { kind: 'none' }` + `cursor: null` literal lives in exactly one place in the codebase (this file). A small `freshBlank(deps)` helper inside the module avoids repeating the wrapper fields. `deps.rng` is called exactly once on the blank path (via `PuzzleKey.generate` → `uuidv4` → 16 `nextInt` calls) and not at all on the loaded-snapshot path. No module-level state; nothing runs at import time; production ports are not imported.

**`src/ui/bindings/teardown.ts` (new).** Sole owner of the persistence teardown wiring.

```ts
export function installTeardown(store: AppStore): void {
  window.addEventListener('pagehide', () => {
    store.getScheduler().flush();
  });
}
```

`pagehide` (not `beforeunload`) — `pagehide` covers both unload and bfcache-restore transitions and fires reliably on mobile. `flush()` exists for this single caller (and its own test file). The function is two lines plus a JSDoc; it exists so `test/main.test.ts` can exercise the wiring without importing `main.ts` and triggering its DOM side effects in node.

**`src/ui/bindings/persistenceCodec.ts`.** The wire format shrinks.

- `serializeBuilderSnapshot` drops the `subMode: 'none'` field and its `// FR-64: forced to 'none' on save` comment, and the `// cursor omitted per C6` comment. The wrapper is now `{ version: 1, kind: 'builder-snapshot', puzzle: <obj>, mode }`. The change is forward-compatible (a parse that ignores unknown fields still works), and existing saved snapshots (which have the `subMode` field) are silently read past it on the parse side.
- `parseBuilderSnapshot` is unchanged in shape. The existing `mode` guard (`mode !== 'design' && mode !== 'fill'`) means any incoming `subMode` value (legacy `none`, hostile `join`, anything) is simply never read. The function continues to return `BuilderSnapshot = { puzzle, displacedClues, mode }` — a pure round-tripper.
- The pre-existing `serializePlayerProgress` `phase !== 'solving'` guard (single owner of that invariant, established by #7) is untouched. The "player in import phase ⇒ nothing to save" invariant is now owned by one layer here and nowhere else; the same one-layer ownership now applies to the `BuilderState` reload shape via `boot.ts`.

**`src/main.ts`.** Reduced to a pure wiring composer. `loadInitialAppState` is deleted; the hand-assembled `BuilderState` literal is deleted; the imports of `parseBuilderSnapshot`, `BuilderState` (type), `GridSize`, `PuzzleKey` are deleted. The file becomes:

```ts
const ports = { storage: localStoragePort, download: downloadPort, filePick: filePickPort };
const deps = { rng: rngPort, now: () => EpochMs.of(Date.now()) };
const initial = createInitialAppState(ports, deps);
const store = createAppStore(initial, deps, ports);
installTeardown(store);
const app = mount(App, { target: document.getElementById('app')!, props: { appStore: store } });
```

`main.ts` now imports `createInitialAppState` from `./ui/bindings/boot` and `installTeardown` from `./ui/bindings/teardown`. No `BuilderState` shape knowledge; no `GridSize.DEFAULT`; no `PuzzleKey.generate`. The Layer 5 description in `architecture.md` §3 is amended to match: "Nothing else constructs an `AppStore` in production; nothing else registers a `pagehide` listener. `main.ts` holds no domain knowledge — the `BuilderState` reload shape, the `AppState.blank(...)` fallback, and the persistence-teardown wiring all live in `ui/bindings/`."

### Deliberate behaviour changes

- **The `subMode: 'none'` field is dropped from the wire wrapper.** Saved snapshots written by the new code no longer carry the field. Old saved snapshots (which have the field) parse cleanly because the codec never reads it. On the restore side, `subMode` is always `{ kind: 'none' }` and `cursor` is always `null`, regardless of what's on disk. The reload invariant is now single-sourced: the wire format has no place to drift it, and `boot.ts` is the only place that applies it. A new saved snapshot (post-fix) and an old saved snapshot (pre-fix) produce byte-identical restored state.
- **`pagehide` fires `flush()` instead of the user closing the tab silently losing up to 400 ms of work.** Behaviour-equivalent in the rare happy path (the debounce timer would have fired eventually) and load-bearing in the common one (tab close, navigation, refresh). No observable change to the in-session UX; a measurable change to the worst-case data-loss window.
- **`main.ts` no longer imports any domain types or values.** It is now a pure wiring file: build ports, build deps, build initial state, build store, install teardown, mount. The `BuilderState` shape knowledge that previously leaked into Layer 5 is fully gone.

### Files

- Created: `src/ui/bindings/boot.ts`; `src/ui/bindings/teardown.ts`; `test/ui/bindings/boot.test.ts`; `test/main.test.ts`.
- Modified: `src/ui/bindings/persistenceCodec.ts` (drop the wire `subMode` field and the two related comments); `src/main.ts` (delete `loadInitialAppState`, the hand-assembled `BuilderState` literal, and the four no-longer-needed imports; add the `createInitialAppState` and `installTeardown` calls); `test/ui/bindings/persistenceCodec.test.ts` (the wrapper-shape test now asserts `subMode` is absent, not `'none'` — a direct consequence of the codec change); `test/ui/bindings/persistenceScheduler.test.ts` (the codec-shared wrapper-shape assertion was rewritten to assert absence, not value — same reason); `llmworkspace/architecture.md` (§3 Layer 2 table — `boot.ts` and `teardown.ts` rows; §3 Layer 5 — composer paragraph rewritten; §8 Persistence — Builder-snapshot bullet updated and a "Teardown" item 3 added); `llmworkspace/architecture_smells.md` (§8 audit-correction note + status line); `llmworkspace/architecture_smell_resolutions.md` (this entry).

No source modules deleted. No new port, intent, or event variants. `App.svelte` autosave wiring is untouched. The `version` field on the persistence wrapper is unchanged.

### Verification

- `npm run ci` at close: eslint + `madge --circular` clean; `svelte-check` 0 errors / 0 warnings; **89 test files / 1278 tests green** (from 86 files / 1249 tests after #4 — +3 files: `boot.test.ts`, `main.test.ts`, plus the codec-test file that was created in the #7 resolution; +29 tests: 9 boot cases, 3 main cases, plus 17 codec cases across the two test files that had to be updated to reflect the new wrapper shape); the single-file production build succeeded (`dist/index.html` 235.44 kB, gzip 103.13 kB).
- The `boot.test.ts` suite pins every branch of the boot path: `absent`, `failed`, valid `fill`-mode snapshot, valid `design`-mode snapshot, hostile `subMode: 'join'` in the wire blob (silently ignored), corrupt JSON, `fileType: 'complete'` rejection, `rng` call count on the blank path, and `rng` silence on the loaded-snapshot path.
- The `main.test.ts` suite pins the teardown wiring: `pagehide` after `scheduleBuilderSave` fires `flush` synchronously; a second `scheduleBuilderSave` followed by `pagehide` flushes the new pending save; no `beforeunload` listener is registered (negative). The test calls `installTeardown(store)` directly with a stubbed `addEventListener`, sidestepping `main.ts`'s module-level DOM side effects.
- The `persistenceCodec.test.ts` round-trip case still passes: save → parse → restored `BuilderSnapshot` equals source on `puzzle`, `displacedClues`, `mode`. `subMode` and `cursor` are explicitly not round-tripped — that is the new behaviour, pinned by a new assertion in the codec test (the wrapper has no `subMode` field).
- Process: one implementation task dispatched to the Senior (the spec was a single coordinated change across three files plus three test files; the Senior also extracted `teardown.ts` as the cleanest way to make the wiring testable — accepted as a defensible deviation, recorded in the resolution). One review pass: `npm run ci` re-run by the reviewer; one mid-flight doc correction (the `teardown.ts` module wasn't in the original spec, so the Layer 2 table and §3 Layer 5 / §8 paragraphs had to be amended to reference it).

### Consequence (change cost after)

A change to the `BuilderState` reload shape — e.g. "preserve `subMode: { kind: 'join' }` across reload" — touches `boot.ts` only. A change to the persistence teardown — e.g. "also flush on `visibilitychange: hidden`" — touches `teardown.ts` only. A change to the wire format — e.g. dropping `mode` (preserving it only in the puzzle object) — touches `persistenceCodec.ts` and the two codec test files; nothing else. The four sub-issues' hand-sync points collapse: `subMode: 'none'` is enforced once (in `boot.ts`); the `BuilderState` shape is owned by `boot.ts`; the `pagehide` wiring is owned by `teardown.ts`; `main.ts` holds no domain knowledge at all.

The doc/code drift is gone: §3 Layer 2 now names `boot.ts` and `teardown.ts` and describes their roles; §3 Layer 5 describes `main.ts` as a wiring-only composer; §8 Persistence names the codec, the autosave contract, and the teardown wiring in three coherent items instead of asserting "used by boot/teardown" for a mechanism that didn't exist. The `#8`-adjacent leftover is none; the next ranked smell is #9 (the JSON round-trip via strings in the persistence blob's nested format), which is structurally separate and not addressed here.

## 9. The persistence blob couples two formats through JSON string round-trips — resolved 2026-10-18

### The smell (recap)

The builder snapshot embedded the puzzle as an object, but the only `domain/format/` API was string-in/string-out (`parsePuzzle(json: string)`, `serializeIncomplete(p, clues): string`). The codec therefore re-encoded the puzzle through the string boundary on every save (`serializeIncomplete` → `JSON.parse` → embed) and every boot (`JSON.stringify` → `parsePuzzle` → `JSON.parse`). The deeper complaint was structural: the file format and the `localStorage` blob format shared the puzzle schema but no structured form, so any future schema change had to keep the embed/extract coherence by hand or corrupt every stored snapshot. The architectural fix is to give them a shared structured form.

### Decision

Options considered and their fates:

- **A — Minimum diff: extract `parsePuzzleUnknown(parsed: unknown)` in `v1.ts` and a structured `serializeIncompleteShape`.** Closes the wasted-work half of the smell (real CPU savings on autosave + boot). Doesn't address the structural complaint: the file format and storage format still have no shared form by construction; a future schema change still has to touch both APIs (or carefully keep them in sync). Rejected as the default per the user's framing — minimum diff is not the goal here. Recorded as a fallback.
- **B — Split `domain/format/` into a structural layer and a JSON-I/O layer.** `v1.ts` becomes the structural layer (`parsePuzzleShape`, `serializeIncompleteShape`, `serializeCompleteShape`, `ParseFailure`, `PuzzleFileType`; no `JSON.parse`/`JSON.stringify`). A new `v1Json.ts` holds the string adapters (`parsePuzzle`, `serializeIncomplete`, `serializeComplete`, `Filename`; each delegates to the structural layer). File import/export and player lifecycle keep using `v1Json` (their I/O is string-shaped by the browser). The codec uses `v1` directly. Closes both halves of the smell: the wasted round-trip is gone, and the file format and storage format share a structured form by construction. *Strong baseline.*
- **C — B + an explicit "stored shape is the wire shape" commitment in the architecture doc.** Closes the drift risk at the documentation level: a future maintainer reading §10 learns that the file format and the localStorage format share the structural layer intentionally, and is told the only way they can diverge is by diverging `v1.ts` itself. No code cost; meaningful doc cost. *Adopted with B.*

Approved package: **B + C**. A would have been a stepping stone to B at best; B alone is the structural fix.

### Design as implemented

**`src/domain/format/v1.ts` (structural layer; refactored).** The canonical wire shape — `parsePuzzleShape(parsed: unknown): Result`, `serializeIncompleteShape(p, clues): object`, `serializeCompleteShape(p): object`, plus `ParseFailure` and `PuzzleFileType`. Operates on structured values end-to-end; the module contains no `JSON.parse` or `JSON.stringify`. The existing internal helpers (`normalizeV1ChainBoundaries`, `validateTopLevelExtras`, `markerFromJson`, `markerToJson`, every private validator) stay where they are; the rename is purely on the public surface.

```ts
export const parsePuzzleShape = (parsed: unknown):
  | { ok: true; puzzle: Puzzle; fileType: PuzzleFileType; displacedClues: DisplacedClue[] }
  | { ok: false; failures: ParseFailure[] } => { /* body of the old parsePuzzle from after the JSON.parse */ };

export const serializeIncompleteShape = (p: Puzzle, displacedClues: DisplacedClue[]): object => {
  return buildSerializedOutput(p, 'incomplete', displacedClues);
};

export const serializeCompleteShape = (p: Puzzle): object => {
  return buildSerializedOutput(p, 'complete', []);
};
```

**`src/domain/format/v1Json.ts` (new; JSON I/O adapters).** Thin wrappers over the structural layer:

```ts
export const parsePuzzle = (json: string): Result => {
  try {
    return parsePuzzleShape(JSON.parse(json));
  } catch {
    return { ok: false, failures: [{ message: 'File is not valid JSON.' }] };
  }
};

export const serializeIncomplete = (p: Puzzle, displacedClues: DisplacedClue[]): string =>
  JSON.stringify(serializeIncompleteShape(p, displacedClues), null, 0);

export const serializeComplete = (p: Puzzle): string =>
  JSON.stringify(serializeCompleteShape(p), null, 0);

// Filename moves verbatim from v1.ts (it is a string-output side effect, not a structural shape).
```

**`src/ui/bindings/persistenceCodec.ts` (round-trip gone).** The codec now uses the structural layer directly:

```ts
import { serializeIncompleteShape, parsePuzzleShape } from '../../domain/format/v1';

export function serializeBuilderSnapshot(state: BuilderState): string {
  const wrapper = {
    version: 1,
    kind: 'builder-snapshot',
    puzzle: serializeIncompleteShape(state.puzzle, state.displacedClues),
    mode: state.mode,
  };
  return JSON.stringify(wrapper);
}

export function parseBuilderSnapshot(blob: string): BuilderSnapshot | null {
  // …wrapper-shape guard (kind === 'builder-snapshot', version === 1)…
  const result = parsePuzzleShape((snap as { puzzle: unknown }).puzzle);
  if (!result.ok || result.fileType !== 'incomplete') return null;
  // …mode guard, return { puzzle, displacedClues, mode }…
}
```

The `serializeIncomplete` + `JSON.parse` round-trip on save and the `JSON.stringify` + `parsePuzzle` round-trip on load are both deleted. The player-progress half of the codec is untouched (it doesn't touch the format layer).

**Caller migration.** `src/builder/state/internal/importExport.ts` and `src/player/state/internal/lifecycle.ts` import `parsePuzzle` / `serializeIncomplete` / `serializeComplete` / `Filename` from `'../../../domain/format/v1Json'` (their import path changed from `'../../../domain/format/v1'`). The change is a single import-line edit per file; no logic change.

### Deliberate behaviour changes

- **The wire JSON is byte-identical before and after.** The structural layer's `JSON.stringify` output matches the old `serializeIncomplete` / `serializeComplete` output byte-for-byte (pinned by `'serializeIncompleteShape returns an object whose JSON.stringify matches serializeIncomplete byte-for-byte'` and the analogous complete case in `test/domain/format/v1.test.ts`). Existing saved snapshots in `localStorage` parse cleanly; existing saved files still re-import; the single-file production build size (`dist/index.html` 235.44 kB, gzip 103.13 kB) is unchanged from the #8 resolution. No migration path needed.
- **`parsePuzzle` with malformed JSON produces the same `ParseFailure` shape as before** (`{ message: 'File is not valid JSON.' }`). The byte-shape of the failure is unchanged; the throw boundary moved from the start of `parsePuzzle` into a one-line `try/catch` around `JSON.parse(json)`.
- **`ParseFailure`, `PuzzleFileType`, `Filename` move between modules but their public behaviour is unchanged.** `Filename.incomplete` / `Filename.complete` produce the same strings.
- **The structural layer is now importable directly.** Code paths whose I/O is genuinely string-shaped (file import/export, player lifecycle) use `v1Json`; code paths whose I/O is structured (the codec's wrapper) use `v1`. A future v3 schema change has one structural place to land (`v1.ts`); the JSON-I/O adapters pick it up automatically.

### Files

- **Created:** `src/domain/format/v1Json.ts`; new test cases appended to `test/domain/format/v1.test.ts` (or a sibling — see Verification) and `test/ui/bindings/persistenceCodec.test.ts`.
- **Modified:** `src/domain/format/v1.ts` (public surface refactored to the structural layer; the string functions and `Filename` removed); `src/ui/bindings/persistenceCodec.ts` (imports switched to `v1`, round-trip deleted); `src/builder/state/internal/importExport.ts` (import path `v1` → `v1Json`); `src/player/state/internal/lifecycle.ts` (same); `test/domain/format/v1.test.ts` (7 new structural-layer cases, plus the existing string-adapter cases untouched); `test/ui/bindings/persistenceCodec.test.ts` (5 new structural-API cases, plus the existing wire-shape and round-trip cases unchanged); `llmworkspace/architecture.md` (§3 Layer 0 inventory row for `domain/format/` — split described; §3 Layer 2 `persistenceCodec.ts` row — notes the structural-API usage; §8 Persistence Builder-snapshot bullet — describes the structural shape instead of "puzzle JSON"; §10 JSON Puzzle Format — split documented and the "structural shape is the canonical wire shape" claim added; §13 File / Module Map — `format/` line now names both `v1.ts` and `v1Json.ts`); `llmworkspace/architecture_smells.md` (#9 status line added; line-number citations flagged as audit-correction); `llmworkspace/architecture_smell_resolutions.md` (this entry).

No source modules deleted. No new port, intent, or event variants. No layer-boundary change (the structural layer and the JSON-I/O layer are both in `domain/format/`; the codec still lives in `ui/bindings/` and uses the structural layer from `domain/` per the existing rule). `App.svelte` autosave wiring is untouched.

### Verification

- `npm run ci` at close: eslint + `madge --circular` clean; `svelte-check` 0 errors / 0 warnings; **89 test files / 1290 tests green** (from 89 / 1278 after #8 — +12 tests: 7 structural-layer cases in `v1.test.ts` covering `parsePuzzleShape` against already-parsed objects, hostile non-objects, hostile top-level extras, and the byte-equivalence assertions for `serializeIncompleteShape` and `serializeCompleteShape`; plus the v1Json export-coverage case; plus 5 codec cases pinning the new invariant: wrapper embeds structural shape directly, parse feeds structural parser directly, byte-identical wire JSON, invalid embedded puzzle returns null, codec output round-trips through `parsePuzzle(serializeIncomplete(...))`). The single-file production build succeeded at the same byte-size (`dist/index.html` 235.44 kB, gzip 103.13 kB).
- The `test/domain/format/v1.test.ts` structural-layer cases exercise the new entry points directly with `unknown` inputs (a parsed object, `null`, an array, a string, a number, an object with a hostile extra field) — the same rejection list the string adapter would have produced, but now provable end-to-end without the `JSON.parse` wrapper.
- The `test/ui/bindings/persistenceCodec.test.ts` structural-API cases pin the round-trip-free invariant by capturing the wrapper object before `JSON.stringify` and asserting `wrapper.puzzle` strictly equals `serializeIncompleteShape(p, clues)`; by spying on the parser call to confirm `parsePuzzleShape` receives the embedded object reference, not a re-stringified copy; and by asserting the wire JSON bytes are unchanged across the refactor.
- Process: two implementation tasks dispatched to the Senior (Task 1: split `v1.ts` into structural + I/O layers, with caller import migration; Task 2: switch `persistenceCodec.ts` to the structural API and pin the invariant in tests). One acceptable deviation during Task 1: the Senior touched `persistenceCodec.ts` only to migrate its imports from `v1` → `v1Json` (a forced compat change once `parsePuzzle`/`serializeIncomplete` moved out of `v1.ts`); no logic change in the codec. The structural-API migration was then the substantive content of Task 2, as planned. One review pass per task.

### Consequence (change cost after)

A change to the puzzle schema (e.g. a v3 column for anagram hints, or a new marker flag) touches `v1.ts` only — both `parsePuzzleShape` validation and `serializeIncompleteShape`/`serializeCompleteShape` emission live there. The JSON-I/O adapters in `v1Json.ts` pick the change up automatically because they delegate. A change to the wrapper format (e.g. "drop the `mode` field from the builder snapshot") touches `persistenceCodec.ts` and its test file only. A change to the file-import/export wire format (e.g. "add a new top-level metadata block") touches `v1.ts` (the structural shape) and `v1Json.ts` (the JSON adapters that wrap it); the codec is unaffected because it already speaks the structural shape.

The drift risk that the smell called out — "a future format change must keep the embed/extract round-trip coherent or corrupt every stored snapshot" — is structurally gone. There is no embed/extract round-trip; there is one structural shape that both formats share by construction. The two formats can only diverge if `v1.ts` itself is changed to make them diverge, which is now an explicit decision in one module rather than an accidental one across two.

The doc/code drift is gone: §3 Layer 0 names the two modules and their roles; §10 explicitly commits to the structural shape as the canonical wire shape; §8 Persistence describes the embedded puzzle as a structural shape rather than "puzzle JSON"; §13 File / Module Map names both files. The `#9`-adjacent leftover is none; the next ranked smell is #10 (word-membership / white-run semantics implemented four ways — see `architecture_smells.md`).
