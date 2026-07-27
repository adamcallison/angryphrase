# Version Stamp — Implementation Plan

> Status: Planned. Not yet implemented. Pair with `architecture_design.md` (no design-doc change required; this is a build/presentation detail, not a domain/architecture concern).

## Goal

Bake the git commit hash and build timestamp into the single-file HTML output and render them at the bottom of every page, so a stale CDN-cached copy is visually distinguishable from a fresh build.

This is a **staleness detector**, not a cache-buster. The footer lives inside the cached HTML; a stale CDN copy shows a stale hash by design. Compare the shown hash against your local `git rev-parse --short HEAD` to judge whether the served HTML matches your latest local build.

## Requirement — must work in both local and CI builds

The git read runs at Vite config-eval time via `execSync`. It is expected to succeed in both common build environments:

- **Local builds:** git binary present, working tree is a repo. `execSync` returns the current HEAD short hash and commit author date. Stamp matches the local checked-out commit.
- **CI builds (e.g. GitHub Actions):** `actions/checkout` (default fetch-depth 1, shallow) still produces a working git repo where `git rev-parse --short HEAD` and `git log -1 --format=%cI` succeed. HEAD and its author date are present even in a depth-1 clone. Stamp matches the CI commit.
- **Failure path:** if the git binary is missing or the working directory is not a repo (rare sandboxed CI), the `safe()` wrapper returns `'unknown'` for both fields. The footer then renders `unknown · unknown`, which is itself a useful signal that the build environment could not read git.

No extra CI plumbing, no token, no non-default checkout settings beyond what a standard shallow checkout already provides. The existing `npm run ci` gate is sufficient.

## Decisions

1. **Hash source — git short commit.** `git rev-parse --short HEAD` (7 chars). Build-time only; no runtime fetch.
2. **Timestamp source — git commit author date (ISO).** `git log -1 --format=%cI`. Reflects last-commit time, not wall-clock build time, so rebuilds without a new commit produce identical output (aid reproducibility). Falls back to `unknown` if git lookup fails.
3. **Exposure — Vite `define`.** Two global constants injected at build: `__APP_COMMIT_HASH__` and `__APP_BUILD_TIME__`. Declared in a `vite-env.d.ts`-style ambient file for TypeScript. No runtime git invocation; no new dependency.
4. **Scope — client-only.** No backend endpoint, no `/version.json`. Single-file app stays single-file.
5. **Footer not a cache-buster.** No query-string appends. The footer's purpose is detection, not eviction.

## Note on reproducibility (out of scope if unwanted)

The plan uses commit timestamp (not build wall-clock) specifically so that rebuilding the same commit twice yields identical HTML. If you instead want the timestamp to refresh on every build run (regardless of commit), switch the timestamp source to `new Date().toISOString()` in the Vite plugin below. That change is the only delta; flag it before implementation if preferred.

## Files to create / modify

| File | Action | Purpose |
|---|---|---|
| `vite.config.ts` | modify | Add an inline build plugin that shells out to `git`, returns the two strings, and injects them via `define`. |
| `src/vite-env.d.ts` (or existing ambient decl file if one exists) | modify/add | Declare the two global `const`s so TS knows about them. |
| `src/ui/shared/VersionStamp.svelte` | create | Presentational component: renders the hash and timestamp at the bottom. Receives no props; reads globals. |
| `src/ui/app/App.svelte` | modify | Render `<VersionStamp />` once, after `<Modal />`, inside the root `<div class="flex min-h-screen flex-col">`. |

No domain, state, reducer, port, or bindings changes. No new dependencies. No test fixture changes.

## Architectural rules in force (from `architecture_design.md` §0)

- **Thin UI.** `VersionStamp.svelte` is purely presentational: it renders two strings and emits nothing. It reads build-time-injected constants, not domain state.
- **Layer boundaries.** The component lives in `ui/shared/`. It imports no domain, no bindings, no ports. The globals are build-time constants, not runtime dependencies.
- **Explicit types.** The two globals are typed `string` in the ambient declaration.

## Implementation detail — Vite plugin

Inside `vite.config.ts`, add an inline plugin (no separate package) running before the build:

```ts
import { execSync } from 'node:child_process';

function gitInfo(): { hash: string; time: string } {
  const safe = (cmd: string): string => {
    try {
      return execSync(cmd, { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  };
  return {
    hash: safe('git rev-parse --short HEAD'),
    time: safe('git log -1 --format=%cI'),
  };
}

const { hash, time } = gitInfo();

export default defineConfig({
  define: {
    __APP_COMMIT_HASH__: JSON.stringify(hash),
    __APP_BUILD_TIME__: JSON.stringify(time),
  },
  plugins: [
    svelte({ compilerOptions: { runes: true } }),
    viteSingleFile(),
  ],
  build: { target: 'es2022', cssMinify: true },
});
```

Notes for the implementer:

- The git lookup runs once at config evaluation time (process start), not per-module. Cheap.
- `JSON.stringify` ensures the defined values are string literals in the bundle.
- Failure (no git, e.g. some CI sandboxes) returns `'unknown'` for both. The footer then shows `unknown / unknown`, which is itself a useful signal (build environment could not read git).
- Do not run git during the Svelte compile; keep it in the Vite plugin/config scope only.
- The two globals replace at build time, so they end up as literal strings baked into the single HTML file. `vite-plugin-singlefile` inlines them with the rest of the JS.

## Implementation detail — ambient declarations

Add to a `src/vite-env.d.ts` (create if absent; check whether one already exists first to avoid duplication):

```ts
declare const __APP_COMMIT_HASH__: string;
declare const __APP_BUILD_TIME__: string;
```

If a `src/vite-env.d.ts` already exists, append these two lines rather than creating a new file.

## Implementation detail — VersionStamp component

`src/ui/shared/VersionStamp.svelte`:

- No props.
- Reads the two globals directly.
- Renders a `<footer>` pinned/positioned at the bottom of the viewport (not below the fold). Suggested style: fixed bottom-right, tiny (`text-[0.6rem]`), muted (`text-gray-400`), `pointer-events-none`, `select-none`, monospace if a project class exists (otherwise `font-mono`).
- Layout rule: must not capture clicks or interfere with the grid. Use `pointer-events-none`.
- Text format suggestion: `{hash} · {time}` where time is rendered as-is (ISO) or lightly formatted via `new Date(__APP_BUILD_TIME__).toLocaleString()` guarded by `unknown` fallback. Keep it simple: show the raw ISO string if not `unknown`, otherwise `unknown`.

Sketch:

```svelte
<footer class="fixed bottom-0 right-0 px-2 py-1 text-[0.6rem] text-gray-400 font-mono pointer-events-none select-none">
  {__APP_COMMIT_HASH__} · {__APP_BUILD_TIME__}
</footer>
```

## Implementation detail — App.svelte wiring

In `src/ui/app/App.svelte`:

- Import `VersionStamp` from `../shared/VersionStamp.svelte`.
- Render it once after `<Modal />`, inside the existing root `<div class="flex min-h-screen flex-col">`.

```svelte
<div class="flex min-h-screen flex-col">
  <Header />
  <main class="flex-1">
    ...routes...
  </main>
  <ToastHost />
  <Modal />
  <VersionStamp />
</div>
```

It is intentionally outside `<main>` so it shows on every route (landing, build, play). `position: fixed` keeps it visible regardless of scroll.

## Tests

No unit tests required by spec (§1.1 row D2: no DOM/component harness; visual verified manually). The component is a pure render of two build-time strings; no domain logic to test.

If a manual smoke check is desired:
- `npm run build` then `grep` `dist/index.html` for the short hash; confirm it matches `git rev-parse --short HEAD`.
- Open the built `dist/index.html` in a browser and confirm the stamp renders bottom-right.

## Verification

1. `npm run typecheck` — ambient globals resolve.
2. `npm run lint` — no new import violations (component imports nothing; global decls are ambient, not imports).
3. `npm run build` — succeeds; `dist/index.html` contains the short hash substring and an ISO timestamp substring.
4. `npm run ci` — full gate stays green.

## Out of scope

- No cache-busting query strings.
- No server/canary `/version.json`.
- No per-file content hashes.
- No toggling the stamp on/off via runtime config.
- No domain, state, or bindings edits.
- No i18n.

## Confirmed choices (human-approved)

1. **Timestamp source = commit date** (`%cI`). Reproducible across rebuilds of same commit.
2. **Footer position = fixed bottom-right.** Always visible.
3. **Content = hash + timestamp** (`{hash} · {time}`).

All three defaults in this plan are locked. Ready to dispatch when requested.