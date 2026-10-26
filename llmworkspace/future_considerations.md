# angryphrase — Future Considerations

Forward-looking material, not a description of the current system. Companion to `architecture.md`.

## Extension points the current code affords

- **Persistence layer.** All persistence goes through `StoragePort` / `DownloadPort` / `FilePickPort`. Adding IndexedDB or cloud sync later means adding a new port implementation; nothing else changes.
- **Format versioning.** Version 2 shipped 2026-09-09 with an identical schema to v1 (only the empty-chain-boundary interpretation differs), so a single parser (`parsePuzzle`) dispatches on the `version` field and applies the v1 boundary normalization conditionally — no schema duplication. A future v3 that *does* change fields should take a parallel-parser shape instead.
- **Anagram RNG.** Already an injected dependency; a "show deterministic scramble" feature is a one-line wiring change.
- **Routing.** `AppState.route` is an enum. Shareable URLs later mean swapping it for a hash router; nothing in reducers cares.
- **New Builder sub-modes.** `BuilderSubMode` is a discriminated union; new variants slot in with their own reducer case files (mirroring `joinSubMode.ts` / `reattachSubMode.ts`).
- **A11y pass.** Components stay presentational and isolated, so adding ARIA roles is a local change per component. `Modal.svelte` has the structure (backdrop, focusable buttons) but no focus trap; adding one is contained.

## Incremental view-model derivation — the open half of smell #14

**The problem.** Every dispatch re-derives the whole view-model tree, and the derived objects are fresh, so Svelte re-evaluates every grid cell (measured: 625 of 625 cell items per keystroke). The cost *shape* is now linear everywhere — the Builder shell derivation is 4× cheaper than it was — so what remains is the *frequency*: nothing is reused, per keystroke, forever.

**What was tried, and why it was rejected.** A projection layer was built and measured (stashed, not merged): the store derives a change description per dispatch (a diff of the before/after snapshots), and the projection copies the unchanged grid rows instead of deriving them. Three findings killed it. (1) The copy cost more than it saved: the identity-preserving merge over the whole tree cost 0.26 ms per keystroke while the row-skip saved 0.12 ms, so the layer was *slower* than plain derivation (0.64 ms vs 0.51 ms on a dense 25×25 fixture). (2) Deciding what to reuse required knowing what feeds each row — the state path of each grid row, which paths mean "the topology changed", which rows carry a highlight — which pushed grid-specific knowledge into a layer meant to be generic: the same "guard list beside the derivation" shape, only relocated. (3) The render-side saving it was built for could not be measured: in headless Chrome every update variant (no-op, fresh identities, stable identities) cost about 19 ms, so the browser-side payoff is still unquantified.

**The real fix — the shape is settled, the placement is not.** The reuse decision belongs **inside the derivation**, because only the derivation knows what feeds it, and it can answer that from its own inputs by identity — with no change-description layer at all:

- the state already carries the structure this needs: `Grid.setCell` copies one row and keeps the rest by reference, and `Puzzle.withGrid` keeps the `words` array, so "did this row change?" is a reference comparison, not a diff;
- so a derivation that has its **previous input and output** can reuse a part when its own inputs are unchanged: for a grid row, the row's cells reference-equal, the word list reference-equal, the topology mask for that row equal, and no cell in the row able to have a different highlight. Copying the previous part preserves its object identity, so the renderer skips it — the identity-preserving merge is not needed for what is copied, only for what is genuinely re-derived (and that is a small part);
- the scope is every view-model with a large tree, by the same pattern: the grid's rows, and the clue panel's entries (which depend on the words, the cell markers, the builder sub-mode and the highlight).

**The open question is where the previous input and output live.** There is no free home for them — wherever they go, this is *new retained state*, and the architecture has to say so rather than let it appear by accident:

- **the derivation retains them** (a closure-held previous input/output): one owner, no hand-over protocol, no protocol between collaborators — but `viewmodels/` stops being "pure state→VM derivation" and §3 Layer 2 would need amending, and the derivation becomes a factory rather than a function;
- **the derivation stays pure and takes them as parameters**: the purity rule survives, but the caller holds them — which puts retained state back in the bindings layer, the thing this attempt was rejected for;
- **the store holds them**: the store is the one stateful component, but it would then hold view-model inputs, which is a different kind of memory from the state it owns.

**The precondition nobody has measured.** The prize is the *render* side; the derivation is already linear and 4× cheaper. Before building any of this, measure what a keystroke actually costs in a real browser with a GPU — how much is Svelte re-evaluating 625 cell items, and how much is the browser's own layout and paint. If cell re-evaluation is a small share, none of this is worth doing and the open half of #14 should be closed as "not worth the complexity at this scale" rather than left dangling. If it is a large share, build it derivation-first, in the order above — and settle the placement question as part of that, not after it.

## Anticipated future requirements (out of scope today, designed-not-to-block)

- **Undo/redo.** The pure-reducer + intent dispatch model suits a snapshot stack: reducers are not reversible, but storing past `BuilderState`/`PlayerState` snapshots and popping on undo is. Strict immutability makes snapshots cheap via structural sharing.
- **Sample puzzle bundling.** The `puzzles/*.json` files already show the canonical format (version 2); `domain/format/parsePuzzle` would be the only entry point.
- **Foreign puzzle formats** (`.puz`, `.xd`, `.jpz`). Explicitly unsupported; if added, a sibling to `domain/format/` producing the same `Puzzle` type.

## Things that would change under scale

The application is single-user, single-device by design; scale is not a concern. If forced:

- **Large grids.** 25×25 is the max. Copying the grid on every edit is fine at this size (edits already copy only the touched row — `Grid.setCell` / `updateCells`); a much larger max grid would need a structural-sharing grid (e.g. row-vector immutable structure).
- **Many puzzles in localStorage.** Per-key progress keys can grow unbounded; no GC exists. If needed, a sweep on Player import could prune progress for keys no longer in any imported file.
