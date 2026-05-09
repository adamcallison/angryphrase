# Crossword Builder & Player — Implementation Plan

## Approach

Strict TDD: write tests first (RED), then implement (GREEN), then refactor.
Pure logic modules (lib/) are implemented first — they have zero Svelte dependency and are trivially testable.
Components are built after logic is solid.

## Implementation Order

### Phase 1: Project Scaffolding
- Svelte 5 + Vite + TypeScript project creation
- Tailwind CSS setup
- Vitest configuration
- File/directory structure per architecture design §5
- Types and constants (lib/types.ts, lib/constants.ts)

### Phase 2: Pure Logic Modules (TDD, in dependency order)

1. **grid-logic.ts** — Foundation: grid creation, word derivation, numbering, cursor navigation
   - Tests: createEmptyGrid, deriveWords, assignNumbers, getWordsAtCell, advancePosition, retreatPosition, movePosition, isSelectableCell, computeWordLength

2. **chain-logic.ts** — Chain operations on top of words
   - Tests: toWordId, getChain, getChainHead, isChainHead, getDisplayClue, joinWords, unjoinWord, breakChainAtWord, validateChains

3. **clue-logic.ts** — Word reconciliation, displaced clues
   - Tests: reconcileWordsOnGridChange (all FR-26 cases), reattachClue, isGridBlank

4. **check-logic.ts** — Answer checking for Player
   - Tests: checkPuzzle (4 result types), clearErrors

5. **validation.ts** — Puzzle validation for import/export
   - Tests: validateCompletePuzzle, validateIncompletePuzzle, canExportAsComplete

6. **import-export.ts** — JSON serialization/deserialization
   - Tests: serializeIncompletePuzzle, serializeCompletePuzzle, parsePuzzleJSON, deriveWordAnswer, round-trips

7. **storage.ts** — localStorage operations
   - Tests: save/load builder state, save/load player progress, clear, generateUniqueKey

### Phase 3: Shared Components
- Cell.svelte, CrosswordGrid.svelte, CluePanel.svelte, ClueEntry.svelte, Toast.svelte

### Phase 4: Builder-Specific Components
- ModeToggle, MarkerToolbar, PuzzleMetadataForm, GridSizeSelector, BuilderActions, DisplacedCluesPanel

### Phase 5: Player-Specific Components
- ImportScreen, ActiveClueDisplay, CheckResultDisplay, PlayerActions

### Phase 6: Pages & App Shell
- Landing.svelte, BuilderPage.svelte, PlayerPage.svelte, App.svelte

### Phase 7: Integration Testing & Polish
- BuilderPage integration tests
- PlayerPage integration tests
- End-to-end flow verification

## Decision Log

1. **Svelte 5 + Vite + Vitest**: Used Svelte 5 with runes ($state, $derived, $effect). Vitest v4 for testing.

2. **$lib alias**: Configured `vite.config.ts` and `tsconfig.json` with `$lib` → `./src/lib` path alias for clean imports.

3. **Tailwind CSS v4**: Used `@tailwindcss/vite` plugin (v4 approach). No `tailwind.config.js` or `postcss.config.js` needed.

4. **GridSizeSelector syntax**: Fixed Svelte template syntax — must use `{#if}/{/if}` blocks, not `{condition && (...)}` inside template markup.

5. **$effect mount pattern**: Svelte 5 doesn't support `$effect(fn, [])` (empty deps). Used a `hasLoaded` state flag to prevent re-runs of the mount-only effect.

6. **wordMetadata as Map**: BuilderPage stores wordMetadata as `Map<string, WordMetadata>`. For Svelte 5 reactivity, mutations require creating a new Map (`new Map(oldMap.set(key, value))`). This is handled in `syncMetadataFromWords`.

7. **PlayerPage join/reattach indication**: PlayerPage doesn't need these modes, so `joinMode={false}` and `reattachMode={false}` are passed to CrosswordGrid.

8. **BuilderPage import handling**: Complete puzzle JSON imports are converted to builder state — grid, words metadata, title, author are extracted. Incomplete format imports include displaced clues.

9. **Numbering flow**: `deriveWords` produces words with `number=0`. Actual numbers come from `assignNumbers(words)` which returns a Map<string, number>. Components use this Map to look up cell numbers.

## Notes

- Using Svelte 5 runes ($state, $derived, $effect) — NOT Svelte 4 stores
- All logic functions are pure — no side effects, no Svelte dependency
- Components receive data via props and communicate up via callback props
- Page components (BuilderPage, PlayerPage) hold all state
- 295 unit tests across 7 test files — all passing
- Build compiles cleanly