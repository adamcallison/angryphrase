# angryphrase rebuild — clarifying questions

These questions emerged while performing a comprehensive audit of the current `angryphrase` codebase for the rebuild. Some entries also contain a candidate recommendation (marked **Candidate**) for a behaviour that I think may not need preserving. Please answer inline; where I've already recorded an assumption, confirm or correct it.

---

**Q1. Tech stack for the rebuild.**
Should the requirements doc mandate staying on the current stack — Svelte 5 + TypeScript + Tailwind + Vite, with the single-file build (`vite-plugin-singlefile` + a custom inline-favicon plugin) and GitHub Pages deployment? Or is the architect free to recommend alternatives?

_Answer:_
Yes, the tech-stack and deployment setup should be exactly as it currently is.

---

**Q2. Legacy format compat — candidate to drop.**
`src/lib/import-export.ts` (`normalizeCell`) still reads a legacy `letter` field, falling back to it when `puzzleLetter` is absent. Additionally `scripts/convert-old-format.ts` is a one-time converter from an even older external format. The `puzzles/*.json` files in the repo use the old `letter`-field format and are **not bundled or referenced by the running app** — a player must manually import a JSON file.
**Candidate to drop:** in the rebuild, drop the `letter`-field fallback in parsing and remove the converter script. The new format would accept only `puzzleLetter`.

_Agree to drop? Or must the new parser keep reading old `letter`-field files for backward compatibility with existing exported puzzles?_

_Answer:_

Drop these.

---

**Q3. Bundled sample puzzles.**
The shipped app currently has **no in-app sample puzzles** — a player can only solve by importing a JSON file obtained elsewhere. Should the rebuild ship a few built-in sample puzzles selectable from the landing/import screen, or preserve the import-only model?

_Answer:_

No need for this. Import only.

---

**Q4. Builder → Player workflow.**
Today, to play a puzzle you built, you must **export a "complete" JSON and then separately import it into the player**. There is no direct "play this puzzle I just built" path. Should the rebuild add a direct "play current puzzle" action from the builder, or preserve the separate export/import friction?

_Answer:_

Not having a "play the current puzzle" feature is not an explicit requirement, but neither is having it. And we should err on the side of simplicity.

---

**Q5. The chain / join feature (cryptic-specific).**
This is the most complex part of the app. It includes:joining words into chains via `nextWord`##; displaying "See N Direction" for non-head chain members; choosing "Export Complete" requires all chain-head words to have non-empty clues (non-head words don't need their own clues); displacing the join-target's existing non-empty clue into a "Displaced Clues" panel; and a "reattach" sub-mode to rehome displaced clues onto other words. _I am assuming this whole feature is in scope and must be preserved_ as it's core cryptic-crossword functionality.

_Please confirm it stays in scope, and confirm the **displaced-clues reattach workflow** specifically is desired (vs. a simpler rule like "block join if target already has a clue")._

_Answer:_

Yes, it is required core functionality. However (and this goes for everything), the requirements doc should unopinionated regarding the technical implementation (tech stack the only exception)

---

**Q6. Two `ActiveClueDisplay` components in the player.**
`PlayerPage.svelte` renders the active clue banner **both above and below** the grid. Is that deliberate (e.g., for mobile so the clue is always visible), or an artefact worth simplifying to a single display?

_Answer:_

It should be above and below.

---

**Q7. Anagram helper.**
A modal lets the player type all letters of the selected word and scramble the non-fixed (empty) ones, with fixed (already-filled) letters locked in place. _I am assuming it stays in scope._ Confirm, or flag for removal.

_Answer:_

Required.

---

**Q8. Markers (space/hyphen separators — multi-word answers).**
Per-cell `spaceRight / spaceBottom / hyphenRight / hyphenBottom` flags, toggled via a `MarkerToolbar`, produce length patterns like `(4, 4)` or `(4-4)` and visual separators between cells. _I am assuming this stays in scope_ as it's needed for multi-word cryptic answers.

_Confirm, or flag for removal._

_Answer:_

Required.

---

**Q9. Persistence.**
Builder state autosaves to `localStorage` (including UI interaction mode rounded down to design/fill, and cursor), debounced 500ms. Player progress autosaves per-puzzle-key in `localStorage`. Is `localStorage` acceptable for the rebuild, or should the architect consider IndexedDB / a backend / accounts? (If you say nothing, I'll record it as "client-side `localStorage`, no accounts.")

_Answer:_

Yes, clientside localStorage, no accounts or any kind of backend.

---

**Q10. Destructive-action UX — candidate to improve.**
The app uses `window.confirm()` for reset/import-overwrite, and guards switching to design mode **only if clues exist** (but not if the grid has letters). **Candidate:** the rebuild should use proper in-app modal confirmation and make the "switch to design mode" guard consistent (also warning when the grid has unsaved letters, or removing the guard entirely if autosave makes it redundant).

_OK to record that as a requirement (in-app confirmation, consistent design-mode guard) rather than preserve the exact `window.confirm()` behaviour?_

_Answer:_

In app confirmation, consistent design-mode guard.

---

**Q11. Grid size.**
Current bounds: min 2, no max enforced, default 15. Keep these bounds, or impose a sane max (e.g., 25)?

_Answer:_

Ok, let's have a sane max, 25.

---

**Q12. Naming.**
The repo/app is named `angryphrase` and the deployed title is "Angryphrase — Crossword Puzzle". Is the product name settled, or should the doc use a neutral working title?

_Answer:_

Use the current name for now.

---

**Q13. Explicit out-of-scope list.**
My intended "Out of Scope" section: no backend, no accounts, no multiplayer, no real-time collaboration, no puzzle marketplace/sharing beyond file export. Anything to add or remove?

_Answer:_

---