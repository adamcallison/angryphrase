# angryphrase — Defensive Programming: Undecided Items

Companion to `defensive_programming_audit.md` (audit record, not part of the live doc
set, per architecture.md §14). Date: 2026-11-13; **revised same day** after the
epistemology correction: a **contract** is a compile-level interface fact or a
unit-test-pinned behaviour; architecture.md is a map, not a contract.

The revision resolved five of the original seven items — all in the same direction:
the guards in question are **pinned deliberately**, several with test titles that
literally say "(defensive)". Under the code-as-contract rule they are contract
surface, not removable defence. They are recorded below as resolved so the history of
the question survives; only U6 remains genuinely undecided, and one documentation
inaccuracy surfaced as a by-product (see the end).

---

## Resolved on re-derivation

### U1 — Reducer phase-guards on confirm / follow-up intents → **KEPT (pinned)**
`handleConfirmResetPlayer`'s import-phase guard is pinned:
`test/player/state/internal/lifecycle.test.ts` — "confirm-reset-player: import phase
is no-op **(defensive)**". `handleApplyLoadedProgress`'s phase guard is pinned: "no-op
when state phase is import (not yet solving)". The guard *is* the contract; removing
it would be a behaviour change requiring test edits. The original question ("is the
guard dead under the modal invariant?") is moot — deadness is not the test here,
pinning is.

**By-product — documentation inaccuracy:** architecture.md §7 (Guarded actions) says
`confirm-*` intents "execute unconditionally". Pinned behaviour disagrees for
`confirm-reset-player` (import phase → no-op), while the three Builder `confirm-*`
handlers genuinely are unconditional — an asymmetry the doc sentence hides. The doc is
not a contract, but it self-describes as a map, and a map that misstates pinned
behaviour is a bad map. Suggested one-line amendment (lead's to make, on approval):
"`confirm-*` executes unconditionally in the state it was granted from; the Player
reset confirm is pinned to no-op outside the solving phase."

### U2 — The "stale UI dispatch" guard family → **KEPT (pinned, deliberately)**
Every guard in the family is pinned, and the test authors chose the word:
`fillMode.test.ts` "edit-clue: no-op when wordKey not found **(defensive)**" and
"type-letter / set-marker: no-op on black cursor cell **(defensive)**";
`solving.test.ts` "click-clue-panel-word: no-op when wordKey not found **(defensive)**";
`joinSubMode.test.ts` "begin-join: no-op when source wordKey not found **(defensive)**",
"resolveJoin: source/target not found **(defensive no-op)**";
`reattachSubMode.test.ts` "begin-reattach / delete-displaced-clue / resolveReattach
… **(defensive)**". Whether stale dispatch is synchronously impossible no longer
matters: the no-op-on-unknown-id behaviour is part of the public contract of every one
of these handlers. The original proposal (write a dispatch-freshness contract, then
delete the family) is retired — it would be a mass behaviour change against pinned
tests.

### U3 — Anagram `openedForWord` resolvability → **KEPT (pinned family)**
`test/player/state/internal/anagram.test.ts` pins the no-op guards of the anagram
handlers (no-op when phase import / anagram null, etc.), and the VM-side closed-modal
fallback is the same deliberate family (see U5's VM pins). The words-immutable-in-
solving invariant question is moot for removal purposes. (Nuance, recorded not
decided: the *specific* miss path — `index.word(openedForWord) === undefined` — did not
turn up a directly-named test; it is covered by the family's shape but not by its own
title. If anyone ever removes these guards, write that test first.)

### U4 — The cursor-never-on-a-black-cell invariant → **KEPT (pinned)**
`GridInteraction.test.ts` pins "typeLetter / backspace: returns null when the current
cell is black"; `fillMode.test.ts` pins "set-marker: no-op on black cursor cell
**(defensive)**". The guards are contract. The original idea — encode the cursor-on-
white invariant and delete three guards — is retired: it would change pinned behaviour.
(Encode-the-invariant remains available as a *documentation* nicety; it buys nothing
under code-as-contract.)

### U5 — Builder sub-mode membership guards in the VM layer → **KEPT (pinned)**
`test/ui/bindings/viewmodels/builderVM.test.ts` pins both fallbacks: "join sub-mode
with missing source word → fallback { kind: 'none' } **(defensive)**" and the reattach
counterpart. Contract surface; nothing to decide.

### U7 — Player-progress blob dimension validation ownership → **CLOSED (pinned behaviour; recommendation retracted)**
`lifecycle.test.ts` pins the intersection semantics explicitly: "apply-loaded-progress:
truncated saved arrays (fewer rows/cols than grid) → **applies only the intersection**"
and the oversized-arrays counterpart. Partial application is not an accident of a
validation split — it is the specified behaviour. The codec-owns-dimensions
recommendation would change pinned behaviour and is retracted (the audit's D1 entry
was rewritten accordingly). If whole-blob-reject is ever *wanted*, that is a product
decision with a test-edit bill, not a cleanup.

---

## Still undecided

### U8 — Out-of-grid intent coordinates: data (no-op) or bug (throw)?
Raised after the B4 retraction. The bounds pre-checks on `toggle-design-cell`
(`designMode.test.ts:183`) and `select-cell` (`fillMode.test.ts:105`) pin **silent
no-op** for in-brand out-of-grid coordinates; `Grid.cellAt`/`setCell` pin **throw**
for the same condition. Both tiers are contract — but they encode contradictory
semantics for one input class, and the producer analysis favours the throw side:

- The `Row`/`Col` brands cannot carry grid-relative validity (context-free minting;
  relational fact; no dependent types) — so the intent *interface* admits such values.
- But every producer of one is a bug by elimination: derive-from-state minters cannot
  produce them (render indices), and legitimate edge arithmetic follows the
  `GridInteraction.move` pattern (compute + `withinBounds` + graceful no-op *inside*
  the domain — the model for any future navigation feature). No legitimate flow
  dispatches an out-of-grid intent.
- The project's stated philosophy for bug-class inputs is fail-loud ("an invariant
  breach is a bug, not a user-facing condition" — `Grid`, `ChainIndex`,
  `reconcileWords`, `assertUnreachable` all throw). The no-op tier silences exactly
  that class: a minter bug becomes an invisible dead click.

**The question:** is the reducer no-op deliberate robustness (a future minter's bug
should degrade to a dead click, not a crashed client-only app with no error boundary)
— or an accident of the "(defensive)" family's shape that should be bug-class?
**Cost either way:** changing to throw = editing the two pinned no-op tests +
accepting that a future minter bug crashes the app instead of degrading. Keeping =
accepting silently-swallowed bugs in this class. Not decidable from the code; the
pins record a choice, they do not justify it.

**Design ladder (recorded 2026-11-13, from the producer-map discussion).** "Valid for
grid X" is relational and cannot be a static type; but every mint can be forced
through a checked constructor:

1. Cap the brand at `0..24` (`intBrand('Row', 0, 24)`) — trivial; does not touch the
   relational fact.
2. **Grid-scoped minting** — `Grid.tryCoord(g, r, c): {row, col} | null` as the only
   sanctioned intent-coord minter; facades call it (they hold the store's grid). An
   out-of-grid coord can then never *enter an intent*; the reducer-side check
   degenerates to the mint-time/reduce-time grid-identity gap, which the synchronous
   work-queue closes — so a reducer hit is a genuine bug → throw. Relocates the
   pinned no-op to the facade, which is where architecture.md §5 already assigns
   invalid-raw-input handling ("a `try` yields `null` … and the action then does
   nothing"). U8 resolves coherently toward fail-loud.
3. **Proof-carrying coords** — the minted value embeds the grid it was validated
   against (`{ grid, row, col }`, minted only by `Grid.coordAt`); the reducer does one
   reference comparison and can distinguish out-of-grid (impossible at mint) from
   grid-changed-since-mint (identity mismatch). New boundary type at the intent seam
   only; internal arithmetic unchanged. *Refined after review:* the grid payload buys
   only failure-mode discrimination, which is a luxury — the economical encoding is a
   **mint-gated phantom brand** (`CellCoord = Brand<'CellCoord', {row, col}>`, sole
   minter `Grid.tryCoord`), zero runtime payload, enforced by the existing
   `domain/brand` owner-allowlist machinery. It expresses *provenance* ("minted via a
   grid-checked path" — type-expressible, compile-time) but not *currency* ("valid for
   the grid the reducer holds now" — a runtime seam property, closed here by the
   synchronous work-queue). With the tag, the remaining reducer-side check becomes
   purely a changed-grid detector → bug → throw. Same cost as option 2 plus a tag.
4. Full static impossibility (`GridSize` literal union, `Grid<Size>`, `Row<Size>`) —
   makes it unrepresentable but infects every signature in the domain and still needs
   runtime minting at the file/DOM boundaries. Rejected as disproportionate.

Options 2–3 convert "impossible to exist" into its strongest TypeScript-achievable
form: unproducible at every mint, loudly failing at every reduce. Recommended shape
if U8 is decided toward throw: **option 2 + the mint-gated phantom brand** (the
refined option 3) — grid-scoped minting as the mechanism, the tag as the type-level
record of it, no payload.

### U6 — House idiom for provably-in-range indexed access (Class C policy)
Unchanged by the epistemology shift — this was never a contract question, it is a
style policy. The codebase treats the same impossible-indexed-access situation four
ways (`throw`, `continue`, optional chaining, `?? default`); the `?? default` form is
the dangerous one (audit B5 — it masks drift). Options remain: (a) restructure away
indexed access where a loop bound dominates (`for…of` / `entries()`), or (b) keep
indexed access and standardize on the throw-with-context form, banning `continue` and
`?? default` for the provably-in-range case — a policy the project could enforce with
a lint tail, as it does its other boundaries. Either is defensible; the current mix is
the only indefensible state.

---

## Summary (after revision)

| Item | Status |
|---|---|
| U1 confirm/follow-up phase guards | kept — pinned (`lifecycle.test.ts`); doc §7 inaccuracy flagged |
| U2 stale-dispatch family (~9 guards) | kept — pinned, tests titled "(defensive)" |
| U3 anagram `openedForWord` guards | kept — pinned family (miss path lacks its own titled test; noted) |
| U4 cursor-never-black guards | kept — pinned (`GridInteraction.test.ts`, `fillMode.test.ts`) |
| U5 VM sub-mode fallbacks | kept — pinned (`builderVM.test.ts`) |
| U6 indexed-access idiom policy | **open** — style/policy decision |
| U7 progress-blob validation split | closed — partial-apply pinned; recommendation retracted |
| U8 out-of-grid intent coords: data or bug? | **open** — pinned no-op vs fail-loud philosophy; raised from the B4 retraction |
