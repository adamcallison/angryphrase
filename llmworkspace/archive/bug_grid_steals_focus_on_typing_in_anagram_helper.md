# Bug: grid steals focus on typing in anagram helper

## Observed behaviour
When typing letters into the anagram helper modal, each keypress causes the grid (probably the "hidden input")
to steal the focus, meaning subsequent keypresses put letters into grid. Using the anagram helper requires
clicking/tapping back in the anagram helper textbox after each keypress.

## Expected behaviour
Typing into the anagram helper textbox does not move the input focus away from the anagram helper textbox.
All other typing/focus behaviours remain the same.

## Root cause
`TypingSurface.svelte`'s `$effect` refocuses the hidden input. It reads the `cursor` prop. In `PlayerShell.svelte` the `cursor` prop is bound to `vm.grid.cursor`, where `vm` is `$derived(playerShellVM())`, which reads the whole app `state`. So the `cursor` prop transitively depends on the entire `state` signal. Consequently every dispatch — including `anagram-input`, which does **not** change the cursor — marks the `cursor` prop dirty and re-runs the effect, which calls `inputEl.focus()` and steals focus from the anagram helper textbox.

Confirmed via a jsdom component repro:
- An effect reading only `cursor` re-runs on `anagram-input` even though `cursor === prev` (value stable by reference).
- Effects reading only `enabled` or only `inputEl` do **not** re-run on `anagram-input`.

So the effect over-fires: the design doc (§7.4 `TypingSurface`) intends it to refocus "when `enabled` is true and the `cursor` ref changes" (i.e. on `select-cell` / clue-panel clicks), but in practice it refocuses on every state mutation. While the anagram modal is open, `enabled` is still `true` (`phase === 'solving'`), so the surface stays armed and grabs focus on every anagram keypress.

## Proposed fix
State-driven, no DOM id / no cross-component focus calls (respects G1/G2 and design §7.4). No change to `TypingSurface.svelte` itself: its existing effect already blurs when `enabled` is false and focuses when `enabled` is true. Gate `enabled` from the bindings layer so the surface is disabled while the anagram modal is open.

1. **`src/ui/player/PlayerShell.svelte`** — pass `enabled={vm.phase === 'solving' && !vm.anagram.open}` to `TypingSurface` (instead of `vm.phase === 'solving'`).
   - Modal open → `enabled = false` → effect blurs the hidden input and the input is `inert` → nothing steals focus; anagram textbox retains focus while typing.
   - Modal close → `enabled = true` → effect refocuses the surface → grid typing resumes.
   - Cursor change while modal closed → refocus as before. A different-word cursor change while the modal is open closes the modal (FR-88), flipping `enabled` back to `true` and refocusing the surface.
2. **`src/ui/player/AnagramModal.svelte`** — add an `onkeydown` Escape handler on the anagram input that calls `dispatchCloseAnagramHelper()` (already imported; matches the close button + backdrop affordances). This preserves FR-89 (Escape closes the modal) for the case where the anagram textbox is focused, since the typing surface no longer captures Escape while the modal is open.
3. **Design doc note** (§7.4 `TypingSurface` / `PlayerShell`) — one sentence: "PlayerShell disables the `TypingSurface` while the anagram modal is open so the modal's input retains focus."

No domain, state, or reducer changes. The `anagram-input` reducer is untouched. No change to `TypingSurface.svelte` or `BuilderShell.svelte` (the Builder has no anagram modal; FR-81 is Player-only).

### Tradeoff
Gating `enabled` blurs the surface when the modal opens (the surface no longer stays focused while the modal is open). Side effect: opening the modal and pressing arrow keys *before* clicking the anagram textbox no longer navigates the grid. Arrow keys move the caret inside the anagram textbox instead (normal text-input behaviour). This is acceptable: FR-88's arrow-path still works whenever the surface holds focus (modal open but textbox not yet clicked; or modal closed). Escape is covered by change 2.

### Verification
- Manual: open the anagram helper, click the textbox, type several letters → focus stays in the textbox. Close the modal → grid typing resumes. Press Escape with the textbox focused → modal closes.
- `npm run ci` stays green (lint incl. madge circular, typecheck, test, build).

## Resolution
Fixed as proposed, plus the autofocus-on-open enhancement (so the player can type immediately without clicking the textbox first).

Files changed:
- **`src/ui/player/PlayerShell.svelte`** — `TypingSurface` `enabled` is now `vm.phase === 'solving' && !vm.anagram.open` (was `vm.phase === 'solving'`). One-line change; `TypingSurface.svelte` itself untouched (its existing effect already blurs on `enabled=false`, focuses on `enabled=true`).
- **`src/ui/player/AnagramModal.svelte`** — added `let inputEl`/`wasOpen` `$state` and a transition-guard `$effect` that focuses the textbox only when `vm.open` transitions `false→true` (not on every dispatch, so it never re-grabs mid-typing); added `bind:this={inputEl}` and `onkeydown` Escape → `dispatchCloseAnagramHelper()` on the textbox. No new imports (`dispatchCloseAnagramHelper` was already imported).
- **`llmworkspace/architecture_design.md`** — updated three §7.4 component-table rows (`PlayerShell.svelte`, `AnagramModal.svelte`, `TypingSurface.svelte`) to document the `enabled`-gating, the textbox Escape handler, and the autofocus-on-open effect.

No domain, state, reducer, intent, or view-model changes. `TypingSurface.svelte`, `BuilderShell.svelte`, `anagramVM.ts`, and `playerVM.ts` untouched.

Verification results:
- `npm run ci` green: lint (incl. `madge --circular`), `svelte-check` typecheck, 1074 tests, `vite build` all pass.
- Runtime jsdom repro (temporary, not committed — project has no component-test harness and extra 3 was declined): mounted `PlayerShell`, opened the anagram helper, typed two keypresses — `document.activeElement` stayed on the anagram textbox throughout (no theft); Escape closed the modal; after close the hidden typing surface was refocused (grid typing resumes). Pre-fix the same repro showed focus moving to the hidden input after the first keypress.
