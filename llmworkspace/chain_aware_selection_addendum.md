# Addendum — Chain-Aware Selection & Anagram Helper

> Status: Amends (does not replace) `architecture_design.md`. Where this doc conflicts with the design
> doc, this doc governs for the features it covers. Decisions ratified by the human on 2026-08-07.
> Source questions Q1–Q10 + answers preserved inline for traceability.

## 1. Scope of change

The "selected word" concept (FR-7, FR-24, FR-81, FR-82, FR-88, CON-4) is widened to the **selected
word's whole chain**, in both Builder and Player. Mechanism is shared (`gridVM`, `cluePanelVM`,
`playerVM`, `builderVM`, `anagram.ts`, `anagramVM`).

Out of scope (unchanged): active clue banner text, `DisplayClue`, `LengthPattern`, `CompletenessCheck`,
join/reattach sub-mode behaviour, JSON format, persistence, numbering.

## 2. FR amendments

**FR-7** — "the selected word" becomes "the selected chain": the chain reachable by following
`nextWord` from the chain head, where the chain head is found by walking predecessors of the cursor's
containing word. The cursor-containing word remains the *anchor* of the selection; the chain is its
chain.

**FR-24 / CON-4** — "pale yellow for cells in the selected word" → "pale yellow for cells in **any
word of the selected chain**". Flat treatment: every cell of every chain member (excluding the
selected cursor cell itself, which stays `bg-selected`) gets `bg-in-word`. No third tier for "the
cursor-containing word within the chain". Black cells are never in a word, so never in a chain.

**FR-73** (clue list) — All chain members' entries render `isSelected: true` when the cursor's chain
is active. (Previously only the cursor-containing word's entry was selected.)

**FR-81** — "Anagram Helper modal for the currently selected word" → "Anagram Helper modal for the
currently selected **chain**". `canOpenAnagram` (PlayerToolbarVM) still just requires
`cursorOnWord`; opening derives the chain.

**FR-82** — "tile row modelling the selected word's cells" → "tile row modelling the selected
**chain's** cells, in chain order head→tail, word-by-word". Inter-word boundary (the gap between the
last cell of one member and the first cell of the next): **no separator tile / no separator glyph**
for now. Within-word separators still derive from cell markers as today. (Future: optional explicit
separator at word ends — deferred.)

**FR-83** — input filtered/clamped to **total chain length** (sum of member `length`s).

**FR-84** — fixed/non-fixed determination runs over the whole chain tile row; fixed positions are
those with a non-null `playerLetter` anywhere in the chain.

**FR-85** — validation: `input.length === totalChainLength` AND input multiset ⊇ fixed-positions
multiset (computed across the whole chain).

**FR-86** — scramble: non-fixed positions = all non-fixed positions across the whole chain. Otherwise
unchanged.

**FR-88** — "selected word changes... modal shall close... Moving the cursor within the same word does
not close the modal" → "Moving the cursor within the **same chain** does not close the modal; moving
to a cell whose chain's head differs from `openedForWord` closes the modal." `openedForWord` now holds
the chain **head's** `WordKey` (the field is not renamed — it is `openedForWord` by identifier, but
semantically holds the head key). Comparison in `anagramAfterCursorChange` becomes a
`Chain.headOf(wordMap, newCursorWord.key)` vs `openedForWord` equality.

## 3. Domain additions

`domain/chain/Chain.ts` gains:

```ts
headOf(words: WordMap, k: WordKey): WordKey;   // walk predecessors until isHead; throws on cycle/dangling
```

Rationale (Q9): chains are linear, no branches (enforced by `ChainValidation`), so every member has
a unique head. Reuse the existing predecessor walk pattern from `DisplayClue.forWord`; throw on a
cycle/branch invariant violation (these are already rejected at import and maintained by
reconciliation, so throw = programmer error). The `modal` storing head's `WordKey` gives O(1)
chain-equality comparison at every cursor move instead of a full walk.

## 4. Anagram model widening

`domain/anagram/Anagram.ts` gains (keep `buildWordModel` for backward compat — tests still cover it; no
caller removed, but production paths switch to the chain form):

```ts
buildChainModel(grid: Grid, members: Word[]): { entries: AnagramEntry[]; separators: CellSeparator[] };
```

- Concatenate `buildWordModel(grid, m)` per member `m` in chain order.
- `entries`: concatenate member `entries`; re-number `position` 0..totalLength-1 across the whole
  row (positions Sequentially assigned, not member-relative).
- `separators`: concatenate member `separators`; **insert a `'none'` separator between members**
  (one per boundary, `members.length - 1` boundaries) so `separators.length === entries.length - 1`
  remains invariant. (Q3 defer the visual rendering of a word boundary; the separator value is
  `'none'` so the UI renders nothing special today.)

`validateInput` and `scramble` operate on `entries` + `input` only — they don't know about words.
But `validateInput`'s length reference *was* `word.length`; production callers must pass the
**total chain length** (computed as `members.map(m => m.length).reduce(+...)`). Add an overload /
new function:

```ts
validateChainInput(totalLength: number, entries: AnagramEntry[], input: string): { ok: true } | { ok: false; reason: string };
```

Keep `validateInput(word, entries, input)` for `buildWordModel` callers. `scramble(entries, input,
rng)` is already word-agnostic — but it throws `input longer than word` where `word` is `entries.length`;
that invariant is preserved (entries.length now = total chain length). No new `scramble` variant
needed; production calls pass the chain entries.

## 5. Reducer changes (`player/state/internal/anagram.ts`)

- `handleOpenAnagramHelper`: derive `word` = containing word from cursor (unchanged); derive
  `head = Chain.headOf(WordMap.fromWords(puzzle.words), word.key)`; set `anagram.openedForWord =
  head`. If `word === undefined` (no containing word): no-op (unchanged).
- `handleAnagramInput` / `handleAnagramScramble`: derive the chain members via
  `Chain.fromHead(wordMap, state.anagram.openedForWord).members`; call `Anagram.buildChainModel`;
  clamp/validate against total chain length. (`handleAnagramInput`'s `clamped` line uses
  `word.length` → replace with `total chain length`.)

No reducer intent/union changes. No `PlayerState` shape changes.

## 6. Auto-close (`anagramAfterCursorChange`)

In `player/state/internal/solving.ts` (and any other site that mirrors it): the comparison

```ts
if (word === undefined || !WordKey.equals(word.key, anagram.openedForWord)) return null;
```

becomes

```ts
if (word === undefined) return null;
const head = Chain.headOf(wordMap, word.key);
if (!WordKey.equals(head, anagram.openedForWord)) return null;
return anagram;
```

`wordMap` is built once per call from `puzzle.words`.

## 7. View-model changes

`ui/bindings/viewmodels/gridVM.ts` — no shape change; `selectedWordCells: ReadonlySet<string>`
parameter retains its name (semantically "selected chain cells" now). Hilite logic unchanged.

`ui/bindings/viewmodels/playerVM.ts` + `builderVM.ts` — local `cellsOfWord(cursorWord)` becomes
`cellsOfChain(words, cursorWord)`: build `WordMap`, find cursor word's head, get `Chain.members`
from head, union the `cellsOfWord` of each member. Empty set when `cursorWord === null` or word has
no chain (single-word chain → its own cells, same as today). `cellsOfWord` helper remains (used by
`cellsOfChain`).

`cluePanelVM.ts` — `isSelected` becomes: cursor's chain head equals the entry's chain head. For a
word `w`: `isChainHead ? highlightedChainHead === w.key : highlightedChainHead === predecessorChainsHead(w.key)`.
Simpler: precompute the set of `WordKey.toCanonical` for all chain members once, then membership
check. `highlightedWordKey` field meaning is unchanged (still the cursor word's key for scroll-into-view);
add an internal `selectedChainMemberKeys: Set<string>` calc.

`anagramVM.ts` — `deriveAnagramModalVM`:
- `word` lookup by `anagramModal.openedForWord` (now a head key) → the head `Word`.
- `members = Chain.fromHead(wordMap, head.key).members`.
- `model = Anagram.buildChainModel(grid, members)`.
- `wordLength` field = `members.map(m => m.length).reduce((a,b) => a+b, 0)` — keep the field name
  (VM contract names are sticky); semantically it is chain length now.
- `validateInput` call → `validateChainInput(totalLength, entries, input)`.
- `tiles` and `expectedUniqueLetterCounts` derive from the concatenated `entries` — already
  iteration-based, no per-word assumption; just iterate over the longer entries array.

## 8. Builder Join/Reattach interaction (Q10)

Coexist. Chain-aware highlight applies in all Builder modes/sub-modes. The Join sub-mode's source
distinction (FR-34 banner) is separate and untouched; chain highlight is purely a grid/bg-color
concern. The `isStartableJoinSource` / `isLinkableFromJoinSource` / `isUnjoinable` clue-list flags
are unchanged.

## 9. No banner change (Q8)

`ActiveClueBannerVM` derivation in `playerVM.ts` (`deriveActiveClueBannerVM`) still uses
`findContainingWord` + `DisplayClue.forWord` + (`isHead` ? `LengthPattern.forWord` : `null`). The
banner text shows the **cursor-containing word's** display clue, not the chain head's. No change.
(The "See N Direction" reference for a non-head cursor word is already correct.)

## 10. Tests required (named cases)

**`test/domain/chain/Chain.test.ts`** (extend):
- `'Chain.headOf returns the head key for a head word'`
- `'Chain.headOf walks predecessors to the head for a mid-chain word'`
- `'Chain.headOf returns the word key for a tail word with a chain'`
- `'Chain.headOf throws on cycle'`
- `'Chain.headOf throws on dangling nextWord'`

**`test/domain/anagram/Anagram.test.ts`** (extend):
- `'buildChainModel concatenates entries head→tail and re-numbers position 0..N-1'`
- `'buildChainModel separators length === totalLength - 1'`
- `'buildChainModel inserts none separator at each word boundary'`
- `'buildChainModel keeps within-word separator markers from each member'`
- `'buildChainModel with single member behaves like buildWordModel'`
- `'validateChainInput ok when input length === total length and superset of fixed'`
- `'validateChainInput fails when input length < total length'`
- `'validateChainInput fails when input lacks a fixed letter'`

**`test/player/state/internal/anagram.test.ts`** (extend):
- `'open-anagram-helper: stores chain head WordKey in openedForWord'`
- `'anagram-input: clamps input to total chain length'`
- `'anagram-scramble: scrambles across whole chain, fixed positions preserved'`
- `'select-cell: anagram stays open when cursor moves to a cell in the same chain'`
- `'select-cell: anagram closes when cursor moves to a cell in a different chain'`
- `'move-cursor: anagram stays open within same chain, closes on chain change'`
- `'click-clue-panel-word: anagram stays open if clicked word is in same chain'`

**`test/ui/bindings/viewmodels/playerVM.test.ts`** (extend — if grep finds existing tests):
- `'derivePlayerShellVM: grid highlights all chain members when cursor on a chain member'`
- `'derivePlayerShellVM: cluePanel isSelected set on all chain members'`
Mirror in `builderVM.test.ts`.

**`test/ui/bindings/viewmodels/anagramVM.test.ts`** (extend):
- `'deriveAnagramModalVM: tiles span whole chain, total length = sum of member lengths'`
- `'deriveAnagramModalVM: separators between members are none'`

## 11. Verification commands

- `npm test` (full)
- `npm run typecheck`
- `npm run lint` (ESLint `no-restricted-imports` + madge cycle check)
- `npm run ci` (full gate)

## 12. Decomposition order (lead-engineer side)

1. `domain/chain/Chain.ts` `headOf` + tests. (No deps.)
2. `domain/anagram/Anagram.ts` `buildChainModel` + `validateChainInput` + tests. (Deps: none new.)
3. `player/state/internal/anagram.ts` open/input/scramble handlers use chain + tests. (Deps: 1, 2.)
4. `player/state/internal/solving.ts` `anagramAfterCursorChange` head-compare + tests. (Deps: 1.)
   (Also any other sites with the same comparison — grep again at dispatch time.)
5. `ui/bindings/viewmodels/anagramVM.ts` chain model + tests. (Deps: 2.)
6. `ui/bindings/viewmodels/playerVM.ts` `cellsOfChain` + tests. (Deps: 1.)
7. `ui/bindings/viewmodels/builderVM.ts` `cellsOfChain` + tests. (Deps: 1; parallel with 6.)
8. `ui/bindings/viewmodels/cluePanelVM.ts` chain-aware `isSelected` + tests. (Deps: 1.)
9. `npm run ci` green.