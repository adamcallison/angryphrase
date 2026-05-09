# Handoff Notes for Future Agents

## Project Status: Feature-Complete MVP

The crossword builder & player application is **functionally complete** with all core features implemented. Build compiles cleanly, all 295 unit tests pass.

## How to Run

```bash
npm run dev          # Dev server on http://localhost:5173
npm run build        # Production build to dist/
npm test             # Run Vitest (295 tests)
npm run test:watch   # Vitest in watch mode
```

**Important:** The dev server cannot be reliably started as a background process from this environment. Run `npm run dev` in your own terminal and access it directly.

## Architecture Overview

### Svelte 5 Runes — NOT Svelte 4
- State: `$state()`, `$derived()`, `$derived.by()`, `$effect()`
- Props: `let { ... } = $props()`
- **NO** Svelte 4 stores (`writable`, `readable`), **NO** `$:` reactive declarations
- **NO** `$effect(fn, [])` — use a `hasLoaded` flag pattern instead for mount-only effects

### File Structure
```
src/
  lib/                    # Pure logic (no Svelte dependency)
    types.ts              # All TypeScript interfaces/types
    constants.ts           # App-wide constants
    grid-logic.ts         # Grid creation, word derivation, numbering, navigation
    chain-logic.ts        # Word chain join/unjoin/validate
    clue-logic.ts         # Word reconciliation, displaced clues, reattach
    check-logic.ts        # Answer checking & error clearing
    validation.ts         # Puzzle validation (complete/incomplete)
    import-export.ts      # JSON serialization/deserialization
    storage.ts            # localStorage persistence
    *.test.ts             # Co-located test files (295 tests total)
  components/              # Reusable UI components
    Cell.svelte            # Individual grid cell (rendering only)
    CrosswordGrid.svelte   # NxN grid with keyboard handling
    CluePanel.svelte       # Across/Down clue lists
    ClueEntry.svelte       # Single clue row (editable or read-only)
    Toast.svelte           # Transient notification
    ActiveClueDisplay.svelte  # Shows selected clue text
    CheckResultDisplay.svelte # Answer check result + clear button
    ImportScreen.svelte    # File picker for puzzle import
    PlayerActions.svelte   # Check/Reset/Import buttons
    ModeToggle.svelte      # Design/Fill mode switch
    MarkerToolbar.svelte   # Space/hyphen marker toggles
    PuzzleMetadataForm.svelte  # Title/Author inputs
    GridSizeSelector.svelte    # Grid size input
    BuilderActions.svelte  # Save/Export/Import/Reset buttons
    DisplacedCluesPanel.svelte # List of displaced clues
  pages/
    Landing.svelte         # Build/Play choice screen
    BuilderPage.svelte     # Builder orchestrator (ALL builder state lives here)
    PlayerPage.svelte      # Player orchestrator (ALL player state lives here)
  App.svelte              # Root component with view routing
  main.ts                 # Entry point
  styles/index.css        # Tailwind CSS entry
```

### Key Patterns

1. **Unidirectional data flow**: Page components hold all state. Children receive data via props and communicate changes via callbacks.

2. **wordMetadata is a Map**: BuilderPage stores `wordMetadata: Map<string, WordMetadata>`. Svelte 5 reactivity on Maps requires creating a new Map on every mutation. Use `syncMetadataFromWords(updatedWords)` helper for bulk updates.

3. **Numbering flow**:
   - `deriveWords(grid, gridSize)` → words with `number: 0`
   - Merge with `wordMetadata` → words with clue/nextWord but still `number: 0`
   - `assignNumbers(words)` → returns `Map<string, number>` for cell number lookup
   - Never put numbers directly on the Word objects; always derive them via `assignNumbers`

4. **Design mode grid changes** MUST call `reconcileWordsOnGridChange()` to update words/displaced clues. This is the most complex function in the app — see section 6.2 of architecture-design.md.

5. **Svelte template syntax**: Use `{#if condition}...{/if}` blocks, NOT `{condition && (...)}`. The latter is JSX/React syntax and will cause build errors.

6. **Path alias**: `$lib` is configured in both `vite.config.ts` and `tsconfig.json` pointing to `./src/lib`. Use `$lib/types` etc. in imports.

7. **wordMetadata → words derivation**: In BuilderPage, `words` is `$derived` from `deriveWords(grid, gridSize)` merged with `wordMetadata`. Any grid change triggers re-derivation and reconciliation.

## Known Gaps / Next Steps

These are areas that need attention but were not in the initial scope:

1. **No component or integration tests yet** — Only the pure logic modules (`src/lib/*.ts`) have tests. The Svelte components and pages (BuilderPage, PlayerPage) have NO tests. These should use `@testing-library/svelte` with Vitest. A concrete example of why this matters: all clues displayed as "0 Across" / "0 Down" because the `number` field on `Word` objects was never populated from the `assignNumbers` map. Each function worked correctly in isolation (`deriveWords` returns `number: 0`, `assignNumbers` produces the correct Map), but no test verified that the pipeline `deriveWords → assignNumbers → merge with metadata → pass to CluePanel` produced `Word` objects with the correct `number` values. This wiring bug was invisible to pure-function tests. An integration test that exercises the full derivation pipeline and checks the final `Word.number` values would have caught it.

2. **No E2E tests** — Playwright tests were deferred per the architecture design. Key flows to test: Builder full workflow, Player full workflow, import/export round-trip.

3. **Visual polish** — The current UI is functional but minimal. Colors, spacing, typography are all TBD per the architecture. The Tailwind CSS is present but not customized.

4. **No undo/redo** — The architecture mentions this as a future extension point. The pure-function approach naturally supports it, but state snapshots would need to be stored.

5. **No keyboard shortcut for Escape in Builder** — The `handleGlobalKeyDown` handler on `<svelte:window>` cancels join/reattach on Escape, but it only fires when the Builder page is mounted. If other pages are shown, this listener isn't active (which is correct).

6. **Autosave debounce** — Both BuilderPage and PlayerPage use `setTimeout(500)` for debounced saves. This is a simple approach but doesn't handle edge cases like rapid successive changes or component teardown.

7. **Import/Export file naming** — Export filenames use a truncated key (`puzzle-${key.slice(0, 8)}-incomplete.json`). No user-customizable naming.

8. **PlayerPage loads `CompletePuzzle` format only** — The import screen validates that the JSON is a "complete" type. If a user tries to import an "incomplete" puzzle, they get an error. BuilderPage handles both formats.

9. **BuilderPage auto-loads from localStorage on mount** — Uses a `hasLoaded` flag pattern since Svelte 5 doesn't support `$effect(fn, [])`. This means the initial empty grid state briefly exists before being overwritten by saved state.

10. **Cell size is fixed at 40px** — The Cell component uses a hardcoded `w-10 h-10` (40px). For responsive/mobile support, this would need to be dynamic.

## Important Module Dependencies

```
grid-logic.ts     (foundation — no dependencies on other lib modules)
    ↑
chain-logic.ts    (depends on: types)
    ↑
clue-logic.ts    (depends on: types, chain-logic)
    ↑
check-logic.ts    (depends on: types)
validation.ts     (depends on: types, chain-logic)
import-export.ts  (depends on: types, constants, validation, chain-logic)
storage.ts        (depends on: types, constants)
```

Page components depend on ALL lib modules. Component files depend on types and specific lib modules as needed.

## Testing Approach

- **Vitest** is the test runner (`npm test` or `npm run test:watch`)
- **No jsdom/happy-dom** — tests are for pure functions only, no DOM needed
- **Co-located test files** — `grid-logic.test.ts` sits next to `grid-logic.ts`
- **Test environment:** Node.js (no browser simulation needed for lib tests)
- To add component tests: install `@testing-library/svelte` and configure `vitest.config.ts` with `environment: 'jsdom'` or `environment: 'happy-dom'`