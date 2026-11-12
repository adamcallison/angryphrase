# angryphrase

A client-only web app for building and solving cryptic-style crossword puzzles. Runs entirely in the browser, persists to `localStorage`, and ships as a **single self-contained HTML file** (all JS/CSS/favicon inlined; no external runtime fetches). No backend, no accounts.

Two top-level experiences, connected only by puzzle JSON files exported to and imported from your file system:

- **Builder** — design a grid (2–25 square, black cells, word separators), type answers, edit clues, link words into clue chains, and export the puzzle as JSON (incomplete or complete — complete exports are gated by a completeness check).
- **Player** — import a completed puzzle, solve it with an anagram helper, check your answers, and clear errors. Progress autosaves per puzzle.

## Use it

Hosted on GitHub Pages: **<https://adamcallison.github.io/angryphrase/>**

Everything runs locally in your browser — puzzles you build and progress you make are stored in that browser's `localStorage`, so nothing leaves your machine. To move a puzzle between devices or share it with someone, use the Builder's export (or Player's import) and pass the JSON file along.

Quick tour:

1. Pick **Build** or **Play** on the landing page.
2. **Build** — design the grid (click cells to toggle black squares, resize while blank), type answers and clues, link clues into chains ("See 5 Down"), then export. *Export Complete* only works once every white cell is filled and every chain-head clue is set; incomplete work exports as an `.json` file you can re-import later.
3. **Play** — import a completed puzzle file and solve. Your letters autosave per puzzle; re-importing the same file restores your progress. *Check* reports how you're doing (a result banner, no cell colouring) and enables *Clear Errors*; the anagram helper scrambles the letters you've typed, and *Reset* clears your progress for that puzzle.

## Stack

Svelte 5 (runes) · TypeScript · Tailwind (build-time only) · Vite + `vite-plugin-singlefile` · Vitest. Node ≥ 22 (pinned via `.nvmrc`).

## Getting started

```bash
npm install
npm run dev        # dev server
```

All scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → single-file `dist/index.html` |
| `npm run preview` | Preview the built artifact |
| `npm run test` | Vitest (pure-logic unit tests, one file per source module) |
| `npm run lint` | ESLint + `madge --circular` (cycle backstop) |
| `npm run typecheck` | `svelte-check` |
| `npm run ci` | lint + typecheck + test + build (what CI runs) |

CI (`.github/workflows/deploy.yml`): `npm run ci` on push to `main`, then deploys the `dist/` artifact to GitHub Pages.

## Architecture

Four principles shape the codebase:

1. **Thin UI** — components render view-models and invoke action bags; all logic lives in pure modules.
2. **Domain-driven** — the domain model is the centre; persistence, format, and UI are adapters at the edges. Pure functions over immutable objects.
3. **Explicit types** — precise field types; illegal states unrepresentable where feasible (range-checked branded types).
4. **No primitive obsession** — `Row`, `Col`, `Letter`, `WordLength`, etc. are branded types; plain `string`/`number` do not appear in domain signatures.

Layers (each may import only what the layer below grants it — enforced by ESLint, allowlist, path-resolved; the spec lives in `tools/boundaries.js`):

```
domain/          pure TS, zero framework imports: value objects, branded
                 types, pure functions, port interfaces
builder|player|app /state/   pure reducers: (state, intent, deps) → { state, events }
ui/bindings/     the seam: AppStore factory, experience facades,
                 view-models, persistence scheduling (only Svelte-aware module)
ui/              presentational Svelte components (VMs + action bags as props)
ports/           side-effect adapters: localStorage, download, file pick, rng
main.ts          the only composer
```

Reducers are pure and return side effects as `DomainEvent[]` data; the `AppStore` is the sole event interpreter and performer of external effects. Port implementations are swappable with test fakes (`test/fakes/`).

Full map: [`llmworkspace/architecture.md`](llmworkspace/architecture.md) — the authoritative description of the system as built, including the state model, persistence scheme, component inventory, and boundary rules. Companion: [`llmworkspace/future_considerations.md`](llmworkspace/future_considerations.md).

## Puzzle file format

JSON, `version: 2` (v1 files still parse — same schema, differing only in one chain-boundary interpretation). Two types: `incomplete` (Builder work-in-progress, may also carry displaced clues) and `complete` (every white cell filled, chain-head clues set, non-head clues empty). Parsing is strict: unknown fields, out-of-range sizes, invalid chains, and non-head clue text all fail with a human-readable error list.

Sample puzzles in [`puzzles/`](puzzles/) — canonical `version: 2`, `type: 'complete'` files, kept as a record of the format.

## License

Released into the public domain (Unlicense) — see [LICENSE](LICENSE).
