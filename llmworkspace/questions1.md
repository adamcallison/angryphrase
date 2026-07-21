# angryphrase rebuild — clarifying questions (round 1)

Thanks for the round-0 answers. The meta-rule from Q5 (doc is unopinionated re technical implementation except tech stack) is noted and will be applied throughout. This round confirms precise *behaviours* I observed in the current code and flags a few **candidate bugs** I think I found during the audit. Answer inline.

---

## A. Confirming Q4 interpretation

**Q1.** You said a direct "play current puzzle" feature is "not an explicit requirement, but neither is having it; err on the side of simplicity." I'll interpret this as: **do NOT include a direct play-from-builder feature; preserve the current model where the player only receives an exported "complete" JSON file.** Correct?

_Answer:_

I just don't think this should be mentioned in the requirements doc. There are infinitely many things we could mention that are not required. I also want to clarify that the requirements doc should NOT refer to the current system: the requirements doc should be useful for an architect/designer that does not have access to the existing system.

---

## B. Core grid/word/cursor rules (confirm these are intended behaviours, not accidents)

**Q2. Word derivation.** A "word" is a maximal contiguous run of **≥ 2** white cells in the across or down direction. Isolated single white cells (length-1 runs) are **not** words, cannot be selected, and cannot be typed into. Confirm, or should single-letter "words" be supported?

_Answer:_

No single letter words.

**Q3. Numbering.** Standard crossword numbering: scan cells left-to-right, top-to-bottom; a cell gets the next sequential number if it starts an across word and/or a down word. Confirm.

_Answer:_

Confirmed.

**Q4. Cell-click selection behaviour.**
- Clicking an unselected white cell: if the cell is in only one word, direction is set to that word's direction; if it's in both an across and a down word, direction defaults to **across**.
- Clicking the already-selected cell: toggles direction between across/down (if the cell is in both words).
Confirm, or change the default (e.g., preserve current direction when clicking a new cell that's in both).

_Answer:_

Confirmed. Also worth noting that clicking a black cell should do nothing.

**Q5. Arrow-key movement.** Pressing an arrow moves the cursor one cell in that direction; if the target cell is not selectable (black, out of bounds, or not part of any word), the cursor **stays in place but the direction changes to the arrow's direction**. Confirm.

_Answer:_

Confirmed.

**Q6. Letter entry / backspace.**
- Typing a letter writes it to the current cell and advances the cursor one cell in the current word's direction; if the next cell is not selectable, the cursor stays (letter is still written).
- Backspace: if the current cell has a letter, delete it and stay; if the current cell is empty, move back one cell in the current word's direction and delete that cell's letter.
Confirm, or should typing at the end of a word do something different (e.g., wrap, or refuse)?

_Answer:_

If the cursor cannot advance (e.g typing at the end of the word, deleting on an empty cell at the beginning), the cursor stays where it is

**Q7. Design-mode click side-effects.** Toggling a cell black/white in design mode **clears the cursor (no cell selected)** after each toggle. Confirm, or should the cursor be preserved?

_Answer:_

Confirmed.

**Q8. Auto-switch to fill mode on import.** Importing a puzzle into the builder automatically switches the builder to **fill** mode. Confirm desired.

_Answer:_

Confirmed.

---

## C. Design-mode guard semantics (you said "consistent in-app confirmation")

**Q9.** Currently switching **to design mode** only warns if any clue text exists. You said the guard should be "consistent." Which of these is the intended trigger for the confirmation when switching to design mode?
- (a) Warn whenever there is *any* work present — puzzle letters, clues, chains, or displaced clues.
- (b) Warn only when there are clues/chains/displaced clues (the things design-mode toggles can destroy or orphan) — i.e., letters alone don't trigger it because toggling a black cell doesn't lose letters directly.
- (c) Remove the guard entirely (autosave means nothing is lost).
Also: should switching **to fill mode** ever require confirmation? (Currently it never does.)

_Answer:_

(a) always warn.

Never a need to warn when when switching to fill mode

---

## D. Displaced clues & reattach

**Q10. Direction matching on reattach.** A displaced clue carries a direction (across/down) from its original word. Currently reattaching it to a target word does **not** require the directions to match — an across displaced clue can be reattached to a down word. Is that intentional, or should reattach require a matching direction?

_Answer:_

Intentional.

**Q11. Candidate bug — reattach banner text vs. actual behaviour.** In reattach mode the banner says "Click a word in the **grid** to attach this clue," but grid clicks in reattach mode actually just select cells (fill behaviour); the real reattach happens by clicking a word in the **clue list**. So the banner is wrong. Fix = make the banner say "clue list" (matching join mode's banner), **or** make grid clicks actually perform reattach. Which behaviour do you want?

_Answer:_

The behaviour is correct, the banner is wrong.

**Q12. Reattach target must have an empty clue.** Currently reattach is blocked if the target word already has a non-empty clue. Confirm, or allow overwriting?

_Answer:_

Confirmed.

**Q13. Displaced clue deletion.** A displaced clue can be outright deleted (the clue text is discarded). Confirm, or should deletion require confirmation (it loses the clue forever)?

_Answer:_

Confirmed.

---

## E. Chains & export

**Q14. "Export Complete" clue requirement.** Only chain-head words must have non-empty clues to export a complete puzzle; non-head chain words (which display "See N Direction") do not need their own clues. Confirm. (Incomplete/builder-save has no such requirement.)

_Answer:_

Non-head chain words with clues wouldn't make any sense? It should not be possible to add a clue to a non-head chain word.

**Q15. Unjoin behaviour.** Unjoining a word removes its `nextWord` link; the formerly-linked (downstream) word gets its clue reset to empty (it was showing "See N Direction" and becomes an independent word with an empty clue slot). Only the direct link is removed — if A→B→C and you unjoin A, B retains its link to C. Confirm.

_Answer:_

Confirmed.

---

## F. Anagram helper

**Q16. Write-back.** The anagram helper is a **scratchpad only** — scrambled letters are never written back into the grid; closing it changes nothing on the puzzle. Confirm this is intended (vs. a "commit to grid" action).

_Answer:_

Confirmed.

**Q17. Stays open across selection changes.** If the anagram helper is open and the player moves the cursor / selects a different word, the helper **stays open and re-derives its state for the newly selected word** (resetting the typed input and scramble). Confirm, or should it close when the underlying selection changes?

_Answer:_

Change of behaviour: close if selection changes.

---

## G. Candidate bug — ActiveClueDisplay for non-head chain words

**Q18.** In the player, the active-clue banner uses the raw `word.clue` field. For a non-head chain word this field is **empty** (the "See N Direction" text only exists in the clue *list* via `getDisplayClue`). So selecting a non-head chain word in the player shows an **empty clue banner**. The clue list, by contrast, correctly shows "See N Direction." This looks like a bug. Fix = the banner should show the display clue ("See N Direction") for non-head chain words, consistent with the clue list. Agree? (Or is the empty banner intended?)

_Answer:_

Yes, I agree.

---

## H. Naming & file semantics

**Q19. "Save" button.** In the builder, "Save" actually **downloads an "incomplete" JSON file** (it does not write to localStorage — autosave handles that). "Export Complete" downloads a "complete" JSON file (gated by validation). So both are file downloads distinguished by completeness. Is the "Save" label/behaviour intended, or should "Save" be re-labelled (e.g., "Export Incomplete") or repurposed? (The doc will record current behaviour as the requirement unless you say otherwise.)

_Answer:_

"Save" is fine.

**Q20. Key semantics.** A new puzzle gets a random UUID key on creation and on builder reset; importing a file adopts the file's key; player progress is keyed by this key. So re-importing the same file restores the same progress; importing a re-keyed copy of the same puzzle would start fresh. Confirm this is desired.

_Answer:_

No need to record that it should "start fresh". The requirement is for restore based on key.

---

## I. Scope boundaries

**Q21. Mobile support.** The app has explicit mobile-soft-keyboard handling (`HiddenInput.svelte` handles `Unidentified` keys, IME composition, Android auto-zoom prevention). Is mobile browser support an explicit requirement for the rebuild?

_Answer:_

Yes.

**Q22. Accessibility.** The current grid uses `role="grid"`/`gridcell` but cells have click handlers without keyboard handlers (svelte a11y warnings are suppressed). Is improved keyboard/screen-reader accessibility an explicit requirement, or out of scope for the rebuild?

_Answer:_

Out of scope.

**Q23. Visual design.** The current look (yellow selected cell, light-yellow highlighted word, black cells, marker separator bars, hyphens, Tailwind + custom CSS) — is the **visual look-and-feel a requirement** (rebuild must look essentially the same), or is the architect free to redesign the visuals so long as the same information is displayed (numbers, letters, selection, word highlight, markers, hyphens)?

_Answer:_

Current visual design is a requirement.

**Q24. Landing page structure.** Top-level landing with two buttons — **Build** and **Play** — leading to separate builder and player experiences. Confirm this top-level structure stays.

_Answer:_

Confirmed.

---

## J. Additions to out-of-scope

**Q25.** Round-0 Q13 you left blank, so I'll assume the proposed out-of-scope list stands: **no backend, no accounts, no multiplayer, no real-time collaboration, no puzzle marketplace/sharing beyond file export.** Anything to add (e.g., no print/PDF export, no .puz/.xd import-export, no timer, no hint system, no undo/redo beyond what autosave implies)?

_Answer:_

---