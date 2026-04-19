# Crossword Builder & Player - Detailed Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Core Data Models](#core-data-models)
5. [Business Logic Modules](#business-logic-modules)
   - [grid-logic.ts](#grid-logic)
   - [clue-logic.ts](#clue-logic)
   - [chain-logic.ts](#chain-logic)
   - [check-logic.ts](#check-logic)
   - [validation.ts](#validation)
   - [import-export.ts](#import-export)
   - [storage.ts](#storage)
6. [Svelte Components](#svelte-components)
   - [Entry Points](#entry-points)
   - [Page Components](#page-components)
   - [Shared Components](#shared-components)
   - [UI Components](#ui-components)
7. [State Management](#state-management)
8. [Key Workflows](#key-workflows)
9. [Testing](#testing)
10. [Appendix: Key Design Decisions](#appendix-key-design-decisions)

---

## Overview

The Crossword Builder & Player is a **purely frontend web application** built with Svelte 5 for creating and solving crossword puzzles. The application operates in two independent modes:

- **Builder Mode**: For designing crossword grids, entering clues, and managing word chains
- **Player Mode**: For solving imported crossword puzzles with progress persistence

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Svelte 5 with runes** (`$state`, `$derived`, `$effect`) | Modern reactivity model with explicit reactive declarations |
| **Tailwind CSS** | Fast iteration, consistent styling, easy theming |
| **Pure functions for business logic** | Maximally testable, framework-agnostic, no side effects |
| **State in page components** | Simple data flow via props, no global stores or context API |
| **localStorage persistence** | Client-side only, no server required |
| **Vitest for testing** | Vite-native test runner for pure logic functions |

---

## Architecture

### High-Level Component Diagram

```
App.svelte
├── Landing.svelte
│   ├── "Build" button → BuilderPage
│   └── "Play" button → PlayerPage
│
├── BuilderPage.svelte (Orchestrator)
│   ├── PuzzleMetadataForm.svelte
│   ├── GridSizeSelector.svelte
│   ├── CrosswordGrid.svelte
│   │   └── Cell.svelte
│   ├── CluePanel.svelte
│   │   └── ClueEntry.svelte
│   ├── DisplacedCluesPanel.svelte
│   ├── MarkerToolbar.svelte
│   ├── ModeToggle.svelte
│   ├── BuilderActions.svelte
│   └── Toast.svelte
│
└── PlayerPage.svelte (Orchestrator)
    ├── ImportScreen.svelte
    ├── CrosswordGrid.svelte
    │   └── Cell.svelte
    ├── CluePanel.svelte
    ├── ActiveClueDisplay.svelte (×2: above/below grid)
    ├── CheckResultDisplay.svelte
    ├── PlayerActions.svelte
    └── Toast.svelte
```

### Communication Patterns

- **Parent → Child**: All data passed via Svelte 5 props
- **Child → Parent**: Callback props (e.g., `onCellClick`, `onKeyDown`)
- **Child → Child**: Never directly; all communication flows through parent
- **Persistence**: Each page manages its own localStorage reads/writes

---

## Project Structure

```
src/
├── main.ts                          # Entry point: mounts App
├── App.svelte                       # Root: view routing
├── env.d.ts                         # Environment type declarations
│
├── lib/                             # Pure business logic (zero Svelte deps)
│   ├── types.ts                     # All TypeScript interfaces/types
│   ├── constants.ts                 # App constants
│   ├── grid-logic.ts                # Grid creation, word derivation, navigation
│   ├── clue-logic.ts                # Word reconciliation, displaced clues
│   ├── chain-logic.ts               # Chain operations, validation
│   ├── check-logic.ts               # Answer checking, error clearing
│   ├── validation.ts                # Puzzle validation for import/export
│   ├── import-export.ts             # JSON serialization/deserialization
│   └── storage.ts                   # localStorage operations
│
├── components/                      # Reusable Svelte components
│   ├── CrosswordGrid.svelte         # Grid rendering, keyboard handling
│   ├── Cell.svelte                  # Single cell rendering
│   ├── CluePanel.svelte             # Across/Down clue lists
│   ├── ClueEntry.svelte             # Single clue row
│   ├── ActiveClueDisplay.svelte     # Selected clue display
│   ├── CheckResultDisplay.svelte    # Check outcome display
│   ├── MarkerToolbar.svelte         # Marker toggle buttons
│   ├── DisplacedCluesPanel.svelte   # Displaced clue list
│   ├── ModeToggle.svelte            # Design/Fill mode switch
│   ├── BuilderActions.svelte        # Save/Export/Import/Reset
│   ├── PlayerActions.svelte         # Check/Reset/Import New
│   ├── PuzzleMetadataForm.svelte    # Title/author inputs
│   ├── GridSizeSelector.svelte      # Grid size input
│   ├── ImportScreen.svelte          # File picker
│   └── Toast.svelte                 # Transient notifications
│
├── pages/                           # Orchestrator components
│   ├── Landing.svelte               # Landing page
│   ├── BuilderPage.svelte           # Builder orchestrator
│   └── PlayerPage.svelte            # Player orchestrator
│
└── styles/
    └── index.css                    # Tailwind directives + custom styles
```

---

## Core Data Models

### CellData

Represents a single cell in the crossword grid.

```typescript
interface CellData {
  black: boolean;           // Whether cell is black (blocked)
  letter: string | null;    // Single A-Z character, or null
  spaceRight: boolean;      // Space marker on right edge
  spaceBottom: boolean;     // Space marker on bottom edge
  hyphenRight: boolean;     // Hyphen marker on right edge
  hyphenBottom: boolean;    // Hyphen marker on bottom edge
}
```

### WordPosition

Identifies a word's starting position and direction.

```typescript
interface WordPosition {
  startRow: number;
  startCol: number;
  direction: Direction;  // "across" | "down"
}
```

### DerivedWord

A word detected from grid structure (before metadata is attached).

```typescript
interface DerivedWord {
  startRow: number;
  startCol: number;
  direction: Direction;
  length: number;         // Contiguous white cells from start
  number: number;         // Assigned by numbering algorithm
}
```

### WordMetadata

User-entered metadata for a word (NOT derived from grid).

```typescript
interface WordMetadata {
  clue: string;                        // Clue text (may be empty)
  nextWord: WordPosition | null;       // Chain link (null = not chained)
}
```

### Word

Full word object combining derived data with metadata.

```typescript
interface Word extends DerivedWord, WordMetadata {}
```

### DisplacedClue

A clue that was displaced when its word was destroyed during grid editing.

```typescript
interface DisplacedClue {
  id: string;           // Unique identifier (crypto.randomUUID())
  clue: string;
  direction: Direction;
  // Note: no position info - user picks new target on reattach
}
```

### CellPosition

A cell coordinate used for selection and highlighting.

```typescript
interface CellPosition {
  row: number;
  col: number;
}
```

### PlayerLetters

Player's entered letters, stored separately from puzzle answers.

```typescript
type PlayerLetters = (string | null)[][];
```

### CheckResult

Result of answer checking in Player mode.

```typescript
type CheckResultType =
  | "complete-correct"
  | "incomplete-correct"
  | "complete-incorrect"
  | "incomplete-incorrect";

interface CheckResult {
  type: CheckResultType;
  incorrectCells: CellPosition[];  // Wrong letters
  emptyCells: CellPosition[];       // Unfilled cells
}
```

### WordId

Unique identifier for a word position.

```typescript
type WordId = string;  // Format: `${startRow}-${startCol}-${direction}`
```

### BuilderState

Complete state for the Builder page.

```typescript
interface BuilderState {
  // Core data
  key: string;
  gridSize: number;
  grid: CellData[][];
  wordMetadata: Map<string, WordMetadata>;
  displacedClues: DisplacedClue[];
  title: string;
  author: string;

  // UI state
  mode: "design" | "fill";
  selectedCell: CellPosition | null;
  selectedDirection: Direction;

  // Reattach mode
  reattachMode: boolean;
  selectedDisplacedClueIndex: number | null;

  // Join mode
  joinMode: boolean;
  joinSourceWordId: WordId | null;
}
```

### PlayerProgress

Saved progress for a player.

```typescript
interface PlayerProgress {
  key: string;
  gridSize: number;
  letters: (string | null)[][];
}
```

### WordChangeResult

Result of reconciling words after a grid change.

```typescript
interface WordChangeResult {
  updatedWords: Word[];
  displacedClues: DisplacedClue[];
  shortenedWords: Word[];
  lengthenedWords: Word[];
}
```

### JSON Import/Export Formats

**CompletePuzzleJSON** - For Player import (validated, no displaced clues):

```typescript
interface CompletePuzzleJSON {
  version: number;
  type: "complete";
  key: string;
  gridSize: number;
  grid: CellData[][];
  words: Word[];
  title: string;
  author: string;
}
```

**IncompletePuzzleJSON** - For Builder save/load (includes displaced clues):

```typescript
interface IncompletePuzzleJSON {
  version: number;
  type: "incomplete";
  key: string;
  gridSize: number;
  grid: CellData[][];
  words: Word[];
  title: string;
  author: string;
  displacedClues: DisplacedClue[];
}
```

### ValidationResult

Result of puzzle validation.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

### Component Props Interfaces

**Note:** Only `CellProps` and `CrosswordGridProps` are defined as exported interfaces in `types.ts`. All other components use inline type definitions for their props.

**CellProps** (exported in `types.ts`):

```typescript
interface CellProps {
  isBlack: boolean;
  letter: string | null;
  number: number | null;
  isSelected: boolean;
  isHighlighted: boolean;
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
  row: number;
  col: number;
}
```

**CrosswordGridProps** (exported in `types.ts`):

```typescript
interface CrosswordGridProps {
  grid: CellData[][];
  gridSize: number;
  words: Word[];
  displayLetters: (string | null)[][];
  selectedCell: CellPosition | null;
  selectedDirection: Direction;
  highlightedCells: CellPosition[];
  mode: "builder-design" | "builder-fill" | "player";

  // Interaction mode flags — when true, grid click behavior changes
  joinMode: boolean;
  joinSourceWordId: WordId | null;
  reattachMode: boolean;

  // Callbacks
  onCellClick: (row: number, col: number) => void;
  onKeyDown: (key: string) => void;
}
```

**CrosswordGridProps**:

```typescript
interface CrosswordGridProps {
  grid: CellData[][];
  gridSize: number;
  words: Word[];
  displayLetters: (string | null)[][];
  selectedCell: CellPosition | null;
  selectedDirection: Direction;
  highlightedCells: CellPosition[];
  mode: "builder-design" | "builder-fill" | "player";
  joinMode: boolean;
  joinSourceWordId: WordId | null;
  reattachMode: boolean;
  onCellClick: (row: number, col: number) => void;
  onKeyDown: (key: string) => void;
}
```

---

## Business Logic Modules

All modules in `src/lib/` are **pure TypeScript functions** with no Svelte dependencies. They can be tested independently without rendering components.

### Constants (`constants.ts`)

Application-wide constants used throughout the codebase.

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `DEFAULT_GRID_SIZE` | `number` | `15` | Default grid size (NxN) for new puzzles |
| `CURRENT_VERSION` | `number` | `1` | JSON format version for import/export |
| `BUILDER_STORAGE_KEY` | `string` | `"builder-current"` | localStorage key for builder state |
| `PLAYER_STORAGE_KEY_PREFIX` | `string` | `"player-"` | Prefix for player progress keys |
| `TOAST_DURATION_MS` | `number` | `3000` | Toast notification display duration |
| `AUTOSAVE_DELAY_MS` | `number` | `500` | Debounce delay for auto-save |

---

### Grid Logic (`grid-logic.ts`)

Functions for grid creation, word derivation, numbering, and cursor navigation.

#### `createEmptyGrid(size: number): CellData[][]`

Creates an NxN grid of all-white cells with default values.

**Parameters:**
- `size` - Grid dimension (N)

**Returns:** 2D array of `CellData` objects with:
- `black: false`
- `letter: null`
- All marker flags: `false`

**Example:**
```typescript
const grid = createEmptyGrid(5); // 5x5 grid, all white cells
```

---

#### `deriveWords(grid: CellData[][], gridSize: number): DerivedWord[]`

Detects all words in the grid by finding maximal contiguous white-cell sequences of length ≥ 2 in both directions.

**Parameters:**
- `grid` - The crossword grid
- `gridSize` - Grid dimension (N)

**Returns:** Array of `DerivedWord` objects with `number: 0` (call `assignNumbers` to set actual numbers)

**Algorithm:**
1. **Across words**: Scan row by row, finding horizontal white-cell sequences
2. **Down words**: Scan column by column, finding vertical white-cell sequences
3. Only sequences of length ≥ 2 are considered words

---

#### `assignNumbers(words: DerivedWord[]): Map<string, number>`

Assigns standard crossword numbering to cells that start words.

**Parameters:**
- `words` - Array of derived words

**Returns:** Map from `"row-col"` string to sequential number

**Numbering Rules:**
- Scan cells left-to-right, top-to-bottom
- A cell receives a number if it starts an across word AND/OR a down word
- One number per cell (shared if cell starts both across and down)

**Example:**
```typescript
const words = deriveWords(grid, 15);
const numbers = assignNumbers(words);
// numbers.get("0-0") → 1 (first numbered cell)
```

---

#### `getWordsAtCell(words: Word[], row: number, col: number): Word[]`

Returns all words containing the specified cell.

**Parameters:**
- `words` - Array of words
- `row`, `col` - Cell coordinates

**Returns:** Array of 0, 1, or 2 words (intersection cells have 2)

---

#### `getWordInDirection(words: Word[], row: number, col: number, direction: Direction): Word | null`

Returns the word at the specified cell in the given direction.

**Parameters:**
- `words` - Array of words
- `row`, `col` - Cell coordinates
- `direction` - `"across"` or `"down"`

**Returns:** The matching word, or `null` if no word of that direction contains the cell

---

#### `advancePosition(grid: CellData[][], row: number, col: number, direction: Direction, gridSize: number): CellPosition`

Advances the cursor one cell in the given direction.

**Parameters:**
- `grid` - The crossword grid
- `row`, `col` - Current position
- `direction` - Direction to move
- `gridSize` - Grid dimension

**Returns:** New position, or current position if movement is blocked (boundary or black cell)

**Use case:** Called after typing a letter to move to the next cell.

---

#### `retreatPosition(grid: CellData[][], row: number, col: number, direction: Direction, gridSize: number): CellPosition`

Retreats the cursor one cell (opposite of `advancePosition`).

**Parameters:** Same as `advancePosition`

**Returns:** Previous position, or current position if movement is blocked

**Use case:** Called on Backspace when current cell is empty.

---

#### `movePosition(row: number, col: number, _direction: Direction, arrowKey: string, gridSize: number): CellPosition`

Moves cursor based on arrow key press (NOT constrained to word direction).

**Parameters:**
- `row`, `col` - Current position
- `_direction` - Unused (part of API signature)
- `arrowKey` - `"ArrowUp"`, `"ArrowDown"`, `"ArrowLeft"`, or `"ArrowRight"`
- `gridSize` - Grid dimension

**Returns:** New position clamped to grid bounds `[0, gridSize-1]`

---

#### `isSelectableCell(grid: CellData[][], row: number, col: number): boolean`

Checks if a cell is a valid selection target.

**Parameters:**
- `grid` - The crossword grid
- `row`, `col` - Cell coordinates

**Returns:** `true` if cell is:
- Within bounds
- White (not black)
- Part of a word (has at least one white neighbor horizontally OR vertically)

---

#### `computeWordLength(grid: CellData[][], startRow: number, startCol: number, direction: Direction, gridSize: number): number`

Counts contiguous white cells from start position in given direction.

**Parameters:**
- `grid` - The crossword grid
- `startRow`, `startCol` - Starting position
- `direction` - `"across"` or `"down"`
- `gridSize` - Grid dimension

**Returns:** Number of contiguous white cells (0 if starting cell is black)

---

#### `getSingleWordLengthPattern(grid: CellData[][], word: Word, gridSize: number): string`

Computes the length pattern string for a word based on cell markers.

**Parameters:**
- `grid` - The crossword grid
- `word` - The word to compute pattern for
- `gridSize` - Grid dimension

**Returns:** Pattern string:
- No markers: `"8"`
- Space markers: `"4, 4"` (comma-space separator)
- Hyphen markers: `"4-4"` (hyphen separator)
- Mixed: `"2, 2-3"` etc.

**Example:**
```typescript
// Word with space at position 4: "4, 4"
// Word with hyphen at position 4: "4-4"
```

---

### Clue Logic (`clue-logic.ts`)

Functions for reconciling words after grid changes and managing displaced clues.

#### `reconcileWordsOnGridChange(oldWords: Word[], newDerivedWords: DerivedWord[], oldDisplacedClues: DisplacedClue[], _grid: CellData[][], _gridSize: number): WordChangeResult`

Reconciles word metadata after a grid change in Design mode.

**Parameters:**
- `oldWords` - Words before the change (with metadata)
- `newDerivedWords` - Words derived from the new grid structure
- `oldDisplacedClues` - Existing displaced clues
- `_grid`, `_gridSize` - Unused (reserved for future use)

**Returns:** `WordChangeResult` containing:
- `updatedWords` - Words with preserved/updated metadata
- `displacedClues` - Combined old + newly displaced clues
- `shortenedWords` - Words that became shorter (for toast notifications)
- `lengthenedWords` - Words that became longer

**Algorithm:**
1. Build lookup map of old words by `WordId`
2. Match old words to new words by `(startRow, startCol, direction)`
3. For matched words: transfer metadata (clue, nextWord)
4. For destroyed words: create displaced clues if they had non-empty clue text
5. For new words: create empty metadata
6. Clean up chain references pointing to destroyed words
7. Clear clues for downstream words of destroyed chain members

**Pure function** - does not mutate any input.

---

#### `reattachClue(words: Word[], displacedClues: DisplacedClue[], clueIndex: number, targetWordId: string): { words: Word[]; displacedClues: DisplacedClue[] } | null`

Reattaches a displaced clue to a target word.

**Parameters:**
- `words` - Current words array
- `displacedClues` - Current displaced clues
- `clueIndex` - Index of clue to reattach
- `targetWordId` - ID of word to attach clue to

**Returns:**
- New `{ words, displacedClues }` object on success
- `null` if reattachment is blocked (target already has clue) or invalid

**Validation:**
- Target word must have empty clue text
- Clue index must be valid
- Target word must exist

**Pure function** - does not mutate any input.

---

#### `isGridBlank(grid: CellData[][], words: Word[], displacedClues: DisplacedClue[]): boolean`

Checks if the grid is blank (for allowing grid size changes).

**Parameters:**
- `grid` - The crossword grid
- `words` - Current words
- `displacedClues` - Displaced clues

**Returns:** `true` if:
- No displaced clues exist
- No word has non-empty clue text
- No cell has a letter

---

#### `generateDisplacedClueId(): string` (internal)

Generates a unique ID for a displaced clue using `crypto.randomUUID()`.

---

### Chain Logic (`chain-logic.ts`)

Functions for managing word chains (linked words via `nextWord` references).

#### `toWordId(pos: WordPosition): WordId`

Generates a `WordId` string from a `WordPosition`.

**Parameters:**
- `pos` - Word position object

**Returns:** Format: `${startRow}-${startCol}-${direction}`

**Example:**
```typescript
toWordId({ startRow: 0, startCol: 3, direction: "across" }) // "0-3-across"
```

---

#### `getChain(words: Word[], startWord: Word): Word[]`

Follows `nextWord` links from startWord to build the complete chain.

**Parameters:**
- `words` - All words
- `startWord` - Starting word

**Returns:** Array starting with `startWord`, followed by each linked word

**Example:**
```typescript
// If A→B→C (A.nextWord = B, B.nextWord = C)
const chain = getChain(words, A); // [A, B, C]
```

---

#### `getChainHead(words: Word[], word: Word): Word`

Finds the first word (head) in the chain containing the given word.

**Parameters:**
- `words` - All words
- `word` - Any word in the chain

**Returns:** The chain head (word that no other word points to)

**Algorithm:** Traverses backwards by finding words that point to the current word.

---

#### `isChainHead(words: Word[], word: Word): boolean`

Checks if a word is the first in its chain.

**Parameters:**
- `words` - All words
- `word` - Word to check

**Returns:** `true` if no other word's `nextWord` points to this word

---

#### `getDisplayClue(word: Word, words: Word[]): string`

Returns the display clue text for a word.

**Parameters:**
- `word` - The word
- `words` - All words (for chain lookup)

**Returns:**
- If chain head: the word's own `clue` text
- If non-head: `"See {number} {Direction}"` referencing the chain head

**Example:**
```typescript
// Word is non-head, chain head is 5-Across
getDisplayClue(word, words) // "See 5 Across"
```

---

#### `joinWords(words: Word[], sourceId: WordId, targetId: WordId): Word[] | null`

Joins source→target by setting `source.nextWord = target` position.

**Parameters:**
- `words` - All words
- `sourceId` - ID of source word (the one being linked FROM)
- `targetId` - ID of target word (the one being linked TO)

**Returns:**
- New words array with updated source word
- `null` if join is invalid

**Validation:**
- Source must not already have a `nextWord`
- Target must not already be pointed to by another word
- Source and target must be different words
- Both words must exist

**Pure function** - does not mutate any input.

---

#### `unjoinWord(words: Word[], wordId: WordId): Word[]`

Removes the `nextWord` link from the specified word.

**Parameters:**
- `words` - All words
- `wordId` - ID of word to unjoin

**Returns:** New words array with:
- Specified word's `nextWord` set to `null`
- Formerly linked word's `clue` set to `""` (replacing its "See" reference)

**Note:** Only the direct link is removed. If A→B→C and you unjoin A, B retains its `nextWord→C`, forming a new chain B→C.

---

#### `breakChainAtWord(words: Word[], destroyedWordId: WordId): Word[]`

Breaks a chain at a destroyed word (used when grid changes destroy a word).

**Parameters:**
- `words` - All words
- `destroyedWordId` - ID of destroyed word

**Returns:** New words array with:
- Predecessor's `nextWord` set to `null`
- Downstream words' `clue` set to `""` (invalidated "See" references)

---

#### `validateChains(words: Word[]): boolean`

Validates that all chain references are valid.

**Parameters:**
- `words` - All words

**Returns:** `true` if:
- No cycles exist
- No branching (no word pointed to by more than one word)
- All `nextWord` references point to existing words
- No self-references

---

#### `getWordLengthPattern(grid: CellData[][], word: Word, allWords: Word[], gridSize: number): string`

Returns display string for word's length pattern.

**Parameters:**
- `grid` - The crossword grid
- `word` - The word
- `allWords` - All words (for chain lookup)
- `gridSize` - Grid dimension

**Returns:**
- Chain head with `nextWord`: `"4,4"` (comma, no space - each word's total length)
- Single word with markers: `"4, 4"` or `"4-4"`
- Simple word: `"8"`

---

### Check Logic (`check-logic.ts`)

Functions for checking player answers and clearing errors.

#### `checkPuzzle(grid: CellData[][], playerLetters: PlayerLetters, gridSize: number): CheckResult`

Checks player's answers against correct answers.

**Parameters:**
- `grid` - Puzzle grid with correct letters
- `playerLetters` - Player's entered letters
- `gridSize` - Grid dimension

**Returns:** `CheckResult` with:
- `type`: One of four outcomes:
  - `"complete-correct"`: All filled, all correct
  - `"incomplete-correct"`: Some empty, all filled correct
  - `"complete-incorrect"`: All filled, some wrong
  - `"incomplete-incorrect"`: Some empty, some wrong
- `incorrectCells`: Cells where player letter ≠ answer
- `emptyCells`: Cells where player has no letter

**Note:** Black cells are ignored. An all-black grid returns `"complete-correct"`.

---

#### `clearErrors(grid: CellData[][], playerLetters: PlayerLetters, checkResult: CheckResult, gridSize: number): PlayerLetters`

Clears incorrect letters from player's grid.

**Parameters:**
- `grid` - Puzzle grid (unused, for reference)
- `playerLetters` - Player's current letters
- `checkResult` - Result from `checkPuzzle`
- `gridSize` - Grid dimension

**Returns:** New `PlayerLetters` array where all `incorrectCells` are set to `null`

**Note:** Empty cells and correct cells are untouched. Original array is NOT mutated.

---

### Validation (`validation.ts`)

Functions for validating puzzle JSON for import/export.

#### `validateCompletePuzzle(puzzle: CompletePuzzleJSON): ValidationResult`

Validates a complete puzzle JSON for Player import.

**Parameters:**
- `puzzle` - Complete puzzle JSON object

**Returns:** `ValidationResult` with `valid` boolean and `errors` array

**Validation Checks (FR-42):**
1. `version` must be `1`
2. `type` must be `"complete"`
3. Required fields: `key`, `gridSize`, `grid`, `words`, `title`, `author`
4. Grid dimensions match `gridSize`
5. All white cells have single A-Z letter
6. All chain-head words have non-empty clues
7. Word validity: positions within bounds, direction valid, length ≥ 2
8. Structural consistency: each white cell in at most one across and one down word
9. `nextWord` references resolve to valid words
10. Chain validity: no cycles, no branching
11. Cell marker fields must be booleans if present

---

#### `validateIncompletePuzzle(puzzle: IncompletePuzzleJSON): ValidationResult`

Validates an incomplete puzzle JSON for Builder import.

**Parameters:**
- `puzzle` - Incomplete puzzle JSON object

**Returns:** `ValidationResult`

**Validation Checks (more lenient than complete):**
- Version and type fields
- Required fields present
- Grid dimensions match
- Cell marker fields are booleans
- Word positions within bounds
- Chain validity (no cycles, no branching)
- `nextWord` references resolve

**Note:** Does NOT require letters in cells or non-empty clues.

---

#### `canExportAsComplete(grid: CellData[][], words: Word[], gridSize: number): { canExport: boolean; errors: string[] }`

Checks if a puzzle is ready for complete export.

**Parameters:**
- `grid` - The crossword grid
- `words` - All words
- `gridSize` - Grid dimension

**Returns:** Object with:
- `canExport`: `true` if all requirements met
- `errors`: Array of error messages

**Requirements:**
- All white cells have letters (single A-Z)
- All chain-head words have non-empty clues

---

#### `hasUnreachableChains(words: Word[]): boolean` (internal)

Supplementary cycle detection for chain structures. Used by validation functions to catch cycles that `validateChains` might miss.

---

### Import-Export (`import-export.ts`)

Functions for serializing and parsing puzzle JSON.

#### `deriveWordAnswer(grid: CellData[][], word: Word): string`

Derives the answer string for a word from grid cells.

**Parameters:**
- `grid` - The crossword grid
- `word` - The word to derive answer for

**Returns:** String of letters from grid cells (null letters contribute empty strings)

**Example:**
```typescript
// Word at 0-0 across, length 5, cells contain ["H", "E", "L", "L", "O"]
deriveWordAnswer(grid, word) // "HELLO"
```

---

#### `serializeIncompletePuzzle(grid: CellData[][], words: Word[], displacedClues: DisplacedClue[], metadata: PuzzleMetadata, key: string): IncompletePuzzleJSON`

Serializes builder state into an IncompletePuzzleJSON object.

**Parameters:**
- `grid` - Current grid
- `words` - All words with metadata
- `displacedClues` - Displaced clues array
- `metadata` - `{ title, author }`
- `key` - Unique puzzle identifier

**Returns:** `IncompletePuzzleJSON` with:
- `version: 1`
- `type: "incomplete"`
- All puzzle data including displaced clues

**Note:** Deep clones grid and words to avoid mutations.

---

#### `serializeCompletePuzzle(grid: CellData[][], words: Word[], metadata: PuzzleMetadata, key: string): CompletePuzzleJSON | { error: string }`

Serializes builder state into a CompletePuzzleJSON object.

**Parameters:** Same as `serializeIncompletePuzzle`

**Returns:**
- `CompletePuzzleJSON` on success
- `{ error: string }` if validation fails

**Validation:**
- All white cells must have letters
- All chain-head words must have non-empty clues

**Note:** Complete format has NO `displacedClues` field.

---

#### `parsePuzzleJSON(jsonString: string): { type: "incomplete"; data: IncompletePuzzle } | { type: "complete"; data: CompletePuzzle } | { error: string }`

Parses and validates a JSON string as either incomplete or complete puzzle.

**Parameters:**
- `jsonString` - Raw JSON string from file

**Returns:**
- `{ type: "incomplete", data: IncompletePuzzle }` for valid incomplete puzzles
- `{ type: "complete", data: CompletePuzzle }` for valid complete puzzles
- `{ error: string }` for parsing or validation errors

**Parsing Steps:**
1. Parse JSON (catch syntax errors)
2. Check `version` field (must be `1`)
3. Check `type` discriminator (`"incomplete"` or `"complete"`)
4. Normalize grid cells (fill in default marker values)
5. Validate based on type using `validateIncompletePuzzle` or `validateCompletePuzzle`
6. Return parsed data without `version`/`type` fields

**Normalization:**
- Missing marker fields default to `false`
- `displacedClues` defaults to `[]` if missing in incomplete format

---

#### `normalizeCell(cell: Record<string, unknown>): CellData` (internal)

Fills in default values for missing marker fields on a grid cell.

---

#### `normalizeGrid(rawGrid: unknown[][]): CellData[][]` (internal)

Normalizes all cells in a grid using `normalizeCell`.

---

### Storage (`storage.ts`)

Functions for localStorage persistence.

#### `playerStorageKey(puzzleKey: string): string`

Returns the localStorage key for player progress.

**Parameters:**
- `puzzleKey` - Unique puzzle identifier

**Returns:** Format: `"player-<puzzleKey>"`

---

#### `saveBuilderState(state: BuilderState): void`

Saves builder state to localStorage.

**Parameters:**
- `state` - Complete `BuilderState` object

**Implementation:**
- Converts `wordMetadata` Map to entries array for JSON serialization
- Stores under `BUILDER_STORAGE_KEY` (`"builder-current"`)

---

#### `loadBuilderState(): BuilderState | null`

Loads builder state from localStorage.

**Returns:**
- `BuilderState` object if saved state exists
- `null` if no saved state or data is corrupt

**Implementation:**
- Reconstructs `wordMetadata` Map from entries array
- Returns `null` on parse errors or invalid data

---

#### `savePlayerProgress(key: string, progress: PlayerProgress): void`

Saves player progress to localStorage.

**Parameters:**
- `key` - Puzzle identifier
- `progress` - `{ key, gridSize, letters }`

**Storage Key:** `"player-<key>"`

---

#### `loadPlayerProgress(key: string): PlayerProgress | null`

Loads player progress from localStorage.

**Parameters:**
- `key` - Puzzle identifier

**Returns:**
- `PlayerProgress` object if saved progress exists
- `null` if no saved progress or data is corrupt

---

#### `clearBuilderState(): void`

Removes builder state from localStorage.

---

#### `clearPlayerProgress(key: string): void`

Removes player progress for the given puzzle key from localStorage.

---

#### `generateUniqueKey(): string`

Generates a unique key using `crypto.randomUUID()`.

**Returns:** UUID string (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)

---

## Svelte Components

All components use **Svelte 5 runes** (`$state`, `$derived`, `$effect`) for reactivity. Components receive data via props and emit changes through callback props.

### Entry Points

#### `main.ts`

Application entry point.

**Responsibilities:**
- Imports global styles (`styles/index.css`)
- Imports root `App` component
- Mounts App to `#app` DOM element using Svelte 5's `mount()` function

```typescript
import './styles/index.css';
import App from './App.svelte';
import { mount } from 'svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});
```

---

#### `App.svelte`

Root component managing view routing.

**State:**
- `currentView: 'landing' | 'builder' | 'player'` - Current view (default: `'landing'`)

**Props:** None

**Children:**
- `Landing.svelte` - Shown when `currentView === 'landing'`
- `BuilderPage.svelte` - Shown when `currentView === 'builder'`
- `PlayerPage.svelte` - Shown when `currentView === 'player'`

**Event Handlers:**
- `onBuild` - Sets `currentView = 'builder'`
- `onPlay` - Sets `currentView = 'player'`

---

### Page Components

#### `Landing.svelte`

Landing page with Build/Play buttons.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `onBuild` | `() => void` | Called when Build button clicked |
| `onPlay` | `() => void` | Called when Play button clicked |

**UI Elements:**
- Title: "Crossword Builder & Player"
- Subtitle: "Create and solve crossword puzzles"
- Build button (blue, routes to Builder)
- Play button (green, routes to Player)

**State:** None (pure presentation component)

---

#### `BuilderPage.svelte`

Orchestrator component for Builder mode. Holds all builder state and composes child components.

**State:**

| State Variable | Type | Description |
|----------------|------|-------------|
| `key` | `string` | Unique puzzle identifier |
| `gridSize` | `number` | Grid dimension (N) |
| `grid` | `CellData[][]` | Current grid |
| `wordMetadata` | `Map<string, WordMetadata>` | Word metadata (clues, chains) |
| `displacedClues` | `DisplacedClue[]` | Displaced clues array |
| `title` | `string` | Puzzle title |
| `author` | `string` | Puzzle author |
| `mode` | `"design" \| "fill"` | Current mode |
| `selectedCell` | `CellPosition \| null` | Currently selected cell |
| `selectedDirection` | `Direction` | Current direction |
| `reattachMode` | `boolean` | Reattach mode active |
| `selectedDisplacedClueIndex` | `number \| null` | Selected displaced clue |
| `joinMode` | `boolean` | Join mode active |
| `joinSourceWordId` | `WordId \| null` | Join source word |
| `toastMessage` | `string` | Toast message |
| `toastVisible` | `boolean` | Toast visibility |

**Derived State:**

| Derived | Type | Description |
|---------|------|-------------|
| `derivedWords` | `DerivedWord[]` | Words from grid structure |
| `numberMap` | `Map<string, number>` | Cell numbering |
| `words` | `Word[]` | Merged words + metadata |
| `selectedWord` | `Word \| null` | Currently selected word |
| `selectedWordId` | `WordId \| null` | Selected word ID |
| `highlightedCells` | `CellPosition[]` | Cells of selected word |
| `displayLetters` | `(string \| null)[][]` | Letters to display (answers) |
| `gridIsBlank` | `boolean` | Grid is blank (for size changes) |
| `hasClueText` | `boolean` | Any word has clue text |
| `exportCheck` | `{ canExport, errors }` | Export readiness |

**Child Components:**
- `PuzzleMetadataForm` - Title/author inputs
- `GridSizeSelector` - Grid size input (disabled when not blank)
- `MarkerToolbar` - Marker toggle buttons (Fill mode only)
- `CrosswordGrid` - Grid rendering
- `CluePanel` - Across/Down clues
- `DisplacedCluesPanel` - Displaced clues (if any)
- `BuilderActions` - Save/Export/Import/Reset buttons
- `Toast` - Transient notifications
- `ModeToggle` - Design/Fill switch

**Key Handlers:**

| Handler | Purpose |
|---------|---------|
| `handleCellClick(row, col)` | Cell click (toggle black/white in Design, select in Fill, join/reattach targets) |
| `handleKeyDown(key)` | Keyboard input (letters, Backspace, arrows) |
| `handleModeChange(newMode)` | Mode switching with confirmation |
| `handleClueChange(wordId, newText)` | Clue text editing |
| `handleJoinClick(wordId)` | Enter join mode |
| `handleUnjoinClick(wordId)` | Remove chain link |
| `handleClueClick(wordId)` | Select word from clue panel |
| `handleDisplacedClueClick(index)` | Enter reattach mode |
| `handleDisplacedClueDelete(index)` | Delete displaced clue |
| `handleSizeChange(newSize)` | Change grid size (when blank) |
| `handleToggleMarker(marker)` | Toggle cell marker |
| `handleSave()` | Export incomplete JSON |
| `handleExportComplete()` | Export complete JSON |
| `handleImport()` | Import puzzle file |
| `handleReset()` | Reset to blank state |

**Auto-save:** Uses `$effect` with 500ms debounce to save state to localStorage on any state change.

**Load on mount:** Uses `$effect` with tracking to load saved state from localStorage on first render.

**Global keyboard:** Escape key cancels join/reattach modes.

---

#### `PlayerPage.svelte`

Orchestrator component for Player mode. Handles puzzle import, progress persistence, and answer checking.

**State:**

| State Variable | Type | Description |
|----------------|------|-------------|
| `puzzleLoaded` | `boolean` | Puzzle imported |
| `puzzleKey` | `string` | Puzzle identifier |
| `gridSize` | `number` | Grid dimension |
| `grid` | `CellData[][]` | Puzzle grid (answers) |
| `words` | `Word[]` | Puzzle words |
| `title` | `string` | Puzzle title |
| `author` | `string` | Puzzle author |
| `playerLetters` | `PlayerLetters` | Player's entered letters |
| `selectedCell` | `CellPosition \| null` | Selected cell |
| `selectedDirection` | `Direction` | Current direction |
| `checkResult` | `CheckResult \| null` | Last check result |
| `importError` | `string \| null` | Import error message |
| `toastMessage` | `string \| null` | Toast message |
| `toastVisible` | `boolean` | Toast visibility |

**Derived State:**

| Derived | Type | Description |
|---------|------|-------------|
| `derivedWords` | `DerivedWord[]` | Words from grid |
| `selectedWord` | `Word \| null` | Selected word |
| `selectedWordId` | `WordId \| null` | Selected word ID |
| `highlightedCells` | `CellPosition[]` | Highlighted cells |
| `displayLetters` | `(string \| null)[][]` | Player's letters |
| `clueNumber` | `number \| null` | Selected clue number |
| `clueDirection` | `Direction \| null` | Selected clue direction |
| `clueText` | `string \| null` | Selected clue text |
| `wordLengthPattern` | `string \| null` | Word length pattern |

**Child Components:**
- `ImportScreen` - File picker (shown when `!puzzleLoaded`)
- `ActiveClueDisplay` - Selected clue (×2: above/below grid)
- `CrosswordGrid` - Grid rendering
- `CluePanel` - Across/Down clues (read-only)
- `CheckResultDisplay` - Check outcome
- `PlayerActions` - Check/Reset/Import New buttons
- `Toast` - Transient notifications

**Key Handlers:**

| Handler | Purpose |
|---------|---------|
| `handleImport(jsonString)` | Parse and load puzzle |
| `handleCellClick(row, col)` | Select cell |
| `handleKeyDown(key)` | Letter input, Backspace, arrows |
| `handleClueClick(wordId)` | Select word from clue |
| `handleCheck()` | Check answers |
| `handleClearErrors()` | Clear incorrect letters |
| `handleReset()` | Reset progress |
| `handleImportNew()` | Return to import screen |

**Auto-save:** Uses `$effect` with 500ms debounce to save `playerLetters` to localStorage.

**Import flow:**
1. `ImportScreen` shows file picker
2. User selects JSON file
3. `parsePuzzleJSON` validates
4. If complete puzzle: load grid, words, metadata
5. Check for saved progress, restore if exists
6. Set `puzzleLoaded = true`

---

### Shared Components

#### `CrosswordGrid.svelte`

Renders the NxN crossword grid and handles keyboard input.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `grid` | `CellData[][]` | Grid data |
| `gridSize` | `number` | Grid dimension |
| `words` | `Word[]` | Words (for numbering) |
| `displayLetters` | `(string \| null)[][]` | Letters to show |
| `selectedCell` | `CellPosition \| null` | Selected cell |
| `selectedDirection` | `Direction` | Current direction |
| `highlightedCells` | `CellPosition[]` | Highlighted cells |
| `mode` | `"builder-design" \| "builder-fill" \| "player"` | Interaction mode |
| `joinMode` | `boolean` | Join mode active |
| `joinSourceWordId` | `WordId \| null` | Join source word |
| `reattachMode` | `boolean` | Reattach mode active |
| `onCellClick` | `(row, col) => void` | Cell click callback |
| `onKeyDown` | `(key) => void` | Key press callback |

**Derived:**
- `numberedCells` - Cell numbers from `assignNumbers(words)`
- `highlightedSet` - Set for O(1) highlight lookup

**Event Handling:**
- **Keyboard**: Intercepts letter keys (A-Z), Backspace, Arrow keys. Prevents default on handled keys.
- **Click**: Uses event delegation on grid container. Reads `data-row`/`data-col` attributes from clicked cell.

**Cursor Styles:**
- Normal: default cursor
- Join mode: `cursor-pointer`
- Reattach mode: `cursor-crosshair`

**Focus:** Grid container has `tabindex="0"` for keyboard focus. Shows focus ring on focus.

**Renders:** Grid of `Cell` components using CSS Grid (`grid-template-columns: repeat(gridSize, 40px)`).

---

#### `Cell.svelte`

Renders a single crossword cell.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `isBlack` | `boolean` | Black cell flag |
| `letter` | `string \| null` | Letter to display |
| `number` | `number \| null` | Cell number |
| `isSelected` | `boolean` | Selected (yellow) |
| `isHighlighted` | `boolean` | Highlighted (light yellow) |
| `spaceRight` | `boolean` | Space marker right |
| `spaceBottom` | `boolean` | Space marker bottom |
| `hyphenRight` | `boolean` | Hyphen marker right |
| `hyphenBottom` | `boolean` | Hyphen marker bottom |
| `row` | `number` | Row index (for click handling) |
| `col` | `number` | Column index |

**Rendering:**

**Black cells:**
- Black background, gray border
- No content

**White cells:**
- White/light yellow/yellow background (based on selection)
- Number in top-left corner (if present)
- Letter centered (if present)
- Markers rendered as absolute-positioned elements:
  - `spaceRight`: 2px vertical bar on right edge
  - `spaceBottom`: 2px horizontal bar on bottom edge
  - `hyphenRight`: Hyphen symbol on right edge
  - `hyphenBottom`: Hyphen symbol on bottom edge

**Attributes:** `data-row` and `data-col` for event delegation.

---

#### `CluePanel.svelte`

Renders Across and Down clue lists.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `words` | `Word[]` | All words |
| `grid` | `CellData[][]` | Grid (for length patterns) |
| `gridSize` | `number` | Grid dimension |
| `selectedWordId` | `WordId \| null` | Selected word ID |
| `editable` | `boolean` | Editable mode (Builder) |
| `onClueClick` | `(wordId: WordId) => void` | Clue click callback |
| `onClueChange` | `(wordId: WordId, newText: string) => void` | Clue change callback |
| `onJoinClick` | `(wordId: WordId) => void` | Join click callback |
| `onUnjoinClick` | `(wordId: WordId) => void` | Unjoin click callback |
| `joinMode` | `boolean` | Join mode active |
| `joinSourceWordId` | `WordId \| null` | Join source word |
| `reattachMode` | `boolean` | Reattach mode active |

**Note:** Props use inline type definition rather than a named interface.

**Derived:**
- `acrossWords` - Across words sorted by number
- `downWords` - Down words sorted by number

**Renders:**
- Two sections: "Across" and "Down"
- Each section contains `ClueEntry` components

---

#### `ClueEntry.svelte`

Renders a single clue row with editable input or read-only text.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `word` | `Word` | Word object |
| `number` | `number` | Word number |
| `wordLengthPattern` | `string` | Length pattern |
| `isEditable` | `boolean` | Editable flag |
| `isSelected` | `boolean` | Selected flag |
| `isChainHead` | `boolean` | Chain head flag |
| `displayClue` | `string` | Clue text (or "See X Dir") |
| `onClueChange` | `(wordId: WordId, newText: string) => void` | Clue change callback |
| `onClueClick` | `(wordId: WordId) => void` | Clue click callback |
| `onJoinClick` | `(wordId: WordId) => void` | Join click callback |
| `onUnjoinClick` | `(wordId: WordId) => void` | Unjoin click callback |
| `joinMode` | `boolean` | Join mode active |
| `joinSourceWordId` | `WordId \| null` | Join source word |

**Note:** Props use inline type definition rather than a named interface.

**Derived:**
- `wordId` - Word ID from word
- `directionLabel` - "Across" or "Down"
- `isJoinSource` - Whether this is the join source
- `hasChainLink` - Whether word has `nextWord`

**Rendering:**

**Chain head words:**
- Editable: Text input for clue
- Read-only: Clue text display

**Non-chain-head words:**
- Always shows "→ See [number] [direction]" in italic gray

**Join/Unjoin buttons (editable mode only):**
- Has chain link: "Unlink ✕" button (red)
- No chain link: "Link next →" button (blue)

**Styling:**
- Selected: Yellow background
- Join source: Blue ring border
- Hover: Light gray background

**Auto-scroll:** Uses `$effect` to scroll selected clue into view.

**Event handling:**
- Click/Enter/Space: Selects clue
- Input change: Calls `onClueChange`
- Join/Unjoin buttons: Stop propagation

---

### UI Components

#### `ActiveClueDisplay.svelte`

Displays the currently selected clue above and below the grid in Player mode.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `clueNumber` | `number \| null` | Clue number |
| `clueDirection` | `Direction \| null` | Clue direction |
| `clueText` | `string \| null` | Clue text |
| `wordLengthPattern` | `string \| null` | Length pattern |

**Note:** Props use inline type definition rather than a named interface.

**Derived:**
- `hasClue` - Whether a clue is selected

**Rendering:**
- Has clue: `{number} {Direction} ({pattern}): {clueText}`
- No clue: Empty placeholder div

**Styling:** Large, bold text for prominent display.

---

#### `CheckResultDisplay.svelte`

Shows the result of answer checking with optional "Clear Errors" button.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `checkResult` | `CheckResult \| null` | Check result |
| `onClearErrors` | `() => void` | Clear errors callback |

**Note:** Props use inline type definition rather than a named interface.

**Derived:**
- `resultConfig` - Configuration based on result type:
  - `message` - Display message
  - `bgClass` - Background color class
  - `textClass` - Text color class
  - `showClearButton` - Whether to show clear button

**Result Configurations:**

| Type | Message | Background | Clear Button |
|------|---------|------------|--------------|
| `complete-correct` | "Congratulations! The puzzle is complete and correct!" | Green | No |
| `incomplete-correct` | "So far, so good! Everything filled in is correct." | Blue | No |
| `complete-incorrect` | "The puzzle is complete but has errors." | Amber | Yes |
| `incomplete-incorrect` | "There are some errors." | Amber | Yes |
| `null` | "Click Check to verify your answers." | None | No |

---

#### `DisplacedCluesPanel.svelte`

Shows displaced clues with reattach and delete buttons.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `displacedClues` | `DisplacedClue[]` | Displaced clues array |
| `reattachMode` | `boolean` | Reattach mode active |
| `selectedClueIndex` | `number \| null` | Selected clue index |
| `onReattachClick` | `(index: number) => void` | Reattach click callback |
| `onDelete` | `(index: number) => void` | Delete callback |

**Note:** Props use inline type definition rather than a named interface.

**Rendering:**
- Empty state: "No displaced clues" (gray italic)
- Each clue:
  - Direction label (capitalized)
  - Clue text
  - Delete button (✕)
  - Highlighted when selected for reattach (amber border/background)

**Styling:**
- Reattach mode + selected: Amber border and background
- Normal: Gray border, light gray background

---

#### `MarkerToolbar.svelte`

Four toggle buttons for cell markers (Builder Fill mode only).

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `cell` | `CellData \| null` | Selected cell data |
| `onToggleMarker` | `(marker: keyof CellData) => void` | Toggle callback |

**Note:** Props use inline type definition rather than a named interface.

**Markers:**
- `spaceRight` - "Space Right"
- `spaceBottom` - "Space Bottom"
- `hyphenRight` - "Hyphen Right"
- `hyphenBottom` - "Hyphen Bottom"

**Styling:**
- Active marker: Blue background, white text
- Inactive: White background, gray text
- No cell selected: Disabled, opacity 50%

---

#### `ModeToggle.svelte`

Switch between Design and Fill modes.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `mode` | `"design" \| "fill"` | Current mode |
| `onModeChange` | `(newMode: "design" | "fill") => void` | Mode change callback |

**Note:** Props use inline type definition rather than a named interface.

**Rendering:**
- Two buttons: "Design" and "Fill"
- Active mode: Blue background, white text
- Inactive mode: White background, gray text

**Note:** Parent component handles confirmation dialog when switching to Design with clue text.

---

#### `BuilderActions.svelte`

Save, Export Complete, Import, and Reset buttons for Builder.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `canExportComplete` | `boolean` | Export ready flag |
| `exportErrors` | `string[]` | Export error messages |
| `onSave` | `() => void` | Save callback |
| `onExportComplete` | `() => void` | Export callback |
| `onImport` | `() => void` | Import callback |
| `onReset` | `() => void` | Reset callback |

**Note:** Props use inline type definition rather than a named interface.

**Rendering:**
- **Save**: Always enabled
- **Export Complete**: Disabled if `!canExportComplete`, shows tooltip with errors on hover
- **Import**: Always enabled
- **Reset**: Always enabled (red styling)
- Error message shown below buttons if `!canExportComplete`

---

#### `PlayerActions.svelte`

Check, Reset, and Import New buttons for Player.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `onCheck` | `() => void` | Check callback |
| `onReset` | `() => void` | Reset callback |
| `onImportNew` | `() => void` | Import new callback |
| `puzzleLoaded` | `boolean` | Puzzle loaded flag |

**Note:** Props use inline type definition rather than a named interface.

**Rendering:**
- **Check**: Blue button, disabled if `!puzzleLoaded`
- **Reset**: Gray button, disabled if `!puzzleLoaded`
- **Import New**: Gray button, always enabled

---

#### `PuzzleMetadataForm.svelte`

Title and author text inputs for Builder.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Puzzle title |
| `author` | `string` | Puzzle author |
| `onTitleChange` | `(newTitle: string) => void` | Title change callback |
| `onAuthorChange` | `(newAuthor: string) => void` | Author change callback |

**Note:** Props use inline type definition rather than a named interface.

**Rendering:**
- Two labeled text inputs
- Standard form styling with focus rings

---

#### `GridSizeSelector.svelte`

Grid size input (NxN) for Builder.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `gridSize` | `number` | Current grid size |
| `isBlank` | `boolean` | Grid is blank flag |
| `onSizeChange` | `(newSize: number) => void` | Size change callback |

**Note:** Props use inline type definition rather than a named interface.

**Rendering:**
- Number input (min: 2)
- "×{gridSize}" label
- Disabled when `!isBlank`
- Helper text when disabled: "Grid size can only be changed when the grid is blank."

---

#### `ImportScreen.svelte`

File picker for importing puzzles (Player mode).

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `onImport` | `(jsonString: string) => void` | Import callback |
| `error` | `string \| null` | Error message |

**Note:** Props use inline type definition rather than a named interface.

**Features:**
- Click to open file picker
- Drag and drop support
- Hidden file input bound to `fileInput` ref
- Error display in red box

**Event Handlers:**
- `handleFileChange` - File input change
- `handleButtonClick` - Trigger file input click
- `handleDrop` - Drag and drop
- `handleDragOver` - Allow drop

**UI:**
- Title: "Import Puzzle"
- Subtitle: "Load a crossword puzzle JSON file to play."
- Drop zone with icon and instructions
- "Complete puzzle files only" note
- Error box (shown when `error !== null`)

---

#### `Toast.svelte`

Transient notification component.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `message` | `string` | Toast message |
| `visible` | `boolean` | Visibility flag |

**Rendering:**
- Fixed position at bottom center
- Dark background, white text
- Rounded corners, shadow
- Hidden when `!visible`

**Usage:** Parent manages `visible` state and timer (3000ms).

**Note:** Props use inline type definition rather than a named interface.

---

## State Management

### Svelte 5 Runes Usage

The application uses Svelte 5's new reactivity system exclusively:

**`$state()`** - Reactive state declaration:
```typescript
let grid = $state<CellData[][]>(createEmptyGrid(DEFAULT_GRID_SIZE));
let mode = $state<"design" | "fill">("design");
```

**`$derived()`** - Computed values:
```typescript
let derivedWords = $derived(deriveWords(grid, gridSize));
let words = $derived.by(() => {
  // Complex derivation logic
  return merged;
});
```

**`$effect()`** - Side effects:
```typescript
$effect(() => {
  // Auto-save on state change
  const _ = [key, gridSize, grid, wordMetadata];
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveBuilderState(state);
  }, 500);
});
```

**`$props()`** - Component props:
```typescript
let { grid, gridSize, onCellClick }: CrosswordGridProps = $props();
```

### State Ownership

**Page components own all state:**
- `BuilderPage.svelte` - All builder state
- `PlayerPage.svelte` - All player state

**Child components are stateless:**
- Receive data via props
- Emit changes via callbacks
- No direct state mutation

### Auto-save Strategy

**Builder:**
- Debounced 500ms
- Saves on any state change
- Uses `$effect` to track dependencies
- Storage key: `"builder-current"`

**Player:**
- Debounced 500ms
- Saves on `playerLetters` change
- Storage key: `"player-<puzzleKey>"`

---

## Key Workflows

### Builder: Design Mode Cell Toggle

1. User clicks cell in grid
2. `handleCellClick(row, col)` called
3. Cell toggled black ↔ white
4. If white → black: all cell data cleared
5. `reconcileWordsOnGridChange()` called
6. Metadata preserved for surviving words
7. Displaced clues created for destroyed words with clues
8. Chain references cleaned up
9. Toast notifications for shortened/lengthened words
10. Auto-save triggered

### Builder: Fill Mode Letter Entry

1. User selects cell (click or clue click)
2. `selectedCell` and `selectedDirection` set
3. User types letter
4. `handleKeyDown(key)` called
5. Letter uppercased and stored in `grid[row][col].letter`
6. `advancePosition()` moves cursor
7. Auto-save triggered

### Builder: Chain Join

1. User clicks "Link next →" on ClueEntry
2. `handleJoinClick(wordId)` sets `joinMode = true`
3. Banner shows "Select the next word in the chain"
4. User clicks target word in grid or clue panel
5. `joinWords()` validates and creates join
6. If target had clue, it's displaced
7. `syncMetadataFromWords()` updates state
8. Join mode exits
9. Auto-save triggered

### Builder: Clue Reattach

1. User clicks displaced clue
2. `handleDisplacedClueClick(index)` sets `reattachMode = true`
3. Banner shows "Click a word to attach this clue"
4. User clicks target word in grid
5. `reattachClue()` validates (target must have empty clue)
6. Clue attached, removed from displaced list
7. Reattach mode exits
8. Auto-save triggered

### Player: Answer Check

1. User clicks "Check" button
2. `handleCheck()` calls `checkPuzzle()`
3. `checkResult` set with type and cell lists
4. `CheckResultDisplay` shows outcome
5. If not complete-correct, "Clear Errors" button shown
6. User clicks "Clear Errors"
7. `handleClearErrors()` calls `clearErrors()`
8. Incorrect letters cleared, `checkResult` reset

### Player: Import and Resume

1. User navigates to Player
2. `ImportScreen` shown
3. User selects JSON file
4. `parsePuzzleJSON()` validates
5. If valid complete puzzle:
   - Grid, words, metadata loaded
   - `loadPlayerProgress()` checked
   - If progress exists, `playerLetters` restored
6. `puzzleLoaded = true`
7. Game view shown

---

## Testing

### Test Files

All pure logic functions have corresponding test files:

| Module | Test File |
|--------|-----------|
| `grid-logic.ts` | `grid-logic.test.ts` |
| `clue-logic.ts` | `clue-logic.test.ts` |
| `chain-logic.ts` | `chain-logic.test.ts` |
| `check-logic.ts` | `check-logic.test.ts` |
| `validation.ts` | `validation.test.ts` |
| `import-export.ts` | `import-export.test.ts` |
| `storage.ts` | `storage.test.ts` |

### Test Runner

**Vitest** is used as the test runner, configured in `vitest.config.ts`.

**Run tests:**
```bash
npm test
```

### Test Categories

**grid-logic.test.ts:**
- `createEmptyGrid`: Creates N×N grid with default values
- `deriveWords`: Detects across/down words, ignores 1-cell sequences
- `assignNumbers`: Sequential numbering in scan order
- `getWordsAtCell`: Returns 0, 1, or 2 words
- `advancePosition`/`retreatPosition`: Cursor movement
- `isSelectableCell`: Valid selection targets
- `getSingleWordLengthPattern`: Marker-based patterns

**clue-logic.test.ts:**
- `reconcileWordsOnGridChange`: Metadata preservation, displacement
- `reattachClue`: Clue reattachment validation
- `isGridBlank`: Blank grid detection

**chain-logic.test.ts:**
- `getChain`: Chain traversal
- `getChainHead`: Head finding
- `isChainHead`: Head detection
- `getDisplayClue`: "See" reference generation
- `joinWords`: Join validation
- `unjoinWord`: Link removal
- `breakChainAtWord`: Chain breaking on destruction
- `validateChains`: Cycle/branching detection
- `getWordLengthPattern`: Chain length patterns

**check-logic.test.ts:**
- `checkPuzzle`: Four outcome classifications
- `clearErrors`: Incorrect letter clearing

**validation.test.ts:**
- `validateCompletePuzzle`: All FR-42 checks
- `validateIncompletePuzzle`: Structural validation
- `canExportAsComplete`: Export readiness

**import-export.test.ts:**
- `serializeIncompletePuzzle`: Builder state serialization
- `serializeCompletePuzzle`: Complete puzzle serialization
- `parsePuzzleJSON`: Parsing and validation
- `deriveWordAnswer`: Answer derivation

**storage.test.ts:**
- `saveBuilderState`/`loadBuilderState`: Round-trip persistence
- `savePlayerProgress`/`loadPlayerProgress`: Progress persistence
- `clearBuilderState`/`clearPlayerProgress`: Clearing data

---

## Appendix: Key Design Decisions

### Why Pure Functions for Logic?

All business logic in `src/lib/` is implemented as pure functions:
- **Testable**: No mocking required, just call with inputs and check outputs
- **Framework-agnostic**: Can be reused in any context
- **Predictable**: No side effects, easier to reason about
- **Composable**: Functions can be combined freely

### Why State in Page Components?

State is held in `BuilderPage` and `PlayerPage`, not in a global store:
- **Simple data flow**: Props down, callbacks up
- **No context API complexity**: Everything traceable through props
- **Svelte 5 friendly**: `$state` in root component is the recommended pattern
- **Independent modes**: Builder and Player have completely separate state

### Why localStorage for Persistence?

- **No server required**: Purely frontend application
- **Simple API**: `getItem`/`setItem` for persistence
- **Per-puzzle progress**: Player progress keyed by puzzle ID
- **Auto-save**: Debounced saves on every state change

### Why Svelte 5 Runes?

- **Explicit reactivity**: `$state`, `$derived`, `$effect` are clear
- **No `$:` syntax**: Old reactive declarations deprecated
- **Better TypeScript integration**: Runes work naturally with types
- **Future-proof**: Svelte 5 is the current version

---

## Document Information

- **Location**: `llmworkspace/detailed_documentation.md`
- **Based on**: Source code analysis of `/src` directory
- **Reference files**: `architecture-design.md`, `requirements-document.md`
