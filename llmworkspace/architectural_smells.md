# Architectural Smells

This document catalogues specific architectural problems in the crossword puzzle codebase, with particular focus on logic that has leaked into page/component files and should be extracted into pure modules — without making those pure modules aware of UI concerns like keypresses.

---

## 1. Duplicated keyboard input handling between BuilderPage and PlayerPage

**Files:** `src/pages/BuilderPage.svelte` lines 251–293, `src/pages/PlayerPage.svelte` lines 159–201

**Problem:** Both pages contain nearly identical `handleKeyDown` functions that:
- Classify keys (`/^[a-zA-Z]$/` test for letters, string comparisons for `Backspace`, `Arrow` prefix)
- Map `KeyboardEvent.key` values to `MoveDirection` via a hardcoded `Record<string, MoveDirection>` (identical in both files, lines 278–283 and 189–192)
- Dispatch to `enterLetter` / `deleteLetter` / `moveCursor` based on key classification
- Call `event.preventDefault()` (UI concern)

The key-to-MoveDirection mapping (`ArrowUp → "up"`, etc.) is repeated verbatim.

**This is NOT a candidate for extraction to pure logic.** Key classification and key-name-to-direction mapping are UI-layer concerns — they are about interpreting keyboard input, which is inherently a UI concept. A pure logic module should not know that `"ArrowUp"` maps to anything.

However, the duplication is real and worth addressing. The appropriate remediation is a **shared UI-level utility** — a Svelte composable or a plain TypeScript helper that lives in the component/UI layer (not in `src/lib/` alongside pure domain logic). For example, a function in `src/utils/keyboard.ts` that returns which cursor operation to perform given a key string. This keeps the UI-layer knowledge (keyboard key names) in a UI-layer module, while the pure domain logic (`enterLetter`, `deleteLetter`, `moveCursor`) stays untouched in `src/lib/cursor-logic.ts`.

Alternatively, since the two pages' handlers may diverge over time (the Builder already has different mode guards and an Escape handler), this may be a case where ~40 lines of acceptable duplication is preferable to premature abstraction that leaks UI concepts into the logic layer.

---

## 2. Design-mode cell toggle logic lives in BuilderPage

**File:** `src/pages/BuilderPage.svelte`, lines 191–241 (`handleDesignModeClick`)

**Problem:** This handler contains domain logic that should be a pure function:
- Lines 193–218: Determining the new `CellData` when toggling black→white or white→black, including the specific default values for each field (`puzzleLetter: null`, `spaceRight: false`, etc.)
- Lines 227–232: Calling `deriveWords` and `reconcileWordsOnGridChange` and updating state

The construction of the new cell (lines 198–207, 210–218) is domain knowledge about what a default black cell vs. a default white cell looks like — this is already partially in `createEmptyGrid` in `grid-logic.ts` but isn't available as a standalone operation.

**Extraction target:** Add to `src/lib/grid-logic.ts`:

```ts
export function toggleCellBlack(
  grid: CellData[][],
  row: number,
  col: number
): { grid: CellData[][]; /* ... */ }
```

This function would return the new grid with the cell toggled and the reconciliation results. The page handler would just assign the result and handle the toast.

---

## 3. Marker mutual-exclusion toggle logic in BuilderPage

**File:** `src/pages/BuilderPage.svelte`, lines 450–475 (`handleToggleMarker`)

**Problem:** The mutual exclusion rules ("spaceRight and hyphenRight are mutually exclusive", "spaceBottom and hyphenBottom are mutually exclusive") are grid domain logic embedded directly in a page handler. The handler also does defensive checks (`if !selectedCell`, `if grid[row][col].black`) and manually clones the grid.

**Extraction target:** Add to `src/lib/grid-logic.ts` or `src/lib/cursor-logic.ts`:

```ts
export function toggleMarker(
  grid: CellData[][],
  cell: CellPosition,
  marker: "spaceRight" | "spaceBottom" | "hyphenRight" | "hyphenBottom"
): CellData[][] | null  // null if cell is black or out of bounds
```

Returns a new grid with the marker toggled and mutual exclusion enforced. Returns `null` if the cell is black. The page handler reduces to: call the function, assign result to `grid` if non-null.

---

## 4. Join-word-then-displace orchestration in BuilderPage

**File:** `src/pages/BuilderPage.svelte`, lines 349–377 (`handleClueClickJoinMode`)

**Problem:** This handler contains the business rule: "When joining source→target, if the target word had a non-empty clue, that clue must be displaced." This rule (lines 365–367) is domain logic that should live in `chain-logic.ts` or `clue-logic.ts`, not in a UI event handler. Displaced clue creation with `crypto.randomUUID()` also happens here, meaning the page needs to know about ID generation.

**Extraction target:** Add to `src/lib/chain-logic.ts` or a new function in `src/lib/clue-logic.ts`:

```ts
export function joinWordsAndDisplace(
  words: Word[],
  sourceWordId: WordId,
  targetWordId: WordId
): { words: Word[]; displacedClues: DisplacedClue[] } | null
```

This would call `joinWords`, then if the target had a clue, create the displaced clue. The `null` case means the join was invalid. The page handler would just call this and assign state.

---

## 5. `downloadJSON` DOM utility inlined in BuilderPage

**File:** `src/pages/BuilderPage.svelte`, lines 501–511 (`downloadJSON`)

**Problem:** This function creates a `<a>` element, sets `href`/`download`, appends to body, clicks, and removes. It is a generic file-download utility with no business logic — pure DOM side effect. It doesn't belong in a page component.

**Extraction target:** Create `src/lib/file-download.ts`:

```ts
export function downloadJSON(data: object, filename: string): void
```

Move the implementation verbatim. BuilderPage just calls `downloadJSON(result, filename)`.

---

## 6. Player progress extraction logic inlined in auto-save effect

**File:** `src/pages/PlayerPage.svelte`, lines 73–84

**Problem:** The auto-save effect manually iterates over the grid with nested loops, conditional null/black checks, and array construction to produce the `letters` 2D array. This is pure data transformation that belongs in a lib module, not embedded in a `$effect`.

**Extraction target:** Add to `src/lib/storage.ts` (or a new `src/lib/player-progress.ts`):

```ts
export function extractPlayerLetters(grid: CellData[][]): (string | null)[][]
```

The auto-save effect becomes:
```ts
const letters = extractPlayerLetters(grid);
savePlayerProgress(puzzleKey, { key: puzzleKey, gridSize, letters });
```

---

## 7. `window.confirm` calls scattered across pages as unconditional side effects

**Files:**
- `src/pages/BuilderPage.svelte`, line 298 (`handleModeChange`)
- `src/pages/BuilderPage.svelte`, line 517 (`handleImport`)
- `src/pages/BuilderPage.svelte`, line 571 (`handleReset`)
- `src/pages/PlayerPage.svelte`, line 225 (`handleReset`)

**Problem:** Business logic handlers call `window.confirm()` directly, making them untestable and coupling the decision-making logic to the DOM confirm dialog. The pattern "check a condition, confirm with user, then proceed" is split across the confirmation and the action.

**Recommendation:** Don't extract `window.confirm` to a lib — that would just move the UI coupling. Instead, restructure so the *decision* comes from the caller. Two approaches:

**Option A:** Have the page component show the confirm dialog in the event handler, then only call the business handler if confirmed. The business handler (`handleModeChange`, `handleImport`, `handleReset`) stays pure. Currently these functions *already* work this way structurally; the smell is that the `window.confirm` call is interleaved with state mutation in the same function body. Split them: confirm first, then call the state-change function.

**Option B:** For repeated patterns, extract a confirmation composable/store. But since there are only 4 call sites with different prompts, Option A is simpler and doesn't require making pure logic aware of UI.

---

## 8. Toast state management duplicated as inline pattern in BuilderPage

**File:** `src/pages/BuilderPage.svelte`, lines 40–54

**Problem:** The toast uses two pieces of state (`toastMessage`, `toastTrigger`), a `$effect` for auto-dismissal, and a `showToast` function. This is a reusable UI pattern. If PlayerPage ever needs toasts, this would be duplicated.

**Extraction target:** A shared toast state module (e.g., `src/lib/toast.svelte.ts`) using Svelte 5 runes. However, because this is UI state, not pure logic, it should remain a Svelte module with `$state`/`$effect`, not a plain `.ts` file. The key benefit: any page or component can call `showToast(message)` without managing the timer state themselves.

---

## 9. `wordMetadata` Map hydration pattern repeated 4 times in BuilderPage

**Files:** `src/pages/BuilderPage.svelte`

**Problem:** The pattern of clearing a `SvelteMap` and repopulating it from entries appears in:
- Lines 142–145 (state load from storage)
- Lines 170–175 (`syncMetadataFromWords`)
- Lines 536–546 (import complete puzzle)
- Lines 555–558 (import incomplete puzzle, this one is slightly different)

Each instance does `wordMetadata.clear()` followed by a loop of `wordMetadata.set(id, ...)`. The `syncMetadataFromWords` function at line 169 is already extracted but the others are inline.

**Extraction target:** Create a helper function:

```ts
function setWordMetadata(map: SvelteMap<string, WordMetadata>, entries: Iterable<[string, WordMetadata]>): void
```

Or, better yet, re-examine whether `SvelteMap` is necessary. A plain `$state` object wrapping a `Map` or even a `$state.record()` may work, and the repetitive clear/set pattern would be replaced by direct assignment.

---

## 10. Import state hydration logic in BuilderPage is complex and brittle

**File:** `src/pages/BuilderPage.svelte`, lines 514–567 (`handleImport`)

**Problem:** After calling `parsePuzzleJSON`, the handler has two branches (`complete` and `incomplete`) that each:
1. Assign `key`, `gridSize`, `grid`, `title`, `author`
2. Derive words from the grid
3. Populate `wordMetadata` from the puzzle's words
4. Fill in any missing word metadata for newly-derived words (lines 541–546, complete branch)
5. Set `displacedClues` (or clear it)

This is state hydration domain logic. Steps 2–4 represent the concept of "initialize builder state from an imported puzzle" which is a coherent operation.

**Extraction target:** Create `src/lib/builder-state.ts` with:

```ts
export interface BuilderStateSnapshot {
  key: string;
  gridSize: number;
  grid: CellData[][];
  wordMetadata: Map<string, WordMetadata>;
  displacedClues: DisplacedClue[];
  title: string;
  author: string;
}

export function hydrateBuilderStateFromImport(
  puzzleData: CompletePuzzle | IncompletePuzzle,
  isComplete: boolean
): BuilderStateSnapshot
```

The page handler would reduce to: parse, confirm if needed, call `hydrateBuilderStateFromImport`, assign the results to state variables. Note: this function should not call `window.confirm` — that stays in the page.

---

## 11. Player import state hydration has similar complexity

**File:** `src/pages/PlayerPage.svelte`, lines 97–151 (`handleImport`)

**Problem:** After parsing, this handler:
1. Validates puzzle type (incomplete puzzles rejected — good, domain logic)
2. Assigns `key`, `gridSize`, `grid`, title/author
3. Re-derives word numbers from the grid (lines 119–124)
4. Restores player progress from localStorage (lines 130–145)
5. Manually overlays saved letters onto a new grid (lines 133–141)

Steps 3–5 are domain logic. The grid overlay in particular (lines 133–141) mirrors the `extractPlayerLetters` extraction suggested in smell #6 — they're inverse operations and should both live in the same lib module.

**Extraction target:** Add to `src/lib/player-progress.ts` (or `storage.ts`):

```ts
export function applyPlayerProgress(
  grid: CellData[][],
  progress: PlayerProgress
): CellData[][]
```

---

## 12. `handleKeyDown` early-return guard differs between Builder and Player

**Files:** `src/pages/BuilderPage.svelte` line 252, `src/pages/PlayerPage.svelte` line 160

**Problem:** BuilderPage's `handleKeyDown` guards on `interaction.kind !== "fill" || !selectedCell` and also listens for Escape globally (`handleGlobalKeyDown`). PlayerPage's `handleKeyDown` only guards on `!selectedCell`. These guards are UI state conditions (what mode are we in?) that should stay in the handler. However, the duplication of the key dispatch logic (see smell #1) means these functions are larger than they need to be, making the guard logic harder to see in context.

If the duplicated key-to-operation dispatch were consolidated into a shared UI utility (as discussed in smell #1), each handler would become shorter, making the guard logic more visible. The pure domain functions (`enterLetter`, `deleteLetter`, `moveCursor`) are already correctly extracted — the remaining duplication is entirely in the UI key-interpretation layer.

---

## 13. Auto-save dependency arrays are manually maintained and fragile

**File:** `src/pages/BuilderPage.svelte`, lines 108–127

**Problem:** The auto-save `$effect` lists dependencies as `const _ = [key, gridSize, grid, wordMetadata, displacedClues, title, author, interaction]`. If a new piece of state is added to `BuilderState` but not added to this array, auto-save will silently miss it. This is an inherent risk of Svelte 5's fine-grained reactivity — the `wordMetadata` SvelteMap may or may not trigger correctly depending on how it's mutated.

**Recommendation:** Consider deriving the entire BuilderState as a single `$derived` value:

```ts
let stateSnapshot = $derived.by(() => ({
  key, gridSize, grid, wordMetadata, displacedClues, title, author,
  interaction, selectedCell, selectedDirection
}));
```

Then auto-save just depends on `stateSnapshot`. This makes the dependency list self-maintaining — any state read inside the `$derived.by` is automatically tracked. The same problem exists in PlayerPage lines 66–93 with `const _ = grid; const _k = puzzleKey; const _g = gridSize;`.

---

## 14. BuilderPage manages too many top-level state variables directly

**File:** `src/pages/BuilderPage.svelte`

**Problem:** BuilderPage has 11 `$state` variables (`key`, `gridSize`, `grid`, `wordMetadata`, `displacedClues`, `title`, `author`, `interaction`, `selectedCell`, `selectedDirection`, `hasLoaded`) plus toast state. These form a coherent "builder session" that could be encapsulated in a class or a Svelte 5 store. Currently, every handler function directly reads and writes individual state variables, creating implicit coupling across the page.

This isn't necessarily wrong for a Svelte page — it's the Svelte way. But the *number* of state variables and the cross-cutting concerns (auto-save, toast, wordMetadata Map management) suggest the page would benefit from extracting coherent groups:

**State groups that could be encapsulated:**
- **Builder data state** (`key`, `gridSize`, `grid`, `wordMetadata`, `displacedClues`, `title`, `author`): These always change together during import/reset/load. A `useBuilderState()` composable could bundle them.
- **Selection state** (`selectedCell`, `selectedDirection`): These always change together per `CursorResult`. Could be a single `$state<{cell: CellPosition | null; direction: Direction}>`.
- **Toast state** (`toastMessage`, `toastTrigger`): As noted in smell #8.

---

## 15. No separation between "command" logic and "query" logic in page handlers

**Problem:** Many handler functions in both pages follow a pattern:
1. Read several state variables
2. Call pure logic functions
3. Write back to multiple state variables
4. Potentially trigger side effects (localStorage, DOM, toast)

This is the "orchestration" pattern, which is appropriate for page components. However, the *pure computation* parts (steps 2) are sometimes mixed into the orchestration rather than extracted. For example, in `handleDesignModeClick`:

```
# Pure computation that should be extracted:
- Compute new cell data (black/white toggle)
- Derive new words from grid
- Reconcile words to preserve metadata

# Orchestration that stays in the page:
- Assign new grid to state
- Assign reconciled metadata to state
- Clear selection
- Show toasts for shortened words
```

The functions that are already extracted (`enterLetter`, `deleteLetter`, `moveCursor`, `joinWords`, `unjoinWord`, `reconcileWordsOnGridChange`, `reattachClue`, `checkPuzzle`, `clearErrors`) represent good extraction decisions. The smells listed above (cell toggle, marker toggle, join-and-displace) are the remaining cases where computation hasn't been extracted.

---

## Summary of recommended new modules and functions

| Module | Function | Moves logic from |
|--------|----------|-----------------|
| `src/lib/grid-logic.ts` (additions) | `toggleCellBlack(grid, row, col)` | BuilderPage lines 191–241 |
| `src/lib/grid-logic.ts` or `cursor-logic.ts` (additions) | `toggleMarker(grid, cell, marker)` | BuilderPage lines 450–475 |
| `src/lib/chain-logic.ts` or `clue-logic.ts` (additions) | `joinWordsAndDisplace(words, sourceId, targetId)` | BuilderPage lines 349–377 |
| `src/lib/file-download.ts` | `downloadJSON(data, filename)` | BuilderPage lines 501–511 |
| `src/lib/player-progress.ts` | `extractPlayerLetters(grid)`, `applyPlayerProgress(grid, progress)` | PlayerPage lines 73–84, 133–141 |
| `src/lib/builder-state.ts` | `hydrateBuilderStateFromImport(puzzleData, isComplete)` | BuilderPage lines 514–567 |
| `src/lib/toast.svelte.ts` | `showToast(message)` with auto-dismiss | BuilderPage lines 40–54 |

**Not recommended for extraction to pure logic:** The duplicated `handleKeyDown` dispatch between BuilderPage and PlayerPage (smell #1). Key classification and key-to-direction mapping are UI concepts that should stay in the component layer, not in `src/lib/`. If the duplication becomes a maintenance burden, create a shared UI utility (e.g. `src/utils/keyboard.ts`) that remains in the UI layer.

The `window.confirm` calls should be restructured so they happen *before* calling the state-changing logic, keeping them in the page component (not extracted to a lib). The auto-save dependency management could be improved by deriving a single state snapshot.