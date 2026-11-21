# angryphrase — Display-Concerns Audit

Audit record (not part of the live doc set, per architecture.md §14). Date: 2026-11-19.
Scope: all of `src/` (read in full: `ui/` components, `ui/bindings/viewmodels/`, the three
`state/` trees, `domain/` copy-minting sites, `index.html`, `tailwind.config.ts`,
`app.css`). No code was changed by this audit.

**Context.** The planned rework keeps the same component set and reworks two things:
form-factor fit (responsive layout) and accessibility. This audit inventories every place
where a display concern has leaked away from where a display rework would want it, or is
duplicated across owners so the rework must edit several sites in drift. Findings are
ranked by how directly they block that rework.

**Epistemology.** architecture.md is a map, not a contract (its own §1); it may be cited
for navigation and for *sanctioning* — where the architecture deliberately placed a
display concern below the UI layer, that placement is a design decision to surface, not
a rule violation to fix unilaterally. Every finding states which of the two it is.

**What is already clean (verified, not assumed):**

- The layer seams held. Grep-verified: zero Tailwind class strings in `ui/bindings/`,
  `domain/`, and the three `state/` trees; VMs carry plain display values (`number`,
  `string`, `hilite` union), exactly per architecture.md §9.
- Components render VM strings verbatim and dispatch raw input; no component sanitises
  or re-mints copy. The component contract held.
- The shared-leaf decomposition (one `Grid`, one `TypingSurface`, one `Modal` family of
  VMs, `clueScroll.ts`) means most rework is genuinely local per component.

The harm concentrates in four places: interaction semantics (Class A), layout and style
duplication inside the UI layer (Class B), the copy seam the architecture deliberately
placed deep (Class C), and doc rot in the one section a display rework would read first
(Class D).

---

## Class A — interaction semantics have no home (blocks the a11y goal directly)

These are the sites where display-as-semantics (what a screen reader, a keyboard, or a
focus ring perceives) was never given an owner at all. Ten `svelte-ignore a11y_*`
suppressions exist repo-wide; zero `aria-live`, `tabindex`, `aria-current`,
`aria-selected`, `focus-visible`, or `sr-only` usage exists anywhere.

- **A1 — the crossword surface is invisible to assistive tech.**
  `src/ui/shared/Grid.svelte`: cells are clickable `<div>`s behind the two suppressions;
  no grid/table semantics; letters, word numbers, hilite, cursor, and separators are
  purely visual. The only keyboard surface is `TypingSurface.svelte`'s hidden input —
  unlabelled, `opacity-0 h-1 w-1`, no `aria-label`, so a screen reader announces
  nothing while the user types into the puzzle. The `select-none` on the grid container
  also blocks selecting/copying cell letters. Because `Grid` is already shared, one
  semantic treatment (roles/labels per cell, a described cursor state) fixes both
  experiences — but it is a per-component design task, not a sweep.
  *Resolved 2026-11-20 (Option B — ARIA grid semantics, no restyle; human decision:
  per-cell label phrasing is coordinates + content, no word membership; the hidden
  input's typing path — `preventScroll` focus, no page jumps — was preserved as a hard
  constraint and is untouched by construction, since real focus never enters the
  grid). Inventory: S1 Grid.svelte semantics, S2 the two `svelte-ignore a11y_*`
  suppressions, S3 `select-none` on the container, S4 TypingSurface's unlabelled
  input, S5 the label-copy minting site (VM layer, per the §9 component contract and
  the C3 precedent that the VM layer is the architecture-sanctioned home for display
  copy). Design as implemented: `role="grid"` + `aria-label="Crossword grid"` on the
  container; per-row `role="row"` wrappers via Tailwind `contents` (`display:
  contents`, layout-neutral — the CSS grid was flat, so rows had to be added without
  entering layout); each cell `role="gridcell"` + `aria-label` from a new
  `GridCellVM.label` minted in `deriveGridVM` (grammar: `Row R, column C,` + `letter
  X`/`empty`/`blocked` + applicable `, word N start`, `, space/hyphen after`,
  `, space/hyphen below`, `, selected`); click activation moved to a nested
  `<button type="button" tabindex="-1">` — a native button is click-legal without a
  keydown handler, adds no tab stop, and let both suppressions be deleted;
  TypingSurface gained `aria-label="Crossword typing input"`; `select-none` removed.
  Spec bug caught by the implementer (the deviation mechanism working as intended):
  the Lead's "black cells get no button" was wrong — Builder design mode
  click-to-un-black (`toggle-design-cell`) depends on black-cell clicks, with no DOM
  test to catch the breakage — so the button renders under `!cell.black ||
  allCellsClickable`; behaviour is byte-preserving on every existing path. Two forced
  additions, both accepted: the button also carries the cell's `aria-label`
  (lint requires a label on text-less buttons; inert duplication, never focused) and
  `z-grid-decor` (equal z + later DOM order keeps hyphen decor from stealing
  in-cell clicks). Deliberate behaviour change, examined: the ~10px protruding half
  of a hyphen glyph no longer activates the cell on click (previously bubbled);
  in-cell hit area is fully preserved via the z-fix. Deferral with a named landing
  site: per-keystroke AT announcement of typed letters requires a live region —
  A5's pass, which also owns the known banner double-announce hazard (A5's entry
  names the banner rendered twice). Files: `src/ui/shared/Grid.svelte`,
  `src/ui/shared/TypingSurface.svelte`,
  `src/ui/bindings/viewmodels/gridVM.ts` (+ `label` field, all existing fields and
  their values unchanged), `test/ui/bindings/viewmodels/gridVM.test.ts` (6 new
  cases). Verification: full CI green, re-run by the lead — eslint + madge clean,
  svelte-check 0 errors/0 warnings (the deleted suppressions did not re-fire),
  1368 tests (1362 existing untouched + 6 new), build green; grep walk: zero
  `aria-live`/`sr-only` anywhere (live regions correctly not smuggled in), the two
  A1 suppressions gone (six `svelte-ignore a11y_*` remain repo-wide, owned by A4's
  clue panels and OverlayDialog's backdrop), diff confined to the four specced
  files. No DOM harness (§12), so screen-reader grid reading and click behaviour in
  both modes joined the manual checklist. Leftover from A1: none.*

- **A2 — two hand-rolled modal implementations, drifting in both a11y and form.**
  `src/ui/shared/Modal.svelte` vs `src/ui/player/AnagramModal.svelte`: same concept
  (overlay + backdrop-click cancel + Escape), two owners. Modal has
  `role="dialog" aria-modal aria-labelledby`; AnagramModal has none of these. Modal
  listens for Escape at window level; AnagramModal only on its input's `onkeydown`, so
  Escape with focus on the Scramble/Close buttons does nothing. Neither has a focus
  trap or return-focus (architecture.md §11 admits "No focus trap (a11y out of
  scope)" — the rework makes this in scope). Drift: `z-50` vs `z-40` (a toast overlays
  the anagram modal but not the confirm modal), `max-w-md` vs `max-w-2xl`. Also:
  Modal's `<svelte:window onkeydown>` is mounted unconditionally and dispatches
  `cancel-modal` even when no modal is open — a no-op today, a landmine if
  `cancel-modal` ever gains side effects.
  *Resolved 2026-11-20 (converged on a chrome primitive, not a shared "modal" —
  inventory: S1 `Modal.svelte`, S2 `AnagramModal.svelte`, plus their §11 rows).
  Confirmed during design that the two are NOT one concept: Modal is a blocking
  prompt (dismiss dispatches `cancel-modal` over a pending intent); AnagramModal
  is a tool panel (typed input persists in player state across close/reopen;
  close is non-destructive). What actually drifted was only the overlay chrome,
  so that is what converged: new `ui/shared/OverlayDialog.svelte` owns
  backdrop-click close, `role="dialog" aria-modal aria-labelledby`, Escape while
  open, Tab containment, initial focus, and return-focus; both consumers embed
  it and keep their distinct contracts (spec in architecture.md §11). The
  landmine is dead — the window keydown listener is effect-gated on `open`, so
  no listener exists when no dialog is on screen (verified in the compiled
  bundle, not just in source). AnagramModal's focus-textbox-on-open behaviour
  is preserved via `initialFocusId`; its input-only Escape (dead on
  Scramble/Close focus) and missing dialog semantics are gone. Width remains a
  caller fact (`max-w-md` confirm, `max-w-2xl` anagram) — retained by decision
  as a content fact, recorded in §11. A11y is now in scope: §11's "No focus
  trap (a11y out of scope)" note removed. z-drift half was already closed by
  B3 (both `z-overlay`). Residual, examined and retained: if both dialogs were
  ever open simultaneously, each mounts its own window keydown, so one Escape
  would close both — pre-existing pathology, not a regression, unreachable in
  the current UI. Verification: full CI green (eslint + madge, svelte-check 0
  errors/0 warnings, build), 1362 tests unchanged and untouched, diff confined
  to the three specced files + the §11 doc rows; no DOM harness exists (§12),
  so trap/Escape/return-focus behaviour joins the manual checklist.
  Leftover from A2: none.*
- **A3 — toasts are the app's failure channel and are never announced.**
  `src/ui/shared/ToastHost.svelte`: no `role="status"` / `aria-live="polite"`. Save
  failures, export gate violations, import rejections, and download failures all land
  here (architecture.md §5: "the rejection is explained by the logic layer (a toast…)")
  — every one is invisible to AT users. The four `kind` colours are pure sight.
  *Resolved 2026-11-21 (Option 1 — hidden mirror live region; alternatives presented to
  the human and rejected: marking the visible container live (cruder — announces the
  dismiss buttons, no phrasing control) and a `role="alert"` split for errors
  (interruptive; single polite region chosen). Design discussion with the human first
  examined whether the toast channel itself is the problem; conclusion recorded as
  follow-up F1: transient toasts are acceptable where the failure is *also* encoded in
  visible state (join/export/grid-size/anagram all show their own failure), but the
  autosave-failure toast is a sole-signal missable channel — a channel bug, tracked
  below, not fixed here. This fix makes every toast speak without prejudicing that
  decision, per the audit's own route (leave the copy where it is; handle announcement
  at the live-region site, which no architecture rule forbids). Inventory: S1
  `ToastHost.svelte` (live region), S2 `toastVM.ts` (`announcement` field + kind map),
  S3 `toastVM.test.ts` (2 new cases), S4 `toastFacade.test.ts` (one-line full-shape
  `toEqual` update — authorized mid-task, see below), S5 `toastFacade.ts` (examined,
  unchanged: passthrough). Design as implemented: `deriveToastVM` mints
  `announcement` as kind word + `": "` + message (`Info:`/`Success:`/`Warning:`/
  `Error:` — exhaustive `Record<ToastKind, string>`, a fifth kind fails to compile
  instead of announcing undefined; the prefix is `kind`'s only spoken encoding since
  the visual toast encodes it as colour alone); `ToastHost` renders a
  `sr-only role="status"` sibling of the visual stack — sibling so it is independent of
  toast placement (B5 may rework placement) and contains no interactive elements;
  `role="status"` implies `aria-live="polite"`, not spelled; auto-dismiss removals from
  a status region are silent while insertions announce. VM-layer minting follows the
  A1/C3 precedent (§9: the VM layer is the architecture-sanctioned home for display
  copy). Copy stays where the reducers mint it. Spec bug caught by the implementer (the
  deviation mechanism working again): the Lead's "existing tests must not break" was
  verified against `toastVM.test.ts` only — `toastFacade.test.ts` pins the full VM
  shape with `toEqual`, so the new field necessarily broke it; fixed by adding the one
  expected line, full-shape intent preserved. Verification: full CI green, re-run by the
  lead — lint + madge, svelte-check 0 errors/0 warnings, 1370 tests (1368 existing
  with the one authorized shape-line edit + 2 new), build; grep walk: `aria-live`/
  `role="status"` exist nowhere outside ToastHost, `announcement` confined to
  `toastVM.ts` + ToastHost, `Toast.svelte` and all state/domain modules untouched.
  No DOM harness (§12), so actual screen-reader announcement of a toast joins the
  manual checklist. Accepted limitation, examined: a toast's 3.5 s ttl means a
  screen reader busy speaking something else may queue past the visual dismissal;
  if this bites in practice, the follow-up decision is keeping announcement text in
  the region longer than the visual toast — a state-shape question, not taken now.
  Leftover from A3: F1 (save-failure channel bug) — see Follow-ups.*
- **A4 — clue rows are clickable `<li>`s behind suppressions.**
  `src/ui/builder/BuilderCluePanel.svelte`,
  `src/ui/player/PlayerCluePanel.svelte`: rows have no keyboard activation, no role, no
  `tabindex`. The Builder row compounds it: a text input plus two link-buttons inside a
  click row, wired with manual `stopPropagation` — Tab order and click semantics are
  both hand-managed and both fragile.
- **A5 — status text is visual-only at four more sites.**
  PlayerToolbar's check-result block, `ActiveClueBanner` (note: `PlayerShell.svelte`
  renders the banner twice, above and below the grid — two copies that would
  double-announce the moment the banner becomes a live region), `ImportScreen`'s error
  box, `BuilderToolbar`'s violation list. None announced; several are the only signal
  of a state change.
  *Scope expanded 2026-11-21 at the human's direction: A5 is also the confirmed home
  of grid state-change announcements, deferred from A1. Human screen-reader test of
  the A1 fix (2026-11-21) confirmed the gap: arrow-key cursor moves, typed letters,
  and backspaces change state but announce nothing — the grid is readable when
  browsed to, but silent while being played. A5 must include a grid announcer: a
  visually-hidden `aria-live="polite"` region whose content is the cursor cell's
  label, minted in `gridVM` (pure derivation of existing state, no new state; the
  §9 contract keeps the copy in the VM layer). That one mechanism covers arrows,
  typing (auto-advance moves the cursor), backspace, and cell clicks. Coordination
  requirement this creates: the banner live region and the grid announcer must not
  fight — moving to a new word would otherwise announce clue + cell simultaneously;
  decide the sequencing/phasing here (e.g. cell label announces always, clue text
  announces only on word change), and the banner's double render must be resolved
  before either goes live. Design sketch lives in the A1 resolution entry's
  deferral note. Until A5 lands, grid play is silent to AT users — an accepted,
  recorded state, not an oversight.*
- **A6 — button hygiene.** No `focus-visible` treatment anywhere (keyboard focus relies
  on the UA default ring, which the rework should consciously keep or replace). Six
  buttons lack `type="button"`: BuilderCluePanel "Link next"/"Unlink",
  JoinReattachBanner Cancel ×2, DisplacedCluesPanel "Reattach"/"Delete". Harmless
  today (no form), inconsistent regardless.
- **A7 — landmarks and headings.** `App.svelte` wraps content in `<main>`, and
  `ImportScreen.svelte` renders its own `<main>` inside it — nested main landmarks.
  The Builder route has no heading at all (Player route uses `h2`, Landing uses `p`).
  `FilePicker.svelte`'s `role="region" aria-label="File drop zone"` labels the
  drag-drop surface, not the pick control it contains.

## Class B — form-factor decisions duplicated or drifting (blocks the fit goal directly)

- **B1 — the two-column shell is hand-rolled twice, in drift.**
  `src/ui/builder/BuilderShell.svelte` and `src/ui/player/PlayerShell.svelte` spell the
  same layout (`mx-auto max-w-7xl px-4 py-4 flex flex-col gap-4` + `md:flex-row`
  two-column) with per-shell deviations: the Player right column lacks the `flex-1` the
  Builder one has; the Player left column adds `min-w-0` the Builder one lacks. Every
  breakpoint change edits both files and must reconcile drift first.
- **B2 — the clue-panel shell is copied verbatim.**
  `BuilderCluePanel.svelte` / `PlayerCluePanel.svelte` duplicate the
  `aside`/section/`h2`/`ul` shell, the `liRefs` + `$effect` scroll wiring, and the
  `max-h-[70vh] overflow-y-auto` panel-scroll decision (a form-factor decision with two
  owners). The `{#snippet clueRow}` idiom (architecture.md §9) dedupes *rows within*
  each panel; the shells themselves are two copies.
- **B3 — the style vocabulary has no home at all.**
  `tailwind.config.ts` `theme.extend` is empty; `app.css` has no `@layer components`.
  ~22 button instances each hand-spell class strings with drift: `rounded` vs
  `rounded-md`, `px-3 py-1` vs `px-4 py-1.5` vs `px-6 py-12`, `bg-blue-600` six times.
  Selection/hilite colour is encoded per site: `Grid.svelte`'s `cellColor`
  (`bg-yellow-400`/`bg-yellow-100`), clue-row `bg-yellow-100` in two panels, banner
  `bg-gray-50`; related "in-progress" states use `ring-blue-400` (joinable),
  `ring-amber-400` (reattaching), `bg-amber-50` (reattach banner) — same concept family,
  independently spelled. z-index is magic numbers across four files (`z-50`, `z-40`,
  `z-10`, `-z-50`). A "make them all fit together" rework has no single place to define
  what "together" means.
  *Resolved 2026-11-20 (Option 3, hybrid — tokens + recipes, spec in
  architecture.md §11 "Style vocabulary"). `tailwind.config.ts` `theme.extend`
  owns the named values (z-scale `typing-surface/-50`, `grid-decor/10`,
  `overlay/40`, `toast/50`; colours `primary`/`hilite`/`accent`/`surface`);
  `app.css` `@layer components` owns the repeated compositions (`.btn` base +
  size/colour variants). Inventory walk found 29 button instances (the audit's
  "~22" folded the six inline link-buttons and the four marker buttons rendered
  by one template into its count's blind spot), 10 hilite-family sites, 6
  z-index sites across 4 files — all migrated. Deliberate visual deltas,
  recorded in §11: uniform `rounded-md` + `font-medium`; toolbar buttons
  unified to `.btn-sm`; uniform disabled treatment; `text-sm` gained where
  absent (Modal, FilePicker); Modal backdrop `z-50`→`z-overlay` (40) so the
  toast overlays both modals deterministically — closes the z-drift half of
  A2, though A2's convergence work (semantics, Escape handling, focus)
  remains open. Retained by decision (each single-owner or already
  drift-free): Toast `kindColor` status hues, Header page chrome, FilePicker
  drag-over state, inline link-buttons, text inputs, per-component status
  hues (green/red/purple/amber). Verification: full CI green — build,
  1362 tests unchanged and untouched, eslint + madge, svelte-check 0 errors —
  and grep walk: no old spellings remain outside the retained list.
  Leftover from B3: none.*
- **B4 — grid form-factor constants are inline in the cell template.**
  `Grid.svelte`: the 2.5rem cell (`grid-cols-[repeat(var(--grid-size),minmax(0,2.5rem))]`,
  `w-[min(100%,calc(var(--grid-size)*2.5rem))]`) and the cqi font formulas
  (`text-[calc(30cqi/var(--grid-size))]`). Single-owner (good — one file to edit), but
  the values are unlabelled magic: a form-factor rework wants named, per-breakpoint cell
  sizing, and today the grid also never grows past 2.5rem/cell on large screens.
- **B5 — toast placement is inline per-branch.**
  `ToastHost.svelte` hand-rolls `max-sm:`/`sm:` dual positioning; no `safe-area-inset`
  for notched phones; `fixed top-4 right-4` can overlay the grid on narrow viewports.
  Right owner (one component), but the decision should be re-derived for the rework
  alongside the shells it overlays.

## Class C — user-facing copy has three homes, none of them "display" (friction for aria phrasing and copy structure)

Not a rule violation — the opposite: architecture.md §7/§9 **sanction** deep placement
("the rejection is explained by the logic layer (a toast carrying the domain's
message)"; "user-facing rejection messages come from `ChainAdmission.message`").
Recorded here because the rework lands squarely on this seam: rephrasing for screen
readers, restructuring the import-error list, or any future i18n requires editing
non-display modules and their pinned tests. Changing the placement is an architecture
amendment and a human decision, not a cleanup.

- **C1 — domain mints display strings.** `domain/chain/DisplayClue.ts` interpolates
  "See N Direction" (a presentation affordance, not a clue); `LengthPattern.forWord`
  bakes the display separators `", "` and `"-"` — while the surrounding parentheses are
  spelled independently in three components (`BuilderCluePanel`, `PlayerCluePanel`,
  `ActiveClueBanner`): one visual token, split across two layers and three sites.
  Also `CompletenessCheck.message`, `ChainAdmission.message`, `GridSize.invalidMessage`,
  `Anagram.validateChainInput` reasons.
- **C2 — state reducers mint toast copy.** `reconcileWords.ts` ("Word N Direction was
  shortened/lengthened"), `importExport.ts` (displaced-clue export warning with inline
  pluralisation; the parse-failure list joined with `'\n'` here — the display join format
  is decided in the reducer), `fillMode.ts`, player `lifecycle.ts`
  (`INCOMPLETE_REJECT_MSG` etc.), `app/state/reducer.ts` (save-failure copy).
  `PlayerState.lastImportError` stores the display string **in state**, so
  restructuring how the import screen shows errors (e.g. a list) is a state-shape
  change.
- **C3 — the VM layer also mints copy.** `modalVM.ts` (titles/bodies/labels — the
  correct home by the architecture's own logic), `playerVM.ts` check-result messages,
  `builderVM.ts` violation labels with singular/plural. The contrast between C2 and C3
  is the finding: the same concept (user-facing message) has no single owner, and the
  deepest of its three homes is the one the architecture blessed.

## Class D — the display spec itself has rotted

- **D1 — architecture.md §11 "Visual conventions" disagrees with the code** in exactly
  the section a display rework would read first: doc says selected
  `bg-yellow-400`/`bg-yellow-300`, in-word `bg-yellow-100`/`bg-yellow-50`, banner
  reserved space `min-h-2em`, word numbers `text-[0.6rem]`; code says
  `bg-yellow-400`/`bg-yellow-100`/`bg-white`, `min-h-[3rem]`,
  `text-[calc(30cqi/var(--grid-size))]`. Any rework that trusts the map starts from a
  wrong baseline. Doc edit is the lead's and is cheap; it should land before any
  component work so the new conventions get written down as they are decided.
  *Resolved 2026-11-20: §11 visual-conventions paragraph rewritten against the code
  (grep-verified: `bg-yellow-300`/`bg-yellow-50`/`min-h-2em`/`text-[0.6rem]` matched
  nothing in `src/`; the paragraph now names `bg-white` default, gray-800 separator
  bars, both cqi formulas, 2.5rem pitch, and `min-h-[3rem]`/`bg-gray-50` banner, and
  carries a note that rework conventions amend the paragraph, not per-component
  spellings). Leftover from Class D: none.*

## Class E — minor / examined and retained

- **E1 — constant display flags.** `DisplacedCluesPanelVM.visible: true` (consumed by an
  `{#if vm.visible === true}` that cannot be false) and `ActiveClueBannerVM.visible:
  true`. Dead branches; free removal during any VM-touching rework task.
- **E2 — `TypingSurface` IME/Unidentified normalisation** — correctly owned by the leaf
  display adapter; retained.
- **E3 — `clueScroll.ts`** manual delta scroll: one shared owner, right home; the rework
  may want `prefers-reduced-motion` behaviour — an opportunity, not a leak.
- **E4 — `PlayerToolbar`'s `COLOR_CLASS`** component-local exhaustive map: the
  architecture-sanctioned §9 pattern; retained.
- **E5 — `VersionStamp.svelte`** fixed `bottom-0 right-0` overlay can collide with
  content on small screens; pointer-events-none already, cosmetic only.

---

## Suggested ordering for the rework (advisory)

1. **D1 first** — fix the §11 map, then amend it as conventions are decided, so the
   rework has a truthful baseline and a place to record its decisions.
2. **B3 before any visual change** — a minimal shared vocabulary (button classes,
   hilite colours, z-scale) makes every later edit one-site-per-concept instead of
   ~22-site sweeps.
3. **A2** — converge `Modal` and `AnagramModal` on one shared overlay shape (semantics,
   Escape, z-order, width) while the component set is still small.
4. **A1/A3/A4/A5** — the semantic markup pass, per component, in the order
   Grid → TypingSurface → ToastHost → clue panels → status sites.
5. **B1/B2** — the responsive shell pass once the vocabulary exists.
6. **C — surfaced, not scheduled.** Class C needs a human decision (amend
   architecture.md or accept the friction) before any code moves; the cheapest version
   that unblocks a11y phrasing is leaving the copy *where it is* and handling
   announcement structure at the live-region site, which no current architecture rule
   forbids.

Every finding above names its site(s) in the repo; no site was silently classified.
Nothing in this audit changed code.

---

## Follow-ups (out-of-audit items surfaced during resolutions)

Items the human examined but that are not resolution leftovers of any single finding —
real work with a named landing site, tracked here so they are not lost.

- **F1 — the autosave-failure toast is a sole-signal missable channel (channel bug,
  not an a11y gap).** Surfaced during the A3 design discussion (2026-11-21). The
  toast channel is acceptable where the failure is *also* encoded in visible state
  (join/export-gate/grid-size/anagram all show their own failure; the import
  rejection already has a persistent inline error box on `ImportScreen`), but
  `report-builder-save-failure` / `report-player-save-failure` land only as a
  3.5 s toast: a persistent condition (writes keep failing) signalled by an
  ephemeral, dismissable, missable toast with no state encoding. A user who looks
  away believes their work is saved while it is not — a data-loss risk behind an
  ephemeral signal. The 60 s re-toast latch (architecture.md persistence section)
  is itself a symptom: the condition is continuous, the warning is not. Proper
  fix: a persistent inline banner (e.g. "Saving failed — changes not kept") that
  renders while the condition holds, in place of (or in addition to) the first
  toast; this likely needs an architecture amendment — §5 blesses "the rejection
  is explained by the logic layer (a toast carrying the domain's message)", and
  the save-failure copy is minted in `app/state/reducer.ts` — so it is a human
  decision and a design round of its own (state shape: the failure latch is
  bindings-layer today, not reducer state; a banner the VMs derive needs it as
  state). Not started; no code exists for it. A3's live region announces whatever
  the channel delivers, so it does not preclude this. Landing site: a future
  design round on "save-failure persistence banner", human-initiated.
