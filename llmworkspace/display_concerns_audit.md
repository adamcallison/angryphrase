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
- **A3 — toasts are the app's failure channel and are never announced.**
  `src/ui/shared/ToastHost.svelte`: no `role="status"` / `aria-live="polite"`. Save
  failures, export gate violations, import rejections, and download failures all land
  here (architecture.md §5: "the rejection is explained by the logic layer (a toast…)")
  — every one is invisible to AT users. The four `kind` colours are pure sight.
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
