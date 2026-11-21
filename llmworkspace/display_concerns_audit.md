# angryphrase — Display-Concerns Audit

Audit record (not part of the live doc set, per architecture.md §14). Date: 2026-11-19.

**Referencing rule.** Nothing in `src/`, `test/`, or the live doc set (`architecture.md` and its companions) may reference this audit or its item tags (A1…A7, B1…B5, C1…C3, D1, E1…E5, F1…F4). This file is a historical record — decisions, once made, are restated self-contained where they live: a code comment explains its own rationale, an `architecture.md` row carries its own dates and reasoning. Human instruction, 2026-11-21.

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
  *Resolved 2026-11-21 (Option 3 — full ARIA for the Player list, an honest explicit
  button for the Builder row; alternatives presented to the human and rejected:
  nested pointer-affordance buttons in both panels (cheapest, but leaves panel
  navigation mouse-only) and tabbable row buttons in Player (keyboard parity at the
  cost of ~60 tab stops on a big puzzle). Human decision #2 on record: the Builder
  underlay stays `tabindex="-1"` — pointer affordance; grid arrows are the
  documented keyboard equivalent. Inventory: S1 BuilderCluePanel row + its two
  suppressions, S2 PlayerCluePanel row + its two suppressions, S3 the manual
  `stopPropagation` wiring, S4 Link next/Unlink missing `type="button"` (A6
  ride-along; no `<form>` exists repo-wide, provably inert). Design as implemented —
  the two panels are NOT one concept (the A2 lesson): Player rows are a
  single-select navigation list, so each `<ul>` is `role="listbox"` with its own
  `aria-label`, rows are `role="option"` with `aria-selected` from `highlightedId`
  (NOT `isSelected`, which is the visual chain-hilite and stays that), and the roving
  tab stop is derived with zero component state: selection follows focus —
  arrows/Home/End dispatch `click-clue-panel-word`, the reducer moves the cursor,
  `highlightedId` advances on re-derivation and moves the tab stop, the handler
  refocuses via the existing `liRefs`, so the existing scroll effect serves keyboard
  navigation too; Enter/Space select; navigation never crosses between the Across and
  Down listboxes. Builder rows are editing units, so the row is a plain `<li>` and
  click lives on a full-row `<button type="button" tabindex="-1">` underlay
  (`absolute inset-0` covers padding and flex gaps — hit target byte-preserved;
  content siblings painted above via `relative` + DOM order, no z-index — the A1
  mechanism), named by the new VM-minted `ClueEntryVM.selectLabel` ("Select clue N
  across/down", minted unconditionally in `deriveCluePanelVM` per §9/C3 — no DOM ids
  exist, so `aria-labelledby` is impossible); `stopPropagation` is deleted — sibling
  elements make it structurally unnecessary; Link next/Unlink gained `type="button"`.
  All four suppressions deleted. Deliberate behaviour additions, examined: the Player
  clue list is now keyboard-navigable (arrows/Home/End/Enter/Space) — that is the
  point; Home/End at a boundary dispatches a self-click, which is the same semantics
  as clicking any clue (cursor re-set, check result cleared) and consistent with
  existing click behaviour. Builder: no behaviour change on any path (click targets,
  drafts, input, join/unjoin, scroll byte-identical). Implementer deviations, both
  accepted: Player used `.at()` + `$derived.by` because eslint bans
  `no-non-null-assertion` (the Lead's sketch would not have passed lint) and passed
  the row's own list into the snippet; the Builder pass applied `relative` to two
  nested spans beyond the direct children specced (inert). Files:
  `src/ui/player/PlayerCluePanel.svelte`, `src/ui/builder/BuilderCluePanel.svelte`,
  `src/ui/bindings/viewmodels/cluePanelVM.ts` (+ `selectLabel`; all existing fields
  unchanged), `test/ui/bindings/viewmodels/cluePanelVM.test.ts` (2 new cases).
  Verification: full CI green, re-run by the lead — eslint + madge, svelte-check
  0 errors/0 warnings (the deleted suppressions did not re-fire), 1372 tests
  (1370 existing untouched + 2 new), build; grep walk: four suppressions gone (two
  remain repo-wide — OverlayDialog's backdrop, owned by A2), zero `stopPropagation`
  under `src/ui`, `selectLabel` confined to `cluePanelVM.ts` + its test +
  BuilderCluePanel, diff confined to the four specced files. No DOM harness (§12), so
  screen-reader listbox reading, arrow navigation, and underlay clicks in both
  panels join the manual checklist. Consequence for A5: arrow-walking the Player
  clue list now changes the active word per keypress — when A5's announcer lands, it
  will speak those word changes without further work here. Leftover from A4: none —
  but A6 is now half-closed (its BuilderCluePanel pair rode along as S4; the other
  four type-less buttons live in JoinReattachBanner and DisplacedCluesPanel and
  remain A6's).* Addendum 2026-11-21 (later the same day): this entry's Player-panel
  description — and the "navigation never crosses between the Across and Down
  listboxes" contract — was superseded by the grouped-listbox form (one
  `role="listbox"` over both sections, arrows walking all clues, boundary keys
  `preventDefault`). The human's boundary test showed the two-separate-listboxes
  model left Down rows keyboard-unreachable whenever the active word was Across
  (the single Tab stop sat in whichever list held the active clue), and two
  "single-select" lists sharing one global selection was not honest ARIA. See the
  §11 row and the focus-token round's rig verification for the superseding form.
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
  *Resolved 2026-11-21 (all recommendations confirmed by the human after a design
  round; alternatives presented and rejected: dedupe the banner to one visible copy
  — a visual/placement change that pre-empts the B1/B2 shell round; reuse the full
  `GridCellVM.label` verbatim as the keystroke announcement — ~8 words per
  keystroke, punishing for the app's core loop; a single composed region per screen
  — needs previous-vs-current comparison, and state never records renderings (the
  Focus-section boundary rule); marking the visible check block live directly —
  a region mounting fresh is less reliably announced than one that exists and
  changes content, the exact reason ToastHost used a sibling; `role="alert"` for
  the Builder violations — the list re-derives on every edit, assertive would
  interrupt mid-typing constantly). Inventory: S1 PlayerToolbar check-result
  block, S2 ActiveClueBanner + PlayerShell's double render, S3 ImportScreen
  error box, S4 BuilderToolbar violation list, S5 the grid state-change
  announcer (the A1 deferral's landing site), S6 the banner↔grid sequencing
  requirement. Design as implemented — four VM-minted announcement fields, then
  five always-mounted region insertions: `GridVM.cursorAnnouncement` (compact
  grammar `row R, column C,` + `letter X`/`empty`/`blocked` — deliberately NOT the
  full `label` grammar; minted by reusing the label's existing content clause, one
  clause owner), `ActiveClueBannerVM.announcement` (`N across: clue (pattern)` —
  the number+direction prefix makes it unique per word, so content-identity
  phasing delivers the audit sketch's "clue announces only on word change" with
  zero extra machinery: a live region holding this string is silent while the
  cursor moves within one word), `PlayerCheckResultVM.announcement` (message +
  " (N incorrect)"/" (N empty)" clauses mirroring the visible spans), and
  `BuilderToolbarVM.violationAnnouncement` (summary labels joined "; "). Regions:
  `Grid.svelte` an `sr-only role="status"` sibling after the container, ungated —
  the shared leaf announces cursor moves in both experiences, Builder design
  mode included (deliberate); `PlayerShell.svelte` a single banner mirror as
  first child of the columns row — DOM-order load-bearing, it precedes `Grid`,
  so a word change queues clue speech before cell speech (the sequencing
  decision, resolved structurally rather than by timers); `PlayerToolbar.svelte`
  an always-mounted mirror; `ImportScreen.svelte` `role="alert"` on the existing
  visible box (alerts announce on insertion, no mirror; copy stays in state,
  blessed C2); `BuilderToolbar.svelte` an always-mounted mirror. The banner
  double-announce hazard is closed by construction: speech flows through the one
  PlayerShell mirror, never through the twice-rendered component — both visible
  copies stay, placement deferred to B1/B2. `aria-live` is never spelled anywhere
  (role implies polite, the repo convention since A3). Visual UI byte-identical:
  the whole change is four sr-only divs, one role attribute, one comment.
  Authorized test-shape edits, pre-declared (A3 precedent): four full-shape
  `toEqual` pins in `playerVM.test.ts` (two banner nulls, one shell banner, one
  check-result) each gained exactly one `announcement` line. Implementer notes,
  both accepted: T2 flagged its fixture choice for the no-incorrect-clause test
  (spec named behaviour, not fixture — reasonable); T4 flagged an ambiguous
  "sibling after the {#if}" placement in BuilderToolbar (inside the flex row —
  fine, `sr-only` is absolutely positioned, layout-neutral). Files:
  `src/ui/bindings/viewmodels/gridVM.ts`, `playerVM.ts`, `builderVM.ts`;
  `test/ui/bindings/viewmodels/gridVM.test.ts` (5 new), `playerVM.test.ts`
  (6 new + 4 pin lines), `builderVM.test.ts` (3 new); `src/ui/shared/Grid.svelte`,
  `src/ui/player/PlayerShell.svelte`, `PlayerToolbar.svelte`,
  `ImportScreen.svelte`, `src/ui/builder/BuilderToolbar.svelte`.
  Verification: full CI green, re-run by the lead — eslint + madge,
  svelte-check 0 errors/0 warnings (no new a11y warnings, zero new
  `svelte-ignore`), 1397 tests (1383 existing + 14 new), build green; grep walk:
  `aria-live` appears only in a ToastHost prose comment, status/alert roles
  confined to the six expected files (four new + ToastHost + ImportScreen),
  both new fields confined to VM + consumer + test. No DOM harness (§12), so
  actual screen-reader behaviour — grid play speech, word-change sequencing,
  toast/banner interleaving, the alert on import failure — joins the manual
  checklist. Accepted limitations, examined: identical re-Check result is silent
  (content-identity); re-clicking the same cell is silent (same); a toast
  arriving mid-announcement queues politely behind it. Leftover from A5:
  none — F1 (save-failure channel bug) remains open as its own follow-up,
  untouched by design.*
  *Addendum 2026-11-21: the banner-placement deferral ("the two visible copies stay,
  placement deferred to B1/B2") landed in the B1 round — human decision: both copies
  stay, deliberately; a scrolled phone user typing in the grid's top or bottom half
  always has the nearest copy on screen. Speech remains single through the mirror.
  See B1's resolution.*
- **A6 — button hygiene.** No `focus-visible` treatment anywhere (keyboard focus relies
  on the UA default ring, which the rework should consciously keep or replace). Six
  buttons lack `type="button"`: BuilderCluePanel "Link next"/"Unlink",
  JoinReattachBanner Cancel ×2, DisplacedCluesPanel "Reattach"/"Delete". Harmless
  today (no form), inconsistent regardless.
  *Resolved 2026-11-21 (Option 2 — own the ring in the B3 vocabulary; alternatives
  presented to the human and rejected: keep the UA default and record it — a passive
  decision whose ring varies by browser/OS and may clash with the reworked visual
  language; and a full focus round also taking F2's two deferred interaction-model
  questions — independent behavioural redesigns, F3-harness-gated, not hygiene).
  Human decision on record: ring colour `primary` (blue-600), `:focus-visible` only.
  Inventory reconciliation: the audit named six type-less buttons; two were already
  closed by A4's ride-along (BuilderCluePanel Link next/Unlink), so four remained.
  Sites: S1 `app.css` (the convention's single home — new `.link` recipe plus one
  combined rule `.btn, .link, .focus-ring` applying `focus-visible:outline
  focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-primary`), S2 JoinReattachBanner Cancel ×2 (`type="button"`
  + `.link`), S3 DisplacedCluesPanel Reattach/Delete (same), S4 BuilderCluePanel
  Link next/Unlink (`.link`, type already fixed by A4), S5 Toast dismiss
  (`.focus-ring`), S6 AnagramModal × close + input (`.focus-ring`), S7
  PlayerCluePanel `role="option"` rows (`.focus-ring` — focused programmatically
  during arrow browsing; browsers match `:focus-visible` there after keyboard
  interaction), S8 the text inputs GridSizeControl / BuilderToolbar title / Builder
  author / BuilderCluePanel clue / AnagramModal input (`.focus-ring` appended,
  compositions otherwise retained), S9 TypingSurface's hidden input — deliberately NO
  ring (invisible 1px surface; its focus is never meant to be seen), S10 the
  `tabindex="-1"` pointer affordances (Grid cell buttons, BuilderCluePanel row
  underlay) — deliberately NO ring (never focused). The six inline link-buttons are
  now a recipe (`.link` = `text-xs underline` + ring; site keeps its hue) — this
  supersedes B3's "deliberate non-recipe" note, because adding a repeated focus
  composition to six sites made them recipe-worthy by B3's own rule; §11 amended
  before code, per design-first. No `outline-none` anywhere: explicit author-origin
  outline longhands unconditionally beat the UA `outline: auto` (origin trumps
  shorthand shape in the cascade), so the default ring is replaced, not duplicated.
  Spec bug caught by the implementer (the deviation mechanism working; A3
  precedent): the Lead's dispatch site list omitted BuilderCluePanel's clue input
  while the amended doc named it — the doc is the spec, so the input got
  `.focus-ring`; correct call. Design as implemented — behaviour-preserving on every
  existing path (the `.link` recipe emits identical font-size/underline, verified in
  the emitted CSS); the only visual delta is the new ring. Files: `src/app.css`,
  `src/ui/builder/JoinReattachBanner.svelte`, `DisplacedCluesPanel.svelte`,
  `BuilderCluePanel.svelte`, `GridSizeControl.svelte`, `BuilderToolbar.svelte`,
  `src/ui/player/AnagramModal.svelte`, `PlayerCluePanel.svelte`,
  `src/ui/shared/Toast.svelte`; doc: architecture.md §11 (recipes + focus
  convention + retained list, lead-edited pre-dispatch). Verification: full CI green,
  re-run by the lead — eslint + madge, svelte-check 0 errors/0 warnings, 1397 tests
  (all existing, untouched — `test/` unmodified in the diff is the
  behaviour-preservation proof), build; grep walk: zero type-less buttons remain
  (multiline-tag-aware walk), `underline` exists only inside the `.link` recipe,
  `.focus-ring` at exactly the eight non-button sites, and the emitted
  single-file-build CSS carries
  `.btn:focus-visible,.link:focus-visible,.focus-ring:focus-visible{outline-style:solid;outline-width:2px;outline-offset:2px;outline-color:#2563eb}`
  (#2563eb = primary/blue-600). No DOM harness (§12), so real-browser/AT checks join
  the manual checklist: ring on Tab into buttons, inputs, and clue rows; no ring on
  pointer clicks; forced-colors behaviour. Leftover from A6: none — the two F2
  interaction-model questions previously landed at "the A6/focus-visible round" are
  re-pointed (see F2's addendum).*
- **A7 — landmarks and headings.** `App.svelte` wraps content in `<main>`, and
  `ImportScreen.svelte` renders its own `<main>` inside it — nested main landmarks.
  The Builder route has no heading at all (Player route uses `h2`, Landing uses `p`).
  `FilePicker.svelte`'s `role="region" aria-label="File drop zone"` labels the
  drag-drop surface, not the pick control it contains.
  *Resolved 2026-11-21 (Option 1, human-chosen with two sub-decisions both (a);
  alternatives presented to the human and rejected: landmarks-only with headings
  deferred to the B1/B2 shell round (leaves the Builder route invisible to heading
  navigation until an undated round), and nested-mains-only (paper-over — the
  FilePicker label would keep lying and the Builder would stay heading-less).
  Inventory reconciliation — the audit's site list was incomplete: it named
  ImportScreen's nested `<main>` but MISSED that `Landing.svelte` renders its own
  `<main>` inside App's too (same kind, same bug, found by the Lead's walk);
  recorded here per the do-not-trust-a-list rule. Inventory: S1 App.svelte's
  `<main>` (the wrapper — sole owner after the fix), S2 ImportScreen's nested
  `<main>`, S3 Landing's nested `<main>` (audit-missed), S4 the Builder route's
  missing heading, S5 Landing's `<p>` posing as a heading, S6 FilePicker's
  mislabelled `role="region"`. Design as implemented: App.svelte keeps the sole
  `<main>`, untouched; ImportScreen and Landing demote their roots to `<div>`s
  with classes unchanged (grep-verified pre-change that no CSS targets the `main`
  element anywhere — `app.css`, `tailwind.config.ts` — so the demotion is
  pixel-invisible); Landing's "What would you like to do?" becomes an `<h2>`
  keeping the former `<p>`'s classes verbatim (semantic-only change, pixel-
  identical under Tailwind preflight); BuilderShell gains a static visible
  `<h2>` "Build a puzzle" above the toolbar (class composition matches
  PlayerShell's h2), deliberately NOT the puzzle title — the title is an
  editable input in the Builder toolbar and a heading mirroring its live value
  would duplicate it (alternatives (b) title-mirror and (c) sr-only offered and
  rejected by the human); FilePicker's `role="region"` + aria-label deleted —
  the drag surface is decorative pointer-only chrome, the pick button's visible
  text is its label, and drag-drop is mouse-only so AT users reach it via the
  button (sub-decision (a); re-labelling the region to "Pick or drop a file" was
  offered and rejected as keeping a pointless jump target). The round's only
  visible UI delta is the Builder heading. Implementer deviation, accepted:
  removing the region role left the drag-handler `<div>` role-less, and
  `a11y_no_static_element_interactions` fails lint on handler-bearing static
  elements — the honest resolution is a `svelte-ignore` with a prose comment
  citing §11's rationale (a role would contradict the recorded decision;
  OverlayDialog's backdrop suppressions are the repo precedent). Repo a11y
  suppression count is now three (OverlayDialog ×2, owned by A2; FilePicker ×1,
  owned here). §11 amended before code (visual-conventions paragraph + the
  BuilderShell / ImportScreen / FilePicker / top-level-layout rows). Files:
  `src/ui/player/ImportScreen.svelte`, `src/ui/app/Landing.svelte`,
  `src/ui/builder/BuilderShell.svelte`, `src/ui/shared/FilePicker.svelte`;
  doc: architecture.md §11 (lead-edited pre-dispatch). Verification: full CI
  green, re-run by the lead — eslint + madge, svelte-check 0 errors/0 warnings,
  1397 tests (all pre-existing, `test/` absent from the diff — the
  behaviour-preservation proof), build; grep walk: exactly one `<main>`
  repo-wide (App.svelte), zero `role="region"`, heading inventory as specced
  (h1 Header; route-level h2 in Landing / Import / Player / Builder; section
  h2s untouched); emitted bundle carries "Build a puzzle" and no region role.
  No DOM harness (§12), so screen-reader landmark/heading jump menus join the
  manual checklist. Leftover from A7: none.*

## Class B — form-factor decisions duplicated or drifting (blocks the fit goal directly)

- **B1 — the two-column shell is hand-rolled twice, in drift.**
  `src/ui/builder/BuilderShell.svelte` and `src/ui/player/PlayerShell.svelte` spell the
  same layout (`mx-auto max-w-7xl px-4 py-4 flex flex-col gap-4` + `md:flex-row`
  two-column) with per-shell deviations: the Player right column lacks the `flex-1` the
  Builder one has; the Player left column adds `min-w-0` the Builder one lacks. Every
  breakpoint change edits both files and must reconcile drift first.
  *Resolved 2026-11-21 (Option 2, the full responsive shell round, sequenced as 1a —
  human chose the full round with a shared layout leaf inside it; alternatives
  offered and declined: mechanism-only dedupe (1b was CSS recipes in app.css) and
  hand-reconciling the drift (rejected as paper-over before it was offered). The
  round also owned B5's toast-placement re-derivation and B2 (folded in by the
  human) — see their entries. Human decisions, all on record: D1 the grid column
  leads a ~60:40 proportional split (`md:flex-[3]` / `md:flex-[2]` + `max-w-md`
  ceiling on the clue column) — refined once mid-round after the Lead's Chrome rig
  measured the first form (left `flex-1`, basis 0, against the clue column's fixed
  448px claim) giving the grid only 264–396px at 768–900px viewports, inverting
  "grid is the star" at tablet widths and regressing the Builder (whose old form
  stretched the clue column instead, keeping a 600px grid); refinement alternatives
  declined: stepped fixed clue width (md 288 / lg 384 / xl 448) and keep-as-measured.
  D2 grid pitch grows 2.5rem → 3rem at ≥1024px (initially also
  3.5rem at ≥1280px — dropped the same day after the human's PC screen
  test: 56px cells read as too big; 48px is the ceiling, a taste decision).
  D3 the banner
  stays rendered twice — human rationale: a scrolled phone user typing in the
  grid's top or bottom half always has the nearest copy on screen. D4 toast
  md-aligned + safe-area. D5 VersionStamp `max-md:hidden` (E5 ride-along).
  Inventory (Lead's walk, superset of the audit's): S1/S2 the outer containers,
  S3/S4 the columns rows, S5–S8 the four column sections — plus two same-kind
  sites the audit missed: the Player left column's `gap-3` vs Builder `gap-4`
  (third drift), and `Header.svelte`'s `mx-auto max-w-7xl px-4` (the page-width
  constant's third speller — examined and retained: single site, App chrome with
  its own padding; a future width change edits TwoColumnShell + Header, so the
  coupling is recorded here rather than silently absorbed). Design as implemented
  (spec in architecture.md §11 shell-layout bullet, lead-edited before each code
  wave; the mid-round D1 refinement amended the doc before the follow-up
  dispatch): new `ui/shared/TwoColumnShell.svelte` owns container + columns row +
  column wrappers; both shells embed it with header/left/right snippets; the
  Player's sr-only speech mirror stays the first element of the left snippet (A5
  sequencing preserved); AnagramModal renders after the shell (fixed overlay,
  container-independent — App renders its own overlays at bottom, same pattern).
  One spacing delta, on record: Player left-column gap normalizes 3 → 4.
  Files: `src/ui/shared/TwoColumnShell.svelte` (new), `BuilderShell.svelte`,
  `PlayerShell.svelte`, `src/app.css`, `src/ui/shared/ToastHost.svelte`,
  `src/ui/shared/VersionStamp.svelte`, plus B2's four below. Verification: full
  CI green, re-run by the lead — eslint + madge, svelte-check 0 errors/0 warnings,
  1397 tests all pre-existing (`test/` absent from the diff — the
  behaviour-preservation proof), build; then the F3-method Chrome rig (throwaway
  playwright-core, /tmp only, no repo changes): 26/26 — column switch at `md`,
  grid column 427/446/506px at 768/800/900px (beats the clue column at every
  width), pitch tokens flip at 1024/1280 and each cap binds when the column
  reaches it (grid = min(column, cap) verified at five widths, 840px cap binding
  at 1440), toast bottom-center at 700px (the old 640–768 band, clear of the
  grid) and top-right at 800px, typed letters land in both routes at every width
  (the F2-sensitive path), banner twice, VersionStamp hidden at 375px, clue-click
  scroll through CluePanelShell. Rig provenance, recorded honestly: rig v1's other
  failures were instrument bugs (an `<aside>` collision with DisplacedCluesPanel
  in section selection, CSS resolved-value semantics, a nonexistent toast
  trigger, `GridSize.MIN` misassumed) — the one real failure (the tablet squeeze)
  was kept red until the human decided, then re-asserted against the superseding
  spec. No DOM harness (§12), so real-notch/real-touch phone and tablet ergonomics
  join the manual checklist. Not addressed: `Header.svelte`'s page-width constant
  (retained — decision above).*
- **B2 — the clue-panel shell is copied verbatim.**
  `BuilderCluePanel.svelte` / `PlayerCluePanel.svelte` duplicate the
  `aside`/section/`h2`/`ul` shell, the `liRefs` + `$effect` scroll wiring, and the
  `max-h-[70vh] overflow-y-auto` panel-scroll decision (a form-factor decision with two
  owners). The `{#snippet clueRow}` idiom (architecture.md §9) dedupes *rows within*
  each panel; the shells themselves are two copies.
  *Resolved 2026-11-21 (folded into the B1 round by the human). Inventory: S1/S2 the
  two asides (byte-identical class strings
  `flex w-full max-w-md flex-col gap-4 max-h-[70vh] overflow-y-auto`), S3/S4 the two
  scroll wirings (`panelEl` + `liRefs` + the `$effect`), S5 the section/h2/ul shells —
  split by kind on inspection: the Player's listbox `role="group"` wrappers and the
  Builder's plain `section>`s differ semantically (the A4 forms), so they stay
  per-panel by decision, not omission. Design as implemented (spec in the §11
  snippet-convention paragraph, lead-edited before code): new
  `ui/shared/CluePanelShell.svelte` owns the aside, the refs record, and the scroll
  effect; each panel embeds it and passes its rows as a children snippet called with
  the refs record (`{#snippet children(liRefs)}`, probed against the installed
  compiler by the implementer); Player keydown refocus reads the param; Builder's
  drafts `SvelteMap` stays per-panel. Consequence: `clueScroll.ts`'s consumer count
  changes 2 → 1 (the shell) — §11 row amended. Files:
  `src/ui/shared/CluePanelShell.svelte` (new), `BuilderCluePanel.svelte`,
  `PlayerCluePanel.svelte`. Verification: CI green (1397 untouched); rig check —
  clue-click scroll advances the panel's scrollTop through the shell-owned wiring;
  DOM byte-identical (same tree, classes, roles — only indentation moved).
  Not addressed: none.*
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
  *Resolved 2026-11-21 (Option 1 — name only, behaviour-preserving; alternatives
  presented to the human and rejected: name + decide large-screen growth now (the
  grid would exceed 2.5rem/cell — breakpoint facts interact with the B1/B2 shell
  rework and would be re-decided there) and defer entirely into the responsive
  round (leaves unlabelled magic until then). Inventory: S1 container width
  `w-[min(...)]`, S2 `grid-cols-[...]`, S3 `grid-rows-[...]`, S4 the word-number
  font span, S5 the letter font span — all five in `Grid.svelte`, grep-verified the
  constants exist nowhere else; plus the new named home in `app.css`. Design as
  implemented (spec in architecture.md §11, lead-edited before code): `app.css`
  `:root` owns three pure static custom properties — `--grid-cell-pitch` (2.5rem),
  `--grid-number-font-ratio` (30), `--grid-letter-font-ratio` (52, the fonts
  expressed as a percentage of one cell's width) — consumed only by `Grid.svelte`'s
  container formulas, which keep the dynamic `--grid-size` references inline. The
  static/dynamic split is load-bearing, not style: the Lead's first design (name
  the whole font expression at `:root`, e.g.
  `--grid-letter-font: calc(52cqi/var(--grid-size))`) was killed by a throwaway
  Chrome probe before dispatch (F3 method, no repo changes) — custom properties
  substitute inner `var()` references at the declaring element and inherit the
  result, so a `:root` var embedding `var(--grid-size)` resolves against `:root`,
  where it doesn't exist (probe: 16px inherited fallback vs 20.8px correct); the
  static-scalar form verified identical (20.8px both). Custom properties rather
  than `theme.extend` tokens because the values feed `calc()` formulas inside
  arbitrary-value class strings where CSS vars are the native mechanism, and any
  future per-breakpoint overrides land in `app.css` beside them. Verification:
  full CI green, re-run by the lead — eslint + madge, svelte-check 0 errors/0
  warnings, 1397 tests all existing and untouched (`test/` absent from the diff
  is the behaviour-preservation proof), build; grep walk: zero
  `2.5rem`/`30cqi`/`52cqi` literals remain in `src/ui` (the values live only in
  `app.css` `:root`); and the strongest available proof, run by the lead with the
  throwaway rig (no DOM harness, §12): built the pre-change and post-change apps,
  imported `puzzles/puzzle1.json` through the Player import screen in real Chrome,
  and diffed computed styles — grid width 600px, cell track 39.9219px, number font
  11.98px, letter font 20.7653px, byte-identical across builds. Deferred with a
  named landing site (human decision): per-breakpoint cell sizing and the
  large-screen growth decision — the grid never exceeds 2.5rem/cell today, now a
  one-line edit in a named home — belong to the responsive shell round (B1/B2).
  Leftover from B4: none.*
  *Addendum 2026-11-21: the deferred landing arrived — the B1 round decided the
  growth (human decision D2): `--grid-cell-pitch` 3rem at ≥1024px, media override
  in `app.css` beside the base constants (the static-literal rule unchanged).
  A second step (3.5rem at ≥1280px) shipped with the round and was dropped the
  same day after the human's PC screen test — 48px cells is the ceiling.
  Rig-verified: the token flips at the breakpoint; the cap binds when the grid
  column reaches it (~1224px viewport under the final proportional split — the
  cap is a ceiling, not a guarantee, by the `min()` width formula).
  See B1's resolution.*
- **B5 — toast placement is inline per-branch.**
  `ToastHost.svelte` hand-rolls `max-sm:`/`sm:` dual positioning; no `safe-area-inset`
  for notched phones; `fixed top-4 right-4` can overlay the grid on narrow viewports.
  Right owner (one component), but the decision should be re-derived for the rework
  alongside the shells it overlays.
  *Resolved 2026-11-21 in the B1 round (this entry's deferral named that landing
  site). Both live defects dead by construction: the position breakpoint is
  aligned to the shells' `md` — bottom-centre below, top-right at `md` and up — so
  the 640–768px mixed state no longer exists; and `--toast-bottom-inset:
  env(safe-area-inset-bottom)` (named home in `app.css` `:root`, B4 precedent)
  keeps notched phones clear of the home-indicator zone. A3's announcer stayed a
  placement-independent sibling throughout, untouched by construction. §11
  ToastHost row amended before code. Files: `src/app.css`, `ToastHost.svelte`.
  Verification: rig — toast bottom-centre and clear of the grid at 700px (the old
  band), top-right at 800px; the inset var present in the emitted CSS.
  Not addressed: none.*

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
  *Resolved 2026-11-21 (Option 1 — delete the flag everywhere; alternatives presented
  to the human and declined: keep field / delete only the dead branch (half measure,
  type still lies), and make `visible` a real derived boolean (a behaviour/UX change,
  not a cleanup — E-class records the always-visible state as examined). Inventory
  (Lead's walk — the audit named the two type fields but not the mints, the consumer,
  or the test pins): S1/S2/S3 `playerVM.ts` (type field + both mint sites),
  S4/S5 `builderVM.ts` (type field + mint), S6 `DisplacedCluesPanel.svelte`'s dead
  `{#if vm.visible === true}` wrapper, S7 three full-shape `toEqual` pins in
  `playerVM.test.ts` (banner mints ×2, shell banner ×1), S8 `builderVM.test.ts`'s
  test pinning `visible` by name and assertion. Design as implemented: `visible`
  deleted from both VM types and all three mints; the panel's `<aside>` renders
  unconditionally (empty-state `{#if vm.entries.length === 0}` untouched); the
  banner's field had zero consumers repo-wide (grep-verified pre-dispatch), so no
  player component changed. Test edits are shape-pin removals only, pre-declared
  (A3/A5 precedent): three banner pins each lost exactly one `visible: true,` line,
  and the displaced-panel test renamed to
  `emptyMessage="No displaced clues"` minus its `vm.visible` assertion — no
  assertion logic added or reworded elsewhere. Files: the five inventory files,
  nothing else. Verification: full CI green, re-run by the lead — eslint + madge,
  svelte-check 0 errors/0 warnings, 1397 tests all passing with count unchanged
  (the unchanged count is the behaviour-preservation proof: no test could have
  observed the flag), build; grep walk: `visible` now exists under `src/`/`test/`
  only as the unrelated `appStore.svelte.ts` prose comment and `focus-visible` CSS;
  diff walked by the lead — the `.svelte` delta is pure dedent (byte-identical
  tree, classes, roles). Leftover from E1: none.*
- **E2 — `TypingSurface` IME/Unidentified normalisation** — correctly owned by the leaf
  display adapter; retained.
  *Confirmed closed 2026-11-21 (human decision — accept the audit's examination;
  Option 1, no code change, none warranted). Recap for the record: the leaf's whole
  job is normalising three keystroke delivery mechanisms into four raw bag calls —
  desktop `keydown` (incl. the deliberate fall-through for
  `event.key === "Unidentified"`), mobile soft-keyboard `input` events, and IME
  `compositionend` (mid-composition keydowns ignored via `isComposing` /
  `keyCode 229`); letter validation stays in the domain (`Letter.try` via the
  facade action), so the leaf carries zero crossword knowledge. Single owner, no
  drift, blocks neither rework goal — a Class-E retained finding is closed by its
  own examination. The normalisation has no automated coverage (no DOM harness,
  §12) and sits on the manual checklist; regression pinning is F3's scope, not a
  defect here. Leftover from E2: none.*
- **E3 — `clueScroll.ts`** manual delta scroll: one shared owner, right home; the rework
  may want `prefers-reduced-motion` behaviour — an opportunity, not a leak.
  *Resolved 2026-11-21 (Option 3, human-chosen from the options round; alternatives
  presented and declined: close-by-examination with no code, the E2 precedent — the
  audit's own framing was "opportunity, not a leak", and the pre-change instant
  teleport was already reduced-motion-safe by construction — and smooth scroll
  alone without the semantics change, which would animate the same snap-to-top
  abruptness rather than remove it). Inventory: S1 `scrollRowIntoView` in
  `clueScroll.ts` (snap-to-top → minimal-window), S2 `CluePanelShell.svelte`'s aside
  class string, S3 `app.css` (new named motion home), S4 `clueScroll.test.ts`
  (three new fake-element cases; the two pre-existing guards verbatim). Design as
  implemented (spec in architecture.md §11, lead-edited before code): the helper
  scrolls the panel only as far as needed to bring the highlighted row fully into
  the visible band — no-op when already fully visible (the former form snapped
  every highlighted row to the panel's top, abrupt since A4 arrow browsing
  re-derives `highlightedId` per keypress); manual-delta arithmetic retained —
  native `scrollIntoView` would also scroll ancestor containers / the page;
  smooth-vs-instant is owned by one named CSS pairing, `.clue-panel-scroll` in
  `app.css` (`scroll-behavior: smooth`, gated to `auto` under
  `prefers-reduced-motion: reduce`; direct `scrollTop` assignment honours the
  element's `scroll-behavior`), appended to the shell's aside. Deliberate
  behaviour changes, examined: highlighted rows no longer snap to top (minimal
  reveal, gentle under arrow browsing); the scroll animates smoothly unless OS
  reduced-motion is set. Implementer honesty note: the above-band test case
  passes under both old and new forms (for a fully-above row, minimal reveal
  equals the old snap) — still meaningful, it pins the exact delta rather than a
  snap overshoot. Follow-up the same round, human-directed (not a finding —
  recorded because it re-paths this entry's files): the two loose non-component
  UI helpers moved into per-folder `helpers/` subfolders —
  `ui/shared/helpers/clueScroll.ts`, `ui/builder/helpers/gridSizeInput.ts`
  (mirrored test files moved with them per §12's mirror rule; §13 tree amended);
  `gridSizeInput.ts` was a pure rename, 0 content change, and the move's whole
  textual delta is four import lines. Files:
  `src/ui/shared/helpers/clueScroll.ts`, `src/ui/shared/CluePanelShell.svelte`,
  `src/app.css`, `test/ui/shared/helpers/clueScroll.test.ts`, plus the moved
  gridSizeInput pair and `GridSizeControl.svelte`'s import line.
  Verification: full CI green, re-run by the lead — eslint + madge, svelte-check
  0 errors/0 warnings, 1400 tests (1397 pre-existing + 3 new), build; grep walk:
  zero stale paths, no `scrollIntoView`/`scroll-smooth` anywhere,
  `clue-panel-scroll` at exactly its three sites. No DOM harness (§12), so actual
  smooth-scroll feel and the reduced-motion toggle join the manual checklist
  (§12 amended with the E3 items). Leftover from E3: none.*
- **E4 — `PlayerToolbar`'s `COLOR_CLASS`** component-local exhaustive map: the
  architecture-sanctioned §9 pattern; retained.
  *Resolved 2026-11-21 (Option 3 — full status/action colour-vocabulary round; the
  human challenged the audit's "retained" verdict — "at minimum, fold colours into
  B3 vocab; the architecture doc is a map, not gospel" — and the challenge was
  answered by reasoning, not doc deference: the map's §9 *placement* survives on its
  own merits (moving the resolution up would break the audit's own verified
  zero-Tailwind-strings seam in `ui/bindings/` and duplicate the semantic field
  `classification` already carries; the map is one house pattern with
  `GridVM.hilite`→cell map and `ToastVM.kind`→kindColor), while the map's *values*
  — raw palette literals — were the real weakness, and those moved into the B3
  vocabulary. Alternatives presented and declined: E4-site-only (half-measure,
  ~16 same-kind sites left raw), severity-only sweep (leaves the role family
  drifted), and moving the resolution into the VM layer (breaks the seam; needs an
  architecture amendment for zero gain). Human taste decisions, all on record:
  both Reset buttons strong red-600 — the two-intensity split (Player strong,
  Builder muted) was drift, not intent; warning hue amber everywhere — Toast's
  former yellow dead; purple tokenised as `tool`. Inventory (Lead's walk, a
  superset of the audit's one-line entry, with one honest gap recorded: the first
  grep pattern omitted blue, so the standalone action-link family surfaced only
  at review time and was closed by a human-directed addendum): severity S1
  PlayerToolbar `COLOR_CLASS`, S2 Toast `kindColor`, S3 AnagramModal error
  message, S4 ImportScreen alert box, S5 BuilderToolbar violation list, S6
  DisplacedClues "(Reattaching…)" note; role S7–S10 PlayerToolbar's four variant
  buttons (Clear Errors / Reset / Import New / Anagram Helper), S11 Builder
  Reset, S12 Export Complete's enabled half, S13 Landing Play, S14 Scramble, S15
  Unlink, S16 Delete; addendum S17 Link next, S18 Reattach. Design as implemented
  (spec in architecture.md §11 "Status/action colours" bullet, lead-edited before
  each code wave, design-first): severity tokens `success`/`danger`/`warning`/
  `info` (`{ DEFAULT 600, hover 700, soft 100, 'soft-text' 900, border 300 }`;
  `info` carries no hover — no solid info button exists) + `tool` (purple-600/
  700) in `theme.extend`, the taxonomy mirroring `ToastKind` — the union the
  codebase already had; recipes `.btn-success`/`.btn-warning`/`.btn-tool` added,
  `.btn-danger` rewritten strong (the muted red-100 form deleted, its only
  consumer Builder Reset moved to the strong form); severity text sites use
  `text-danger`/`text-success`/`text-warning`, tinted boxes the `*-soft`
  family; the three component-local exhaustive maps stay component-local per the
  amended retained note. Deliberate visual deltas, all human-sanctioned: toast
  warning yellow→amber; ImportScreen tint red-50→red-100 and text red-700→
  red-900 (unified on Toast's tint); Builder Reset muted→strong; reattaching
  note amber-700→amber-600. Every other site is byte-identical hue (600/700 map
  directly onto token DEFAULTs/hovers; the addendum's blue-600 = `primary`'s
  DEFAULT, emitted rgb(37 99 235) verified). One Lead error corrected on the
  record: the addendum's option text described the banner Cancel link as
  normalizable to 600 — on reading the banner it proved to be one of two
  tint-matched Cancel links (blue-700 under blue-800 text, amber-800 under
  amber-900 text), banner chrome rather than standalone action links; the
  mis-description was corrected before dispatch and the banner links retained.
  Files: `tailwind.config.ts`, `src/app.css`, `src/ui/shared/Toast.svelte`,
  `src/ui/player/PlayerToolbar.svelte` (also `colorPair`→`variant`, a
  component-local array field now holding recipe names), `ImportScreen.svelte`,
  `AnagramModal.svelte`, `src/ui/builder/BuilderToolbar.svelte`,
  `BuilderCluePanel.svelte`, `DisplacedCluesPanel.svelte`,
  `src/ui/app/Landing.svelte`; doc: architecture.md §11 (tokens bullet, recipes
  bullet, retained note, seven component rows, lead-edited before code).
  Verification: full CI green, re-run by the lead for the main wave — eslint +
  madge, svelte-check 0 errors/0 warnings, 1400 tests (all pre-existing;
  `test/` absent from the diff is the behaviour-preservation proof, both waves),
  build; emitted-bundle walk by the lead: `.btn-danger` carries #dc2626 and
  red-100 #fee2e2 is absent, `.text-primary` = rgb(37 99 235); grep walks:
  zero green/red/amber/purple/yellow class literals under `src/ui` outside the
  retained list, blue at exactly its three retained sites. Inventory closure:
  18 of 18 sites changed or explicitly retained — retained, with reason and
  home: JoinReattachBanner's tint ladders (banner chrome under the
  `accent.join`/`accent.reattach` family), FilePicker drag-over blue-500/50
  (B3-retained), BuilderToolbar's disabled gray half (the dead look is a content
  fact), neutral grays everywhere. Leftover from E4: none. Consequence for B3:
  its "green/red/purple stay literal" retention row is superseded — §11 now
  records the vocabulary.*
- **E5 — `VersionStamp.svelte`** fixed `bottom-0 right-0` overlay can collide with
  content on small screens; pointer-events-none already, cosmetic only.
  *Resolved 2026-11-21 (B1-round ride-along, human decision): `max-md:hidden` —
  hidden below `md` rather than moved; the collision was with the toast's new
  bottom-centre mobile position. §11 row amended.*

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
5. **B1/B2** — the responsive shell pass once the vocabulary exists. Also owns B5's
   toast-placement re-derivation (recorded in B1's entry).
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
  *Resolved 2026-11-21 (Option 1, banner-only — human decision; alternatives
  presented and rejected in the options round: banner-from-bindings-closure
  without state (cheaper but the condition stays invisible to reducers and
  tests — the same testability hole the finding names, and the audit's own
  text says "a banner the VMs derive needs it as state") and strengthening the
  toast channel only (paper-over: the channel stays ephemeral by design).
  Inventory (Lead's walk): S1 `app/state/state.ts` (`builderSaveFailed` /
  `playerSaveFailed` flags + blank), S2 `app/state/intents.ts`
  (`report-builder-save-result { ok }` / `report-player-save-result { ok }`
  replacing the two toast-minting failure intents), S3 `app/state/reducer.ts`
  (flag flip with a same-reference no-op guard when the flag already matches —
  load-bearing: the store dispatches on every attempted write, success
  included), S4 `appStore.svelte.ts` (latch machinery and
  `saveFailureRetoastMs` deleted; the write-result callback warns per failed
  write and always dispatches; `getSaveHealth()` named-slice getter), S5
  `boot.ts` (restored-state literal + two false fields), S6 `saveBannerVM.ts`
  (new — slice→message exhaustive `Record`, the copy's new home per the §9/C3
  precedent; state stores booleans only), S7 `SaveFailureBanner.svelte` (new —
  always-mounted `sr-only role="status"` mirror, empty when healthy, plus the
  gated visible banner in the danger-soft tint), S8/S9 the two facades
  (`saveBannerVM()` getters — deliberately NOT folded into the shell VMs: save
  health is app-level, not slice-level), S10/S11 the shells (Builder header
  below the h2; Player solving branch only — player writes never happen on the
  import screen), S12 tests (reducer 4 new; state shape-pin lines; appStore
  rewrite of the six latch tests to flag semantics, the 60 s cadence test
  deleted outright as dead machinery; saveBannerVM 4; facades +2 each; two
  type-forced inert edits, `filePickActions.test.ts`'s `AppStore` stub and
  `playerFacade.test.ts`'s hand-built `AppState` literal, accepted — same
  treatment as boot.ts). Design as implemented, two dispatches: architecture.md
  amended first (§3 appStore/scheduler/viewmodels rows, §5 storage-writes
  bullet, §6 options/getter list, §7 AppState + AppIntent, §8 write-failure
  paragraph rewritten, §9 SaveBannerVM, §11 three rows + SaveFailureBanner row,
  §12 folds list). Deliberate behaviour changes, examined: the save-failure
  toast is gone (the banner replaces it — A3's announcer no longer speaks save
  failures because there are none to speak); the 60 s re-toast latch is gone
  (the banner does not lapse, so reminders are unnecessary); `console.warn`
  now fires per failed write (was once per episode; the port warns only on the
  load path, so the write path keeps its diagnostic); the store dispatches on
  every attempted write, inert via the reducer's no-op guard. The flags pass
  the Focus-section boundary rule — "saving is failing" is a headless-actable
  fact, no rendering recorded. Consequence for A3: its "accepted limitation"
  about toast ttl vs announcement queueing is now moot for this channel;
  ImportScreen's error box remains the model for load-side failures. Human
  instruction, same round: comments added by this work must not reference audit
  items — the banner's comment tag was removed with its rationale kept
  self-contained (the audit doc, not the live doc set, is where these tags
  live); architecture.md's F1 pointers were de-tagged the same way. Files:
  the twelve inventory sites + doc. Verification: full CI green, re-run by the
  lead — eslint + madge, svelte-check 0 errors/0 warnings, 93 files / 1409
  tests (1400 pre-change +2 reducer, −1 cadence test, +8 display round — the
  two type-forced stub edits add no assertions), build green; grep walk by the
  lead: old intent kinds zero hits repo-wide, save-result/getSaveHealth/
  saveBanner confined to the inventory files, zero audit-item refs in src/ or
  test/ comments. No DOM harness (§12), so real screen-reader announcement of
  the banner (region exists-and-changes) joins the manual checklist.
  Not addressed: none. Leftover from F1: none.*
- **F2 — focus architecture: the hidden typing input stole focus on every state
  change.** Surfaced 2026-11-21 by the human's manual test of the A4 fix. Two-round
  history, recorded honestly:
  **Round 1 (A4-T4, superseded):** the Lead diagnosed the reported Tab "cycle"
  (focus alternating between the 1-across clue entry and an invisible stop) as the
  hidden input being a Tab stop, and landed `tabindex="-1"`. Both halves of that
  diagnosis were wrong: the cycle's second state was not the input's Tab-stop
  membership but a programmatic *focus steal*, and removing the stop regressed the
  only keyboard path into grid typing. The misdiagnosis came from reasoning about
  the mechanism instead of reproducing it — the exact discipline the Lead demands
  of dispatched work.
  **Round 2 (focus-token round, 2026-11-21, verified):** reproduced in a real Chrome
  with an instrumented build. Root cause: `TypingSurface`'s cursor-refocus `$effect`
  re-runs not just on cursor change but on *every* state change with byte-identical
  cursor values (Svelte 5 re-runs effects on parent re-render even with unchanged
  primitive props — empirically verified), each re-run calling `focus()`; any state
  change while a clue editor held focus (its blur commits `edit-clue`) yanked focus
  back. Human chose Option B over a component-level compromise after a design round:
  **typing focus is a reducer-minted fact** (`typingFocusSeq`, a monotonic counter
  bumped by pointer/activation intents only — fill-mode `select-cell`;
  `click-clue-panel-word`/`click-grid-word` in the `subMode none` branch only;
  Player `select-cell`/`click-clue-panel-word`), carried through `GridVM` to the
  guarded effect; Player clue-list arrows dispatch a new `browse-clue-panel-word`
  intent (same cursor effect, no mint) so list browsing never fights the typing
  surface; A4-T4's `tabindex="-1"` **reverted** — the input is again the
  keyboard-reachable, aria-labelled entry into grid typing. Boundary rule recorded
  in architecture.md's Focus section: state records interaction facts any headless
  consumer could act on (the `cursor`/`subMode` family); it never records
  renderings. Deliberate behaviour change, examined: after a non-minting click
  (e.g. Player Check), keystrokes go nowhere until the user re-enters typing (Tab
  to the labelled stop, or any grid/clue click) — platform-conventional focus
  behaviour replacing the accidental global theft; also dead: the latent steal on
  autosave/re-toast dispatches mid-edit. Old `GridVM` cursor fields removed with
  their mechanism (their only consumer was the old effect). Verification: full CI
  (1383 tests; +12 B1/B2, −2+1 B3), then a real-browser Playwright rig run by the
  lead — ten behavioural checks, all passing: clue-click mints typing focus (letter
  lands), Tab walk never re-enters the hidden input, edit-clue-then-Tab keeps focus
  on the next control (the reported cycle, dead), toolbar clicks keep focus, Player
  import→arrow-browse keeps focus in the listbox, Enter mints, letters land, Check
  keeps focus. Remaining open, named landing site (two questions, same landing):
  "type after any toolbar click" would need a grid-first global key-routing model
  (the real-crossword-app convention), and "Tab into the clue row you clicked
  rather than the first entry" needs state-driven focus ordering — both
  interaction-model decisions for the A6/focus-visible round, human-initiated.
  Not started.
  *Addendum 2026-11-21 (A6 closed as hygiene + ring only): A6 landed without these
  two questions, per the human's Option-2 choice (A6's resolution entry). They are
  re-landed here: destination is a **focus-model round**, human-initiated and gated
  on the F3 harness (both are behavioural decisions exactly the harness exists to
  pin). A6's focus convention does not pre-empt either: it styles where focus
  lands, it does not change where focus goes. F4 below later joined this
  destination as the round's third question.*
- **F3 — DOM harness decision, proven twice in one day, still pending.** The
  focus-steal (F2) and its round-2 fix were both invisible to the repo's test
  suite by construction: no test renders a `.svelte` file (architecture.md §12),
  and the bug class is focus/keydown/DOM ordering — exactly what only a rendered
  harness can see. The Lead's throwaway Playwright rig (system Chrome, no repo
  changes; `playwright-core` installed `--no-save`) found the root cause in one
  instrumented run and verified the fix in ten behavioural checks. A permanent
  harness (Playwright + a thin app-driving helper, ~10 checks as regression
  tests) would pin the A4/F2 behaviours the manual checklist currently holds.
  Not commissioned — the human has the offer on record; landing site: a harness
  design round, human-initiated. Until then the manual checklist carries these
  items.
- **F4 — the grid typing surface has no visible focus indicator.** Surfaced
  2026-11-21 by the human during keyboard testing after the A6 round ("still no
  visible selection for grid"). Not an A6 leftover — every A6 decision stands
  (the hidden input deliberately ringless; pointer affordances ringless); the gap
  is that keyboard-*acquired* typing focus (the F2-minted Tab stop into grid
  typing) has no visual encoding anywhere: the yellow cursor cell is the *cursor*,
  not focus, and it was already yellow before the Tab; A5's live region speaks
  the cell, but a sighted keyboard user sees nothing change on entering grid
  typing.
  **Empirical finding (lead's throwaway probe, real Chrome via Playwright-core,
  no repo changes — the F3 method):** text inputs match `:focus-visible` on
  *every* acquisition path — Tab, direct click into the input, `focus()` called
  inside a click handler (the grid-mint path), and cold script focus. Therefore
  no pure-CSS keyboard-only form exists: `focus-within` and
  `:has(:focus-visible)` on the existing grid wrapper (identical
  `relative overflow-x-auto` div around `Grid` + `TypingSurface` in both shells)
  both fire on the mouse mint too. A convention-clean fix needs a modality
  source somewhere other than CSS.
  Options examined with the human: (A) wrapper ring on `:focus-within` —
  rejected: fires on mouse mints, breaking the A6 convention
  ("ring = keyboard-acquired focus"); the human overruled the Lead's "true
  fact" framing — correctly, a broken convention is a broken convention.
  (D) carrying interaction modality in intents — dead by the Focus boundary
  rule (new state surface whose only consumer is a visual fact; fails the
  headless-consumer test). (B) **leaf modality gate** — `TypingSurface` tracks
  last-interaction modality from window `pointerdown`/`keydown` capture
  listeners (OverlayDialog's window keydown is the listener precedent; E2 IME
  normalisation is the leaf-owned-keyboard-fact precedent; `FilePicker`'s
  `dragOver` is the transient-pointer-fact-as-local-`$state` precedent) and
  reports keyboard-acquired focus up via a callback prop; the shells toggle a
  `.focus-ring-within`-style class (same `app.css` home as the A6 convention)
  on the wrapper. Conventions audit: breaks nothing written; one new pattern
  either way — B1 keeps the boolean in the shells (first-ever shell-local
  `$state`; ten other components already hold local `$state`) vs B2 extracts
  the wrapper trio into a shared leaf (shells stay pure; cost: a new plumbing
  component + §11 row, riding the B1/B2-family duplication already scheduled).
  Lead's recommendation if taken: B1.
  Human decision 2026-11-21: **record + defer.** Accepted state, recorded: a
  keyboard user entering grid typing sees no indicator until this lands; the
  hidden input's `aria-label` and A5's announcements carry AT users meanwhile.
  Landing site: the **focus-model round** — the same destination as F2's two
  re-landed questions (grid-first key routing, Tab-into-clicked-row), making
  this its third question; human-initiated, F3-harness-gated (the modality
  gate is DOM-timing behaviour exactly the manual checklist currently holds
  and only a rendered harness can pin). Not started; no code exists for it.
  Touch caveat, pre-recorded: on the B forms a touch tap (pointerdown) suppresses
  the ring — mobile users keep the yellow cursor as their indicator, consistent
  with the convention's meaning.
