# angryphrase — Architecture Smell Resolutions

Companion to `architecture_smells.md`. Each entry records how a ranked smell was resolved: the decision (options considered, what was chosen, what was deferred and why), the design as implemented, any deliberate behaviour changes, and the verification evidence. Entries are written after the fact and describe the code as it now stands — where this document and the code disagree, the code wins (the same rule `architecture.md` declares for itself).

Conventions: no line-number references (they rot — see smell #11); functions, modules, and test names are the anchors.

Resolved so far: #1 (grid-interaction duplication).

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
