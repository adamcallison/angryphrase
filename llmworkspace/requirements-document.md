# Crossword Builder & Player — Requirements Document

## 1. Project Overview

A purely frontend web application for creating and playing crosswords. The app has two distinct modes — a Builder and a Player — accessible from a landing page. The Builder allows users to design grid layouts, enter answers and clues, and export puzzles as JSON. The Player allows users to import completed puzzles and solve them interactively. There is no backend, no server, and no database — all state is managed client-side via localStorage and file import/export. The goal is minimal infrastructure complexity, deployable as a static site.

## 2. Stakeholders & Users

- **Puzzle builders**: Anyone who wants to create a crossword. They design the grid, enter answers and clues, and export the result.
- **Puzzle solvers (players)**: Anyone who wants to solve a crossword. They import a completed puzzle JSON and play it.
- **Developer (user)**: Brand new to web development — the architecture should be straightforward and the codebase approachable.

## 3. Functional Requirements

### 3.1 App Structure

- **FR-01**: The app presents a landing page with two options: Build and Play.
- **FR-02**: Selecting Build enters the Builder. Selecting Play enters the Player.
- **FR-03**: The two modes are separate — there is no play-test feature from the Builder.

### 3.2 Builder

#### Grid Design

- **FR-04**: The Builder operates in two explicit modes — "Design" mode and "Fill" mode — with a mode switch between them. When switching to Design mode and the puzzle has any non-empty clue text, a confirmation dialog is shown to warn the user that grid changes may affect clues.
- **FR-05**: In Design mode, clicking a cell toggles it between white (fillable) and black (blocked).
- **FR-06**: In Fill mode, clicking a cell selects it for typing; typing a letter fills the cell and advances the cursor. Fill mode follows the same cursor and direction behavior as the Player (FR-46–FR-51, FR-53–FR-54), with the difference that the builder always sees the answers.
- **FR-07**: Grid size defaults to 15×15.
- **FR-08**: Grid size can only be changed when the grid is a blank slate — no letters in any cell, no attached clue text, and no displaced clue text. When any content exists, the grid size is locked. Deleting all content (including reattaching or deleting all displaced clues) re-enables size changes.
- **FR-09**: The grid is always square (NxN). There are no minimum or maximum bounds on N.
- **FR-10**: Rotational symmetry is NOT enforced, but the architecture should not make it difficult to add in the future.
- **FR-11**: Numbering follows the standard crossword scheme: numbers are assigned left-to-right, top-to-bottom. A cell receives a number only if it starts an across word and/or a down word.

#### Clues and Answers

- **FR-12**: Answers are typed directly into the grid in Fill mode. The grid cells are the source of truth for all letter data — each cell holds one letter or is empty. Word answer strings in the JSON format are derived from cell contents, not stored independently. The builder always sees the answers — there is no "hide answers" feature. Valid letters are A–Z only; all input is auto-uppercased before storage. Cells can also carry directional space and hyphen markers (see FR-16–FR-18), which are metadata and do not affect cell content or correctness checking.
- **FR-13**: Clue text is entered in a side panel, organized by Across and Down, auto-ordered by current numbering.
- **FR-14**: The grid and side panel are linked: clicking a clue highlights the corresponding word in the grid; clicking a grid cell scrolls the corresponding clue into view in the panel. At a cell that is part of both an across and a down word, the clue matching the current direction is scrolled into view.
- **FR-15**: Puzzle metadata includes a title and author name.

#### Space & Hyphen Markers

- **FR-16**: In Fill mode, the toolbar provides four marker buttons: "Space Right", "Space Bottom", "Hyphen Right", and "Hyphen Bottom". Clicking a marker button toggles that marker on the currently selected cell — applying it if absent, removing it if present.
- **FR-17**: A cell can have at most one marker per direction. Within the horizontal direction, a cell can have either "Space Right" or "Hyphen Right" but not both — applying one replaces the other. Similarly for the vertical direction: "Space Bottom" or "Hyphen Bottom" but not both. A cell can have both a horizontal marker and a vertical marker simultaneously (e.g., "Space Right" and "Hyphen Bottom" on an intersection cell).
- **FR-18**: Markers are metadata on cells, not cell content. They do not affect correctness checking, which remains purely per-cell letter matching. Markers indicate word-internal boundaries: a space marker indicates a word break within a continuous sequence of cells, and a hyphen marker indicates a hyphenated compound. In the Builder, markers are visible on the grid cells as visual indicators. Markers are independent of the word-chain structure (see FR-19–FR-24) — neither automatically creates or modifies the other.

#### Multi-Word Clue Chains

- **FR-19**: Words can be joined into chains via a "next word" link. Each word can point to at most one "next word" and can be pointed to by at most one other word, forming singly-linked lists (no branching, no cycles). Mixed-direction chains are allowed (e.g., an Across word linked to a Down word).
- **FR-20**: The Builder provides a "join" action: the user selects a source word and then a target word to set `source.nextWord = target`. The join is valid only if: (a) the source word does not already have a `nextWord`, and (b) the target word is not already pointed to by any other word. If the target word has a non-empty clue, that clue is displaced to the displaced-clues bin (per FR-26/FR-27 rules).
- **FR-21**: The Builder provides an "unjoin" action: removing the `nextWord` link from a word. When a word is unlinked, the formerly linked word becomes an independent word with an empty clue slot. Any displaced clue for that word (if any) remains in the displaced-clues bin for manual reattachment.
- **FR-22**: In the Builder's clue panel, the first word in a chain shows its editable clue text. Each subsequent word in the chain shows a non-editable reference: "→ See [number] [direction]" (e.g., "→ See 3 Across"), where the reference points to the first word in the chain. This reference updates automatically when numbering changes.
- **FR-23**: When a grid change in Design mode destroys a word that is part of a chain, the chain breaks at that point: any `nextWord` link from the preceding word (if any) is removed, and any words that followed the destroyed word become independent words with empty clue slots. If the destroyed word was the first in its chain and had a real (non-"See") clue, that clue is displaced per normal rules (FR-26). If the destroyed word was not the first in its chain (it had a "See" reference), no displacement occurs since it had no independent clue text.
- **FR-24**: Shortening or lengthening a word that is part of a chain (without destroying it) follows the same rules as FR-26 for the word itself. The chain structure is not affected by word shortening or lengthening as long as the word's starting position remains the same.

#### Clue-Grid Interaction (Word-Attachment Model)

- **FR-25**: Each clue is attached to a word object identified by its starting cell position and direction (across = left-to-right, down = top-to-bottom). Numbering is a display layer recalculated on every grid change.
- **FR-26**: When the grid changes in Design mode, words are matched before and after the change by their starting cell position and direction. If a word's starting cell no longer starts a word of that direction, the word is considered destroyed:
  - If a word is unchanged: the clue stays attached, renumbered.
  - If a word is shortened (starting cell unchanged, ending cell moved): the answer is truncated from the end (cells beyond the new end are no longer part of this word; their letters are not changed), the clue text is preserved, and the builder is shown a non-blocking transient notification (toast) indicating which word was shortened.
  - If a word is lengthened (starting cell unchanged, ending cell extended): the newly included cells become part of the word, retaining whatever letters they currently hold (which may be empty).
  - If a word is destroyed (starting cell changed, or word split/shrunk to <2 letters): the clue goes into a "displaced clues" bin if the clue text is non-empty. If the clue text is empty, no displaced entry is created — the word simply vanishes.
  - If a new word appears: a blank clue slot is created.
- **FR-27**: Displaced clues are visible in a separate section of the side panel, color-coded, and reattachable to new words. Each displaced clue has a delete button (×) to permanently remove it. Reattach mode is only available in Fill mode. To reattach: click the displaced clue to enter a temporary "reattach mode." In this mode, the next click on a word in the grid assigns the clue to that word, overriding normal Fill mode click behavior. After assignment, the Builder returns to normal Fill mode. A displaced clue can be reattached to any word regardless of the original direction (the `direction` field in the displaced clue is for display and filtering, not enforcement). Reattachment is blocked if the target word already has non-empty clue text — the user is shown a message that the word already has a clue. Pressing Escape cancels reattach mode. Switching to Design mode cancels any active reattach mode. Clicking a black cell, an isolated white cell, or any element that is not a word also cancels reattach mode.

#### Validation

- **FR-28**: Every white cell must be part of at most one across word and at most one down word. (This is a structural invariant of the grid model — words are maximal contiguous runs of white cells — and is always true by construction. It is stated here for clarity and for validation on import.)
- **FR-29**: One-letter words are logically impossible (the minimum effective word length is 2). Isolated white cells (not part of any word) can exist in Design mode but are not selectable in Fill mode for typing.
- **FR-30**: Every word must have a non-empty clue before the puzzle can be exported as a complete puzzle, with one exception: words that are not the first word in a chain (i.e., words pointed to by another word's `nextWord` link) do not require their own clue — they display "See [reference]" in the Player. This is a hard block on export, not a warning.
- **FR-31**: Incomplete puzzles can be exported without all clues filled in.

#### Persistence and Export

- **FR-32**: On entering Builder mode, the latest work is automatically loaded from localStorage. The builder always has a "current puzzle" in progress.
- **FR-33**: The Builder auto-saves to localStorage during work.
- **FR-34**: The "Save" action exports an incomplete puzzle as a JSON file (for resumption later). This action is always available regardless of puzzle completeness.
- **FR-35**: The "Export" action exports a complete puzzle as a JSON file (for the Player to load). This is blocked if any word lacks a non-empty clue (unless it is a non-first word in a chain, per FR-30) or if any white cell has no letter.
- **FR-36**: The incomplete export format includes builder state: grid layout, grid size, words with cell positions, clue text, and nextWord references, displaced clues, title, and author. (Letter data is stored in the grid cells, not duplicated in word objects.)
- **FR-37**: The complete export format is a clean, validated subset containing only what the Player needs: grid layout, grid size, words with cell positions, clue text, and nextWord references, title, and author. (Letters are derived from the grid cells.) No displaced clues or partial state.
- **FR-38**: The Builder can import an incomplete or complete puzzle JSON. Importing a complete puzzle makes it editable as an incomplete puzzle (since the incomplete schema is a superset). Importing replaces the current puzzle (what is on screen and what is in localStorage). If the current puzzle has any content (letters or clue text), a confirmation dialog is shown before the import proceeds.
- **FR-39**: The Builder can reset to initial state: 15×15 all-white grid, no answers, no clues, no metadata, clears localStorage for that puzzle, and generates a new random unique key. No finer-grained reset.
- **FR-40**: Multiple puzzles are handled via export/import of incomplete JSON files — there is no in-app puzzle manager.
- **FR-41**: Import and export must work without violating cross-site scripting restrictions (CSP, etc.).

### 3.3 Player

#### Loading and Identity

- **FR-42**: The Player imports a completed puzzle JSON via a file picker. The imported file is validated against the complete format schema: it must have a recognized `version` field, the required fields (`type`, `key`, `gridSize`, `grid`, `words`, `title`, `author`), all white cells must have a letter, and all words must have non-empty clue text (or be a non-first word in a chain, displayed as "See [reference]"). Structural validation is also performed: grid dimensions must match `gridSize`, word start positions must be within grid bounds, word lengths must be ≥2, each white cell must be part of at most one across word and at most one down word (FR-28), letter values must be single A–Z characters, `nextWord` references (if present) must point to valid words (forming valid chains without cycles or branching), and cell marker fields must be valid. Files that fail validation are rejected with a simple error message.
- **FR-43**: Each puzzle is assigned a random unique key at creation time. This key is used for localStorage progress tracking. When a puzzle file is imported, the key travels with it, so progress can be recovered regardless of file renaming or re-downloading. The Builder stores its current puzzle under the key `builder-current`. The Player stores progress under the key `player-<uniqueKey>`.
- **FR-44**: If an imported puzzle matches an existing localStorage entry, the player's previous progress is recovered.
- **FR-45**: The Player displays the puzzle's title and author name.

#### Grid Navigation and Typing

- **FR-46**: Clicking a white cell selects it. When clicking an unselected intersection cell (part of both an across and a down word), the default direction is across.
- **FR-47**: Typing a letter (A–Z only, auto-uppercased) fills the selected cell and advances the cursor to the next cell in the current direction. If there is no next cell in the current direction (end of word or edge of grid), the cursor stays in the current cell.
- **FR-48**: Clicking an already-selected cell that is part of both an across and a down word toggles the current direction between across and down.
- **FR-49**: Clicking a cell that is part of only one word selects that word's direction.
- **FR-50**: Arrow keys move the selected cell.
- **FR-51**: Backspace deletes the letter in the current cell and moves the cursor backward in the current direction. If there is no previous cell in the current direction (beginning of word or edge of grid), the cursor stays in the current cell and the letter is still deleted.
- **FR-52**: There is no Tab-to-next-word navigation — navigation is by cell only.
- **FR-53**: Two visual selection states: the selected cell is highlighted in yellow; the cells of the currently selected word are highlighted in a lighter yellow.
- **FR-54**: Clue numbers are visible in the grid cells (like a real crossword).
- **FR-55**: Space and hyphen markers are rendered on grid cells in the Player. "Space" markers render as a thin vertical bar at the cell's right edge (for "space right") or a thin horizontal bar at the cell's bottom edge (for "space bottom"). "Hyphen" markers render as a small hyphen symbol at the cell's right edge (for "hyphen right") or bottom edge (for "hyphen bottom"). Markers are purely visual — they do not affect typing, navigation, or correctness checking.

#### Clue Display

- **FR-56**: A side panel lists Across and Down clues, similar to the Builder. For words that are not the first in a chain, the clue text displayed is "See [first-word-number] [direction]" (e.g., "See 3 Across") instead of an independent clue.
- **FR-57**: The currently selected clue appears above and below the grid.
- **FR-58**: The selected clue in the side panel is highlighted.

#### Answer Checking

- **FR-59**: A "Check" button evaluates the player's current grid against the correct answers, producing one of four results:
  1. Complete and correct
  2. Incomplete, but everything filled in so far is correct
  3. Complete, but incorrect
  4. Incomplete, and some filled answers are wrong
- **FR-60**: If the result is not "complete and correct", the player is offered a "clear errors" option that removes only letters in cells that differ from the correct answer. Empty cells are left untouched. The clearing is silent — no flash or animation.
- **FR-61**: There is no instant feedback (no color changes on typing). No hints. No reveal functionality.
- **FR-62**: Completing the puzzle correctly is indicated by the "complete and correct" check result. There is no special congratulatory UI.

#### Reset and Persistence

- **FR-63**: The Player can reset all progress on a puzzle — clearing all entered letters and the localStorage entry for that puzzle.
- **FR-64**: Progress is auto-saved to localStorage during play.
- **FR-65**: Only puzzles created by the Builder are supported — no external formats (e.g., .puz).

## 4. Non-Functional Requirements

### Performance

- **NFR-01**: Grid rendering and cell selection must feel instant — no perceptible lag on typing or clicking for grids up to at least 25×25 (625 cells).

### Compatibility

- **NFR-02**: Modern browsers only (latest 2 versions of Chrome, Firefox, Safari, Edge).
- **NFR-03**: Desktop-focused; mobile/responsive is not a current requirement but the tech stack should not make it difficult to add later.

### Accessibility

- **NFR-04**: Not a current requirement, but the architecture should not work against it.

### Maintainability

- **NFR-05**: The codebase should be approachable for a developer new to web development — straightforward architecture, no over-engineering.

## 5. Data Format

### Source of Truth

The grid cells are the source of truth for all letter data. Each cell holds one letter or is empty. Word answer strings in the JSON format are derived from cell contents at export time — they are never stored independently. This eliminates intersection consistency issues (a cell can only hold one letter, so across and down words sharing that cell always agree). Cells may also carry directional space and hyphen markers, which are metadata about word-internal boundaries (spaces, hyphens) and do not affect cell content or correctness checking.

### Incomplete Puzzle JSON (Builder save format)

Contains builder-internal state:
- `version`: integer, format version number (initially `1`)
- `key`: string, random unique identifier for localStorage tracking
- `type`: `"incomplete"`, format discriminator
- `gridSize`: integer, N (the grid is NxN)
- `grid`: 2D array of cells, each cell is an object `{ black: boolean, letter: string | null, spaceRight: boolean, spaceBottom: boolean, hyphenRight: boolean, hyphenBottom: boolean }` (letter is a single uppercase A–Z character, or null for empty; marker fields default to `false` if absent on import)
- `words`: array of word objects, each with:
  - `startRow`: integer, row index of the starting cell (0-based)
  - `startCol`: integer, column index of the starting cell (0-based)
  - `direction`: `"across"` or `"down"`
  - `clue`: string (may be empty)
  - `nextWord`: `null` or an object `{ startRow: integer, startCol: integer, direction: string }` referencing the next word in the chain. If `null` or absent, the word is not chained.
- `displacedClues`: array of clue objects that lost their word, each with:
  - `clue`: string
  - `direction`: `"across"` or `"down"`
- `title`: string
- `author`: string

### Complete Puzzle JSON (Player format)

A clean, validated subset:
- `version`: integer, format version number (initially `1`)
- `key`: string, random unique identifier (same key from creation)
- `type`: `"complete"`, format discriminator
- `gridSize`: integer, N (the grid is NxN)
- `grid`: 2D array of cells, each cell is an object `{ black: boolean, letter: string, spaceRight: boolean, spaceBottom: boolean, hyphenRight: boolean, hyphenBottom: boolean }` (letter is a single uppercase A–Z character; all white cells have a letter; marker fields default to `false` if absent on import)
- `words`: array of word objects, each with:
  - `startRow`: integer, row index of the starting cell (0-based)
  - `startCol`: integer, column index of the starting cell (0-based)
  - `direction`: `"across"` or `"down"`
  - `clue`: string (non-empty for the first word in a chain; for non-first chain words, this is `"See [number] [direction]"`, e.g., `"See 3 Across"`)
  - `nextWord`: `null` or an object `{ startRow: integer, startCol: integer, direction: string }` referencing the next word in the chain. If `null` or absent, the word is not chained.
- `title`: string
- `author`: string

The complete format is derived from the incomplete format by validation (all first-in-chain words have non-empty clues, all white cells valid, all `nextWord` references resolve to valid words forming valid chains) and stripping of builder-only state (displaced clues, partial answers, etc.). Since the incomplete format is a superset, importing a complete puzzle into the Builder makes it editable as an incomplete puzzle.

### Puzzle Identity

Each puzzle is assigned a random unique key at creation time by the Builder. This key is stored in both incomplete and complete JSON formats and used as the localStorage key for progress tracking. This ensures that if a player re-imports the same puzzle file, their progress is recovered regardless of file renaming or re-downloading.

### Player Progress Format

The Player stores progress in localStorage under the key `player-<uniqueKey>`. The progress format is:
- `key`: string, the puzzle's unique key (for verification on load)
- `gridSize`: integer, N (for validation on load)
- `letters`: 2D array (same dimensions as the grid), each element is a single uppercase A–Z character or `null` for empty cells

This format stores only the player's entered letters. The puzzle's answer grid, clues, and structure are loaded from the imported JSON file, not from progress storage.

### Version Handling

On import, if the `version` field is not recognized, the app rejects the file with a simple error message. The current version is `1`. This establishes a pattern for future format evolution: newer app versions can support older versions, but older app versions will cleanly reject newer formats.

## 6. Tech Stack

- **Framework**: Svelte
- **Language**: TypeScript
- **Build tool**: Vite
- **Output**: Static HTML/CSS/JS, deployable via any static host
- **Rationale**: Lightweight output, natural reactivity model for state-heavy grid interactions, component composability for shared grid across Builder/Player, approachable for a new web developer, easy path to future mobile support.

## 7. Constraints & Assumptions

- **No backend or server.** All state is client-side (localStorage + file import/export).
- **Grid cells are the source of truth for letter data.** Word answer strings are derived from cell contents at export time, never stored independently.
- **Cell markers are metadata, not content.** Space and hyphen markers do not affect cell letters or correctness checking.
- **Word chains are singly-linked lists.** Each word points to at most one next word and is pointed to by at most one word. No branching, no cycles.
- **Minimal infrastructure.** Deployable as a static site.
- **Desktop-focused.** Mobile support is a future possibility, not a current requirement.
- **Single-page application.** Landing page → Builder or Player.
- **Functional first, styled later.** CSS is fully separable from logic in Svelte; visual polish is deferred.
- **Happy path first.** Error handling should prevent data loss and invalid state, but polished error messages are deferred.
- **No external puzzle formats.** Only the app's own JSON format is supported.
- **No undo/redo** in the Builder at this time. Can be added later.
- **No rotational symmetry enforcement.** Can be added later.

## 8. Out of Scope

- Backend, server, database, or API
- User accounts or authentication
- Sharing puzzles via URL or any mechanism other than file transfer
- Importing external formats (.puz, Across Lite, etc.)
- Play-test mode from the Builder
- Timer or timed puzzles
- Hints or reveal functionality in the Player
- Instant feedback on cell correctness in the Player
- Congratulatory animation or message on puzzle completion
- Undo/redo in the Builder
- Mobile/responsive layout
- Accessibility (screen readers, keyboard-only navigation) beyond basic structural markup
- Puzzle difficulty ratings or notes
- Multiple-puzzle library UI (beyond key-based localStorage recovery)
- Finer-grained reset beyond "reset to initial state"