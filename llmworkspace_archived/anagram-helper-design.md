# Anagram Helper — Design Document

## 1. Feature Overview

The Anagram Helper is a new tool for the Player page that assists users in solving crossword clues by letting them shuffle (anagram) the letters of a selected word. It displays the word as it currently appears in the grid — with already-placed letters fixed in position and visible — and lets the user type in the full set of letters for the word, then repeatedly scramble the non-fixed letters.

### Core User Flow

1. User selects a word in the crossword grid (by clicking a cell or a clue).
2. The "Anagram" button becomes enabled (it is greyed out when no word is selected).
3. User clicks the Anagram button.
4. An Anagram Helper overlay appears showing the selected word's cells:
   - Letters already placed in the grid are visible and **fixed** in their positions (they will not move during scrambling).
   - Empty cells show as blank slots awaiting input.
5. The user types the **complete set of letters** for the word into the text input. The text input starts **empty** — the user must type all letters, including those already present in the grid. The tiles serve as a visual reference showing which positions have letters.
6. The typed letter set is valid when:
   - It is exactly the same length as the word.
   - It **contains** all the letters already placed in the grid (i.e., the multiset of typed letters is a superset of the multiset of fixed letters, accounting for duplicates).
7. While the input is valid, a "Scramble" button shuffles the non-fixed letters randomly, leaving fixed (already-placed) letters in their original positions.
8. The user can close the overlay to return to the crossword.

---

## 2. Architecture

### 2.1 Component Tree

```
PlayerPage.svelte
├── ActiveClueDisplay (existing)
├── CrosswordGrid (existing)
├── CluePanel (existing)
├── CheckResultDisplay (existing)
├── PlayerActions (existing, modified — add Anagram button)
└── AnagramHelper.svelte (NEW)
    └── Cell.svelte (existing, reused as-is for tile rendering)
```

### 2.2 State Model

All state lives in `PlayerPage.svelte` (following the existing pattern of single-source-of-truth page components). The Anagram Helper's state is a simple open/closed toggle plus the context needed for rendering.

**New state added to `PlayerPage.svelte`:**

```typescript
// Whether the anagram helper overlay is currently open
let anagramOpen = $state<boolean>(false);
```

**Derived context (computed when overlay opens):**

```typescript
// Already computed — reuse existing `selectedWord`:
// - selectedWord: Word | null  (derived from cursor state)
// - highlightedCells: CellPosition[] (derived from selectedWord)
```

The Anagram Helper component will receive the `selectedWord` and the `grid` as props so it can derive the letter positions and markers internally. It will manage its own internal state (typed input text, display arrangement) without leaking into `PlayerPage`.

### 2.3 Component Props & Internal State

#### `PlayerActions.svelte` (modified)

New props:

| Prop | Type | Description |
|------|------|-------------|
| `hasSelectedWord` | `boolean` | Whether a word is currently selected (controls button enabled/disabled) |
| `onAnagram` | `() => void` | Callback to open the anagram helper |

The Anagram button will be greyed out (`disabled`) when `hasSelectedWord` is `false`.

#### `Cell.svelte` (reused, not modified)

The existing Cell component is used directly inside AnagramHelper to render each tile. Cell is a good fit because it already handles:
- Rendering a letter (or null for empty)
- Displaying cell numbers
- Rendering space/hyphen markers

The AnagramHelper passes the following props to each Cell:
- `isBlack`: `false` (always)
- `letter`: the display letter for that position (or `null` for empty)
- `number`: the word number for the first cell, `null` for all others
- `isSelected`: `false` (always)
- `isHighlighted`: `false` (always)
- `spaceRight` / `hyphenRight`: from the word's cell data (for across words)
- `spaceBottom` / `hyphenBottom`: `false` (words in the anagram view are always displayed across)
- `onclick`: `() => {}` (no-op, tiles are display-only)

No visual differentiation is made between fixed, shuffled, and empty tiles in the Cell component itself. The "fixed" concept is purely internal to the scramble logic — fixed letters stay in place during shuffle, but they render the same as any other letter.

#### `AnagramHelper.svelte` (new)

| Prop | Type | Description |
|------|------|-------------|
| `word` | `Word` | The currently selected word (always present when open) |
| `grid` | `CellData[][]` | The full grid (to read `playerLetter`, `spaceRight`/`hyphenRight` from each cell) |
| `onClose` | `() => void` | Callback to close the overlay |

**Internal state:**

```typescript
// The raw text input from the user (starts empty).
// The user types all letters for the word, including those already in the grid.
let inputText = $state<string>("");

// The current display arrangement of letters, which may differ from the
// input order after scrambling.
let shuffledDisplay: (string | null)[] | null = $state(null);
// When null, display is derived from inputText + fixed letters.
// When set (after a scramble), display is the shuffled arrangement.

// Whether the current inputText is valid:
// 1. Length equals word length
// 2. Contains all fixed letters (as a multiset superset)
let isValid = $derived(computeValidity());
```

---

## 3. Detailed Behavior

### 3.1 Opening the Anagram Helper

When the user clicks the Anagram button:

1. `PlayerPage` sets `anagramOpen = true`.
2. The `AnagramHelper` component receives the current `selectedWord` and `grid`.
3. The component initializes its internal state:
   - Computes the list of cells for the word (using `getWordCells(word)`).
   - Reads each cell's `playerLetter` from the grid and its `spaceRight`/`hyphenRight` markers.
   - Sets `inputText = ""` (the input starts empty — the user must type all letters).
   - Computes the `fixedMask`: for each cell, `true` if `playerLetter` is non-null.
   - Computes the `fixedLetters`: for each cell, the `playerLetter` value or `null`.
4. The overlay renders, showing the word's tiles.

### 3.2 Letter Input

The user types the **complete set of letters** for the word into a single text input. The input starts empty — even letters already in the grid must be typed by the user.

**UI for letter input:**

A single `<input>` element where the user types all letters for the word (including those already placed in the grid). This input:

- Starts **empty** — no pre-population.
- Filters to A-Z characters only (case-insensitive, stored/displayed as uppercase).
- Has a `maxlength` equal to the word's total length.
- Shows a placeholder like "Type all letters for this word".

As the user types, the component:

1. Distributes the typed letters into the tile positions (fixed positions always show the grid letter regardless; non-fixed positions show letters from the input).
2. Validates that the typed letters contain all fixed letters as a multiset superset.
3. If valid, enables the Scramble button.

### 3.3 Validation Rules

The typed letter set is valid when:

1. **Correct length**: The number of typed letters equals the word's total length.
2. **Contains all fixed letters**: Every fixed letter (already placed in the grid) must appear in the typed set at least as many times as it appears as a fixed letter. For example, if position 0 has "C" and position 5 has "T", the typed letters must contain at least one "C" and one "T". If two positions both have "E", the typed letters must contain at least two "E"s.

When valid, the fixed letters are "claimed" from the typed pool first (staying in their fixed positions), and the remaining letters are distributed to the empty slots. The Scramble button then shuffles only the non-fixed letters among the non-fixed positions.

### 3.4 Scramble Behavior

When the user clicks the **Scramble** button:

1. From the typed input, "claim" the fixed letters first — remove one instance of each fixed letter from the typed pool, in order, to guarantee each fixed letter is accounted for.
2. The remaining unclaimed letters fill the non-fixed positions in order.
3. Shuffle only the non-fixed position letters (Fisher-Yates shuffle).
4. Place the shuffled non-fixed letters back into the non-fixed positions.
5. Update the tile display — fixed letters remain unchanged.

**Fixed letters never move.** They remain in their original grid position at all times.

### 3.5 Closing the Anagram Helper

Clicking the **Close** button (or pressing Escape) calls `onClose()`, which sets `anagramOpen = false` in `PlayerPage`. No letters are written back to the grid — the Anagram Helper is purely a visualization/brainstorming tool. It does not mutate the puzzle state.

---

## 4. Visual Design

### 4.1 Anagram Button in PlayerActions

The Anagram button follows the same visual pattern as the existing "Check" / "Reset" / "Import New" buttons:

- **When no word is selected**: Greyed out, `opacity-40`, `cursor-not-allowed`, matching the existing `disabled` pattern.
- **When a word is selected**: Styled as a secondary action button (grey/neutral, matching "Reset"):
  ```
  bg-gray-200 text-gray-700 hover:bg-gray-300
  focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1
  ```
- **Label**: "Anagram".

### 4.2 Anagram Helper Overlay

The overlay is a **modal dialog** — a fixed-position layer on top of the crossword UI. This is the first modal in the app, so it establishes the modal pattern.

**Structure:**

```
┌─────────────────────────────────────────────────────┐
│  (dark semi-transparent backdrop, full-screen)       │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  Anagram: 3 Across (7)                [×]      │  │
│  │                                               │  │
│  │  ┌───┐   ┌───┐ ┌───┐ ┌───┐-┌───┐ ┌───┐ ┌───┐ │  │
│  │  │ C │   │   │ │   │ │   │ │   │ │   │ │   │ │  │
│  │  └───┘   └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ │  │
│  │                                               │  │
│  │  [ Type all letters for this word: _______ ]  │  │
│  │                                               │  │
│  │  [Scramble]              [Close]              │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Key visual elements:**

- **Backdrop**: `fixed inset-0 bg-black/50 z-40` — dark semi-transparent overlay covering the entire page.
- **Dialog panel**: Centered, `max-w-lg`, white background, rounded corners, shadow. `z-50` to sit above the backdrop.
- **Header**: Shows the word number, direction, and length pattern (e.g., "Anagram: 3 Across (7)" or "Anagram: 5 Down (4-4)"). Close button (`×`) in the top-right corner.
- **Tile row**: A horizontal row of Cell components representing each cell in the word, with visual separators for space/hyphen markers between tiles:
  - **Space markers**: A wider gap between tiles where the word has an inter-word space, matching how `ActiveClueDisplay` shows patterns like "4, 4".
  - **Hyphen markers**: A hyphen character (`-`) rendered between tiles where the word has a hyphen, matching how `ActiveClueDisplay` shows patterns like "4-4".
  - All tiles render with the same default visual styling (`cell--default`). There is no visual differentiation between fixed, shuffled, and empty tiles in the Cell component itself. Tiles with a letter show that letter; tiles without a letter are blank.
- **Letter input**: A single text input below the tiles, starting **empty**. Styled to match the app's existing input aesthetics. Label text: "Type all letters for this word".
- **Scramble button**: Primary action (`bg-blue-600 text-white`), disabled when the letter set is invalid or incomplete. Only enabled when the typed text has the correct length and contains all fixed letters.
- **Close button**: Secondary action (`bg-gray-200 text-gray-700`).

### 4.3 Responsive Considerations

- On small screens, the dialog modal should take near-full width with adequate padding.
- For long words (10+ letters), the tile row should allow horizontal scroll within the tile row for very long words, or scale down tile size via a CSS custom property. The default tile size matches the grid cell size (`var(--cell-size): 40px`) for visual consistency (since we reuse the Cell component).

### 4.4 Accessibility

- The modal uses `role="dialog"` and `aria-modal="true"`.
- Focus trapping: When the modal is open, focus stays within the dialog. On close, focus returns to the Anagram button.
- Escape key closes the modal.
- Each tile (Cell) already has `role="gridcell"`.
- The letter input has a clear label: "Type all letters for this word."

---

## 5. Implementation Plan

### 5.1 Files to Create

| File | Purpose |
|------|---------|
| `src/components/AnagramHelper.svelte` | Main anagram helper modal component (renders Cell instances) |
| `src/lib/anagram-logic.ts` | Pure functions for anagram logic (shuffle, validation) |

### 5.2 Files to Modify

| File | Changes |
|------|---------|
| `src/pages/PlayerPage.svelte` | Add `anagramOpen` state, render `AnagramHelper`, wire up open/close handlers, pass `hasSelectedWord` prop to `PlayerActions` |
| `src/components/PlayerActions.svelte` | Add Anagram button with `hasSelectedWord` / `onAnagram` props |
| `src/lib/types.ts` | Add `AnagramState` interface |

### 5.3 Implementation Steps (Order)

1. **Add `AnagramState` type to `src/lib/types.ts`** — Interface for computed anagram state.
2. **Create `src/lib/anagram-logic.ts`** — Pure utility functions:
   - `computeAnagramState(word: Word, grid: CellData[][]): AnagramState` — Computes fixed mask, fixed letters, markers (space/hyphen), and empty count for the word's cells
   - `deriveDisplayLetters(inputText: string, fixedLetters: (string | null)[], fixedMask: boolean[]): (string | null)[]` — Distributes typed input into display positions, claiming fixed letters first
   - `validateInput(inputText: string, fixedLetters: (string | null)[], fixedMask: boolean[]): boolean` — Checks length and multiset containment of fixed letters
   - `shuffleNonFixedLetters(display: (string | null)[], fixedMask: boolean[]): (string | null)[]` — Fisher-Yates shuffle of non-fixed positions only
   - `computeCellMarkers(word: Word, grid: CellData[][]): { spaceRight: boolean[]; hyphenRight: boolean[] }` — Computes space/hyphen markers for each cell in the word
3. **Create `src/components/AnagramHelper.svelte`** — The main modal component with all internal state and UI. Renders Cell instances for the tile row.
4. **Modify `src/components/PlayerActions.svelte`** — Add the Anagram button.
5. **Modify `src/pages/PlayerPage.svelte`** — Wire up the Anagram button, modal open/close, and data passing.

### 5.4 New Types

Add to `src/lib/types.ts`:

```typescript
/** State for the anagram helper, derived from a selected word and the grid. */
export interface AnagramState {
  /** The word being anagrammed. */
  word: Word;
  /** For each cell position in the word, whether the letter is fixed (already in grid). */
  fixedMask: boolean[];
  /** The letters currently placed in fixed positions (null for non-fixed). */
  fixedLetters: (string | null)[];
  /** The total length of the word. */
  length: number;
  /** Number of non-fixed (empty) positions. */
  emptyCount: number;
}
```

Note: Space/hyphen markers are computed separately by `computeCellMarkers` rather than stored in `AnagramState`, since they map directly to the Cell component's `spaceRight`/`hyphenRight` props.

---

## 6. Key Design Decisions

### 6.1 Modal vs. Inline Panel

**Decision: Modal overlay.**

Reasons:
- The Anagram Helper is a focused, short-lived interaction — the user opens it, shuffles a few times, and closes it. A modal naturally scopes this interaction.
- An inline panel would compete for screen space with the clue panel and grid, especially on mobile.
- No existing modal pattern exists in the app, but this is a natural starting point. The modal pattern can be extracted into a reusable `Modal.svelte` component later if needed.

### 6.2 Single Text Input vs. Per-Cell Input

**Decision: Single text input for all letters.**

Reasons:
- The user described typing "a set of letters" — this naturally maps to a single input field.
- Per-cell inputs would require complex cursor management and wouldn't add value since the user isn't assigning letters to specific slots (that's what the main grid is for).
- A single input is simpler to implement, validate, and reason about.

### 6.3 No Grid Write-Back

**Decision: The Anagram Helper does not write letters back to the grid.**

Reasons:
- The Anagram Helper is a brainstorming tool. The user shuffles letters to visualize possibilities, then manually enters the answer in the crossword grid.
- Automatic write-back could lead to accidental overwrites.
- Keeping it read-only simplifies the implementation and avoids state synchronization issues.

### 6.4 State Ownership

**Decision: All anagram state is internal to `AnagramHelper.svelte`.**

Reasons:
- Follows the existing pattern where page components orchestrate top-level state but component internals (like form inputs) are managed locally.
- The Anagram Helper is self-contained — it doesn't need to affect any data outside itself.
- Only the open/close toggle lives in `PlayerPage`, which is minimal and consistent with how modal-like components typically work.

### 6.5 Scramble Algorithm

**Decision: Fisher-Yates shuffle, applied only to non-fixed positions.**

Reasons:
- Fisher-Yates is the standard unbiased shuffle algorithm.
- We extract the non-fixed letters, shuffle them, and redistribute back into the non-fixed positions. This guarantees fixed letters never move.
- Each click produces a new random permutation. If the shuffle accidentally produces the same arrangement, it's an acceptable outcome (low probability for any word with more than 2 non-fixed letters).

### 6.6 Cell Component Reuse

**Decision: Reuse the existing `Cell.svelte` component as-is, with no modifications.**

Reasons:
- Cell already handles everything the anagram tiles need: rendering a letter (or blank), displaying space/hyphen markers, and providing consistent visual sizing.
- The AnagramHelper passes appropriate props: `isBlack=false`, `isSelected=false`, `isHighlighted=false` for all tiles, with `letter` set to the display letter for each position (or `null` for empty), and `number` set to the word's number for the first cell (or `null` for others).
- `onclick` is passed as a no-op `() => {}` since tiles are display-only in the anagram context.
- No visual differentiation between fixed, shuffled, and empty tiles is needed — the "fixed" concept is purely internal to the scramble logic. The user can see which cells had letters from the grid before opening the helper, and during scrambling, they can observe which positions don't change (those are the fixed ones).
- This avoids polluting Cell with anagram-specific concerns and keeps the component count minimal.

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| No word selected | Anagram button is disabled (greyed out). This is the default state when the page loads or when the user clicks away from all cells. |
| Word is fully filled in (all cells have `playerLetter`) | The Anagram Helper opens showing all cells with their letters. The text input is still empty — the user must type all letters. The Scramble button is disabled since all positions are fixed (shuffling zero non-fixed letters is a no-op). |
| Word has no letters placed (all empty) | All cells show as blank. The user types the full set of letters, then scrambles. |
| User changes word selection while Anagram Helper is open | The Anagram Helper re-initializes with the new word's data (via `$effect` on the `word` prop). This is unlikely in practice since the modal blocks grid interaction, but handling it correctly prevents stale state bugs. Typed letters are reset on word change. |
| User closes and reopens for the same word | The Anagram Helper re-initializes from the current grid state. Any previously typed letters are lost. This is intentional — the grid is the source of truth. |
| Keyboard events while modal is open | The modal captures keyboard events. Letter typing goes to the Anagram input, not the crossword grid. Arrow keys and other grid navigation are suppressed while the modal is open. |
| Word with space/hyphen markers | Spaces and hyphens within a word (indicated by `spaceRight`/`hyphenRight` markers on cells) are rendered by the Cell component's existing marker rendering. The header shows the length pattern (e.g., "4, 4" or "4-4"). |

---

## 8. Scramble Technical Detail

The scramble function works on the user's typed input text. The input text represents the complete set of letters for the word (including those already in the grid). On scramble:

1. "Claim" the fixed letters from the input text — for each fixed position, remove one instance of that fixed letter from the typed pool. This guarantees fixed letters are accounted for.
2. The remaining letters fill the non-fixed positions in order.
3. Shuffle only the non-fixed position letters (Fisher-Yates).
4. Redistribute: fixed letters stay in their original positions; shuffled non-fixed letters fill the empty slots.

```
Example: 7-letter word, position 0 has 'C' (fixed), position 5 has 'T' (fixed)
User types: "CRANNTR"

On Scramble:
  1. Claim fixed letters from input:
     - Position 0 is fixed='C' → claim one 'C' from pool → remaining: [R, A, N, N, T, R]
     - Position 5 is fixed='T' → claim one 'T' from pool → remaining: [R, A, N, N, R]
  2. Extract non-fixed position letters: [R, A, N, N, R]
  3. Shuffle (Fisher-Yates): e.g. [N, R, N, R, A]
  4. Redistribute into display:
     → Position 0 (fixed): C
     → Position 1 (non-fixed): N
     → Position 2 (non-fixed): R
     → Position 3 (non-fixed): N
     → Position 4 (non-fixed): R
     → Position 5 (fixed): T
     → Position 6 (non-fixed): A
     Final display: [C, N, R, N, R, T, A]
```

The display is re-derived from `inputText` each time the user types, and from the shuffled arrangement after each scramble click.

```typescript
/**
 * Derives the display letters for the tile row.
 * Fixed positions always show the grid letter.
 * Non-fixed positions show letters from the input text (after claiming fixed letters).
 * If input text is incomplete, non-fixed positions show null (blank cells).
 */
export function deriveDisplayLetters(
  inputText: string,
  fixedLetters: (string | null)[],
  fixedMask: boolean[],
): (string | null)[] {
  const totalLength = fixedMask.length;
  const result: (string | null)[] = [];

  // Check if input has enough letters
  if (inputText.length < totalLength) {
    // Not enough letters typed yet — show fixed letters and null for rest
    for (let i = 0; i < totalLength; i++) {
      result.push(fixedMask[i] ? fixedLetters[i] : null);
    }
    return result;
  }

  // Claim fixed letters from the input pool
  const pool = inputText.split('');
  for (let i = 0; i < totalLength; i++) {
    if (fixedMask[i]) {
      const fixedLetter = fixedLetters[i]!;
      const idx = pool.indexOf(fixedLetter);
      if (idx !== -1) {
        pool.splice(idx, 1); // Remove one instance
      }
    }
  }

  // Build result: fixed positions get their grid letter,
  // non-fixed positions get letters from the remaining pool
  let poolIdx = 0;
  for (let i = 0; i < totalLength; i++) {
    if (fixedMask[i]) {
      result.push(fixedLetters[i]);
    } else {
      result.push(pool[poolIdx] ?? null);
      poolIdx++;
    }
  }

  return result;
}
```

```typescript
/**
 * Shuffles the non-fixed positions of a display array using Fisher-Yates.
 * Fixed positions are unchanged.
 */
export function shuffleNonFixedLetters(
  display: (string | null)[],
  fixedMask: boolean[],
): (string | null)[] {
  // Extract non-fixed letters
  const nonFixed: string[] = [];
  const nonFixedIndices: number[] = [];
  for (let i = 0; i < display.length; i++) {
    if (!fixedMask[i] && display[i] !== null) {
      nonFixed.push(display[i]!);
      nonFixedIndices.push(i);
    }
  }

  // Fisher-Yates shuffle
  for (let i = nonFixed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nonFixed[i], nonFixed[j]] = [nonFixed[j], nonFixed[i]];
  }

  // Redistribute
  const result = [...display];
  for (let k = 0; k < nonFixedIndices.length; k++) {
    result[nonFixedIndices[k]] = nonFixed[k];
  }
  return result;
}
```

```typescript
/**
 * Validates that the input text contains all fixed letters (as a multiset superset).
 */
export function validateInput(
  inputText: string,
  fixedLetters: (string | null)[],
  fixedMask: boolean[],
): boolean {
  if (inputText.length !== fixedMask.length) return false;

  // Build a frequency map of the input
  const inputFreq = new Map<string, number>();
  for (const ch of inputText) {
    inputFreq.set(ch, (inputFreq.get(ch) ?? 0) + 1);
  }

  // Check that each fixed letter appears at least as many times in the input
  for (let i = 0; i < fixedMask.length; i++) {
    if (fixedMask[i]) {
      const letter = fixedLetters[i]!.toUpperCase();
      const inputCount = inputFreq.get(letter) ?? 0;
      if (inputCount < 1) return false;
      inputFreq.set(letter, inputCount - 1); // "Claim" one instance
    }
  }

  return true;
}
```

---

## 9. Word Change Handling

If the selected word changes while the Anagram Helper is open (e.g., user clicks a clue in the background, though this would be behind the modal), the component should respond via a Svelte 5 `$effect`:

```typescript
// Inside AnagramHelper.svelte
$effect(() => {
  // Re-initialize whenever the word reference changes
  const state = computeAnagramState(word, grid);
  fixedMask = state.fixedMask;
  fixedLetters = state.fixedLetters;
  // Reset the input text to empty
  inputText = "";
  shuffledDisplay = null;
});
```

Since the modal overlay blocks interaction with the grid, this scenario is unlikely in practice. However, handling it correctly prevents stale state bugs.

---

## 10. Summary of All Changes

### New Files
1. **`src/lib/anagram-logic.ts`** — Pure functions: `computeAnagramState`, `deriveDisplayLetters`, `validateInput`, `shuffleNonFixedLetters`, `computeCellMarkers`
2. **`src/components/AnagramHelper.svelte`** — Modal overlay with Cell-based tiles, text input (starts empty), and scramble button

### Modified Files
3. **`src/lib/types.ts`** — Add `AnagramState` interface
4. **`src/components/PlayerActions.svelte`** — Add Anagram button with `hasSelectedWord` and `onAnagram` props
5. **`src/pages/PlayerPage.svelte`** — Add `anagramOpen` state, modal open/close handlers, render `AnagramHelper` component, pass `hasSelectedWord` to `PlayerActions`

### No Changes To
- **`src/components/Cell.svelte`** — Reused as-is. No modifications needed. AnagramHelper passes `isBlack=false`, `isSelected=false`, `isHighlighted=false`, `number=null` (except first cell), and a no-op `onclick`.
- Grid rendering (`CrosswordGrid`) — unaffected
- Grid logic (`grid-logic.ts`) — no changes needed; existing `getWordCells` and `getWordInDirection` are sufficient
- State machine (`interaction-machine.ts`) — the anagram feature doesn't change the player's interaction mode
- Checking/reset logic — unaffected
- Storage/persistence — the anagram tool is ephemeral; nothing is saved