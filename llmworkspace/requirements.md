# angryphrase — Crossword Builder & Player: Requirements Document

> Status: Draft for architectural design. This document describes the *behaviour* the system must exhibit. It is deliberately unopinionated about technical implementation, with one exception: the technology stack is pinned (see §6, Constraints). The document is intended to be usable by an architect/designer who has no access to any prior implementation.

---

## 1. Project Overview

`angryphrase` is a client-side web application for **building and solving cryptic-style crossword puzzles**. It supports the conventions needed for cryptic crosswords that other crossword tools often omit: multi-word answers separated by spaces or hyphens, and "chained" clues where one clue references another ("See 5 Across"). The application has two top-level experiences — a **Builder** for authoring puzzles and a **Player** for solving them — linked solely by puzzle files exported as JSON. The application runs entirely in the browser, persists state in `localStorage`, and is deployed as a single self-contained HTML file to a static host.

---

## 2. Stakeholders & Users

| Actor | Interaction |
|---|---|
| **Puzzle builder** | Authors puzzles using the Builder experience: designs the grid, fills answers, adds clues, joins clues into chains, and exports puzzle files. |
| **Puzzle solver** | Solves puzzles in the Player experience by importing a puzzle file, entering letters, checking answers, and using an anagram helper. |
| **Maintainer** | Deploys the built single-file HTML to a static host (GitHub Pages) via CI. |

There are **no accounts, no backend, and no multi-user collaboration**. Both roles are served by the same single-user, in-browser application.

---

## 3. Functional Requirements

The grid model and several interaction rules are shared between the Builder and the Player. Shared rules are defined once in §3.2–§3.4 and §3.24–§3.27 and referenced where needed.

### 3.1 Landing & Navigation

- **FR-1.** The application shall present a landing screen with two actions: **Build** and **Play**. On application load the landing screen is always shown; the choice of Build/Play is not persisted across sessions.
- **FR-2.** Selecting **Build** shall enter the Builder experience. Selecting **Play** shall enter the Player experience. The two experiences are independent; navigating between them is only via the landing screen, and there is no in-app data handoff from the Builder to the Player (the Player only receives puzzles via imported complete JSON files, per FR-67).

### 3.2 Grid Model & Terminology (shared)

- **FR-3.** A puzzle is an **N×N square grid** of cells, where N is the grid size. The minimum grid size is **2** and the maximum is **25**; the default size for a new puzzle is **15**.
- **FR-4.** Each cell is either **black** or **white**. White cells hold a single letter (A–Z) and an optional set of markers (defined in §3.8). Black cells hold no letter and no markers.
- **FR-5.** A **word** is a maximal contiguous run of **two or more** white cells in either the across (horizontal, left-to-right) or down (vertical, top-to-bottom) direction. A single isolated white cell does **not** constitute a word. Words have a direction (`across` or `down`), a start cell (the topmost/leftmost cell), and a length.
- **FR-6.** **Numbering** shall be assigned by scanning all cells left-to-right, top-to-bottom. A cell receives the next sequential integer if it is the start cell of an across word and/or a down word. Numbers are displayed in the corner of their start cell.
- **FR-7.** The **cursor** is the currently selected cell plus a direction (across or down). At most one cell is selected at a time; it is also valid for no cell to be selected. When a cell is selected, it is always a white cell that is part of at least one word. The **selected word** is the word that contains the selected cell and matches the cursor's direction, **if such a word exists**; the cursor may point in a direction for which no containing word exists (e.g., after an arrow-key direction change per FR-14), in which case the selected word is none.
- **FR-8.** A cell is **selectable** if and only if it is white and part of at least one word (i.e., it has at least one orthogonal white neighbour that together forms a length-≥2 run). Black cells, out-of-bounds cells, and isolated white cells are not selectable.
- **FR-9.** **Clicking a black cell shall do nothing** (no selection change, no side effect).

### 3.3 Cell-Click Selection (shared)

- **FR-10.** Clicking an unselected selectable cell:
  - If the cell is part of exactly one word, the cursor direction becomes that word's direction.
  - If the cell is part of both an across and a down word, the cursor direction defaults to **across**.
- **FR-11.** Clicking the currently selected cell:
  - If the cell is part of both an across and a down word, the cursor direction toggles between across and down.
  - Otherwise, the cursor remains unchanged.

### 3.4 Keyboard Interaction (shared)

- **FR-12.** **Letter keys (A–Z, case-insensitive):** write the uppercase letter into the selected cell (overwriting any existing letter in the active letter field — see §3.14 for which field), then advance the cursor by one cell in the current word's direction. If the next cell is not selectable (e.g., the cursor is at the end of the word, or the next cell is black/out-of-bounds), the cursor **stays** on the current cell; the letter is still written.
- **FR-13.** **Backspace:** if the selected cell currently has a letter, delete that letter and leave the cursor on the same cell. If the selected cell is empty, move the cursor back one cell in the current word's direction and delete that cell's letter. If the cursor cannot retreat (e.g., already at the start of the word), the cursor stays; nothing is deleted.
- **FR-14.** **Arrow keys:** move the cursor one cell in the arrow's direction. If the target cell is not selectable, the cursor **stays in place** but the cursor direction **changes to the arrow's direction**. (Example: pressing Down while in across mode at a cell with no downwards selectable neighbour keeps the cursor in place but switches direction to down.)
- **FR-15.** The Escape key shall cancel any in-progress "join" or "reattach" sub-mode in the Builder (see §3.10, §3.11) and shall close the anagram helper modal in the Player (see §3.23).
- **FR-15a.** Keys other than A–Z, Backspace, the four Arrow keys, and Escape (where specified) are **not interpreted** by the grid and shall not call `preventDefault` (so the browser's default — e.g., Tab focus movement — is unaffected).

### 3.5 Builder — Overview

- **FR-16.** The Builder shall have two primary modes: **Design** (toggle cells black/white) and **Fill** (select cells and type answers). Exactly one is active at a time. The current mode is clearly indicated in the UI (e.g., a Design/Fill toggle control).
- **FR-17.** The Builder mode may optionally be in a **sub-mode** of Fill: **Join** (linking clues into a chain) or **Reattach** (re-homing a displaced clue). These are transient modes entered from Fill and exited back to Fill; they are described in §3.10 and §3.11.
- **FR-18.** The Builder shall persist its entire state to `localStorage` so that a page reload resumes the same puzzle. See §3.18.
- **FR-19.** New puzzle: on starting the Builder with no stored state, the application shall create a blank grid of the default size populated entirely with white empty cells, and assign a unique puzzle key.

### 3.6 Builder — Design Mode

- **FR-20.** In Design mode, clicking a white cell toggles it to black; clicking a black cell toggles it to white. A freshly toggled cell has no letter and no markers (all marker flags false).
- **FR-21.** After each design-mode toggle, the cursor (selected cell) shall be **cleared** (no cell selected).
- **FR-22.** A grid-size control shall allow the builder to change the grid size. Grid size changes are only permitted when the grid is **blank** (defined as: no cell holds a letter, no word has a non-empty clue, and no displaced clues exist). When the grid is not blank, the size control shall be disabled with an explanatory message. New size must be within the bounds in FR-3; changing size shall reset the grid to an all-white empty grid of the new size and clear all word metadata and displaced clues.
- **FR-23.** Whenever the grid structure changes in Design mode (a cell toggles), the application shall re-derive all words from the new grid and **reconcile** them against the previous words per §3.12.

### 3.7 Builder — Fill Mode

- **FR-24.** In Fill mode, the builder enters letters (the **puzzle answer letters**, stored in the white cells' answer-letter field), using the shared keyboard rules (§3.4). The selected cell and selected word are visually highlighted (see CON-4).
- **FR-25.** Fill mode is a prerequisite for the Join and Reattach sub-modes (§3.10, §3.11). When neither sub-mode is active, Fill cell-click and keyboard behaviour mirrors the Player's solving interaction (§3.3, §3.4), except that it edits **answer** letters rather than **player** letters. The marker toolbar (FR-26), and the Join/Reattach sub-modes, are Builder-only additions with no Player equivalent.
- **FR-26.** A **marker toolbar** shall be available in Fill mode for the currently selected cell, allowing the builder to toggle the four markers defined in §3.8. When no cell is selected, the toolbar shall be disabled.

### 3.8 Builder — Markers (Space / Hyphen Separators)

- **FR-27.** Each white cell carries four independent marker flags: `space-right`, `space-bottom`, `hyphen-right`, `hyphen-bottom`. Each flag is a boolean. `space-right` and `hyphen-right` are **mutually exclusive** (toggling one on turns the other off); the same applies to `space-bottom` and `hyphen-bottom`.
- **FR-28.** Markers indicate a separator **after** the cell in the named direction: a space-separator or a hyphen-separator between the current cell and the next cell of a word. Markers are visual (a vertical/horizontal bar for spaces; a hyphen glyph for hyphens) and are used in **length-pattern** display (§3.24).
- **FR-29.** Markers may only be set on white cells. Black cells and out-of-bounds cells cannot have markers. A marker on a cell applies only when that cell is part of a word in the marker's direction (e.g., `space-right` only matters for an across word's display).

### 3.9 Builder — Clues

- **FR-30.** Each word has an associated (possibly empty) **clue** text and an optional **chain link** (defined in §3.10). Clue text is free-form.
- **FR-31.** Only words that are **chain heads** (see §3.10) are editable: a chain head displays a text input for its clue. A non-chain-head word shall **not** be given its own clue; it instead displays the chain reference defined in §3.24 (FR-90). The application shall prevent the builder from adding a clue to a non-head chain word.
- **FR-32.** Clues are listed in a panel with two sections — **Across** and **Down** — each sorted by word number. Clicking a clue in the panel shall navigate the cursor to that word's start cell and set direction to the word's direction (in Fill mode), and focus the typing surface. In Join or Reattach sub-modes, clue clicks have the special behaviours in §3.10 and §3.11. In Design mode, clue clicks navigate as in Fill mode. When a word becomes selected (through grid click, clue click, or keyboard navigation), the corresponding clue entry in the panel shall be scrolled into view if not already visible.

### 3.10 Builder — Chains (Clue Linking)

- **FR-33.** A word may have a **`nextWord` link** pointing to the start cell and direction of another word. A word with no incoming link is a **chain head**. Following `nextWord` links from a head yields the chain. Chains are linear lists (validity rules in §3.10 FR-35 and §3.27 FR-98).
- **FR-34.** **Join sub-mode:** From Fill mode, the builder may initiate a join from a word (the **source**). Initiation enters Join sub-mode, with the source word visually distinguished and an instructional banner directing the builder to click the next word in the clue list (and that Escape cancels). The builder then clicks a target word in the clue panel to complete the join. Clicking the source word itself cancels the join. Escape cancels the join.
- **FR-35.** **Join validity:** a join is permitted only when (a) the source and target are different words; (b) the source does not already have a `nextWord` link; (c) the target is not already pointed to by any other word; (d) both source and target exist. An invalid join shall be rejected; the builder is informed (see §3.25 toasts).
- **FR-36.** **Successful join effect:** the source's `nextWord` is set to the target. If the target had a non-empty clue, that clue is **displaced** into the **Displaced Clues** panel (§3.11). A target with an empty clue produces no displaced clue.
- **FR-37.** **Unjoin:** The builder may remove a word's outgoing `nextWord` link. Effects: the source's `nextWord` is cleared; the formerly-linked (downstream) word — which had been displaying a chain reference — becomes an independent word and gets its clue **reset to empty**. Only the direct link is removed: if A→B→C and A is unjoined, B retains its link to C.
- **FR-38.** **Clear visual affordance** shall be provided to initiate a join from a word and to unlink an existing join (e.g., per-clue "Link next" / "Unlink" controls).

### 3.11 Builder — Displaced Clues

- **FR-39.** A **displaced clue** is a clue text that has been detached from its word (most commonly as a side-effect of a join, §3.10 FR-36; also as a side-effect of a word being destroyed in design mode, §3.12). A displaced clue retains its clue text and the direction (across/down) of its original word, but no positional information.
- **FR-40.** The Builder shall display a **Displaced Clues panel** when any displaced clues exist. Each displaced clue shows its direction and clue text, and offers two actions: **reattach** (begin reattach sub-mode for this clue) and **delete** (permanently discard — no confirmation required).
- **FR-41.** **Reattach sub-mode:** triggered from the Displaced Clues panel. The builder clicks a target word **in the clue list** (not the grid) to rehome the displaced clue. Escape cancels. The banner/instructions during reattach shall clearly direct the builder to the **clue list**, not the grid.
- **FR-42.** **Reattach validity:** the target word must exist, must currently have an **empty** clue, and must be a **chain head** (or a standalone word, which is also a chain head). Reattach is blocked (with a toast) if the target already has a non-empty clue or if the target is a non-head chain word — non-head chain words cannot be given clues (per FR-31). The displaced clue's direction **need not** match the target word's direction.
- **FR-43.** **Successful reattach effect:** the target word's clue is set to the displaced clue's text, and the displaced clue is removed from the panel. (The target was already a chain head per FR-42; it now has a non-empty clue and is editable. The displaced clue's chain membership is not transferred — only the text is moved.)
- **FR-44.** If the displaced clue being reattached is deleted (from the panel) while in reattach sub-mode for that clue, reattach sub-mode shall be cancelled. If a different displaced clue is deleted, the reattach index shall be adjusted accordingly.

### 3.12 Builder — Reconciliation on Grid Change (Design Mode)

When a cell toggles black/white in Design mode, words are re-derived and reconciled with the previous word metadata. The following rules apply:

- **FR-45.** A word that still exists at the same start cell and direction (**surviving word**) **retains** its clue text and its `nextWord` link. If its length changed, it is reported as shortened or lengthened (for toast notification, §3.25).
- **FR-46.** A previously-existing word that no longer exists (**destroyed word**) is removed. If it had a non-empty clue, that clue is **displaced** into the Displaced Clues panel (preserving the clue text and direction).
- **FR-47.** Chain cleanup on destroyed words:
  - Any word whose `nextWord` points to a destroyed word has its `nextWord` cleared.
  - For each destroyed chain word, every surviving **downstream** word reachable from it via `nextWord` (i.e., words that were displaying "See …" references that depended on the destroyed word's chain) has its **clue cleared** (its reference is no longer valid).
- **FR-48.** A newly-appearing word (start cell/direction not previously a word) gets an empty clue and no `nextWord` link.

### 3.13 Builder — Metadata

- **FR-49.** The Builder shall provide editable fields for the puzzle **title** and **author** (free-form text). These are included in exported puzzle files.

### 3.14 Builder — Letter Field Semantics

- **FR-50.** Each white cell stores two distinct letter fields: the **answer letter** (the puzzle's intended letter, edited in the Builder) and the **player letter** (the solver's entered letter, edited in the Player). The Builder edits the answer letter; the Player edits the player letter. Answer and player letters never collide: editing one does not affect the other.
- **FR-51.** Letters are always single uppercase A–Z characters; lowercase input is silently uppercased.

### 3.15 Builder — Confirmation & Destructive Actions

- **FR-52.** All destructive-action confirmations shall use **in-app modal dialogs** (not native browser `confirm` dialogs).
- **FR-53.** **Switching to Design mode** shall require confirmation whenever the current puzzle contains **any** work — defined as: any white cell holds an answer letter, or any word has a non-empty clue, or any chains exist, or any displaced clues exist. If the user cancels, the mode remains unchanged. Switching **to Fill mode** shall never require confirmation.
- **FR-54.** **Importing** a puzzle into the Builder when the current puzzle is not blank shall require confirmation that the existing work will be replaced. If the current puzzle is blank, no confirmation is required.
- **FR-55.** **Resetting** the Builder (discard all work and start a new blank puzzle) shall require confirmation that the action cannot be undone.

### 3.16 Builder — Import & Export

- **FR-56.** The Builder shall import puzzle JSON files (via a file picker; drag-and-drop is also acceptable). Importing replaces all current Builder state (per FR-54). On successful import, the Builder shall automatically switch to **Fill mode** (not Design).
- **FR-57.** The Builder accepts both of the two puzzle JSON formats defined in §3.27. **Incomplete** files (the Builder's own saved format) may be imported; **complete** files (the Player's solvable format) may also be imported into the Builder to allow continued editing. On import, the puzzle adopts the **key** from the imported file (so that player-progress slots are consistent across Builder export and Player import).
- **FR-58.** The **Save** action shall download an **incomplete** puzzle JSON file containing the full current Builder state (grid, words with metadata and chains, displaced clues, title, author, and the puzzle's key). This is the Builder's primary "disk" output and is unaffected by completeness/validity.
- **FR-59.** The **Export Complete** action shall download a **complete** puzzle JSON file, but only if the puzzle passes the **export-completeness check** (§3.17). The complete format has no `displacedClues` field; any displaced clues present in the Builder are simply omitted from the file — they are a Builder-only concept, do not block export, and remain preserved in the Builder's `localStorage` state.
- **FR-60.** Filenames for downloaded files shall encode the puzzle key (e.g., `puzzle-<first-8-chars-of-key>-incomplete.json` / `…-complete.json`).

### 3.17 Builder — Export-Completeness Check

Before a puzzle can be exported as **complete**, the following must all hold:

- **FR-61.** Every white cell has a single uppercase A–Z answer letter (no nulls, no invalid characters).
- **FR-62.** Every **chain-head** word has a non-empty (non-whitespace) clue. Non-head chain words do **not** need their own clue (they display a chain reference).
- **FR-63.** When the check fails, the Builder shall disable the Export Complete action and display all blocking errors (e.g., per-cell/per-word) to the builder. **Displaced clues do not participate in the export-completeness check**: outstanding displaced clues do not block Export Complete. They are a Builder-only concept and are simply omitted from the complete file (per FR-59); they remain in the Builder's `localStorage` state and are not lost from the Builder.

### 3.18 Builder — Persistence

- **FR-64.** The Builder shall autosave its entire state to `localStorage` — including grid, word metadata, displaced clues, title, author, and the current cursor (selected cell + direction). The interaction mode (Design/Fill) and any join/reattach sub-mode need not be persisted byte-for-byte; on restore, the Builder shall resume in the base Design or Fill mode (never re-entering a Join or Reattach sub-mode automatically).
- **FR-65.** Autosave shall be **debounced** so that rapid edits do not hammer `localStorage`; an debounce interval on the order of a few hundred milliseconds is acceptable. On application load, if stored Builder state exists, it shall be restored.
- **FR-66.** A **Reset** action shall clear the stored Builder state from `localStorage` in addition to starting a new blank puzzle. A new unique puzzle key shall be generated on reset and on initial creation.

### 3.19 Player — Overview

- **FR-67.** The Player shall accept a puzzle for solving **only by importing a complete puzzle JSON file** (via file picker; drag-and-drop acceptable). Incomplete puzzle files shall be rejected with a clear error message. There is no direct data handoff from the Builder to the Player within the application; the Player only ever receives a puzzle via this import.
- **FR-68.** On successful import the Player shall display the puzzle's title and (if present) author, the grid, the clue list, the active-clue banner (above and below the grid, per FR-71), and the action controls. If the title is empty, a placeholder such as "Untitled Puzzle" shall be displayed.
- **FR-69.** The Player shall apply any saved progress for the imported puzzle's key (§3.22) to the grid before presenting it.

### 3.20 Player — Solving Interaction

- **FR-70.** The Player uses the shared cell-click selection rules (§3.3) and the shared keyboard rules (§3.4), with the distinction that the Player edits **player letters**, not answer letters.
- **FR-71.** The active clue banner shall display the **selected word's number, direction, length pattern (per §3.24), and display clue** (per §3.24 FR-90). The banner shall be rendered **both above and below the grid** simultaneously. When no word is selected, the banner area shall be blank (reserved space, not collapsed).
- **FR-72.** For correctness (the active clue banner special case): when the selected word is a **chain head**, the banner shows the chain head's actual clue text; when the selected word is a **non-head chain word** (which itself has an empty clue and displays a "See N Direction" reference in the clue list — see §3.24 FR-90), the banner shall show that **same "See N Direction" reference** so that the banner and clue list remain consistent. (I.e., the banner never shows an empty clue for a non-head chain word.)
- **FR-73.** The clue list (Across/Down sections, sorted by number) shall show, for each word: its number, direction, and either its clue text (if a chain head) or its "See N Direction" chain reference (if a non-head chain word). The length pattern (per FR-91) shall be displayed **only for chain-head words**; non-head words show no length pattern (only the "See N Direction" reference). Clicking a clue navigates the cursor to that word (per FR-32).

### 3.21 Player — Check, Clear, Reset

- **FR-74.** A **Check** action shall compare each white cell's player letter to its answer letter and produce one of four result classifications:
  - **complete-correct** — all white cells filled and all correct;
  - **incomplete-correct** — some white cells empty, all filled cells correct;
  - **complete-incorrect** — all white cells filled, some incorrect;
  - **incomplete-incorrect** — some white cells empty, some filled cells incorrect.
  Black cells are ignored. The result, plus the specific cells that are incorrect or empty, shall be used for display.
- **FR-75.** The Check result shall be displayed with a distinct message and colour per classification. For classifications that include incorrect cells, a **Clear Errors** action shall be offered; activating it shall set the player letter to null on every currently-incorrect cell (correct and empty cells untouched). The original grid is not mutated; clearing produces a new grid.
- **FR-76.** The Check result shall be **cleared** (reset to "no result displayed") whenever the grid changes (the player types, deletes, resets, etc.).
- **FR-77.** A **Reset** action shall clear all player letters to null (answer letters intact), clear the cursor, and remove any saved progress for this puzzle's key from `localStorage`. Reset shall require in-app modal confirmation.

### 3.22 Player — Import New & Persistence

- **FR-78.** An **Import New Puzzle** action shall discard the current puzzle and return to the import screen (saving nothing extra; autosaved progress is retained in `localStorage`). It shall also clear the import error state and the cursor.
- **FR-79.** Player progress (the grid of player letters) shall be autosaved to `localStorage`, keyed by the puzzle's key, with debounce on the order of a few hundred milliseconds. A `gridSize` is stored alongside the letters.
- **FR-80.** On import, saved progress is applied **only** if the saved `gridSize` matches the imported puzzle's `gridSize`. The application shall apply each saved non-null letter at its corresponding cell **only if that cell is white in the imported grid**; saved letters that would target a black cell (e.g., a puzzle re-exported with grid edits but the same key) are silently dropped.

### 3.23 Player — Anagram Helper

- **FR-81.** The Player shall provide an **Anagram Helper** modal for the currently selected word. It is only enabled when a word is selected.
- **FR-82.** The modal shall display a tile row modelling the selected word's cells: positions that already contain a player letter are **fixed** (showing that letter, locked); empty positions are non-fixed. Inter-cell separators from the word's markers (spaces/hyphens — §3.8) shall be rendered between the corresponding tiles.
- **FR-83.** The modal shall accept a text input for the word's letters; input is filtered to A–Z, uppercased, and clamped to the word's length. The modal shall show how many of the expected letters have been entered.
- **FR-84.** The tile row shall display: fixed positions always show their grid letter; non-fixed positions show letters from the input after first "claiming" any fixed letters from the input pool. If the input is incomplete, non-fixed positions that have no source letter are blank.
- **FR-85.** Input validation: the input is considered valid when its length equals the word's length and the input contains every fixed letter at least as many times as it appears among the fixed positions (multiset superset claim). When invalid at full length, a clear error message shall be shown.
- **FR-86.** A **Scramble** action shall be enabled only when the input is valid and the word has at least one non-fixed position. Scramble shall randomly permute (Fisher–Yates or equivalent) the non-fixed letters, leaving fixed positions unchanged.
- **FR-87.** The Anagram Helper is a **scratchpad only**: neither typed input nor scrambled arrangement is written back to the grid. Closing the modal changes nothing on the puzzle.
- **FR-88.** If the **selected word changes** while the Anagram Helper is open — because the player clicks a different cell, clicks a different clue, or navigates with arrow keys to a cell whose word differs from the one the modal was opened for — the modal shall **close**. (The modal does not silently re-derive for a new word; the player must reopen it.) Moving the cursor within the same word does not close the modal.
- **FR-89.** The modal may be closed by an explicit close control, by pressing Escape, or by clicking the modal backdrop.

### 3.24 Chain Display Rules (shared)

- **FR-90.** **Display clue for a word:**
  - If the word is a chain head (no other word points to it), its display clue is its own clue text.
  - If the word is a non-head chain word, its display clue is the text **"See N Direction"** where N is the chain **head's** number and Direction is the head's direction (Across/Down).
- **FR-91.** **Length pattern for a word** (used in the clue list and the active-clue banner; wrapped in parentheses in display):
  - If the word **has a `nextWord` link** (i.e., it is a chain head with a link, or a mid-chain non-head with a link), the pattern is the **total length of each word in the chain starting from this word and following `nextWord` to the tail**, joined by a comma with no space (e.g., `4,4,5`). That is, the pattern reflects the **suffix of the chain from this word onward**, not necessarily the whole chain from its head.
  - If the word **has no `nextWord` link** (a standalone word or a chain tail), the pattern is derived from the word's own markers: contiguous cell runs separated by space-markers render as run lengths joined by `", "` (e.g., `4, 4`); runs separated by hyphen-markers render as run lengths joined by `-` (e.g., `4-4`); mixed separators may appear in a single pattern (e.g., `2, 2-3`); a word with no markers renders as its single total length (e.g., `8`).

### 3.25 Toasts (shared)

- **FR-92.** The application shall provide a non-blocking toast notification system for transient messages (e.g., "Word 7 Across was shortened." after a design toggle; "Cannot join these words…"; "This word already has a clue."). Toasts shall auto-dismiss after a few seconds.

### 3.26 Mobile Support

- **FR-93.** The application shall support mobile browsers, including invoking the on-screen keyboard for letter entry without inducing layout zoom, and handling input methods that may deliver characters via composition events or "Unidentified" key events. The typing surface (a hidden input) shall be used to capture mobile soft-keyboard input while remaining visually unobtrusive.

### 3.27 JSON Format & Validation (shared)

- **FR-94.** The puzzle JSON format version is **1**. Both formats include a `version` field equal to 1 and a `type` discriminator (`"incomplete"` or `"complete"`). The parser shall reject files with an unrecognized version or type.
- **FR-95.** Each cell in the JSON is represented by fields: `black` (boolean), `puzzleLetter` (single A–Z string or `null`), and the four marker booleans (`spaceRight`, `spaceBottom`, `hyphenRight`, `hyphenBottom`). The answer-letter field is named `puzzleLetter`; no other field name is accepted for the answer letter (e.g., a `letter` field is not a fallback). The player letter is **never** serialized — it is runtime-only and lives only in `localStorage` progress.
- **FR-96.** Both formats include: `key` (string), `gridSize` (integer), `grid` (2D array of cells), `words` (array of word objects with `startRow`, `startCol`, `direction`, `length`, `number`, `clue`, `nextWord`), `title`, `author`.
- **FR-97.** The **incomplete** format additionally includes `displacedClues` (array of `{ id, clue, direction }`). The **complete** format has no `displacedClues` field.
- **FR-98.** On import, the parser shall validate:
  - Grid dimensions match `gridSize` (square);
  - For **complete** files: every white cell has a single A–Z `puzzleLetter`; every marker field, where present, is a boolean; every chain-head word has a non-empty clue;
  - For **incomplete** files: white-cell letters may be null and clues may be empty; marker fields, where present, must be booleans;
  - For both: word positions are within bounds and `length ≥ 2`; `nextWord` references (where present) point to existing words; the chain structure has no cycles, no branching (no word pointed to by more than one word), and no dangling references; no self-references.
- **FR-98a.** Word **numbers** are always re-derived from the grid per FR-6 on load; the `number` field carried in the file is not trusted (it is treated as redundant/cached and may be overwritten by the derived value). Likewise, word **lengths** are treated as derivable from the grid but are read from the file for validation cross-check.
- **FR-99.** The parser/validator shall, where reasonable, **normalize** the input by filling in default values (e.g., missing marker booleans default to `false`; the player letter is always initialized to `null` on import). The parser shall produce a clear, single error message listing the validation failures on rejection.

### 3.28 Deployment

- **FR-100.** The application shall build to a **single self-contained HTML file** (with all JS, CSS, and the favicon inlined) suitable for static hosting. It shall be deployable to a static host (GitHub Pages) via CI on push to the default branch, running lint, type-check, unit tests, and the production build before deploying.

---

## 4. Non-Functional Requirements

### Performance

- **NFR-1.** UI interactions (typing, cursor movement, cell toggles, clue edits) shall respond with no perceptible lag — under 100 ms for any incremental edit on a grid sized at the maximum (25×25).
- **NFR-2.** Autosave writes to `localStorage` shall be debounced (per FR-65, FR-79) to avoid blocking the UI thread during rapid typing.
- **NFR-3.** Initial application load and load-with-restored-state shall complete in well under one second on a reasonable device/network; the deployed file is a single HTML file with no external runtime dependencies.

### Correctness / Determinism

- **NFR-4.** All "pure" logic — word derivation, numbering, chain validation, check/clear, chain display, length-pattern derivation, reconciliation — shall be exercised by automated unit tests; the application shall ship a passing test suite as part of CI.
- **NFR-5.** Core state transitions (Builder interaction mode including Design/Fill/Join/Reattach; Player interaction state) shall be well-defined and deterministic: from any given state, every user action has a single, specified outcome, and transitions that are not meaningful for the current state shall be prevented by the UI (i.e., illegal transitions are impossible to reach from the UI).

### Security / Privacy

- **NFR-6.** No user data ever leaves the browser. There is no analytics, telemetry, or third-party loading. `localStorage` is the only persistence.
- **NFR-7.** Imported puzzle JSON is treated as untrusted input; parsing and validation shall not `eval` or otherwise execute embedded content.

### Availability / Robustness

- **NFR-8.** The application is offline-capable once loaded (single-file build, no runtime fetches).
- **NFR-9.** Corrupt or missing `localStorage` state on load shall degrade gracefully (e.g., start a fresh blank puzzle in the Builder; ignore corrupt progress in the Player) without crashing.
- **NFR-10.** An unparseable or invalid puzzle file import shall produce a clear user-facing error and change no application state.

### Compatibility

- **NFR-11.** The application shall target modern evergreen desktop browsers and modern mobile browsers (Safari iOS, Chrome Android). Specific accommodations for mobile soft-keyboard input are required (FR-93).

### Observability

- **NFR-12.** User-facing errors (import failures, invalid joins, reattach blocks) shall be surfaced via the toast system (FR-92) rather than silently ignored or failing the console.

---

## 5. Integration Points

- **INT-1. Puzzle JSON files (file system).** The only integration surface with the outside world. The Builder emits incomplete/complete JSON files via download and consumes them via file picker/drag-and-drop. The Player consumes complete JSON files. The format is specified in §3.27.
- **INT-2. `localStorage` (browser).** Two logical stores: Builder state (single key) and per-puzzle player progress (keyed by puzzle key). No server, no sync, no cross-device.
- **INT-3. Hosting (GitHub Pages).** Build output is a single HTML file deployed statically. No server-side runtime.
- **INT-4. CI (GitHub Actions).** On push to the default branch: install, lint, type-check, unit tests, production build, then deploy. The build's "single self-contained HTML file" constraint (FR-100) is a deployment integration requirement, not just a developer preference.

There are **no other external integrations**: no third-party APIs, no auth providers, no puzzle syndicates, no social services.

---

## 6. Constraints & Assumptions

### Constraints

- **CON-1. Technology stack (the single pinned implementation decision):** Svelte 5, TypeScript, Tailwind CSS, Vite. The build output is a single self-contained HTML file via `vite-plugin-singlefile` and an inline-favicon step, deployed to GitHub Pages. The application supports only the JSON format defined in §3.27; no prior, legacy, or foreign puzzle formats are supported.
- **CON-2. No backend, no accounts, no multi-user features** (see Out of Scope, §8).
- **CON-3. Persistence is browser `localStorage` only**; no IndexedDB, no server database.
- **CON-4. Visual look-and-feel is a fixed requirement** (not free for redesign). The application shall use the following visual conventions: a **yellow** background for the selected cell, a **pale yellow** background for cells in the selected word, a **white** background for other white cells, **black** background for black cells, **dark vertical/horizontal bars** on cell edges to render space-markers, **hyphen glyphs** between cells to render hyphen-markers, and **small numbers** in the top-left corner of numbered cells. The general layout shall place the Builder's grid and controls on one side and the clue list on the other; the Player's grid shall have an active-clue banner both above and below it. The architect may refine spacing and typography within the spirit of these conventions.
- **CON-5. Product name is `angryphrase`**; document/window title "Angryphrase — Crossword Puzzle".

### Assumptions

- **ASM-1.** A single user uses the application on a single device/browser profile; state is not shared across devices.
- **ASM-2.** A puzzle's **key** is its identity. Re-importing the same file (with the same key) restores the same player progress; a different key (or a re-keyed copy of the same puzzle content) is a distinct progress slot. Keys are random UUIDs; collisions are negligibly unlikely.
- **ASM-3.** The builder is the source of truth for puzzle content; solvers only consume exported complete files.
- **ASM-4.** A unit-test suite for pure logic is expected (per NFR-4) and should grow during development.

---

## 7. Open Questions & Risks

- **RISK-1. Chain-breaking on grid change is intricate.** The reconciliation rules in §3.12 (displacing clues for destroyed words, clearing downstream chain members' clues, removing links to destroyed words) are subtle and have many edge cases (nested chains, destroyed words in the middle of a chain, destroyed downstream words). Ambiguities here are a high-probability source of bugs. **Mitigation:** exhaustive unit tests; consider a small property-based test over random grid toggles.
- **RISK-2.** The distinction between **answer letters** (Builder) and **player letters** (Player) being stored on the same cell type is straightforward but must be handled consistently on serialization (`playerLetter` is never serialized — see FR-95 — and must always be reinitialized to `null` on import). Cross-contamination is a likely bug source.
- **RISK-3.** The **"Save"** action in the Builder downloads an *incomplete* file (not a localStorage write). This is potentially counter-intuitive; the label is retained as a fixed requirement (FR-58) but is worth a UX review note.
- **RISK-4.** Mobile soft-keyboard handling (FR-93/NFR-11) is fiddly and browser-specific. Working behaviour across iOS Safari and Android Chrome is a non-trivial acceptance criterion not easily covered by automated tests.
- **RISK-5.** No accessibility improvements are in scope (see §8), but the chosen component structure should not preclude a future a11y pass; e.g., keeping semantic roles where cheap is advisable. This is an open thread, not a blocker.
- **OQ-1.** Whether the **Displaced Clues** panel should be hidden entirely when empty, or always shown as "No displaced clues", is a minor UX choice left to design.
- **OQ-2.** Exact toast duration is left to the architect within "a few seconds" (FR-92).
- **OQ-3.** Whether the Builder's grid-size control is a numeric input or a select is a UX choice; bounds are fixed (min 2, max 25, default 15).
- **OQ-4.** Length pattern for a selected **non-head mid-chain** word in the active-clue banner: per FR-91 this would reflect the suffix of the chain from that word onward. Whether this edge display is desired, or should instead reflect the whole chain from its head (or show no pattern for non-head words), is left open for design review. (Affects only the rare case of selecting a non-head word in the Player; the clue list already shows no pattern for non-heads.)
- **OQ-5.** Whether complete-file validation (FR-98) should additionally reject a non-head chain word that carries a non-empty `clue` field. Currently such a field is ignored in display (the "See N Direction" reference is shown regardless) and the file imports fine; requiring it to be empty would be stricter.
- **OQ-6.** Builder cursor persistence across reload: FR-64 specifies restoring the selected cell + direction. Whether to continue doing so or reset the cursor on reload is a minor UX choice.

---

## 8. Out of Scope

The following are explicitly **out of scope**:

- **No backend server** of any kind; **no accounts, authentication, or user identity.**
- **No multiplayer, no shared editing, no real-time or asynchronous collaboration.**
- **No puzzle marketplace, sharing service, or social features** — sharing happens only by manual file exchange (export/import).
- **No persistence beyond `localStorage`** (no IndexedDB, no cloud sync).
- **No import/export of foreign formats** (no `.puz`, `.xd`, `.jpz`, etc.); only the application's own JSON format (§3.27).
- **No direct Builder→Player path** within the application; the Builder and Player communicate only via exported/imported complete JSON files.
- **No bundled sample puzzles**; puzzles come only from files the user imports.
- **No accessibility improvements** are in scope, though semantic HTML roles may be kept where convenient.
- **No print/PDF export, no timer, no hint system, no reveal-letter action, no undo/redo stack** (autosave + check/reset are the only state-management affordances as specified).
- **No support for any JSON format other than the one defined in §3.27** (no legacy field fallbacks, no foreign-format converters).

---

## Self-Verification Checklist

- [x] Every functional requirement is specific and testable (numbered FR-1…FR-100; NFR-1…NFR-12; CON/INT/RISK/OQ tagged).
- [x] No requirement uses vague terms ("fast", "scalable") without quantification (NFR-1 gives 100 ms; NFR-2/NFR-3 give debounce/load targets; FR-3 fixes grid bounds).
- [x] Contradictions resolved: design-mode guard fires on any work present (FR-53); anagram helper closes on selection change (FR-88); active-clue banner shows "See N Direction" for non-head chain words (FR-72).
- [x] Non-functional requirements addressed (performance, correctness, security, availability, compatibility, observability).
- [x] Edge cases and failure modes explored (corrupt localStorage, invalid puzzle files, invalid joins/reattach, chain-breaking on grid change, mobile IME input, end-of-word typing).
- [x] The document stands on its own: it does not assume the reader has access to any prior implementation. The only fixed implementation decision is the technology stack per §6.