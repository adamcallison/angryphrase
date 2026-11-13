# angryphrase — Defensive Programming Audit

Audit record (not part of the live doc set, per architecture.md §14). Date: 2026-11-13.
Scope: all of `src/` (115 files, ~7.7k lines). Method: full read of `domain/`, the three
`state/` trees, `ui/bindings/`, `ui/` components, `ports/`, `main.ts`; every candidate
guard judged against the interface or invariant that does or does not make it redundant.
No code was changed by this audit.

**Epistemology (revised 2026-11-13, second pass).** A **contract** is one of exactly
two things, both in code:

1. a **compile-level interface fact** — a type signature, a discriminated union, an
   exhaustive switch narrowed to `never`;
2. a **unit-test-pinned behaviour** — a specific test asserting the fact.

**architecture.md is not a contract.** It is a map (its own §1: "Where it disagrees
with the code, the code wins"); it may be cited for navigation, never as the
justification for a verdict. This revision re-derived every finding and every retained
row against that rule; contract sources are cited per finding as `Pinned by:` /
`Interface:`.

**Meta-finding the re-derivation produced.** This codebase deliberately pins its
defensive no-ops as named contract tests — `edit-clue: no-op when wordKey not found
(defensive)`, `confirm-reset-player: import phase is no-op (defensive)`,
`type-letter: no-op on black cursor cell (defensive)`, and a dozen more. The test
authors chose the word. Under the code-as-contract rule those guards are not
removable defence — they *are* the contract surface. The audit's remit therefore
narrows precisely to the **unpinned** defences:

- **unreachable guards** — no test can pin them (they cannot fire), and their removal
  breaks no test; the Class A/C findings;
- **duplicates of a pinned contract** — one layer is pinned, the second layer restates
  it; the Class B findings and the `[free]` A-items.

A finding that would require editing a pinned test is not a guard removal — it is a
behaviour change, and it leaves this audit's remit. (One such item was demoted on this
pass: the player-progress "partial apply" clamps are pinned behaviour, see D1.)

**Admission criterion (unchanged in substance).** A site is a finding only if a
contract fact — compile-level interface, pinned test, or same-expression code logic
(loop bounds, container sizes constructed in the same function) — guarantees the
guarded condition cannot occur or is already guaranteed elsewhere. Guards protecting
against corrupt external input (file imports, `localStorage` blobs, DOM events),
guards that *mint* a pinned never-throw contract (the ports), and guards that are
themselves the pinned behaviour (the "(defensive)" test family) are **not** findings;
they are in the "Examined and retained" section with their pinning test.

Companion: `defensive_programming_undecided.md` — sites where a contract *could* retire
the guard but the contract is implicit, unwritten, or would itself need a design
decision. Nothing there was silently classified.

---

## 0. Backdrop: the compiler-forced guard idiom

Two project settings shape this audit and must be read first, or half the findings
misread as free-will paranoia:

- `tsconfig.json` sets `noUncheckedIndexedAccess: true` — `arr[i]` has type
  `T | undefined` even when the index is provably in range.
- `eslint.config.js` bans `@typescript-eslint/no-non-null-assertion` everywhere except
  `src/domain/grid/Grid.ts` (the sanctioned raw-indexing leaf).

So a guard like `const x = arr[i]; if (x === undefined) throw …` inside a
`for (let i = 0; i < arr.length; i++)` loop is partly *the idiom this codebase uses to
satisfy the compiler*. The finding is not "the author was defensive"; it is "the guard
is provably dead at runtime, and a restructure (typically `for (… of …)` / `entries()`)
would remove both the guard and the indexed access". Class C lists these; whether to
sweep-restructure them or adopt the throw-guard as a uniform house idiom is an open
policy question (see undecided doc).

**Compiler pressure cuts across the classes — do not read A/B as "free-will".** Being
compile-required is a property of the *current code shape*, and it is orthogonal to
what the finding is about. The classes are defined by what dissolves the guard:

- **Class C** — only a local restructure dissolves it (loop/index idiom); no contract
  change involved.
- **Class B** — a named contract (type or function contract) can *carry the proof*, so
  the guard dissolves at the interface — but several B guards are compile-required
  **today** precisely because the interface is currently too wide to carry it.
- **Class A** — locally provable; some are compile-required in the current shape
  (narrowing gaps, `Map.get`, indexed access), some are deletable with zero compile
  impact.

Per-finding compile status is tagged `[forced]` (compile-required in the current
shape; deleting it as-written fails type-check) or `[free]` (deletable today, no
compile impact). Only `[free]` guards are straightforward deletions; every `[forced]`
one needs the restructure or contract change its entry names.

A related observation that *is* decidable: the codebase currently treats the same
impossible-indexed-access situation four different ways — throw (`Anagram`, `v1`,
`LengthPattern.separatorAt`), `continue` (`LengthPattern.chainPattern`,
`partOfRunMask`), optional-chaining (`gridVM`, `appStore`), and `?? default`
(`AnagramModal`). Whatever policy wins, one form should win.

---

## Class A — dead guards, provable locally (no contract change needed)

Every guard below is provably dead from facts in the same file or expression. Some are
deletable as-is (`[free]`); some are compile-required in the current shape and need the
small local restructure their entry names (`[forced]` — see §0). Two of them (A3, and
B6 in the next class) use the Class C mechanism but have non-loop fixes, which is why
they are not in the C table.

### A1. `GridInteraction.select` — unreachable cursor-null re-check `[forced]`
`src/domain/grid/GridInteraction.ts`, the `sameCell` branch:
`if (cursor === null) return null; // unreachable: sameCell implies cursor !== null`.
The comment is correct: `sameCell` is computed with `cursor !== null && …` as its first
conjunct, so inside `if (sameCell)` the re-check cannot fire. It is compile-required
as written — TypeScript cannot narrow `cursor` through the computed boolean `sameCell`,
so reading `cursor.direction` in that branch fails without it. Fix: restructure the
narrowing (e.g. branch on `cursor !== null` first, or inline the conjunct), which
removes the guard rather than re-checking what the branch condition already proved.

### A2. `reconcileWords` — "unreachable" throw on missing reconciled word `[forced]`
`src/builder/state/internal/reconcileWords.ts`, the `derivedWords` loop: throws when a
`newWords` entry is missing from `survivingByCanonical`. Self-acknowledged unreachable:
every key of `newByCanonical` is inserted into `survivingByCanonical` by either the
survivor loop (old∩new) or the new-word loop (new-only), and the loop iterates
`newWords` → keys of `newByCanonical`. Compile-required as written because
`Map.get` returns `T | undefined` unconditionally (strict-null, not
`noUncheckedIndexedAccess`). Fix: derive `derivedWords` directly from the maps in
insertion order rather than re-looking-up — removes both the lookup and the guard.

### A3. `joinSubMode.handleUnjoin` — findIndex + indexed access + impossible re-check `[forced]`
`src/builder/state/internal/joinSubMode.ts`: `findIndex(…)`, then
`state.puzzle.words[sourceIdx]`, then `if (source === undefined) return`. With
`sourceIdx !== -1` already guaranteed, the indexed access cannot yield `undefined`.
This is the Class C mechanism (`noUncheckedIndexedAccess` on a provably-in-range
index), parked here rather than in the C table because the fix is not a loop
restructure: a single `.find()` — the exact shape `handleBeginJoin` two handlers above
already uses — removes the indexed access, the guard, and the double lookup in one
move.

### A4. `solving.handleClearErrors` — dead grid-identity check `[free]` — **RESOLVED 2026-11-13**
`src/player/state/internal/solving.ts`: `newGrid === state.puzzle.grid ? state.puzzle :
Puzzle.withGrid(…)`. The preceding guard (`incorrectCells.length === 0` → early
return) guarantees the write loop runs at least once, and the loop's
`Grid.setCell` unconditionally allocates — `const newRow = […g[row]]; const newGrid =
[…g];` — so the identity comparison is never true. Remove the ternary;
`Puzzle.withGrid` unconditionally.

**Contract status, stated honestly (corrected twice — final):** "setCell always
returns a fresh grid" **is** a contract fact — pinned by
`test/domain/grid/Grid.test.ts` ("Grid.setCell returns a new grid with the cell
replaced; original grid unchanged"): it asserts `expect(updated).not.toBe(grid)`,
touched row cloned, untouched rows keep reference. `Grid.updateCells`'s
empty-list→same-reference return is likewise pinned ("returns the same grid reference
when updates is empty"). An earlier draft of this entry claimed the freshness was an
undocumented implementation fact — wrong; the pin was missed in the first pass. Two
consequences:

1. The dead ternary's premise is contract-protected: a future value-aware
   same-reference `setCell` would break a pinned test, not silently revive the branch.
2. The one API that owns an identity-relevant return is `updateCells` (pinned). The
   dead ternary in `handleClearErrors` imputes that semantics to `setCell`, which does
   not have it — that misattribution, more than the dead branch itself, is the smell.

**Resolution (2026-11-13):** the ternary was replaced with unconditional
`Puzzle.withGrid(state.puzzle, newGrid)` — three lines removed, one added, nothing
else in the function touched (the early guards and the `setCell` loop stayed; the
`updateCells` refactor was deliberately out of scope). Verification: full
`test/player/state/` tree — 198 tests, 5 files — green with zero test edits; the
suite's reference-stability assertions live only on the no-op paths (early guards),
and no test asserted puzzle identity after a real clear (checked by both the
implementer and the reviewer). The misattribution the entry flagged is gone with the
branch.

### A5. `persistenceCodec.serializePlayerProgress` — identity conditional `[free]` — **RESOLVED 2026-11-13**
`src/ui/bindings/persistenceCodec.ts`: `cell.playerLetter === null ? null :
cell.playerLetter` — both branches are the same value (the brand is a string at
runtime). Write `playerLetter: cell.playerLetter` directly.
Resolution: the conditional was replaced with the bare field (one line). Verification:
`test/ui/bindings/persistenceCodec.test.ts` 24/24 and the full
`test/ui/bindings/` run (294 tests, 17 files) pass with zero test edits — the
round-trip suite pins the serialized output, so passing unchanged is the
byte-identical proof. Diff confirmed single-line, single-file by `git diff`.

### A6. `persistenceScheduler` — duplicated phase gate `[forced]` — **RETRACTED as a deletion; recast as an interface-shape observation**
`src/ui/bindings/persistenceScheduler.ts`: `if (blob === null || state.phase !== 'solving')
return`. `serializePlayerProgress` returns non-null **iff** `state.phase === 'solving'`
— that is its entire gate, and the codec test titles the pin ("returns null when
state.phase !== 'solving' (single owner of the phase guard)"). Semantically the two
clauses are one condition.

**But the recommended deletion ("drop the phase clause") does not compile — proven,
not argued:** a minimal reproduction under the project's strict settings gives
`error TS2339: Property 'key' does not exist on type 'PlayerState'` the moment the
clause is removed. The two clauses carry *distinct compile-level duties* that neither
subsumes:

- `blob === null` narrows `blob: string | null` → `string` — required by
  `savePlayerProgress(key, blob)`;
- `state.phase !== 'solving'` narrows `state: PlayerState` → the solving variant —
  required by `state.puzzle.key`.

One fact, two channels, both needed because the interface signals "not solving" as a
*value-level* null while the caller needs the same fact as a *type-level* narrowing.
The duplication is forced by the interface shape, not chosen by the caller.

**The fix that would genuinely remove it** is B1-shaped: `serializePlayerProgress`
taking `Extract<PlayerState, { phase: 'solving' }>` and returning `string` (never
null), so the caller keeps one check (the phase narrow) and loses the other. That
rewrites the pinned codec test that asserts the null return — a contract change, not a
guard removal. Out of this audit's remit; recorded here as an observation with the
same status as D1. First draft of this entry tagged it `[free]` with "drop the phase
clause" — wrong; the tag and the instruction are both retracted.

### A7. `reconcileWords.describeViolation` — unreachable `default` arm `[free]` — **RESOLVED 2026-11-13**
`src/builder/state/internal/reconcileWords.ts`: the switch covers all four
`ChainViolation` kinds; `default: return JSON.stringify(violation)` is unreachable (the
narrowed type is `never`). Every reducer in the codebase uses the `assertUnreachable`
idiom for exactly this. Same idiom here; the `default` disappears.
Resolution: the arm was replaced with `default: assertUnreachable(violation)` and a
private per-file `assertUnreachable` helper matching the two reducers' convention (no
shared export created — grep confirmed none exists). Beyond deleting dead code, the
idiom buys compile-time exhaustiveness the old form lacked: this tsconfig has no
`noImplicitReturns`, so a future fifth violation kind would previously have made the
function silently return `undefined` into the throw message; now it is a compile
error. Verification: `reconcileWords.test.ts` 23/23 with zero test edits, and
`npx tsc --noEmit -p tsconfig.json` clean — the clean typecheck under the `never`
narrowing is the proof that the union has exactly the four cased kinds (a fifth would
fail to compile).

### A8. `appStore.dispatch` — `shift()` undefined break `[forced]`
`src/ui/bindings/appStore.svelte.ts`: `while (activeQueue.length > 0) { const next =
activeQueue.shift(); if (next === undefined) break; … }`. `length > 0` guarantees
`shift()` is defined, but the guard is compile-required — the lib signature of
`Array.shift()` is `T | undefined` unconditionally (same effect as Class C's
`noUncheckedIndexedAccess`, from a different source). Restructure (e.g. drain with a
snapshot loop) removes it. Lowest value of this class — record, don't necessarily
change.

---

## Class B — guards retired by a named interface contract

The distinguishing property is the fix: a contract (type or function contract) carries
the proof, so the guard dissolves at the interface. Note from §0: most of these guards
are compile-required **today** — that is not a contradiction; it is the finding. The
interface is currently too wide to carry a proof it already holds semantically, and the
guard is the rent. `[free]`/`[forced]` tags give the compile status of the guard
as-written.

### B1. `WriteOutcome.cursor` is typed wider than `GridInteraction` ever produces `[forced today, by the wide type itself]`
`src/domain/grid/GridInteraction.ts` declares `WriteOutcome = { grid: Grid; cursor:
Cursor }` with nullable `Cursor`, but `typeLetter` and `backspace` return a
`WriteOutcome` only on paths where `cursor !== null` (a null cursor exits early through
the top-level `null` return). Consequently `solving.ts`'s `if (cursor === null) return
Result.ok(state)` after destructuring `out` (twice — `handleTypeLetter`,
`handleBackspace`) is dead code checking an impossible member — and it is
compile-required **today** precisely because the type lies: the destructured
`out.cursor` is `Cursor`, and the downstream `CursorChange.cursor` field demands
`NonNullable<Cursor>`. Fix at the interface: `cursor: NonNullable<Cursor>` on
`WriteOutcome` — the type stops lying, the two dead guards then fail to compile and
are deleted. This is the audit's cleanest contract-tightening: the guard is the *rent
paid* for the over-wide interface, not a free-will choice.
**Contract source:** the `WriteOutcome` interface itself (compile-level). No test can
pin the dead branch — it is unreachable — which is exactly why the wide type is the
problem: the interface is the only place the fact could live, and it currently lies.

### B2. `solving` pre-checks `state.cursor === null` before calling `GridInteraction` `[free]` — **RESOLVED 2026-11-13**
`src/player/state/internal/solving.ts`, `handleTypeLetter` / `handleBackspace`: the
reducer null-guards the cursor, then calls `GridInteraction.typeLetter(…)` which
null-guards it again and returns `null` (→ `Result.ok(state)`, identical outcome). This
one, unlike B1, is **not** compile-required: `typeLetter`'s parameter accepts nullable
`Cursor`, so passing `state.cursor` directly type-checks, and the `out === null` branch
already yields the same result. It is pure behavioural duplication. The in-repo
counterexample is `fillMode.ts`'s handlers for the *same two intents*: they pass
`state.cursor` straight through and rely on the domain contract. Delete the cursor
clause to match the Builder form. (Mirror image of B1: B1's guard is rent on a wide
*return* type; B2's guard is free-will distrust of a *parameter* contract that already
exists.)
**Pinned by:** `test/domain/grid/GridInteraction.test.ts` — "returns null when input
cursor is null" for `typeLetter` and `backspace`. The null-cursor→null-outcome path
the reducer duplicates is itself pinned contract behaviour.
**Resolution (2026-11-13):** the `|| state.cursor === null` clause was deleted from
the entry guards of `handleTypeLetter` and `handleBackspace` (phase clause kept —
pinned no-op *and* the `state.puzzle` narrowing). `state.cursor` now flows into
`GridInteraction` as the nullable `Cursor` with no cast or assertion, matching the
lean form `fillMode` and the same file's `handleMoveCursor`/`handleSelectCell` already
use. Verification: solving suite 85/85, full player tree 198/198, `tsc --noEmit -p
tsconfig.json` and `eslint` on the file both clean — all with zero test edits, and the
no-op-when-cursor-null pins pass unchanged through the domain's own null handling.

### B3. Post-admission re-find guards duplicate `ChainAdmission`'s `ok` contract `[forced today; the fix is the interface carrying the proof]`
`src/builder/state/internal/joinSubMode.ts` (`resolveJoin`):
`if (source === undefined || target === undefined) return Result.ok(state); //
defensive — admission mismatch` — `ChainAdmission.canLink` returning `{ ok: true }`
already proves both words exist (its first two checks are exactly
`source-not-found` / `target-not-found`). Same shape in
`reattachSubMode.resolveReattach`: re-finding the displaced clue after `canReattach`
proved `clue-not-found` cannot fire. The guards are compile-required as written —
`Array.find` returns `T | undefined` unconditionally — so the *proof* that they are
dead lives only in `ChainAdmission`'s contract, not in any type the caller can see.
The minimal fix keeps the `find` calls (the objects are needed) and accepts that the
undefined-branches are unreachable; the full fix — `canLink`/`canReattach` returning
the found objects on `ok` — makes the interface carry the proof, deletes the second
lookup, and dissolves the guard at the boundary. The full fix is the one worth doing;
it is an interface change beyond "unnecessary guard removal" and is offered as such.
**Pinned by:** `test/domain/chain/ChainAdmission.test.ts` — `ok` on distinct unlinked
words / head-with-empty-clue, plus the four `*-not-found` reason tests. The
`ok ⇒ both exist` implication the dead branches re-check is exactly what those test
pairs pin.

### B4. `designMode.handleToggleDesignCell` — bounds pre-check duplicates `Grid`'s throw `[free]` — **RETRACTED as a deletion; recast as a pinned defensive no-op**
`src/builder/state/internal/designMode.ts`: `if (!Grid.withinBounds(grid, row, col))
return Result.ok(state)` followed immediately by `Grid.cellAt` / `Grid.setCell`, each of
which re-checks bounds and throws `RangeError`. The pre-check is a second owner of the
same rule with the *opposite* failure semantics (silent no-op vs throw).

**But the no-op is pinned:** `test/builder/state/internal/designMode.test.ts` — "no-op
when row/col out of bounds" — mints an in-brand but off-grid coordinate
(`Row.of(GridSize.DEFAULT)` on a default grid) and asserts state unchanged, no events.
Under the code-as-contract rule the silent no-op is contract surface: deleting the
pre-check would turn that pinned path into a `RangeError`. The deletion recommended in
the first draft is retracted; B4 joins the "(defensive)" family (see the retained
table) — it is `toggle-design-cell`'s member of the systematic reducer policy that
`fillMode`'s "select-cell: no-op on out-of-bounds coords" pin (`fillMode.test.ts:105`)
also belongs to.

**The observation that survives, now read correctly:** the codebase runs a
*two-tier* bounds policy. Reducer intent handlers treat out-of-bounds coordinates as
possibly-stale data → silent no-op (pinned, per intent). `Grid` accessors treat
out-of-bounds coordinates as a bug → throw (pinned). The reducer pre-checks are the
boundary that downgrades `Grid`'s bug-throw to the intent's data-no-op. The first
draft read the semantic disagreement between the tiers as a smell; the pins say it is
the *current design*. A later challenge sharpened that disagreement rather than
settling it — every producer of an out-of-grid intent coordinate is a bug by
elimination (see U8 in `defensive_programming_undecided.md`), so whether the no-op
tier is deliberate robustness or an accident of the "(defensive)" family's shape is
an open design question, not closed by the pin.

**Why the guard is irreducible even though the current pipeline cannot produce its
input:** the facade mints coords from render indices (always in-grid), but that
impossibility is an emergent property of the current dispatch seam, not a type-level
fact — `Row`/`Col` are branded `0..∞` *by design*, because grid-relative validity is a
**relational** property (true of `Row.of(20)` on a 25-grid, false on a 15-grid) that
no static brand can express; even a `0..24` brand would leave `Row.of(20)` in-brand on
a 5×5 grid. So a runtime check is permanent in this design, and the intent's public
interface (`{ row: Row; col: Col }`) admits in-brand off-grid values to any future
minter. The pinned no-op is the *specified behaviour for the type-admissible inputs
the current seam doesn't emit* — the handler's contract over its interface, not a
defence against its own pipeline. Same epistemic status as the U2 stale-dispatch
family: seam-impossibility deliberately not relied upon.
**Pinned by:** `Grid.test.ts` RangeError tests (the throw tier);
`designMode.test.ts:183` and `fillMode.test.ts:105` (the no-op tier).

### B5. `AnagramModal.svelte` — `?? 'none'` fallback contradicts the model's length contract `[forced today; fix is a VM restructure]`
`src/ui/player/AnagramModal.svelte`: `{@const sep = vm.separators[i - 1] ?? 'none'}`.
`Anagram.buildWordModel` / `buildChainModel` construct `separators.length ===
entries.length − 1` by construction (one separator per adjacent pair, one per chain
boundary), and the tile loop starts at `i = 1`. The fallback is dead at runtime — and
worse, it is a *default that would silently mask* a drift between the model and the
template. It is compile-required under svelte-check's `noUncheckedIndexedAccess`
(template index access), so deleting the `?? 'none'` alone does not type-check; the
proper fix is for the VM to carry separators aligned with tiles (e.g. an
`AnagramTileVM.separatorAfter` field derived once in `anagramVM.ts`, where the length
contract is visible) so the template never indexes the array at all.
**Pinned by:** `test/domain/anagram/Anagram.test.ts` — "buildWordModel returns
separators length = word.length − 1" and "buildChainModel separators length ===
totalLength − 1". The length contract the fallback second-guesses is pinned.

### B6. `gridVM` — optional chaining over a mask derived from the same grid `[forced; Class C family]`
`src/ui/bindings/viewmodels/gridVM.ts`: `mask[r]?.[c] === true` where `mask =
WordTopology.partOfRunMask(grid)` is `grid.map(row => row.map(…))` — same dimensions by
construction, and `r`/`c` are the indices of the very grid being mapped. This is the
Class C mechanism (`noUncheckedIndexedAccess` on a provably-in-range index), listed
here rather than in the C table only because the killing invariant is cross-module
(mask dimensions ≡ grid dimensions) rather than a same-expression loop bound. Same
options as Class C: restructure the derivation so the mask is consulted per-cell
without double indexed access, or accept the idiom under the Class C policy.
**Pinned by:** `test/domain/grid/WordTopology.test.ts` — "partOfRunMask returns a mask
aligned with the grid". Alignment is pinned; only the template-side optional chaining
is the open question.

---

## Class C — compiler-forced dead guards on provably-in-range indexed access

All of these are the `noUncheckedIndexedAccess` idiom (§0) guarding an index that a
loop bound or container-size invariant in the same expression already proves valid.
(A3 and B6 are the same mechanism with non-loop fixes; they live in their own classes.)
Each is dead at runtime; each is removable by restructuring to `for…of` / `entries()`
without changing behaviour. Listed with the invariant that kills them:

| Site | Guard | Killing invariant |
|---|---|---|
| `WordTopology.measureRun` (both axes) | `if (!Grid.withinBounds(grid, …, col)) break` | loop condition `c < size` where `size = grid.length`; square-grid; `startRow` from a caller iterating `i < size` |
| `WordTopology.partOfRunMask` | `if (rowMask === undefined) continue` | `mask` is `grid.map(…)` — one row per grid row; `r = startRow + i` inside a run derived from that grid |
| `Anagram.buildWordModel` | `cells[i] === undefined` throw | `i < cells.length`, loop over the array just built |
| `Anagram.buildChainModel` | `members[i] === undefined` throw | `i < members.length` |
| `Anagram.scramble` | `pool[k]` / `pool[j]` undefined throws | Fisher–Yates loop `i < pool.length − 1`; `j = rng.nextInt(pool.length − i)` ∈ `[0, pool.length − i)` |
| `LengthPattern.chainPattern` | `members[memberIndex] === undefined` → `continue` | `memberIndex < members.length` |
| `format/v1.crossCheckWords` | `parsedWords[i] === undefined` throw | `i < parsedWords.length` (`i` also used in messages — `entries()` restructure) |
| `format/v1.validateNextWordReferences` | `words[i] === undefined` throw | `i < words.length` (same) |

Two judgements inside this class:

- **`measureRun`'s bounds check is genuinely redundant, not just dead**: the contrast
  with `whiteAt` in the same module shows the difference. `whiteAt`'s
  `withinBounds` is *load-bearing* — `Col.try(c ± 1)` mints values that are in-brand
  (Row/Col have no upper bound) but can exceed the grid size, since grids run 2..25
  while the brand range is 0..∞. `measureRun`'s check, by contrast, is dominated by its
  own loop bound. Remove `measureRun`'s; keep `whiteAt`'s.
- **`LengthPattern` is internally inconsistent**: `separatorAt` *throws* on the
  impossible out-of-range offset while `chainPattern` *skips* the impossible undefined
  member. Whichever policy the house adopts (§0) should make these two agree.

---

## Class D — observations that are not guard removals but belong to this audit

### D1. Player-progress blob validation is split across two owners — **demoted from recommendation to observation (pinned behaviour)**
`persistenceCodec.parsePlayerProgress` validates the blob's content (arrays of arrays,
`Letter.try` per cell, branded `gridSize`) but not its *dimensions* — a ragged or
short `playerLetters` passes. `solving`-tree `handleApplyLoadedProgress` then defends
with `Math.min` row/col clamps and a `savedRow === undefined` continue. The first
draft of this audit called that a split and recommended codec-owned dimension
validation; the re-derivation **retracts the recommendation**: the partial-application
semantics are *deliberate, pinned contract* — `test/player/state/internal/lifecycle.test.ts`:
"apply-loaded-progress: truncated saved arrays (fewer rows/cols than grid) → applies
only the intersection" and the oversized-arrays counterpart. Moving dimension
validation into the codec would change pinned behaviour (partial apply → whole-blob
reject) — a behaviour change, outside this audit's remit. What remains is the
observation: the two layers each carry part of a pinned contract, and a reader
looking for "what shape is a valid progress blob" must read both files. If the
split ever bothers anyone, the fix is a behaviour-change decision, not a cleanup.
The `saved == null` continue is legitimate data filtering either way (a stored `null`
letter is a cell not yet solved).

### D2. `builderFacade.setMarker` dispatches an intent it knows will no-op
`src/ui/bindings/builderFacade.ts`: when `cursor === null || mode !== 'fill'`, it
dispatches `{ kind: 'set-marker', axis, separator: 'none' }` — an intent whose reducer
path is guaranteed to change nothing. Not a guard, but a defensive *dispatch*: noise in
the intent log for every marker-button click with nothing selected. Doing nothing
(`return`) is the honest form. **Unpinned:** the facade tests cover only the
cursor-present paths, so no test edit is needed to change it — but it is a (small)
behaviour change in the dispatch stream, so it stays an observation rather than a
finding.

---

## Examined and retained (load-bearing — each row now cites its contract source)

Under the code-as-contract rule, "retained" must mean *pinned* or *interface-enforced*,
not "architecture.md says so". Every row below was re-derived accordingly.

| Site | Contract source |
|---|---|
| `Grid.cellAt`/`setCell`/`updateCells` bounds throws; `updateCells` empty→same-ref; `setCell` fresh-grid return | `Grid.test.ts`: RangeError tests; "returns the same grid reference when updates is empty"; `not.toBe(grid)` clone assertions |
| `GridInteraction` null-cursor / black-cell no-op returns (`select`, `move`, `typeLetter`, `backspace`) | `GridInteraction.test.ts`: "returns null when input cursor is null" (×3), "returns null when the current cell is black" (×2), plus the full no-op-outcome series |
| `Cell.setAnswerLetter`/`setPlayerLetter`/`setMarker` black no-op guards | `Cell.test.ts`: "no-op on black cells (returns same black cell with null letters)" |
| `ChainMarker` null / no-op returns for out-of-bounds or black end cells | `ChainMarker.test.ts`: null-on-black, null-on-out-of-bounds, no-op writes (×4), plus "does not mutate the input grid" |
| `ChainIndex.headOf`/`fromHead` dangling & cycle throws | `ChainIndex.test.ts` (throws on dangling/cycle); the cycle guard in `fromHead` is also the loop's termination condition |
| `Numbering.assign` "no start cell" throw | sanctioned invariant guard — unreachable on all current call paths, so unpinned by construction; kept as a bug-signal, would be a *test edit* only if ever fired |
| `reconcileWords` post-run `ChainValidation` throw | unreachable when reconciliation is correct — bug-signal, same status as the row above |
| `ports/*` try/catch (`localStoragePort`, `downloadPort`, `filePickPort`) — the never-throw contract's *minter* | `test/ports/*` — e.g. `localStoragePort.test.ts`: "saveBuilder returns an Error when localStorage.setItem throws (graceful failure)" with `expect(() => result).not.toThrow()` |
| `v1Json.parsePuzzle` / `persistenceCodec` JSON catches and shape checks | codec/parser test suites pin the failure-as-data shapes for corrupt input |
| Reducer-side `mode`/`phase`/`isBlank`/gate checks (`fillMode`, `solving`, `designMode`, `handleRequest*`) | the guard-rejection test series pins each as no-op contract — e.g. `fillMode.test.ts`: "no-op in design mode" / "no-op when cursor is null" per intent; `lifecycle.test.ts`: "request-reset-player: import phase is no-op" |
| The "(defensive)" guard family (stale-id no-ops: `edit-clue`, `click-clue-panel-word`, `begin-join`, `unjoin`, `resolveJoin`, `begin-reattach`, `delete-displaced-clue`, `resolveReattach`, `confirm-reset-player` import-phase, anagram guards, VM banner fallbacks, **out-of-bounds intent coords: `toggle-design-cell`, `select-cell`**) | **pinned deliberately**, test titles say so — `fillMode.test.ts:650`, `solving.test.ts:658`, `joinSubMode.test.ts:92/387/404`, `reattachSubMode.test.ts:75/153/294/311`, `lifecycle.test.ts:595`, `builderVM.test.ts:297/317`, `designMode.test.ts:183`, `fillMode.test.ts:105`. These are contract surface, not removable defence (see the meta-finding in the admission section) |
| `Anagram.scramble` internal count/length throws | `scramble`'s own contract for arbitrary callers; reducer path relies on them |
| `WordTopology.whiteAt` `withinBounds` | code logic: brand range (0..∞) ≠ grid size (2..25); `try(c ± 1)` can mint in-brand-but-off-grid values — the contrast with `measureRun`'s dominated check is the Class C finding |
| `gridActions` `Row.try`/`Col.try`/`Letter.try` + silent return | `gridActions.test.ts` pins the invalid-input→no-op dispatch contract |
| `TypingSurface` IME/composition guards; `FilePicker` `dataTransfer?.files?.[0]` | browser-event reality; `TypingSurface` has no DOM harness (manual checklist), so these stay by nature, unpinned by suite |

---

## Verification

At original audit time (2026-11-13) no code had been changed; every finding was
verified by direct read of the cited file plus its callers and, where a contract was
invoked, the minting site (`ChainAdmission`, `Grid`, `Anagram` model builders,
`serializePlayerProgress`) and the relevant architecture.md section. No finding relies
on grep alone. Sites where the contract could not be pinned down went to
`defensive_programming_undecided.md` rather than being classified here.

Post-audit code changes are recorded on their findings (currently: A5, resolved
2026-11-13).

**Second-pass re-derivation (2026-11-13, later).** After the epistemology correction
(contracts are interfaces and pinned tests; architecture.md is a map), every finding
and retained row was re-derived against the test suite by direct grep/read of the
cited test files — the pins quoted above are quoted from the suite, not from the doc.
The re-derivation retired one recommendation (D1: partial-apply is pinned), resolved
five of the seven undecided items (see `defensive_programming_undecided.md`), and
corrected one factual error in the A4 entry's contract status (the `setCell`
fresh-grid fact *is* pinned; the first two drafts of that paragraph were wrong in
opposite directions). A later check retracted A6's deletion entirely: a minimal tsc
repro proved the "redundant" clause is a required narrowing (`state.puzzle.key`
fails without it) — A6 is recast as an interface-shape observation, same status as
D1. A further pin check retracted B4 as well: `designMode.test.ts:183` pins the
out-of-bounds silent no-op, making the bounds pre-check contract surface — the
"(defensive)" family's coords tier — rather than a duplicated rule.
