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

**By-product — documentation inaccuracy:** architecture.md §7 (Guarded actions) said
`confirm-*` intents "execute unconditionally". Pinned behaviour disagreed for
`confirm-reset-player` (import phase → no-op), while the three Builder `confirm-*`
handlers genuinely are unconditional — an asymmetry the doc sentence hides. The doc is
not a contract, but it self-describes as a map, and a map that misstates pinned
behaviour is a bad map. **Amended 2026-11-19 (human-approved):** §7 now reads
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

### U7 — Player-progress blob dimension validation ownership → **CLOSED 2026-11-19 via the D1 resolution (codec-owns-dimensions; the 2026-11-13 "retraction" below is superseded)**
`lifecycle.test.ts` pins the intersection semantics explicitly: "apply-loaded-progress:
truncated saved arrays (fewer rows/cols than grid) → **applies only the intersection**"
and the oversized-arrays counterpart. Partial application is not an accident of a
validation split — it is the specified behaviour. The codec-owns-dimensions
recommendation would change pinned behaviour and is retracted (the audit's D1 entry
was rewritten accordingly). If whole-blob-reject is ever *wanted*, that is a product
decision with a test-edit bill, not a cleanup.

**Supersession (2026-11-19).** The paragraph above is the 2026-11-13 re-derivation
record, kept for history. The human later ruled the retraction a misunderstanding —
the pin reflected the implementation, not intent (`serializePlayerProgress` always
writes an exact square, so a dimension-mismatched blob is corruption or tampering) —
and approved the codec-owns-dimensions contract change. It landed 2026-11-19: the
codec rejects dimension-invalid blobs whole, the reducer's `Math.min` clamps and
undefined-row skip are deleted, the two former partial-apply pins were replaced by
codec-level rejection tests. Full record: the audit doc's D1 entry (authoritative).
The U1-style caveat cuts both ways: even a human-approved reversal of a pin is on
record here, so a *future* reversal back to partial-apply would likewise be a product
decision with a test-edit bill.

---

## Decided after the 2026-11-13 re-derivation (this section was "Still undecided" until every item below was decided)

### U8 — Out-of-grid intent coordinates: data (no-op) or bug (throw)? — **DECIDED 2026-11-13: CellCoord + fail-loud; landed 2026-11-13**
**Decision:** option 2 + the refined option 3 (grid-scoped minting + mint-gated phantom
brand, no payload) — `CellCoord` provenance brand, sole minter `Grid.tryCoord`;
`select-cell` / `toggle-design-cell` intents carry `cell: CellCoord`;
`toggle-design-cell`'s reducer drops its `withinBounds` pre-check and treats a
mismatch as a bug (`Grid.cellAt`'s pinned `RangeError` is the detector);
`select-cell` keeps its graceful domain path. The architecture doc was amended
FIRST (§2 principle 4 grid-scoped constructor, §3 `grid/`, §4 owners 13→15, §5 facade
minting) — architecture.md is the authoritative spec for the design; this entry
records only the decision history.

**Implementation state (final, 2026-11-13):**
- T1 (domain): `CellCoord.ts` + `Grid.tryCoord` + boundary owners — landed &
  accepted (Grid suite + boundary suites + tsc green).
- T2 (seam flip): intents/facades/reducers + 51 test constructions (38 `select-cell`
  + 13 `toggle-design-cell`, accounting closed by grep) + pin rewrites — landed &
  accepted. `toggle-design-cell`'s out-of-grid pin is now a `RangeError` throw-pin
  ("mint bypass or changed grid"); `select-cell`'s no-op pin survives via
  `GridInteraction.select`'s graceful path (construction method changed only); the
  no-dispatch UX pins live at the facade (`gridActions.test.ts`: out-of-grid raw
  coords, null grid). No test pinned the old player import-phase dispatch, so the
  no-dispatch behaviour change needed no rewrite.
- Post-T2 closers: this status line, the audit record's B4/"(defensive)"-family row
  update, and the gate — `npm run ci` green end-to-end (1356 tests, svelte-check,
  madge, single-file build), run 2026-11-13.

**U8 is closed** (landed 2026-11-13 — implementation state above, final). The
undecided set is now **empty**: U6, the last open item (the indexed-access idiom
policy, a style decision), was **decided 2026-11-19** — option (a), the uniform
restructure sweep; see the U6 entry below and the audit doc's Class C policy table.

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

### U6 — House idiom for provably-in-range indexed access (Class C policy) — **DECIDED 2026-11-19: option (a), uniform restructure sweep**
Style policy, never a contract question. Human direction at inventory review: (a)
restructure away indexed access where a loop bound dominates (`for…of` / `entries()`)
— not (b) throw-with-context standardization. Decision block:

- **Sweep inventory (S1–S8, built from the Class C table plus same-kind sites named
  in §0):** S1 `WordTopology.measureRun` (both axes, redundant `withinBounds`
  breaks); S2 `Anagram.buildWordModel` throw; S3 `Anagram.buildChainModel` throw;
  S4 `Anagram.scramble` pool throws (see deferral below); S5
  `LengthPattern.chainPattern` `continue`; S6 `LengthPattern.separatorAt` throw —
  in scope beyond the C table because the audit's own judgement line says
  "whichever policy wins, these two must agree", and the sweep makes both Length
  Pattern sites agree by removal; S7 `format/v1.crossCheckWords` throw; S8
  `format/v1.validateNextWordReferences` throw. (`partOfRunMask` was already resolved
  with B6; `?? default` with B5; optional-chaining with B6/A8.)
- **Deferred — S4 `Anagram.scramble`, human direction 2026-11-19 ("fix the others,
  then come back"):** Fisher–Yates requires indexed reads (`pool[j]`, `pool[k]`);
  no `for…of` shape exists; `noUncheckedIndexedAccess` forces the guard; non-null
  assertions banned repo-wide by eslint. Options on record: (1) keep the
  throw-with-context guards as the sweep's single sanctioned exception, mirroring
  `Grid.ts`'s raw-indexing leaf; (2) splice-extraction restructure — guard-free but
  consumes a different rng stream, so the ~3 pinned SeededRng-deterministic tests
  would need rewriting (A6/B1/B3-style human-approved behaviour change); (3) amend
  the eslint allowlist for one non-null assertion. **Open item — tracked until
  closed.**
- **S4 DECIDED 2026-11-19: option (1), keep the loud guards** — human direction.
  The deciding argument: the guards are already exception-free (a runtime throw
  violates no lint rule), they fail loud where `!` would fail silent, and the
  Fisher–Yates loop is O(n) where the guard-free splice alternative is O(n²) and
  breaks the pinned SeededRng stream. Per the same human direction, the guards now
  carry a loud comment marking them as the codebase's **only** sanctioned
  redundant-guard site (random-access tier), so a future reader does not "clean them
  up" into a lint exception.
- **Zero-suppression package (same human direction, 2026-11-19):** the config-file
  carve-out is gone on principle — "sanctioning exceptions in the config file sets
  a precedent for allowing exceptions." `Grid.cellAt`/`setCell` converted to
  check-by-read (the read is the check; same single runtime check as the old
  `withinBounds` call, now in a compiler-visible channel — relocation, not
  addition; strictly stronger on ragged rows); `Grid.updateCells`' batch
  pre-validation loop deleted, its apply-loop checks are now the primary bounds
  owners (row via the forced read, col via an explicit length check — needed
  regardless, since an out-of-range write silently extends a JS array; the pinned
  original-grid-untouched assertion holds structurally either way); `main.ts`'s
  per-line disable replaced by an explicit null-check throw. The resulting policy,
  one tier per situation, no overlap:

  | Situation | Form | Sites |
  |---|---|---|
  | walk over a collection | restructure — no guard | 7 (the sweep) |
  | read with bounds to prove | check-by-read — the read is the check | `Grid` ×3 |
  | random access | one loud guard, loudly commented | `Anagram.scramble` only |
  | `!` assertions / config exceptions | banned absolutely | nowhere |

  `eslint.config.js`'s `no-non-null-assertion` rule is now absolute — no `ignores`,
  no per-line disables in `src/`. **U6 is closed.**
- After the sweep lands, the §0 four-way mix reduces to one residual case (S4's
  throws) — the only remaining decision is S4's own.

---

## Summary (after revision)

| Item | Status |
|---|---|
| U1 confirm/follow-up phase guards | kept — pinned (`lifecycle.test.ts`); doc §7 inaccuracy amended 2026-11-19 (human-approved) |
| U2 stale-dispatch family (~9 guards) | kept — pinned, tests titled "(defensive)" |
| U3 anagram `openedForWord` guards | kept — pinned family (miss path lacks its own titled test; noted) |
| U4 cursor-never-black guards | kept — pinned (`GridInteraction.test.ts`, `fillMode.test.ts`) |
| U5 VM sub-mode fallbacks | kept — pinned (`builderVM.test.ts`) |
| U6 indexed-access idiom policy | **closed 2026-11-19** — sweep landed (7 sites); S4 decided: keep loud guards (random-access tier, loudly commented); zero-suppression package removes both lint exceptions; `no-non-null-assertion` now absolute |
| U7 progress-blob validation split | **closed 2026-11-19 via D1** (human-approved contract change superseded the 2026-11-13 retraction): codec-owns-dimensions landed; see U7's supersession note |
| U8 out-of-grid intent coords: data or bug? | **decided 2026-11-13** — CellCoord + fail-loud; see U8's decision block for implementation state |
