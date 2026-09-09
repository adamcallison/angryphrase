The code base has two concepts
1. Separators - in the middle of a word, a space or hyphen can be placed, which gets shown on the grid and incorpororated into the clue length display
2. Multitword/chain clues, which span multiple grid words.

Today, multiword clues are locked into having a space between each word. No evidence of this is shown in the grid, but it appears as such in the clue length display.

The desired state is that multiword clues can have either separator (space or hyphen) or even no separator. The relevant symbol should appear on the grid, and the clue length display should be as
it would be for a single-word clue with a separator.

By default, a multiword clue should have a space between words, but this should be changeable via the existing separator toggles.

The symbols might be difficult to see at the edge of a word. For the purposes of this feature, don't worry about that.


The architecture_design.md document should be updated as appropriate.

---

# Implementation Plan — Flexible Multiword Chain Separators

> Status: lead-engineer plan, 2026-09-09. Normative for this feature; amends `architecture_design.md`
> and `requirements.md` per §7. Supersedes the deferred-boundary note in
> `chain_aware_selection_addendum.md` §2 (FR-82 amendment).

## 1. Decision record

**D1 — the chain-join separator is a `CellMarker` on the source word's last cell (single source of truth).**
For a word `W` with `nextWord != null` (a non-tail chain member), the separator between `W` and its
successor is read from the direction-scoped marker pair on `W`'s **last cell** (the cell at
`Direction.advance(W.key.start, W.key.direction, W.length - 1)`): across → `marker.spaceRight` /
`marker.hyphenRight`; down → `marker.spaceBottom` / `marker.hyphenBottom`. This extends FR-28's rule
("a separator after the cell in the named direction") from within-word adjacent cells to the chain
boundary — the gap between the source's last letter and the successor's first letter in the clue's
reading order. Rejected alternative: a `separator` field on the `nextWord` link object — it creates
two sources of truth for one boundary (cell markers still render, link field decides semantics),
makes `toggle-marker` position-dependent, and adds a sync invariant at every mutation point
(join, unjoin, reconcile, parse, serialize).

**D2 — three states; empty pair = no separator; default space is materialized at join.**
`space*` → space separator; `hyphen*` → hyphen; neither → no separator (length runs merge across the
boundary). The feature default ("space between words") is applied by *setting the space flag* when a
join is created and the pair is empty — not by an implicit default in derivation. A pre-existing
space or hyphen flag on the last cell is respected, not overwritten. The user reaches "no separator"
by toggling the flag off with the existing marker toggles (FR-26/FR-27) — no new UI, no new intents.

**D3 — file format version 2 (schema identical; version value disambiguates legacy data).**
Pre-feature chains carry empty boundary pairs that *displayed* as space joins (the old hardcoded
`", "` join), while explicit "none" is also an empty pair — indistinguishable within v1. The version
tag disambiguates:
- `parsePuzzle` (renamed from `parsePuzzleV1`; see §4) accepts `version: 1 | 2`; anything else is
  rejected as today.
- **v1 parse normalization:** for every word with `nextWord != null` whose last-cell direction pair
  is empty, set the space flag (materializing the legacy default). This is the FR-99
  normalization-precedent class ("missing marker booleans default to `false`"). v1 files thus display
  exactly as they did before the feature.
- **v2 parse:** no boundary normalization — an empty pair means "no separator" and round-trips.
- `serializeIncomplete` / `serializeComplete` write `version: 2`.
- No fields are added, removed, or renamed; all strict field-set checks are unchanged.
- Consequence: builds predating this feature reject v2 exports (`version !== 1`). Accepted —
  single-user application, continuously deployed.
- Rejected alternatives: normalize-only (kills the "none" state on every save/reload — the builder
  snapshot and autosave round-trip through the parser); empty-means-none without a version bump
  (silently changes existing chains' display from `5, 9, 7` to `21`).

**D4 — the boundary marker's lifecycle is bound to the link.** When a link is severed the boundary
pair is cleared: by `unjoin` (FR-37), by reconciliation when the link's target word is destroyed,
and for a destroyed linked word's own last cell (its cells may survive white after a split — a
stale marker there would render and could act as a spurious intra-word separator in a new word).
Rationale: once a marker serves as a join separator, its meaning exists only while the link exists.

**D5 — reconciliation moves the boundary marker when a linked word changes length (uniform
read-clear-set rule).** Without this, a lengthened linked word's old boundary marker becomes a
spurious intra-word separator and its new (unmarked) boundary merges; a shortened or split word
loses the marker with the destroyed cell. The rule (per OLD word `O` with `nextWord != null`):
- `oldEnd` = `O`'s last cell; `kind` = the direction pair at `oldEnd` in the NEW grid if that cell
  is still white, else `'space'` (cell destroyed ⇒ information lost ⇒ feature default).
- If `O` was destroyed: clear the pair at `oldEnd` (if the cell is white).
- If `O` survives as `N` (same key): clear the pair at `oldEnd` (if white); if `N`'s reconciled
  `nextWord != null`, set `N`'s NEW last-cell pair to `kind`; if the link was severed (target
  destroyed), leave the new pair empty.
- A length-unchanged linked word degenerates to read-clear-set-same — a no-op that preserves the
  user's space/hyphen/none choice.
- Direction-scoped pairs make across/down collisions at a shared cell impossible to conflate; two
  same-direction words cannot share a last cell (maximal runs are disjoint per direction).

## 2. Normative semantics

**Length pattern (FR-91 chain branch, replaces the `", "` member join).** For `w` with
`nextWord != null`, walk `Chain.membersOf(words, w.key)` in order as a *virtual single word*: one
flat cell sequence, run counter shared across the whole sequence. Within each member, the existing
adjacent-cell-pair rule applies (member's own markers split its runs; the member's own `nextWord` is
not consulted — no recursion, unchanged). Between member `i` (non-last) and member `i+1`, the
boundary marker on member `i`'s last cell decides: space → emit run + `", "`; hyphen → emit run +
`"-"`; neither → the run continues (no emission, run absorbs member `i+1`'s first cell). The final
run is emitted at the tail's last cell. Examples (member lengths 5, 9, 7, no internal markers):
space-joined → `5, 9, 7` (identical to today); hyphen-joined → `5-9-7`; no separators → `21`;
space join where the middle member carries an internal hyphen after its 2nd cell → `5, 2-7, 7`.

**Anagram helper (`Anagram.buildChainModel`).** The separator inserted between members (previously
hardcoded `'none'`, per the chain-aware selection addendum) is now derived from the member's
last-cell direction pair by the same reading rule. `AnagramModal.svelte` already renders
`'space'`/`'hyphen'`/`'none'` between tiles — no UI change.

**Grid rendering.** No change. `gridVM` already derives `separatorRight`/`separatorBottom` from cell
markers at every cell (including word-edge cells); `BuilderGrid`/`PlayerGrid` already render them.
The boundary symbol "at the edge of a word" appears automatically once the marker is set (edge
visibility explicitly out of scope per the feature doc).

**Marker toggling.** No reducer or UI change. `toggle-marker` already flips the pair on any selected
white cell with mutual exclusion; the boundary cell is just another cell. Selecting the source
word's last cell and toggling is the entire user interaction for changing a join separator.

**`Word` invariant addition (AD §3.3).** For every word `W` with `nextWord != null`, the separator
between `W` and its successor is `W`'s last-cell direction pair; the pair is never both-true
(existing `CellMarker` invariant). No requirement that one be set — empty is the legal "no
separator" state.

## 3. Behavior changes accepted

1. v1 files: a chain source whose last cell carries a *decoration* marker (e.g. a hyphen set
   pre-feature, previously a display no-op for chain enumeration) is now respected as that join's
   separator. The new reading is the intended one; affected data is rare (requires a marker on a
   linked word's end cell).
2. A linked word shortened from its end loses its boundary marker with the destroyed cell; the
   boundary defaults back to space (D5). A split word preserves the kind (old end cell still white).
3. Old builds reject v2 exports (D3).
4. Existing `LengthPattern` chain test fixtures gain materialized space markers; asserted output
   strings are unchanged (the space-joined default is display-identical to the old hardcoded join).

## 4. Code changes

| # | File(s) | Change |
|---|---|---|
| F1 | `src/domain/format/v1.ts` (+ callers `persistenceCodec.ts`, `builder/state/internal/importExport.ts`, `player/state/internal/lifecycle.ts`) | `parsePuzzleV1` → **`parsePuzzle`** (it now parses both versions; rename is honest, typecheck enumerates callers). Accept `version: 1 \| 2`. v1-only boundary normalization per D3 (runs after chain validation, before `Puzzle` construction). Serializers write `version: 2`. File name `v1.ts` stays (it hosts the v1/v2 schema family; no field changes). |
| F2 | `src/domain/chain/LengthPattern.ts` | Chain branch rewritten to the virtual-concatenation walk (§2). `singleWordPattern` retained unchanged for the no-`nextWord` branch. |
| F3 | `src/builder/state/internal/joinSubMode.ts` | `resolveJoin` success path materializes default space on the source's last cell (set space flag, clear hyphen flag — respects mutual exclusion) only when the pair is empty. `handleUnjoin` clears the source's last-cell direction pair (D4). |
| F4 | `src/builder/state/internal/reconcileWords.ts`, `designMode.ts` | `reconcileWords` returns `{ grid, words, displacedClues, events }` and applies the D5 boundary-marker rule to the grid; `handleToggleDesignCell` threads the returned grid into the new puzzle. |
| F5 | `src/domain/anagram/Anagram.ts` | `buildChainModel` derives inter-member separators from the member's last-cell pair (§2). |
| F6 | — | No changes: `gridVM`, `grid components`, `BuilderToolbar`, `cluePanelVM`/`playerVM` (both delegate to `LengthPattern.forWord`), `DisplayClue`, `CompletenessCheck`, `CellMarker`, intents, `DomainEvent`, ports. |
| S | `puzzles/*.json` | Reserialize to `version: 2` so the samples remain canonical records of what the app writes (DRN item 5 precedent). One sample (puzzle6) contains a chain; its implicit space boundary was materialized during reserialization — the same result the app produces when re-importing the old v1 file — so no display changes. |

## 5. Test cases (named)

**`test/domain/format/v1.test.ts`** (F1):
- `'parsePuzzle accepts version 2 files'`
- `'parsePuzzle rejects unknown version 3'`
- `'v1 chain with unmarked boundary is normalized to a space marker'`
- `'v1 chain with unmarked down-word boundary normalizes the bottom pair'`
- `'v1 chain with hyphen boundary marker is preserved'`
- `'v2 chain with unmarked boundary is preserved as no separator'`
- `'serializeIncomplete writes version 2'`
- `'round trip: v2 no-separator boundary survives serialize → parse'`

**`test/domain/chain/LengthPattern.test.ts`** (F2): existing chain fixtures gain materialized space
markers (asserted strings unchanged); new:
- `'chain with hyphen boundary markers renders 5-9-7'`
- `'chain with empty boundary markers merges member lengths into 21'`
- `'chain with mixed boundaries renders 5, 9-7'`
- `'none boundary merges the run into the next member's internal space split (7, 7, 7)'` —
  members 5, 9 (internal space after its 2nd cell), 7; first boundary empty, second space → `7, 7, 7`
- `'boundary marker on a down-word member reads the bottom pair'`

**`test/builder/state/internal/joinSubMode.test.ts`** (F3):
- `'join materializes default space marker on source last cell (across)'`
- `'join materializes default space marker on source last cell (down → spaceBottom)'`
- `'join respects a pre-existing hyphen marker on source last cell'`
- `'unjoin clears the boundary marker pair on source last cell'`
- `'unjoin leaves the other direction's markers and other cells' markers untouched'`

**`test/builder/state/internal/reconcileWords.test.ts`** (F4): adapt to the new return shape; new:
- `'unchanged linked word keeps its boundary marker (space, hyphen, and none each preserved)'`
- `'lengthened linked word moves the boundary marker to the new last cell and clears the old cell'`
- `'end-shortened linked word defaults its boundary to space when the old end cell is destroyed'`
- `'split linked word moves the boundary marker; surviving old end cell is cleared'`
- `'severed link (target destroyed) clears the source's boundary marker'`
- `'destroyed linked word clears its old end-cell marker'`
- `'standalone words' markers are untouched by reconciliation'`

**`test/domain/anagram/Anagram.test.ts`** (F5): replace `'buildChainModel inserts none separator at
each word boundary'` with:
- `'buildChainModel derives a space boundary separator from the member's last-cell marker'`
- `'buildChainModel derives a hyphen boundary separator from the member's last-cell marker'`
- `'buildChainModel renders a none boundary separator when the pair is empty'`
- `'buildChainModel boundary on a down-word member reads the bottom pair'`

**`test/ui/bindings/viewmodels/anagramVM.test.ts`** (F5): update
`'deriveAnagramModalVM: separators between members are none'` to the marker-driven variants.
Other VM tests (`playerVM`, `cluePanelVM`) whose fixtures assert chain length-pattern strings gain
boundary markers as needed — sweep during F-tasks, `npm run test` is the gate.

## 6. Doc amendments (lead-engineer, before any code dispatch)

1. `requirements.md`: FR-28 (markers apply at chain boundaries of linked words' last cells);
   FR-36 (join materializes the default space marker); FR-37 (unjoin clears the boundary pair);
   FR-91 (chain branch: boundary-marker rule replaces the `", "` member join; examples); FR-94/FR-98
   (version 1|2 acceptance); FR-99 (v1 boundary normalization listed among the defaults).
2. `architecture_design.md`: §1.1 decision-table row (chain separators via boundary markers + v2);
   §3.3 `Word` invariants (+boundary-marker invariant); §3.4 & §8.4 `LengthPattern` behaviour;
   §3.7 & §6 format reference (v2 acceptance, v1 normalization, serializers write 2, `parsePuzzle`
   rename); §8.5 `reconcileWords` (new signature + D5 rule + RISK-1 test additions); §8.6 join step;
   FR-37 unjoin note in §4.3; §8.8 `buildChainModel`; §10.1 coverage list; §12.2 (format versioning
   realized as a single parser with version-dispatched normalization — lighter than the anticipated
   parallel `parsePuzzleV2`, no schema duplication).
3. `chain_aware_selection_addendum.md` §2 FR-82: supersession note — the deferred word-end separator
   is now specified (boundary markers, this plan; the hardcoded `'none'` inter-member separator is
   replaced).
4. `puzzles/*.json`: reserialize to version 2 (task S).
5. This document: the plan itself (this section).

## 7. Decomposition & verification

Lead amends docs (§6) first — the design document is the source of truth before any dispatch. Then
Senior tasks in order (F-rows are file-disjoint; F1–F5 may be parallelized pairwise, serialized
here for review discipline):

1. Task F1 — format v2 + normalization + sample reserialize.
2. Task F2 — `LengthPattern` chain-boundary semantics.
3. Task F3 — join/unjoin marker lifecycle.
4. Task F4 — `reconcileWords` boundary rule + grid return.
5. Task F5 — `buildChainModel` boundary separators + VM test sweep.
6. Final: `npm run ci` green (lint incl. boundary/madge checks, typecheck, vitest, build).

Manual verification addendum (§10.3 class): join two words → space bar appears at source's last
cell and clue list shows `a, b`; toggle hyphen there → glyph + `a-b`; toggle off → merged length;
reload mid-each-state to confirm persistence (v2 round trip).
