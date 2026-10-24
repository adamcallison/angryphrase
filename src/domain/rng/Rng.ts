// Rng is a deps-injection abstraction (a determinism knob), not a side-effect port.
// See architecture.md §3 Layer 0 (domain/rng/) — reducers call it directly.
export interface Rng {
  nextInt(n: number): number;     // 0 ≤ result < n
}
