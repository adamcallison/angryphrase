# Crossword Builder & Player — Architecture Design

## 1. System Overview

A purely frontend web application for creating and solving crosswords. Two independent modes — Builder and Player — share a grid rendering engine and clue panel but have entirely separate state management and interaction logic. All data lives client-side in localStorage and JSON files. The grid cells are the single source of truth for letter data; word boundaries and numbering are derived from the grid structure.

**Key design decisions and rationale:**

| Decision | Rationale |
|----------|-----------|
| Svelte 5 with runes (`$state`, `$derived`, `$effect`) | Forward-looking reactivity model; simpler mental model than Svelte 4 stores; explicit reactive declarations |
| Tailwind CSS + scoped CSS for complex cases | Fast iteration, strong LLM support, easy theming via config; scoped CSS reserved for complex conditional styling (cell markers, selection states) |
| Pure functions for all business logic | Grid computation, chain manipulation, clue-grid interaction, and validation are pure functions operating on plain data — maximally testable, free of framework coupling |
| State held in page components, passed via props | Svelte 5's `$state` in the root page component; no global stores, no context API complexity. The page is the orchestrator. |
| Simple state-based routing | Three views, no URL tracking needed, zero dependencies |
| Vitest for unit tests | Logic functions are pure and trivially testable; Vitest is Vite-native and the natural choice |

---

## 2. Architecture

### 2.1 High-Level Component Diagram

```
App.svelte
├── Landing.svelte
│   └── "Build" button → BuilderPage
│   └── "Play" button → PlayerPage
│
├── BuilderPage.svelte
│   ├── PuzzleMetadataForm.svelte (title and author inputs)
│   ├── GridSizeSelector.svelte (enabled only when grid is blank)
│   ├── CrosswordGrid.svelte (shared, mode="builder-fill" or "builder-design")
│   │   └── Cell.svelte (shared, receives display props)
│   ├── CluePanel.svelte (shared, editable=true)
│   │   └── ClueEntry.svelte (builder: editable input per word)
│   │   └── DisplacedCluesPanel.svelte
│   ├── MarkerToolbar.svelte (builder-only)
│   ├── ModeToggle.svelte (builder-only: Design / Fill switch)
│   ├── BuilderActions.svelte (save incomplete, export complete, import, reset)
│   └── Toast.svelte (transient notifications)
│
└── PlayerPage.svelte
    ├── ImportScreen.svelte (file picker, shown when no puzzle loaded)
    ├── CrosswordGrid.svelte (shared, mode="player")
    │   └── Cell.svelte (shared, receives display props)
    ├── CluePanel.svelte (shared, editable=false)
    ├── ActiveClueDisplay.svelte (selected clue above and below grid — rendered twice)
    ├── PlayerActions.svelte (check, clear errors, reset, import new puzzle)
    ├── CheckResultDisplay.svelte (shows check outcome and "clear errors" option)
    └── Toast.svelte (transient notifications)
```

### 2.2 Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **App.svelte** | Root component. Holds `currentView` state ("landing" \| "builder" \| "player"). Renders the active view. |
| **Landing.svelte** | Two buttons: Build and Play. No state. Emits events to App. |
| **BuilderPage.svelte** | Orchestrator for Builder mode. Holds all builder state (`$state`). Handles grid changes, mode switching, word metadata management, displaced clues, import/export, localStorage persistence. Passes computed props to children. |
| **PlayerPage.svelte** | Orchestrator for Player mode. Holds player state including whether a puzzle is loaded. Handles puzzle import, progress save/restore, answer checking, letter entry. Passes computed props to children. |
| **PuzzleMetadataForm.svelte** | Two text inputs: puzzle title and author name. Bound to BuilderPage state via callbacks. Builder-only. |
| **GridSizeSelector.svelte** | Number input for grid size N, showing NxN. Disabled when grid is not blank. Emits `onSizeChange(newSize)`. Builder-only. |
| **ImportScreen.svelte** | File picker for importing a complete puzzle JSON. Shows validation errors. Shown when Player has no puzzle loaded. After successful import, PlayerPage transitions to the playing view. |
| **CrosswordGrid.svelte** | Renders the NxN grid. Receives grid data, selection state, display configuration, and interaction mode flags as props. Emits `onCellClick`, `onKeyDown` events. Renders visual feedback for join/reattach modes. Does NOT manage state — the parent page decides what happens on interactions. |
| **Cell.svelte** | Renders a single cell. Receives all display data as props: black/white, letter to show, number, selection state (selected, highlighted), markers. Pure rendering, no state. |
| **CluePanel.svelte** | Renders Across/Down clue lists. Receives words with clues, selected word info, and an `editable` flag. In editable mode, clue inputs update via `onClueChange` callback. Emits `onClueClick`. Scrolls selected clue into view. |
| **ClueEntry.svelte** | A single clue row: number, direction label, clue text input (or read-only text for Player, or "→ See [ref]" for non-head chain words). In Builder, shows "Link next →" button (when no nextWord) or "Unlink ✕" button (when has nextWord). |
| **DisplacedCluesPanel.svelte** | Shows displaced clues with reattach and delete buttons. Each displaced clue shows its text, original direction, and a ✕ delete button. Emits `onReattachClick` (enters reattach mode) and `onDelete` (permanently removes displaced clue). Highlighted when its clue is selected for reattachment. Builder-only. |
| **MarkerToolbar.svelte** | Four toggle buttons: Space Right, Space Bottom, Hyphen Right, Hyphen Bottom. Indicates which markers are active on the selected cell. Emits `onToggleMarker`. Builder Fill mode only. |
| **ModeToggle.svelte** | Switch between Design and Fill. Shows confirmation dialog (`window.confirm()`) when switching to Design with existing clue text. Builder-only. |
| **ActiveClueDisplay.svelte** | Shows the currently selected clue text. Rendered twice in PlayerPage — once above the grid and once below. Player-only. |
| **CheckResultDisplay.svelte** | Shows the result of an answer check: one of four outcomes (complete+correct, incomplete+correct, complete+incorrect, incomplete+some-wrong). If not complete+correct, shows a "Clear Errors" button. Player-only. |
| **BuilderActions.svelte** | Two separate export buttons: "Save" (always available, exports incomplete JSON) and "Export Complete" (only available when puzzle passes validation). Also "Import" and "Reset" buttons. Emits events. Builder-only. |
| **PlayerActions.svelte** | "Check" button, "Reset" button, "Import New Puzzle" button. "Clear Errors" button is shown by CheckResultDisplay, not here. Player-only. |
| **Toast.svelte** | Fixed-position transient notification. Shows a message for 3 seconds then fades out. Receives messages from the parent page component. Rendered at page level in both BuilderPage and PlayerPage. |

### 2.3 Communication Patterns

- **Parent → Child**: All Svelte 5 props. No stores, no context API. The page component is the single source of truth.
- **Child → Parent**: Callback props (function props like `onCellClick`, `onKeyDown`). No Svelte events (`createEventDispatcher` is Svelte 4; Svelte 5 uses callback props).
- **Child → Child**: Never directly. All cross-component communication flows through the parent page component.
- **Persistence**: BuilderPage and PlayerPage each manage their own localStorage reads/writes. No shared persistence layer.

### 2.4 Boundary Definitions

| Boundary | What crosses it | How |
|----------|----------------|-----|
| App → BuilderPage | None (BuilderPage loads from localStorage) | BuilderPage self-initializes |
| App → PlayerPage | None (PlayerPage starts with import dialog) | PlayerPage self-initializes |
| BuilderPage → CrosswordGrid | Grid data, selection state, display config | Props |
| CrosswordGrid → BuilderPage | Cell click, key press | Callback props |
| BuilderPage → CluePanel | Words with clues, selected word, editable flag | Props |
| CluePanel → BuilderPage | Clue click, clue text change | Callback props and two-way binding on clue text |
| Logic functions ↔ Components | Never. Logic functions are pure. Components call them and use the results. | Direct function calls |
| localStorage ↔ State | Serialized puzzle data, player progress | `import-export.ts` functions; `storage.ts` read/write |

---

## 3. Data Model

### 3.1 Core Types

```typescript
// === Grid ===

interface CellData {
  black: boolean;
  letter: string | null;         // Single A-Z character, or null
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
}

// Grid is CellData[][] — a flat 2D array indexed grid[row][col]

// === Words ===

// Word identifier: unique key for a word position
type WordId = string; // `${startRow}-${startCol}-${direction}`

type Direction = "across" | "down";

interface WordPosition {
  startRow: number;
  startCol: number;
  direction: Direction;
}

// A word as derived from the grid structure
interface DerivedWord {
  startRow: number;
  startCol: number;
  direction: Direction;
  length: number;    // Derived from grid (contiguous white cells from start)
  number: number;    // Assigned by numbering algorithm
}

// Metadata attached to a word (NOT derived from grid — user-entered)
interface WordMetadata {
  clue: string;                        // Clue text (may be empty)
  nextWord: WordPosition | null;       // Chain link (null = not chained)
}

// Full word object combining position + metadata + derived data
interface Word extends DerivedWord, WordMetadata {}

// === Displaced Clues ===

interface DisplacedClue {
  id: string;                        // Unique identifier for UI rendering and reattach targeting
  clue: string;
  direction: Direction;
  // Note: no position info. When reattached, user picks a new target word.
}

// === Puzzle Metadata ===

interface PuzzleMetadata {
  title: string;
  author: string;
}

// === Selected Cell / Direction ===

interface CellPosition {
  row: number;
  col: number;
}

// Cells at grid boundaries or next to black cells have no neighbor in a direction
// The cursor's (row, col) always points to a valid white cell while selected

// === Player Progress ===

// Player letters stored separately from the puzzle grid
// playerLetters[row][col] = string | null
type PlayerLetters = (string | null)[][];

// === Answer Checking ===

type CheckResultType = "complete-correct" | "incomplete-correct" | "complete-incorrect" | "incomplete-incorrect";

interface CheckResult {
  type: CheckResultType;
  incorrectCells: CellPosition[];   // Cells where player letter ≠ answer letter
  emptyCells: CellPosition[];        // Cells where player has not entered a letter
}
```

### 3.2 Key Invariants

1. **Cell letter consistency**: Each cell holds exactly one letter (A-Z) or null. Word answers are derived from cells, never stored independently.
2. **Word boundaries**: Words are maximal contiguous sequences of non-black cells in a row (across) or column (down). A word requires at minimum 2 cells. Isolated single white cells exist but are not words.
3. **Numbering**: Numbers are assigned left-to-right, top-to-bottom. A cell receives a number only if it starts an across and/or down word. Numbering is recalculated on every grid change.
4. **Chain structure**: `nextWord` references form singly-linked lists. No word has more than one `nextWord` and no word is pointed to by more than one word. No cycles.
5. **Grid dimensions**: Grid is always square (NxN). Grid size can only change when the grid is blank (no letters, no clues, no displaced clues).
6. **Clue completeness for export**: Every word must have non-empty clue text to export as "complete," except non-first words in a chain (they show "See [reference]").

### 3.3 Data Flow

**Builder data flow:**

```
User Action (click/type/import)
    │
    ▼
BuilderPage.update__*( )  ← event handlers
    │
    ├──► grid-logic.ts      (derive words, numbering)
    ├──► clue-logic.ts      (match words, handle displaced clues)
    ├──► chain-logic.ts      (validate/join/unjoin chains)
    │
    ▼
state.$state updated
    │
    ├──► CrosswordGrid re-renders
    ├──► CluePanel re-renders
    ├──► autoSave() → localStorage
```

**Player data flow:**

```
User Action (click/type/import)
    │
    ▼
PlayerPage.update__*( )  ← event handlers
    │
    ├──► playerLetters updated
    │
    ▼
state.$state updated
    │
    ├──► CrosswordGrid re-renders (shows playerLetters overlaid on puzzle grid)
    ├──► autoSave() → localStorage
```

---

## 4. API / Interface Definitions

### 4.1 Pure Logic Functions (lib/)

These are the core business logic functions. They operate on plain data and have no side effects.

**grid-logic.ts**

```typescript
// Create an NxN grid of all-white cells
function createEmptyGrid(size: number): CellData[][]

// Detect all words in the grid (maximal contiguous white-cell sequences of length ≥ 2)
function deriveWords(grid: CellData[][], gridSize: number): DerivedWord[]

// Assign numbers to words (left-to-right, top-to-bottom)
// A cell receives a number if it starts an across and/or down word
function assignNumbers(words: DerivedWord[]): Map<string, number>
// Returns a map from "row-col" to number

// Get all words containing a specific cell
function getWordsAtCell(words: Word[], row: number, col: number): Word[]

// Get the word at a cell in a specific direction (or null)
function getWordInDirection(words: Word[], row: number, col: number, direction: Direction): Word | null

// Advance cursor position in direction; stop at word end or grid boundary
function advancePosition(grid: CellData[][], row: number, col: number, direction: Direction, gridSize: number): CellPosition

// Retreat cursor position in direction; stop at word start or grid boundary
function retreatPosition(grid: CellData[][], row: number, col: number, direction: Direction, gridSize: number): CellPosition

// Move cursor with arrow keys
function movePosition(row: number, col: number, direction: Direction, arrowKey: string, gridSize: number): CellPosition

// Check if a cell is a valid selection target (white, part of a word)
function isSelectableCell(grid: CellData[][], row: number, col: number): boolean

// Compute word length from grid (count contiguous white cells from start position in direction)
function computeWordLength(grid: CellData[][], startRow: number, startCol: number, direction: Direction, gridSize: number): number
```

**clue-logic.ts**

```typescript
// Apply a grid change (Design mode): reconcile words with existing metadata
// This is the core of FR-26 — matching words before/after a grid change
interface WordChangeResult {
  updatedWords: Word[];           // Words with preserved/updated metadata
  displacedClues: DisplacedClue[]; // Newly displaced clues
  shortenedWords: Word[];          // Words that were shortened (for toast notification)
  lengthenedWords: Word[];         // Words that were lengthened
}

function reconcileWordsOnGridChange(
  oldWords: Word[],
  newDerivedWords: DerivedWord[],
  oldDisplacedClues: DisplacedClue[],
  grid: CellData[][],
  gridSize: number
): WordChangeResult

// Reattach a displaced clue to a word
function reattachClue(
  words: Word[],
  displacedClues: DisplacedClue[],
  clueIndex: number,
  targetWordId: WordId
): { words: Word[]; displacedClues: DisplacedClue[] }

// Check if grid is blank (no letters, no clue text, no displaced clues)
function isGridBlank(grid: CellData[][], words: Word[], displacedClues: DisplacedClue[]): boolean
```

**chain-logic.ts**

```typescript
// Build a chain of words from a starting word (following nextWord links)
function getChain(words: Word[], startWord: Word): Word[]

// Find the head (first word) of a chain containing the given word
function getChainHead(words: Word[], word: Word): Word

// Check if a word is the first in its chain
function isChainHead(words: Word[], word: Word): boolean

// Get the display clue for a word (either its own clue, or "See [ref]" for non-head chain words)
function getDisplayClue(word: Word, words: Word[]): string

// Join two words into a chain (source.nextWord = target)
// Returns updated words array, or null if join is invalid
function joinWords(words: Word[], sourceId: WordId, targetId: WordId): Word[] | null

// Unjoin a word (remove its nextWord link)
function unjoinWord(words: Word[], wordId: WordId): Word[]

// Break chain at a destroyed word (used when Design mode destroys a word in a chain)
function breakChainAtWord(words: Word[], destroyedWordId: WordId): Word[]

// Validate all chain references (no cycles, no branching, all references resolve)
function validateChains(words: Word[]): boolean

// Generate a WordId from a WordPosition
function toWordId(pos: WordPosition): WordId
```

**validation.ts**

```typescript
// Validate a complete puzzle for export
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateCompletePuzzle(puzzle: CompletePuzzle): ValidationResult

// Validate an incomplete puzzle for save/load
function validateIncompletePuzzle(puzzle: IncompletePuzzle): ValidationResult

// Check export readiness: all words have clues (except chain non-heads), all cells have letters
function canExportAsComplete(
  grid: CellData[][],
  words: Word[],
  gridSize: number
): { canExport: boolean; errors: string[] }
```

**Player import validation rules (FR-42)**: When a file is imported into the Player, `parsePuzzleJSON` and `validateCompletePuzzle` check the following. If any check fails, the import is rejected with a simple error message listing the problems:

1. **`version` field**: Must be `1`. Any other value rejects the file.
2. **`type` field**: Must be `"complete"`. Incomplete puzzles cannot be played.
3. **Required fields present**: `key`, `gridSize`, `grid`, `words`, `title`, `author` must all exist.
4. **Grid dimensions**: `grid.length` must equal `gridSize`, and `grid[row].length` must equal `gridSize` for every row.
5. **All white cells have letters**: Every cell where `black === false` must have a `letter` that is a single A–Z character.
6. **All first-in-chain words have non-empty clues**: Every word that is not pointed to by another word's `nextWord` must have a non-empty `clue` string.
7. **Word validity**: Each word has a valid `startRow`, `startCol` (within grid bounds), `direction` ("across" or "down"), and a length ≥ 2 (the word occupies at least 2 cells).
8. **Structural consistency**: Each white cell is part of at most one across word and at most one down word (verified by checking that no two across words overlap the same cell in the same row, and no two down words overlap the same cell in the same column).
9. **`nextWord` references resolve**: Every `nextWord` reference (if present) must point to a valid word in the puzzle's word list (matching by startRow, startCol, direction).
10. **Chain validity**: All `nextWord` links form valid singly-linked lists — no cycles, no branching (no word pointed to by more than one word).
11. **Cell marker fields**: If present, `spaceRight`, `spaceBottom`, `hyphenRight`, `hyphenBottom` must be booleans. If absent, they default to `false`.
12. **Letter values**: `letter` in every cell must be a single uppercase A–Z character (not null for white cells in complete puzzles).
13. **Word answer strings**: Derived from grid cells (not stored independently). At validation time, each word's letters are read from the grid and verified to be present.

**Builder import validation** is more lenient: incomplete puzzles may have empty cells and empty clues. The `validateIncompletePuzzle` function checks only structural consistency (grid dimensions, word positions within bounds, chain validity if present, marker field types).

**check-logic.ts**

```typescript
// Check the player's answers against the correct answers
function checkPuzzle(
  grid: CellData[][],
  playerLetters: PlayerLetters,
  gridSize: number
): CheckResult
// Returns a CheckResult with:
//   type: one of four outcomes
//   incorrectCells: cells where player letter ≠ answer (for "clear errors" feature)
//   emptyCells: cells where player has not entered a letter
//
// Classification logic:
//   - All white cells filled + all correct → "complete-correct"
//   - Some cells empty + all filled cells correct → "incomplete-correct"
//   - All cells filled + some incorrect → "complete-incorrect"
//   - Some cells empty + some filled cells incorrect → "incomplete-incorrect"

// Clear incorrect letters from player's grid (returns new PlayerLetters)
function clearErrors(
  grid: CellData[][],
  playerLetters: PlayerLetters,
  checkResult: CheckResult,
  gridSize: number
): PlayerLetters
// For each cell in checkResult.incorrectCells, set playerLetters[row][col] = null.
// Empty cells are untouched.
```

**import-export.ts**

```typescript
// Serialize builder state to incomplete puzzle JSON
function serializeIncompletePuzzle(
  grid: CellData[][],
  words: Word[],
  displacedClues: DisplacedClue[],
  metadata: PuzzleMetadata,
  key: string
): IncompletePuzzleJSON

// Serialize builder state to complete puzzle JSON (validates first)
function serializeCompletePuzzle(
  grid: CellData[][],
  words: Word[],
  metadata: PuzzleMetadata,
  key: string
): CompletePuzzleJSON | { error: string }

// Parse and validate imported JSON
function parsePuzzleJSON(jsonString: string): 
  | { type: "incomplete"; data: IncompletePuzzle }
  | { type: "complete"; data: CompletePuzzle }
  | { error: string }

// Derive answer strings from grid cells for a word
function deriveWordAnswer(grid: CellData[][], word: Word): string
```

**storage.ts**

```typescript
const BUILDER_STORAGE_KEY = "builder-current";
function playerStorageKey(puzzleKey: string): string;

// Save/load builder state
function saveBuilderState(state: BuilderState): void
function loadBuilderState(): BuilderState | null

// Save/load player progress
function savePlayerProgress(key: string, progress: PlayerProgress): void
function loadPlayerProgress(key: string): PlayerProgress | null

// Clear builder state
function clearBuilderState(): void
// Clear player progress
function clearPlayerProgress(key: string): void

// Generate unique key
function generateUniqueKey(): string
```

### 4.2 Component Props and Callbacks

**CrosswordGrid.svelte**

```typescript
interface CrosswordGridProps {
  grid: CellData[][];
  gridSize: number;
  words: Word[];                    // For numbering display
  displayLetters: (string | null)[][]; // What letters to show (answers or player input)
  selectedCell: CellPosition | null;
  selectedDirection: Direction;
  highlightedCells: CellPosition[];  // Cells of the currently selected word
  mode: "builder-design" | "builder-fill" | "player";

  // Interaction mode flags — when true, grid click behavior changes
  joinMode: boolean;                    // True when awaiting target word selection for chain join
  joinSourceWordId: WordId | null;      // The source word in join mode (for highlighting)
  reattachMode: boolean;                // True when awaiting target word selection for clue reattach

  // Callbacks
  onCellClick: (row: number, col: number) => void;
  onKeyDown: (key: string) => void;  // letter keys + Backspace + Arrow keys
}
```

**Cell.svelte**

```typescript
interface CellProps {
  isBlack: boolean;
  letter: string | null;           // Letter to display
  number: number | null;            // Cell number (null if none)
  isSelected: boolean;             // Yellow highlight — this cell is selected
  isHighlighted: boolean;          // Light yellow — part of selected word
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
  row: number;
  col: number;
}
```

**CluePanel.svelte**

```typescript
interface CluePanelProps {
  words: Word[];
  selectedWordId: WordId | null;
  editable: boolean;
  onClueClick: (wordId: WordId) => void;
  onClueChange: (wordId: WordId, newText: string) => void;
  onJoinClick: (wordId: WordId) => void;          // Enter join mode with this word as source
  onUnjoinClick: (wordId: WordId) => void;        // Remove nextWord link from this word
  onDisplacedClueClick: (clueIndex: number) => void; // Enter reattach mode for this clue
  onDisplacedClueDelete: (clueIndex: number) => void; // Delete this displaced clue
  onDisplacedClueGridClick: (wordId: WordId) => void; // Reattach displaced clue to clicked word (called from grid click during reattach mode)
  joinMode: boolean;                               // Whether join mode is active (to show visual feedback)
  joinSourceWordId: WordId | null;                 // Which word is the join source
  reattachMode: boolean;                           // Whether reattach mode is active
}
```

### 4.3 Builder State Shape

```typescript
interface BuilderState {
  // Core data
  key: string;                       // Unique puzzle identifier
  gridSize: number;
  grid: CellData[][];
  wordMetadata: Map<string, WordMetadata>;  // Keyed by WordId
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
  joinSourceWordId: WordId | null;       // The word being linked FROM

  // Derived (computed via $derived)
  // These are NOT stored — they're computed from the data above
  // derivedWords: DerivedWord[] — computed by deriveWords(grid, gridSize)
  // words: Word[] — derivedWords merged with wordMetadata (each derived word
  //   looks up its metadata from wordMetadata by WordId; if missing, defaults to
  //   { clue: "", nextWord: null })
  // numberedCells: Map<string, number> — cell-number map computed by assignNumbers(words)
  // highlightedCells: CellPosition[] — cells of the currently selected word
}
```

**Important note on words vs. wordMetadata:** Internally, the Builder stores word metadata separately from the grid-derived word positions. This separation is critical for the reconciliation logic (FR-26): when the grid structure changes, we can match old metadata to new word positions. The `words` array passed to components is always the *merged* view — each DerivedWord enriched with its corresponding WordMetadata. Components never see the raw `wordMetadata` map directly.
```

### 4.4 Player State Shape

```typescript
interface PlayerState {
  // Whether a puzzle is loaded — if false, show ImportScreen
  puzzleLoaded: boolean;

  // Puzzle data (set after successful import, immutable thereafter)
  puzzleKey: string;
  gridSize: number;
  grid: CellData[][];                // From imported puzzle (structure + answers)
  words: Word[];                     // From imported puzzle
  title: string;
  author: string;

  // Player data
  playerLetters: PlayerLetters;       // Player's entered letters
  selectedCell: CellPosition | null;
  selectedDirection: Direction;

  // Check result (null until user clicks Check)
  checkResult: CheckResult | null;

  // Derived
  // highlightedCells: cells of selected word
}

// When puzzleLoaded is false, only puzzleLoaded is meaningful.
// All other fields are their default/empty values.
// The ImportScreen component is shown instead of the grid.
```

**Player initial state**: When the Player page is entered, `puzzleLoaded` is `false` and the `ImportScreen` is shown. After a valid puzzle JSON is imported, the puzzle data fields are populated, `playerLetters` is initialized from saved progress (if any) or as an empty grid, `puzzleLoaded` becomes `true`, and the game view is shown.

---

## 5. File / Module Structure

```
crossword-app/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── favicon.ico
└── src/
    ├── main.ts                         # Entry point: mount App
    ├── App.svelte                      # Root: view routing, global styles
    │
    ├── lib/
    │   ├── types.ts                    # All TypeScript interfaces/types (§3.1, §4.3-4.4)
    │   ├── constants.ts                # Default grid size, storage keys, version
    │   ├── grid-logic.ts               # Pure: grid derivation, numbering, navigation (§4.1)
    │   ├── clue-logic.ts              # Pure: word reconciliation, displaced clues (§4.1)
    │   ├── chain-logic.ts             # Pure: chain operations, validation (§4.1)
    │   ├── check-logic.ts             # Pure: answer checking, error clearing (§4.1)
    │   ├── validation.ts              # Pure: puzzle validation for import/export (§4.1)
    │   ├── import-export.ts           # Pure: JSON serialization/deserialization (§4.1)
    │   └── storage.ts                 # Side effects: localStorage operations (§4.1)
    │
    ├── components/
    │   ├── CrosswordGrid.svelte        # Shared: renders NxN grid, handles focus/keyboard
    │   ├── Cell.svelte                 # Shared: renders single cell
    │   ├── CluePanel.svelte           # Shared: Across/Down clue lists
    │   ├── ClueEntry.svelte           # Shared: single clue row (editable or readonly)
    │   ├── ActiveClueDisplay.svelte   # Player: selected clue text (rendered twice: above/below grid)
    │   ├── CheckResultDisplay.svelte  # Player: check outcome and "Clear Errors" button
    │   ├── MarkerToolbar.svelte       # Builder Fill: marker toggle buttons
    │   ├── DisplacedCluesPanel.svelte # Builder: displaced clue list with reattach/delete
    │   ├── ModeToggle.svelte          # Builder: Design/Fill mode switch
    │   ├── BuilderActions.svelte      # Builder: Save/Export Complete/Import/Reset buttons
    │   ├── PlayerActions.svelte       # Player: Check/Reset/Import New Puzzle buttons
    │   ├── PuzzleMetadataForm.svelte  # Builder: title and author text inputs
    │   ├── GridSizeSelector.svelte    # Builder: NxN grid size input (disabled when not blank)
    │   ├── ImportScreen.svelte        # Player: file picker and validation error display
    │   └── Toast.svelte               # Shared: transient notification
    │
    ├── pages/
    │   ├── Landing.svelte             # Landing page with Build/Play buttons
    │   ├── BuilderPage.svelte         # Builder orchestrator (holds $state)
    │   └── PlayerPage.svelte          # Player orchestrator (holds $state)
    │
    └── styles/
        └── index.css                  # Tailwind directives + CSS custom properties
```

**Naming conventions:**
- Files: PascalCase for Svelte components, kebab-case for TypeScript modules
- Components: PascalCase names matching filenames
- Functions: camelCase
- Types/Interfaces: PascalCase
- Constants: UPPER_SNAKE_CASE

**Structural principles:**
- `lib/` contains zero-Svelte-dependency pure logic. These are plain TypeScript modules that can be tested without rendering any components.
- `components/` contains Svelte components that receive data and callbacks via props — no side effects, no direct state mutation.
- `pages/` contains orchestrator components that hold `$state` and compose components. These are the only files that manage reactive state.
- `styles/` contains global styles. Visual polish is deferred, but this file establishes the design token foundation (CSS custom properties via Tailwind config).

---

## 6. Key Implementation Notes

### 6.1 Svelte 5 Runes Guidance

The builder must follow these Svelte 5 patterns:

- **State declaration**: Use `$state()` in page components (BuilderPage, PlayerPage) for all mutable state. Do not use Svelte stores (`writable()`, `readable()`).
- **Derived values**: Use `$derived()` for computed values — selected word, highlighted cells, word lists with numbering, etc. These should never be manually synchronized.
- **Side effects**: Use `$effect()` for localStorage auto-save. Auto-save should debounce (e.g., 500ms) to avoid excessive writes on rapid typing.
- **No `$:` syntax**: Svelte 4's reactive declarations are deprecated. Use `$derived()` instead.
- **Shared state across components**: Pass as props. Do not use Svelte context (`setContext`/`getContext`) for data that flows from the page component — props are clearer and more traceable.
- **Data flow pattern**: **All data flows via one-way props and callback props.** There are no exceptions — including clue text. When a user types in a ClueEntry, the `oninput` event calls `onClueChange(wordId, newText)`, which updates the state in BuilderPage. The updated state then flows back down via props. This keeps the data flow simple and unidirectional: state lives in the page component, flows down via props, and changes flow up via callbacks.

### 6.2 Grid Change Reconciliation (FR-26)

This is the most complex logic in the app. When a Design-mode change modifies the grid (toggling a cell black/white), the app must:

**Cell data cleanup (pre-reconciliation):** When a cell is toggled from white to black (FR-05), all data on that cell is cleared: `letter` is set to `null`, and all marker flags (`spaceRight`, `spaceBottom`, `hyphenRight`, `hyphenBottom`) are set to `false`. This ensures that if the cell is later toggled back to white, it starts clean — stale data from a previous white-cell state doesn't persist.

**Auto-uppercasing (FR-12):** When a letter is typed in Fill mode, it is converted to uppercase before being stored. Only A–Z characters are accepted. The `onKeyDown` handler in BuilderPage/PlayerPage should filter and uppercase input before updating `grid[row][col].letter` or `playerLetters[row][col]`.

The reconciliation steps after a cell toggle:

1. **Snapshot old words** (with their metadata — clues, nextWord references).
2. **Derive new words** from the modified grid structure.
3. **Match old words to new words** by (startRow, startCol, direction).
4. **For each match**, transfer the old metadata (clue, nextWord) to the new word. Check if the word was shortened or lengthened and generate toast notifications.
5. **For each destroyed old word** (no match in new words): if it had non-empty clue text, add to displaced clues. If it was in a chain, break the chain.
6. **For each new word** (no match in old words): create empty metadata.
7. **Update `wordMetadata`** and `displacedClues`.

Important subtlety: `nextWord` references use (startRow, startCol, direction). If a word's start position changes (meaning it was destroyed and recreated at a different position), its old nextWord reference is invalid. The reconciliation logic must handle this:
- If a word with a `nextWord` is destroyed, the chain breaks. The `nextWord` field is removed from the preceding word (if any), and what follows is unlinked.
- If a word that is pointed to by a `nextWord` is destroyed, the reference from the preceding word is removed.

**nextWord reference updates on position shifts**: Even when a word survives (is not destroyed), its start position can change if cells above or to the left are added/removed (when grid size changes, which resets everything). However, for Design mode toggles, position shifts cannot occur because a single cell toggle doesn't change other cells' positions. The only way start positions shift is for words at the beginning of a row/column, and those are detected as "destroyed" (start position changed = destroyed). Therefore, reconciliation only needs to handle two cases for existing references: (1) the referenced word still exists at the same position (reference valid), or (2) the referenced word was destroyed (reference invalidated and removed).

The `clue-logic.ts` `reconcileWordsOnGridChange` function handles all of this in a single pure function call.

### 6.3 Chain Join/Unjoin (FR-19–FR-24)

- **Join**: Setting `source.nextWord = target`. Validation: source must not already have a `nextWord`, target must not already be pointed to by another word. If target has non-empty clue text, that clue is displaced.
- **Unjoin**: Removing `source.nextWord`. The formerly linked word becomes independent with an empty clue slot.
- **Chain break on grid change**: If a word in a chain is destroyed (FR-23), the chain breaks. The preceding word's `nextWord` is removed. Words after the destroyed word become independent.

#### Join Interaction Sequence

1. User clicks a **"Link next →"** button on a ClueEntry in the clue panel. This button only appears on words that do not currently have a `nextWord`.
2. App enters **join mode**. Visual feedback:
   - The source ClueEntry is highlighted (e.g., a colored border).
   - A banner or toast says "Select the next word in the chain."
   - The cursor over grid cells changes to a pointer.
3. User selects the target word in one of two ways:
   - **Click a word's cells in the grid**: The word matching the currently selected cell's direction is used as the target. If the clicked cell is an intersection, the current direction determines which word. (User can click once to toggle direction, then click again in join mode to select the intended word.)
   - **Click a ClueEntry in the clue panel**: Unambiguously identifies the target word.
4. Validation runs:
   - **Valid**: Create the join. If the target word had non-empty clue text, that clue is displaced to the displaced-clues bin. Exit join mode, return to normal Fill mode.
   - **Invalid — target already pointed to**: Show toast "This word is already linked as a next word." Stay in join mode for the user to pick a different target.
   - **Invalid — target is the same word**: Show toast "A word cannot link to itself." Stay in join mode.
5. **Escape** cancels join mode, returns to normal Fill mode.
6. **Switching to Design mode** cancels join mode.

#### Unjoin Interaction Sequence

1. User clicks an **"Unlink ✕"** button on a ClueEntry that has a `nextWord` link. This button replaces the "Link next →" button when a link exists.
2. The `nextWord` reference from the source word is removed immediately. No confirmation needed. **Only the direct link is removed**: if A→B→C and the user unjoins A→B, only A's nextWord is cleared. B retains its own nextWord link to C, forming a new chain B→C. B becomes the new chain head with an empty clue slot (its previous "See [ref]" text is replaced with an editable empty clue).
3. Any displaced clue for the formerly linked word (B) stays in the displaced-clues bin — it is NOT auto-restored.

**Note**: FR-21 says "the formerly linked word becomes an independent word with an empty clue slot." This design interprets this as: B gets an empty clue slot (replacing its "See" reference), but B's own nextWord link to C is preserved, making B the head of a new chain. If the intent was that the entire downstream chain should be dissolved, the `unjoinWord` function should be updated accordingly.

### 6.4 Grid Size Changes (FR-08)

Grid size can only change when the grid is blank: no letters in any cell, no non-empty clue text, no displaced clues. The check is:

```typescript
function isGridBlank(grid, words, displacedClues): boolean {
  // No letters in any cell
  // No word has non-empty clue text
  // No displaced clues exist
}
```

When grid size changes, a new grid is created (all white), all word metadata is cleared, and all derived state is recalculated.

### 6.5 Reattach Mode (FR-27)

Reattach mode is a temporary UI state:

1. User clicks a displaced clue in the **DisplacedCluesPanel**. (Each displaced clue shows its text, its original direction, and has a ✕ delete button.)
2. App enters **reattach mode**. Visual feedback:
   - The selected displaced clue is highlighted.
   - A banner says "Click a word in the grid to attach this clue."
   - The cursor over grid cells changes to a targeting cursor.
3. User clicks a cell in the grid that belongs to a word. The word is determined by the cell's current direction (same logic as join mode — intersection cells use the currently active direction).
4. Validation:
   - **Target word has empty clue text**: Reattach succeeds. Set the word's clue to the displaced clue's text. Remove the displaced clue from the bin. Exit reattach mode, return to normal Fill mode.
   - **Target word has non-empty clue text**: Show toast "This word already has a clue." Stay in reattach mode for the user to pick a different target.
5. **Escape** cancels reattach mode. The displaced clue stays in the bin.
6. **Clicking a black cell, an isolated white cell, or any non-word element** cancels reattach mode.
7. **Switching to Design mode** cancels reattach mode.

Implementation approach: the Builder page manages `reattachMode` as `$state`. When `reattachMode` is true, the `onCellClick` callback runs reattach logic before normal Fill-mode logic.

### 6.6 Cursor and Navigation (FR-46–FR-54)

The cursor logic is shared between Builder Fill mode and Player mode:

- **Clicking an unselected intersection cell**: Select it, default direction is "across."
- **Clicking an already-selected intersection cell**: Toggle direction.
- **Clicking a cell with only one word**: Select that word's direction.
- **Typing a letter**: Fill the cell, advance cursor in current direction.
- **Backspace**: Delete letter in current cell, retreat cursor.
- **Arrow keys**: Move in arrow direction (not constrained to current word direction).
- **No Tab navigation** — cell-by-cell only.

The `advancePosition` and `retreatPosition` functions in `grid-logic.ts` handle cursor movement. They stop at word boundaries (for typing advancement) or grid boundaries.

### 6.7 Design ↔ Fill Mode Switching (FR-04)

When switching to Design mode and the puzzle has any non-empty clue text, show a confirmation dialog. Implementation: use `window.confirm()` initially. The same pattern applies to:

- **Import confirmation** (FR-38): When importing a puzzle that would replace existing work with content, `window.confirm()` is shown before proceeding.
- **Reset confirmation** (FR-39): Before resetting the puzzle to a blank state, `window.confirm()` is shown.

These are all blocking, synchronous confirmations. A custom modal can replace `window.confirm()` in a future visual polish pass.

### 6.8 Answer Checking (FR-59–FR-61)

The `checkPuzzle` function in `check-logic.ts` compares `playerLetters[row][col]` against `grid[row][col].letter` for every white cell. It returns a `CheckResult` with:
- **type**: One of four outcomes:
  1. `complete-correct`: All white cells filled and all match the answer.
  2. `incomplete-correct`: Some white cells empty, but all filled cells match the answer.
  3. `complete-incorrect`: All white cells filled, but some don't match the answer.
  4. `incomplete-incorrect`: Some white cells empty, and some filled cells don't match the answer.
- **incorrectCells**: List of `CellPosition`s where `playerLetters ≠ grid.letter` (for "clear errors" feature).
- **emptyCells**: List of `CellPosition`s that are still empty.

**Clearing errors** (FR-60): The `clearErrors` function takes the check result and returns a new `PlayerLetters` array where all incorrect cells are set to `null`. Empty cells are untouched. This is silent — no flash or animation.

**UI flow**: After the user clicks "Check", `CheckResultDisplay` shows the outcome. If not "complete-correct", a "Clear Errors" button is shown. Clicking "Clear Errors" calls `clearErrors`, updates `playerLetters`, and clears `checkResult` (so the display resets).

### 6.9 Import/Export (FR-34–FR-38, FR-41)

Two distinct export actions exist in `BuilderActions`:

- **"Save" button**: Always available. Exports the puzzle in incomplete JSON format (full builder state including displaced clues, empty cells, etc.). Intended for resumption later.
- **"Export Complete" button**: Only available when `canExportAsComplete()` returns `{ canExport: true }`. If the puzzle has incomplete words (missing clues or empty cells), the button is disabled and a tooltip or brief message indicates what's missing. Exports in complete JSON format (clean, validated subset).

Both use the File API for download: create a `Blob`, generate a URL with `URL.createObjectURL`, trigger a download, then revoke the URL.

**Import**: Triggered by either the "Import" button in `BuilderActions` or the file picker in `ImportScreen` (Player). Creates a hidden `<input type="file">` element, reads the file with `FileReader`, and calls `parsePuzzleJSON`. Complete JSON is treated as editable incomplete. Replaces current puzzle. If the current puzzle has any content (letters or clue text), `window.confirm()` is shown before proceeding.

This approach avoids CSP issues — no `fetch()`, no server calls, no eval.

### 6.10 localStorage Strategy

- **Builder**: Auto-save to `builder-current` on every state change (debounced 500ms). Load on mount.
- **Player**: Auto-save to `player-<key>` on every letter change (debounced 500ms). Check for existing progress on puzzle import.
- **Progress format**: Only `playerLetters` and `key` are stored for the Player. Puzzle structure comes from the imported file.

### 6.11 Toast Notifications (FR-26, FR-27)

A simple `Toast.svelte` component that shows a message for 3 seconds then fades out. Implemented as a fixed-position element that receives messages via a callback. Used for:
- Word shortened notifications
- Reattach blocked (target word already has a clue)
- Export validation errors

### 6.12 Keyboard Handling

The CrosswordGrid component must capture keyboard input. This requires the grid or a cell to have DOM focus. Implementation:
- Use a hidden `<input>` or a `tabindex` attribute on the grid container to capture focus.
- `onKeyDown` handler on the grid container intercepts letter keys, Backspace, and arrow keys.
- Prevent default on handled keys to avoid browser scrolling.

### 6.13 Marker Handling (FR-16–FR-18)

Markers are toggled via the MarkerToolbar in Builder Fill mode. Each marker corresponds to a cell property: `spaceRight`, `spaceBottom`, `hyphenRight`, `hyphenBottom`. Toggling logic:

- Setting `hyphenRight` on a cell that already has `spaceRight` clears `spaceRight` first (and vice versa). Same for `hyphenBottom`/`spaceBottom`.
- A cell can have both a horizontal and vertical marker simultaneously (e.g., `spaceRight` + `hyphenBottom`).
- The MarkerToolbar only appears in Fill mode. In Design mode, markers are not editable (Design mode is for cell toggle only).

### 6.14 Player Markers Display (FR-55)

Markers render as visual indicators on cells:
- `spaceRight`: thin vertical bar at cell's right edge
- `spaceBottom`: thin horizontal bar at cell's bottom edge
- `hyphenRight`: small hyphen symbol at cell's right edge
- `hyphenBottom`: small hyphen symbol at cell's bottom edge

These are implemented via CSS pseudo-elements or small positioned elements within Cell.svelte. They're purely visual — no effect on typing, navigation, or checking.

### 6.15 Interaction Mode Mutual Exclusivity

The Builder has three mutually exclusive interaction modes in Fill mode:
1. **Normal Fill mode** (default): Clicking selects cells, typing fills letters.
2. **Join mode**: Clicking a grid cell or ClueEntry selects the target word for chain linking.
3. **Reattach mode**: Clicking a grid cell assigns a displaced clue to the clicked word.

Only one mode can be active at a time. Entering a new mode cancels the previous one. Pressing Escape returns to normal Fill mode. Switching to Design mode cancels any active mode.

### 6.16 Displaced Clue Deletion (Extension of FR-27)

The requirements mention reattach and cancel as the two actions on displaced clues, but the DisplacedCluesPanel also includes a **delete** action (✕ button). This permanently removes a displaced clue from the bin. This is a reasonable UX extension — without it, the displaced clue bin would only ever grow, never shrink (except via reattachment). Deletion is not reversible (no undo/redo per constraints).

### 6.17 Numbering Algorithm (FR-11)

The `assignNumbers` function implements standard crossword numbering:
1. Scan all cells left-to-right, top-to-bottom (row by row, column by column within each row).
2. A cell receives a number if it starts an across word AND/OR a down word.
3. A cell starts an across word if it is white, its left neighbor is black or the left edge, AND its right neighbor is white (the word has at least 2 cells).
4. A cell starts a down word if it is white, its top neighbor is black or the top edge, AND its bottom neighbor is white (the word has at least 2 cells).
5. Numbers are assigned sequentially in scan order (1, 2, 3, ...). A cell that starts both an across and a down word gets one number that applies to both.

### 6.18 JSON Serialization Details

**Incomplete format** includes `displacedClues` and allows `letter: null` and empty `clue` strings. **Complete format** excludes `displacedClues` entirely (not even an empty array), requires all white cells to have a `letter`, and requires all chain-head words to have non-empty clues. The `type` field distinguishes them: `"incomplete"` vs. `"complete"`.

For export, marker fields (`spaceRight`, `spaceBottom`, `hyphenRight`, `hyphenBottom`) that are `false` may be omitted from the JSON for compactness, since they default to `false` on import. This is optional — including all fields is also valid.

### 6.19 Toast Component Implementation

`Toast.svelte` is rendered at the page level (in `BuilderPage` and `PlayerPage` separately). It takes a `message` prop and a `visible` prop. When `visible` becomes `true`, the toast appears for 3 seconds then fades out. The parent page manages toast state: `$state toastMessage: string | null` and a setter function that shows the toast and auto-clears it after 3 seconds via `setTimeout`.

---

## 7. Testing Strategy

### 7.1 Unit Tests (Priority: HIGH)

All pure logic functions in `lib/` are the primary testing target. These have no Svelte dependency and are trivially testable.

**Test categories and key scenarios:**

**grid-logic.test.ts**
- `createEmptyGrid`: Creates N×N grid, all cells white, all fields default
- `deriveWords`: Detects across and down words from grid; ignores 1-letter "words"; handles black cells; handles full rows/columns
- `assignNumbers`: Correct numbering (left-to-right, top-to-bottom); cells starting both across and down get one number; isolated cells get no number
- `getWordsAtCell` / `getWordInDirection`: Returns correct word(s) for intersection cells, single-word cells, edge cells
- `advancePosition` / `retreatPosition`: Correct movement within words; stops at word end/beginning; handles grid edges
- `movePosition`: Arrow key movement in all directions; wraps/clamps at grid edges
- `computeWordLength`: Correct lengths for various word configurations

**clue-logic.test.ts** *(most critical tests)*
- `reconcileWordsOnGridChange`:
  - Unchanged word: clue preserved, renumbered
  - Shortened word: clue preserved, toast info generated
  - Lengthened word: clue preserved, new cells included
  - Destroyed word with empty clue: vanishes, no displaced clue
  - Destroyed word with non-empty clue: clue goes to displaced bin
  - New word: empty clue slot created
  - Chain word destroyed: chain breaks correctly, preceding link removed
  - Multiple simultaneous changes: all handled correctly
  - Displaced clue reattachment: correct field updates, blocked on non-empty target

**chain-logic.test.ts**
- `joinWords`: Valid join; fails if source already has nextWord; fails if target already pointed to; displaces target's clue
- `unjoinWord`: Correctly removes link; formerly linked word gets empty clue
- `getChainHead`: Finds head of simple chain; handles already-head word; handles long chains
- `getDisplayClue`: Head word shows its own clue; non-head shows "See [ref]"; updates with renumbering
- `validateChains`: Detects cycles; detects branching; accepts valid chains

**validation.test.ts**
- Complete puzzle: all white cells have letters; all head words have clues; all nextWord references resolve; valid grid dimensions; valid chain structure
- Incomplete puzzle: valid structure but allows empty cells and empty clues
- Rejects unrecognized version

**import-export.test.ts**
- Round-trip: serialize then parse produces equivalent data
- Complete export: no displaced clues, no empty cells, no empty head-word clues
- Import complete into incomplete format: compatible superset
- Key preservation across round-trips
- Marker fields default to false when absent

**check-logic.test.ts**
- `checkPuzzle`: All four result types (complete-correct, incomplete-correct, complete-incorrect, incomplete-incorrect)
- `clearErrors`: Only incorrect cells cleared; empty cells untouched; returns new array

**storage.test.ts**
- Save and load builder state round-trip
- Save and load player progress round-trip
- Missing keys return null
- Clear operations work correctly

### 7.2 Component Tests (Priority: MEDIUM)

Using Vitest + `@testing-library/svelte`:

- **Cell.svelte**: Renders correct state (black, white, selected, highlighted, number, markers)
- **CrosswordGrid.svelte**: Renders grid of correct size; clicks emit `onCellClick`; key presses emit `onKeyDown`
- **CluePanel.svelte**: Renders across/down sections; highlights selected clue; editable mode works; readonly mode works
- **Toast.svelte**: Appears and disappears after timeout

### 7.3 Integration Tests (Priority: MEDIUM)

Test the orchestrator pages by mounting them with `@testing-library/svelte`:

- **BuilderPage**: Enter Design mode, click cells to toggle black/white, switch to Fill mode, type letters, verify clue panel updates, add clue text, verify word numbering updates after grid change, test displaced clue flow
- **PlayerPage**: Import puzzle JSON, type letters, navigate grid, check answers, clear errors

### 7.4 End-to-End Tests (Priority: DEFERRED)

Playwright tests for full workflows — deferred until core functionality is stable. Key scenarios to eventually cover:
- Full Builder workflow: create grid → fill answers → add clues → export
- Full Player workflow: import → solve → check → confirm correct
- File import/export round-trip

### 7.5 Mocking Strategy

- **Pure logic functions**: No mocks needed — they're pure functions.
- **localStorage**: Use Vitest's `vi.stubGlobal` to mock `localStorage` in storage tests.
- **File API**: Use Vitest's `vi.stubGlobal` to mock `File`, `Blob`, `URL.createObjectURL` for import/export tests.
- **Component tests**: Mock callback props to verify event emission.

---

## 8. Future Considerations

### 8.1 Extension Points (Design Anticipates)

- **Rotational symmetry**: The grid architecture makes this straightforward to add — a symmetry toggle in Design mode that mirrors cell toggles 180°. No structural changes needed.
- **Undo/redo**: The pure-function approach to state changes (especially `reconcileWordsOnGridChange`) naturally produces new state objects. An undo stack would require saving previous states. This would benefit from moving to an immutable-state pattern (currently state is mutated via `$state` assignments). Could be added by introducing a command pattern or state snapshots.
- **Play-test from Builder**: The current architecture shares CrosswordGrid between Builder and Player, so adding a play-test mode would require instantiating PlayerPage-like behavior within BuilderPage. The shared grid component makes this architecturally feasible.
- **Mobile/responsive**: Tailwind's responsive utilities make this straightforward. The grid would need viewport-relative sizing. Keyboard handling would need virtual keyboard consideration.
- **Multiple puzzles**: Currently handled via file import/export. Adding an in-app puzzle manager would require a new PuzzleList component and a localStorage schema for multiple puzzles.
- **Accessibility**: Cell.svelte could add ARIA roles (`grid`, `gridcell`, `row`) and keyboard event handling is already in place. Screen reader improvements would need `aria-label` annotations on cells.

### 8.2 Potential Scale Concerns

- **25×25 grids** (625 cells) are the performance target (NFR-01). The grid rendering and derivation logic must be efficient. Key optimization: avoid full re-derivation on every keystroke. Only re-derive when the grid structure changes (Design mode toggles), not when a letter is typed in Fill mode.
- **Large clue panels** with many words should use efficient scrolling. Svelte's `{#each}` with keyed blocks handles this well.

### 8.3 Decisions Deliberately Deferred

- **Visual design**: Colors, spacing, typography. Tailwind config provides the mechanism; actual values are TBD.
- **Error message styling**: Simple text to start, no fancy error states.
- **"Export Complete" disabled-state messaging**: Whether the button shows a tooltip, inline text, or a list of missing items when the puzzle is not ready for complete export. Start with a disabled button, upgrade later.