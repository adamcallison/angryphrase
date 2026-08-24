// Rng is a deps-injection abstraction (a determinism knob), not a side-effect port.
// Hoisted out of domain/ports/ports.ts (formerly domain/persistence/ports.ts) to break a type-only cycle
// (see llmworkspace/design_review_notes.md item 1).
export interface Rng {
  nextInt(n: number): number;     // 0 ≤ result < n
}
