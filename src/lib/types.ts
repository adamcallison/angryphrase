// Shared type definitions for the crossword puzzle app

// === Grid ===

export interface CellData {
  black: boolean;
  letter: string | null; // Single A-Z character, or null
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
}

// Grid is CellData[][] — a flat 2D array indexed grid[row][col]

// === Words ===

// Word identifier: unique key for a word position
export type WordId = string; // `${startRow}-${startCol}-${direction}`

export type Direction = "across" | "down";

export type DirectionPolarity = "forward" | "backward";

export interface WordPosition {
  startRow: number;
  startCol: number;
  direction: Direction;
}

// A word as derived from the grid structure
export interface DerivedWord {
  startRow: number;
  startCol: number;
  direction: Direction;
  length: number; // Derived from grid (contiguous white cells from start)
  number: number; // Assigned by numbering algorithm
}

// Metadata attached to a word (NOT derived from grid — user-entered)
export interface WordMetadata {
  clue: string; // Clue text (may be empty)
  nextWord: WordPosition | null; // Chain link (null = not chained)
}

// Full word object combining position + metadata + derived data
export interface Word extends DerivedWord, WordMetadata {}

// === Displaced Clues ===

export interface DisplacedClue {
  id: string; // Unique identifier for UI rendering and reattach targeting
  clue: string;
  direction: Direction;
  // Note: no position info. When reattached, user picks a new target word.
}

// === Puzzle Metadata ===

export interface PuzzleMetadata {
  title: string;
  author: string;
}

// === Selected Cell / Direction ===

export interface CellPosition {
  row: number;
  col: number;
}

// Cells at grid boundaries or next to black cells have no neighbor in a direction
// The cursor's (row, col) always points to a valid white cell while selected

// === Player Progress ===

// Player letters stored separately from the puzzle grid
// playerLetters[row][col] = string | null
export type PlayerLetters = (string | null)[][];

// === Answer Checking ===

export type CheckResultType =
  | "complete-correct"
  | "incomplete-correct"
  | "complete-incorrect"
  | "incomplete-incorrect";

export interface CheckResult {
  type: CheckResultType;
  incorrectCells: CellPosition[]; // Cells where player letter ≠ answer letter
  emptyCells: CellPosition[]; // Cells where player has not entered a letter
}

// === Builder State ===

export interface BuilderState {
  // Core data
  key: string; // Unique puzzle identifier
  gridSize: number;
  grid: CellData[][];
  wordMetadata: Map<string, WordMetadata>; // Keyed by WordId
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
  joinSourceWordId: WordId | null; // The word being linked FROM
}

// === Player Progress ===

export interface PlayerProgress {
  key: string;
  gridSize: number;
  letters: (string | null)[][];
}

// === Clue-Logic Reconciliation ===

export interface WordChangeResult {
  updatedWords: Word[]; // Words with preserved/updated metadata
  displacedClues: DisplacedClue[]; // Newly displaced + existing displaced clues
  shortenedWords: Word[]; // Words that were shortened (for toast notification)
  lengthenedWords: Word[]; // Words that were lengthened
}

// === JSON Import/Export Formats ===

// Complete puzzle JSON (Player format — includes version and type discriminator)
export interface CompletePuzzleJSON {
  version: number;
  type: "complete";
  key: string;
  gridSize: number;
  grid: CellData[][];
  words: Word[];
  title: string;
  author: string;
}

// Incomplete puzzle JSON (Builder save format — includes version and type discriminator)
export interface IncompletePuzzleJSON {
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

// Parsed puzzle data (version and type consumed during parsing, not included here)
export interface IncompletePuzzle {
  key: string;
  gridSize: number;
  grid: CellData[][];
  words: Word[];
  title: string;
  author: string;
  displacedClues: DisplacedClue[];
}

export interface CompletePuzzle {
  key: string;
  gridSize: number;
  grid: CellData[][];
  words: Word[];
  title: string;
  author: string;
}

// === Component Props ===

export interface CellProps {
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

export interface CrosswordGridProps {
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

// === Validation ===

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}