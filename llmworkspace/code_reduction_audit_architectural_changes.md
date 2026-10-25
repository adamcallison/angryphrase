# angryphrase — Code Reduction via Architectural Changes

Companion to `code_reduction_audit.md`. Admission criterion (same as the main report):
an item qualifies only if it **improves or preserves code/architecture quality while
reducing LOC**. Anything that would trade a guard, a contract, a principle, or an
enforcement mechanism for line count is rejected and recorded at the end — it is not an
option, it is a non-starter.

One candidate survives that filter. It is an architectural change in the narrow sense
that it amends a decision documented in architecture.md §9 rather than merely local code.

---

## A1. Split `ClueEntryVM` into builder and player variants (est. −40 LOC, typing strictly improved)

`viewmodels/cluePanelVM.ts`'s `ClueEntryVM` carries 11 fields. Three of them —
`isStartableJoinSource`, `isLinkableFromJoinSource`, `isUnjoinable` — are builder-only
concepts that are **always false in the Player**, plus the `isBuilder` /
`builderSubMode` parameter threading through `deriveCluePanelVM` exists solely to
produce those false values.

Split into:

- `BuilderClueEntryVM` — the full 11 fields; derivation keeps `builderSubMode`;
- `PlayerClueEntryVM` — the 8 shared fields; derivation drops the `isBuilder` flag and
  the entire builder-flags branch (`isUnjoinable = hasOutgoingNextWord` etc. never
  computes).

Why this is a quality improvement, not just a deletion: the Player VM stops carrying
impossible states ("this player clue row is unjoinable" — it never can be), which is the
same principle the domain applies with branded types ("illegal states unrepresentable"),
applied at the VM layer. The builder panel and player panel have different actions bags
already (`BuilderCluePanelActions` vs `PlayerCluePanelActions`); the VM types now match
that split instead of papering over it with a shared supertype.

Cost: one more exported VM type pair; architecture.md §9's sentence "builder-only fields
are simply false in Player" is amended. The two derivations share every non-builder line
(today's single function already branches per-field, so no logic is duplicated — only
the false-value assignments disappear).

**Risk:** low. Type-level only; components already ignore the always-false fields.

---

## Rejected — would make the code/architecture worse to reduce LOC

Recorded for the same reason as the main report's rejected list: so nobody re-proposes
them as "simplifications" later. Each entry states what it would have deleted and the
property it would have traded.

- **Store methods replacing the intent/reducer/event model** (est. −700 to −1,000).
  Would delete the intent unions (~110 lines), both reducer switches (~240), the
  `target` stamping, `intentKinds`, and the `AppIntent | …` plumbing. Trades away:
  reducer purity (the entire state-layer test harness tests reducers as functions), the
  structural enforcement of external-effect ordering (autosave scheduled before external
  events so clears cancel saves), undo/redo readiness (future_considerations.md —
  snapshot stacks are trivial over immutable reducers), and most of the reason the ESLint
  layer matrix exists. The single biggest LOC saving available in the codebase, bought
  with the architecture's defining properties. Rejected.

- **Schema-library parser (`zod`/`valibot`) replacing `v1.ts`'s hand-rolled checks**
  (est. −400 to −500). Trades away: the dependency-free domain layer (a runtime lib
  import in `domain/**`, currently blocked by the ESLint matrix — the block is the
  principle), byte-equality of the failure list (architecture.md §10: "strict — the
  failure list is the contract"; schema defaults and refinement order are easier to get
  subtly wrong than the current explicit checks), and bundle size headroom in a
  single-file build. Rejected.

- **Deleting the ports layer** (est. −250 to −350). Trades away: the never-throw port
  contracts, failures-as-data, warn-once semantics in one place, and the
  `InMemoryStoragePort`/`SeededRng` fakes that test persistence end-to-end. Moving the
  fake seam to stubbed globals re-scatters that discipline into call sites. The clearest
  case of architecture buying testability with LOC. Rejected.

- **Merging the three state modules into one state tree/reducer** (est. −150 to −250).
  Keeps purity and events, but converts the mechanically-enforced Builder/Player import
  isolation ("do not import each other at all" — ESLint-checked) into convention, and
  deletes the `reduceApp` composition the layer rules police. A guard→convention trade.
  Rejected.

- **Dropping branding wholesale, validating at boundaries** (est. −300 to −400). Trades
  the compiler-blocked cross-cell bug class (`row`/`col` swaps, coordinate-as-number
  mistakes) — principle 3/4 of architecture.md §2 is the project's stated identity.
  Rejected.

- **Flattening the grid/word behavior modules into one `grid.ts`/`word.ts`** (beyond the
  main report's O4/O9/O10/O11, est. −100 to −200 further). Trades the module manifests —
  each `export const X: { … }` block *is* the architecture's per-module documentation of
  what it owns (architecture.md §3 table) — and reduces `ChainIndex`'s "single owner of
  chain structure" principle to a comment. Mega-files for navigation savings that mostly
  duplicate what O5's type-file merges already capture. Rejected.

- **Folding `viewmodels/` + facades into the components (derive with `$derived` at the
  shells)** (est. −400 to −600). Trades "thin UI" as an enforceable property: the ESLint
  layer matrix's biggest enforcement win loses its object, and the VM derivations — the
  bulk of what this item deletes — mostly have to exist somewhere anyway; only the
  pass-through plumbing really goes. Deletes the least essential code of any candidate
  while contradicting a stated principle most directly. Rejected.

---

The main report (`code_reduction_audit.md`) remains the actionable list: ≈1,400–1,700 LOC
of strictly quality-preserving reductions, plus the one qualifying item above (~40 more).
