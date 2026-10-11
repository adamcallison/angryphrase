# angryphrase — Future Considerations

Forward-looking material, not a description of the current system. Companion to `architecture.md`.

## Extension points the current code affords

- **Persistence layer.** All persistence goes through `StoragePort` / `DownloadPort` / `FilePickPort`. Adding IndexedDB or cloud sync later means adding a new port implementation; nothing else changes.
- **Format versioning.** Version 2 shipped 2026-09-09 with an identical schema to v1 (only the empty-chain-boundary interpretation differs), so a single parser (`parsePuzzle`) dispatches on the `version` field and applies the v1 boundary normalization conditionally — no schema duplication. A future v3 that *does* change fields should take a parallel-parser shape instead.
- **Anagram RNG.** Already an injected dependency; a "show deterministic scramble" feature is a one-line wiring change.
- **Routing.** `AppState.route` is an enum. Shareable URLs later mean swapping it for a hash router; nothing in reducers cares.
- **New Builder sub-modes.** `BuilderSubMode` is a discriminated union; new variants slot in with their own reducer case files (mirroring `joinSubMode.ts` / `reattachSubMode.ts`).
- **A11y pass.** Components stay presentational and isolated, so adding ARIA roles is a local change per component. `Modal.svelte` has the structure (backdrop, focusable buttons) but no focus trap; adding one is contained.

## Anticipated future requirements (out of scope today, designed-not-to-block)

- **Undo/redo.** The pure-reducer + intent dispatch model suits a snapshot stack: reducers are not reversible, but storing past `BuilderState`/`PlayerState` snapshots and popping on undo is. Strict immutability makes snapshots cheap via structural sharing.
- **Sample puzzle bundling.** The `puzzles/*.json` files already show the canonical format (version 2); `domain/format/parsePuzzle` would be the only entry point.
- **Foreign puzzle formats** (`.puz`, `.xd`, `.jpz`). Explicitly unsupported; if added, a sibling to `domain/format/` producing the same `Puzzle` type.

## Things that would change under scale

The application is single-user, single-device by design; scale is not a concern. If forced:

- **Large grids.** 25×25 is the max. `GridOps.clone` on every edit is fine at this size; a much larger max grid would need a structural-sharing grid (e.g. row-vector immutable structure).
- **Many puzzles in localStorage.** Per-key progress keys can grow unbounded; no GC exists. If needed, a sweep on Player import could prune progress for keys no longer in any imported file.
