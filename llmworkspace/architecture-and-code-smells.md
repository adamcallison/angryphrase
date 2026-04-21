# Architecture & Code Smells Report

**Generated:** 2026-04-21
**Scope:** Full codebase review of angryphrase crossword builder/player

---

## Critical Architectural Smells

### 1. BuilderPage.svelte is a God Component (825 lines)

**Location:** `src/pages/BuilderPage.svelte`
**Severity:** Critical

BuilderPage contains ALL state management, ALL event handlers, ALL business logic orchestration for the builder experience. It manages 17+ state variables, 15+ handler functions, multiple derived computations, side effects, and the entire UI layout. This is a classic God Component anti-pattern that makes the code:
- Impossible to unit test
- Extremely difficult to reason about
- Prone to regression when modified
- A merge conflict magnet for multi-developer teams

**Recommendation:** Extract state management into a custom Svelte 5 rune-based store or context module. Extract handler logic into composable functions. Split the page into smaller, focused sub-components.

### 2. PlayerPage.svelte is a near-God Component (431 lines)

**Location:** `src/pages/PlayerPage.svelte`
**Severity:** Critical

Same anti-pattern as BuilderPage, but for the player mode. 8+ state variables, 10+ handler functions, derived computations, side effects. Nearly identical structure to BuilderPage.

### 3. Massive Code Duplication Between Pages

**Locations:** `src/pages/BuilderPage.svelte`, `src/pages/PlayerPage.svelte`
**Severity:** Critical

The following logic is duplicated (not shared) between BuilderPage and PlayerPage:

| Logic | BuilderPage | PlayerPage |
|-------|-------------|------------|
| Cell click handler | `handleCellClick` (~75 lines) | `handleCellClick` (~35 lines) |
| Keyboard handler | `handleKeyDown` (~70 lines) | `handleKeyDown` (~80 lines) |
| Selected word derivation | `selectedWord` computed | Identical computation |
| Highlighted cells | `highlightedCells` computed | Identical computation |
| Display letters mapping | `displayLetters` computed | Nearly identical |
| Arrow key + direction logic | Switch statement + redundant set | Switch statement + redundant set |
| Toast notification system | `showToast()` + timer management | Identical `showToast()` |
| Auto-save effect | `$effect` with debounce timer | Identical `$effect` pattern |
| Cell selection at intersection | Toggle direction logic | Identical toggle logic |

**Recommendation:** Extract shared logic into composable utility modules (e.g., `useCrosswordCursor`, `useToast`, `useAutosave`). Create shared derived state factories.

### 4. No State Management Layer

**Severity:** High

All state is managed directly in page components using Svelte 5 `$state` runes. There are no stores, no context providers, no state management patterns. This makes components:
- Tightly coupled to their state
- Impossible to test in isolation
- Hard to share state between sibling components

### 5. No Routing Solution

**Location:** `src/App.svelte`
**Severity:** Medium

App.svelte manages views with a simple `currentView` state variable:
```ts
let currentView = $state<'landing' | 'builder' | 'player'>('landing');
```
This means no URL history, no deep linking, no back button support, no shareable URLs.

---

## High-Priority Code Smells

### 6. Missing `break` in Arrow Key Switch Statement (BUG)

**Location:** `src/pages/BuilderPage.svelte` lines 420-436, `src/pages/PlayerPage.svelte` lines 266-282
**Severity:** High (Bug)

The `ArrowRight` case falls through to `default`. While it doesn't cause incorrect behavior (default sets `directionPolarity = "forward"` which matches ArrowRight's intent), it's a code smell and could easily become a real bug if the default case changes.

```ts
switch (key) {
  case "ArrowRight":
    [selectedDirection, directionPolarity] = ["across", "forward"]
    // MISSING break; here!
  default:
    directionPolarity = "forward"
}
```

### 7. Redundant Direction Setting After Arrow Key Handler

**Location:** `src/pages/BuilderPage.svelte` lines 438-446, `src/pages/PlayerPage.svelte` lines 284-293
**Severity:** Medium

The switch statement already sets `selectedDirection`, then a second block of code ALSO sets `selectedDirection` based on the key:
```ts
// Already set in switch:
[selectedDirection, directionPolarity] = ["across", "forward"]
// Then also set here:
if (key === "ArrowLeft" || key === "ArrowRight") {
  selectedDirection = "across";
} else if (key === "ArrowUp" || key === "ArrowDown") {
  selectedDirection = "down";
}
```
This is redundant and confusing. The second block should be the sole source of truth for direction.

### 8. BuilderState Mixes Data and UI State

**Location:** `src/lib/types.ts` lines 97-119
**Severity:** High

`BuilderState` includes both core data and UI state:
```ts
export interface BuilderState {
  // Core data
  key: string;
  gridSize: number;
  grid: CellData[][];
  wordMetadata: Map<string, WordMetadata>;
  displacedClues: DisplacedClue[];
  title: string;
  author: string;
  // UI state — should NOT be persisted
  mode: "design" | "fill";
  selectedCell: CellPosition | null;
  selectedDirection: Direction;
  reattachMode: boolean;
  selectedDisplacedClueIndex: number | null;
  joinMode: boolean;
  joinSourceWordId: WordId | null;
}
```

The entire state (including UI selections) is persisted to localStorage. This means when a user reloads, they restore transient UI state like join mode and selected cell, which is unexpected and could cause confusion.

**Recommendation:** Separate `BuilderData` (persisted) from `BuilderUIState` (ephemeral).

### 9. Missing Debounce Timer Cleanup on Component Destroy

**Location:** `src/pages/BuilderPage.svelte` lines 134-158, `src/pages/PlayerPage.svelte` lines 111-129
**Severity:** Medium

The `$effect` for auto-save creates a `setTimeout` but lacks a cleanup return function. The timer reference (`saveTimer` / `toastTimer`) is a module-level variable, not properly scoped to the effect lifecycle.

### 10. `window.confirm` Used for Destructive Actions

**Locations:** `src/pages/BuilderPage.svelte` lines 453, 617, 691, `src/pages/PlayerPage.svelte` line 323
**Severity:** Medium

Using `window.confirm` for confirmation dialogs is a UX anti-pattern. It's not customizable, blocks the main thread, and can't be styled. Should use a proper modal/dialog component.

### 11. File Input Created Via `document.createElement`

**Location:** `src/pages/BuilderPage.svelte` lines 621-687
**Severity:** Medium

The `handleImport` function creates a hidden file input programmatically instead of using Svelte's template-based approach (like ImportScreen does). This creates a disconnect between the two import mechanisms and is harder to maintain.

### 12. `deriveWordAnswer` Is Exported but Unused in Production Code

**Location:** `src/lib/import-export.ts` lines 27-42
**Severity:** Low

The `deriveWordAnswer` function is exported and tested but never called in the application. It appears to be leftover functionality or intended for future use (perhaps displaying answers).

---

## Medium-Priority Code Smells

### 13. No Accessibility on Grid Cells

**Location:** `src/components/Cell.svelte`, `src/components/CrosswordGrid.svelte`
**Severity:** Medium

The grid has `role="grid"` but individual cells lack:
- `role="gridcell"`
- `aria-selected` for the selected cell
- `aria-label` describing the cell content (number, letter)
- Screen reader announcements for cell navigation

### 14. No Component Tests

**Severity:** Medium

All 305 tests are unit tests for logic modules. There are zero Svelte component tests. No testing-library/svelte tests for:
- User interactions (clicking cells, typing letters)
- Component rendering (proper display of black/selected/highlighted cells)
- Prop reactivity
- Accessibility tree

### 15. TypeScript Errors in Test Files

**Location:** `src/lib/validation.test.ts` (21 errors per svelte-check)
**Severity:** Medium

The test file has type mismatches where `CellData` objects are created without all required fields. While tests pass at runtime, this indicates the tests are not type-safe and could mask future regressions.

### 16. `vitest.config.ts` Missing Path Aliases

**Location:** `vitest.config.ts`
**Severity:** Low

The vitest config doesn't include the `$lib` path alias that `vite.config.ts` defines. This forces test files to use relative imports (`./types`) instead of the cleaner `$lib/types` pattern used in source files. This inconsistency makes it harder to move tests or restructure.

### 17. `vitest.config.ts` Includes Unnecessary Tailwind Plugin

**Location:** `vitest.config.ts` line 6
**Severity:** Low

The `tailwindcss()` plugin is included in the Vitest config, which adds overhead to test runs without any benefit since CSS isn't processed in unit tests.

### 18. Artificial Effect Dependency Tracking

**Location:** `src/pages/BuilderPage.svelte` line 138
**Severity:** Low

```ts
const _ = [key, gridSize, grid, wordMetadata, displacedClues, title, author];
```
This creates an unused array solely to force reactivity tracking. In Svelte 5, `$effect` automatically tracks accessed reactive values, making this pattern unnecessary and confusing. It should simply access the reactive values directly.

### 19. No Bounds Validation on Grid Size Input

**Location:** `src/components/GridSizeSelector.svelte`
**Severity:** Medium

The input only has `min="2"` but no `max` attribute. A user could enter 1000, creating a grid that crashes the browser. The `handleSizeChange` function does check `if (newSize < 2) return;` but has no upper bound check.

### 20. `crypto.randomUUID()` Environment Concern

**Locations:** `src/lib/clue-logic.ts` line 153, `src/lib/storage.ts` line 106
**Severity:** Low

`crypto.randomUUID()` requires a secure context (HTTPS) and isn't available in all environments. While modern browsers support it, this could fail in older browsers or non-HTTPS contexts. Consider a fallback.

### 21. No Toast Animation/Transition

**Location:** `src/components/Toast.svelte`
**Severity:** Low

The Toast component appears/disappears instantly with no CSS transition or Svelte transition. This degrades the UX for important feedback messages.

### 22. Reconcile Test Passes Extra Arguments

**Location:** `src/lib/clue-logic.test.ts` line 598 (in `isGridBlank` test)
**Severity:** Low

One test call to `reconcileWordsOnGridChange` passes 5 arguments when the function only accepts 3. The extra `grid` and `gridSize` parameters are silently ignored. This appears to be a leftover from a previous API signature and should be cleaned up.

### 23. PUZZLE DATA Not Validated or Used in Tests

**Location:** `puzzles/*.json`
**Severity:** Low

The JSON puzzle files in `puzzles/` are not used by any automated test. They appear to be fixtures but aren't validated against the current schema programmatically. They could become stale or invalid without detection.

### 24. No Shared Composable for Cursor/Selection Logic

**Severity:** Medium

Both BuilderPage and PlayerPage implement cursor movement, cell selection, and direction toggling independently. This includes:
- `advancePosition`, `retreatPosition`, `movePosition` calls
- Intersection detection and direction toggling
- Letter input handling
- Backspace handling

This should be extracted into a shared `useCrosswordCursor` composable.

### 25. Arrow Key Direction Override Has Subtle Semantic Issue

**Location:** `src/pages/BuilderPage.svelte` lines 377-448, `src/pages/PlayerPage.svelte` lines 218-296
**Severity:** Medium

In both pages, the arrow key handler does:
1. Set `directionPolarity` (and sometimes `selectedDirection`) based on the arrow key
2. Call `movePosition` with the updated direction
3. Check if the new position is selectable
4. Update `selectedCell`
5. Then **again** update `selectedDirection` based on the arrow key

The issue: `selectedDirection` is set TWICE — once before `movePosition` (in the switch) and once after (in the if block). The switch statement sets it to the "intuitive" direction (ArrowDown → "down"), but then the if-block overrides it to the same value. The `movePosition` function uses the direction from the switch, which is correct, but the double-setting is confusing and suggests the logic was not clearly designed.

---

## Low-Priority / Nit Smells

### 26. Inconsistent Component Prop Definition Style

Some components use named interfaces (`CrosswordGridProps`, `CellProps` in `types.ts`), while others define props inline in the `<script>` block. Should be consistent.

### 27. No Design Tokens or CSS Custom Properties

All styling is via Tailwind utility classes with magic numbers. The cell size (`40px`) is hardcoded in `Cell.svelte` and `CrosswordGrid.svelte`. Should use CSS custom properties for consistency.

### 28. `main.ts` Uses Non-Null Assertion

**Location:** `src/main.ts` line 6
```ts
const app = mount(App, { target: document.getElementById('app')! });
```
Should have a null check for robustness.

### 29. No `onDestroy` Cleanup for Timers

Both BuilderPage and PlayerPage manage timers (`toastTimer`, `saveTimer`) as module-level variables. In Svelte 5, these aren't properly cleaned up on component destruction. Should use `$effect` with return cleanup functions.

### 30. CSS Class String Interpolation Hard to Read

**Location:** Multiple components (Cell.svelte, ClueEntry.svelte, etc.)

Dynamic class strings using template literals like:
```svelte
class="...{isSelected ? 'bg-yellow-300' : isHighlighted ? 'bg-yellow-100' : 'bg-white'}"
```
are hard to read and maintain. Consider using a class utility function or Svelte's `class:` directive.

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Critical architectural smells | 5 |
| High-priority code smells | 6 |
| Medium-priority code smells | 9 |
| Low-priority code smells | 10 |
| **Total** | **30** |

## Key Test Metrics

- **Unit test files:** 7
- **Unit tests:** 305 (all passing)
- **Component tests:** 0
- **Integration tests:** 0
- **TypeScript errors:** 21 (all in test files)
- **Test coverage of components:** 0%

## Priority Recommendations

1. **Extract BuilderPage/PlayerPage logic into composable modules** — This is the single highest-impact change. Create `useCrosswordCursor`, `useToast`, `useAutosave` composables and a shared `CrosswordState` management module.

2. **Separate data from UI state in BuilderState** — Create a `BuilderData` type for persistence and keep `BuilderUIState` ephemeral.

3. **Fix the missing `break` in arrow key handlers** — Easy bug fix with potential impact.

4. **Write component tests** — Start with `CrosswordGrid`, `Cell`, and `ClueEntry` since they have the most interactions.

5. **Fix TypeScript errors in test files** — Make tests type-safe.

6. **Add routing** — Even a simple hash-based router would improve UX significantly.