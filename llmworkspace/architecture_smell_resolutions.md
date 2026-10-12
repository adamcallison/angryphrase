# angryphrase — Architecture Smell Resolutions

Companion to `architecture_smells.md`. Each entry records how a ranked smell was resolved: the decision (options considered, what was chosen, what was deferred and why), the design as implemented, any deliberate behaviour changes, and the verification evidence. Entries are written after the fact and describe the code as it now stands — where this document and the code disagree, the code wins (the same rule `architecture.md` declares for itself).

Conventions: no line-number references (they rot — see smell #11); functions, modules, and test names are the anchors.

Resolved so far: #1 (grid-interaction duplication), #2 (duplicate "complete puzzle" definitions).

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
