# Console-output audit — which `console.*` sites should be replaced

> Audit date: 2026-09-07. Scope: `src/` (26 `console.warn` sites; zero `console.log` / `console.error` / `console.info` / `console.debug` / `console.trace` in production code). `dist/` is build output — excluded. Test files that *assert* warns are listed under "Test impact" only.
>
> Companion findings live in `code_smells.md` as **P2–P4** (open). This doc is the full audit; the smells log carries one-line pointers.

## Inventory & verdicts

| # | Site | Verdict | Authority |
|---|------|---------|-----------|
| 1–9 | `src/ui/bindings/persistenceCodec.ts` — warns at lines 47, 55, 61, 71, 114, 119, 124, 130, 148 | **Keep** | AD §9 (line 1104): corrupt blob → "`console.warn` is acceptable; no toast." Tests assert the warn fires (`persistenceScheduler.test.ts:129`, round-trip/garbage cases) |
| 10–11 | `src/main.ts` — lines 51, 62 | **Keep** | NFR-9 boot fallback; AD §9 (line 1104) — fresh-blank start, warn acceptable, no toast |
| 12 | `src/ui/bindings/appStore.svelte.ts:51` — `appStore: download failed` | **Keep** | G7 fix (archive lines 504–513) deliberately retains the warn at the bindings layer *alongside* the `report-download-failure` error toast |
| 13–14 | `src/ui/bindings/appStore.svelte.ts:78, 86` — NFR-9 silent-drop warns | **Keep** | AD §9 (line 1104) + Player corrupt-progress drop; `appStore.test.ts:294, 311` assert them |
| 15, 20 | `src/ports/localStoragePort.ts:17, 39` — `loadBuilder` / `loadPlayerProgress` catch+warn+`null` | **Keep** | §3.7 never-throw contract, single warn site in adapter; absent ≡ failed both map to the same NFR-9 fallback, so no observer is needed |
| 16, 17, 18, 21 | `src/ports/localStoragePort.ts:25, 32, 47, 54` — `saveBuilder` / `clearBuilder` / `savePlayerProgress` / `clearPlayerProgress` catch+warn+`void` | **Replaced (P3, landed 2026-09-08)** — writes now catch + return `Error \| null` silently (warn moved to appStore); §3.7 amended to the reads-benign / writes-`Error\|null` principle | See "P3" below |
| 19, 22–25 (partial) | `src/ports/filePickPort.ts` — lines 14, 25, 58, 68 | **Keep until P4 lands, then move to bindings** | §3.7 + AD line 780 ("impl warns once on genuine failure; cancel is silent"); on P4 the warns move to the bindings layer per the G7 Task A pattern |
| 26 | `src/ui/shared/FilePicker.svelte:20` — `pickFile failed` catch | **Remove (P2)** | Dead code: §3.7 never-throw contract + AD §2.1 line 205 "Consumers add no redundant catch layers" — the port cannot throw, so this catch is unreachable. Removed by P2/F+B (component de-IO'd; §7 line 314 props row amended) |
| 27 | `src/ui/shared/FilePicker.svelte:45` — drop read failed | **Replace with toast (P2)** | NFR-12 (line 270): user-facing errors "surfaced via the toast system (FR-92) rather than silently ignored or failing the console". P2/F+B path: port `readDroppedFile` + facade `importDroppedFile` action + per-experience `report-import-read-failure` intent → toast |

(27 rows because the localStoragePort write sites are counted individually above; total distinct `console.warn` call sites in `src/` = 26.)

## Keep rationale (summary)

All corrupt-blob / NFR-9 sites (`persistenceCodec`, `main.ts`, `appStore:78,86`) warn and *correctly* give no toast: no user action is pending, the mandated fallback (fresh Builder / import screen) already happened, and a boot-time toast about an internal blob would be noise. The bindings-layer download warn (`appStore:51`) is half of a warn+toast pair by design (G7). Port-adapter warns are the sanctioned "single warn site" (§3.7) wherever the failure maps to a *distinguishable* benign return.

## Replace findings

### P2 — `FilePicker.svelte`: dead catch + drop-read failure invisible to the user ✅ (landed 2026-09-08)

Two defects in one file — the only component-level `console.warn` in the codebase (the drop path bypassed the port by design; see `filePickPort.ts:3-5`).

**Design decision (2026-09-08, human sign-off): F+B.** The original proposal (AppIntent `report-import-read-failure` + required `onreaderror` prop on FilePicker) was superseded during plan review. An AppIntent raised from a leaf would have forced a cross-dialect dispatch through an experience facade (whose `dispatch` is deliberately narrowed, AD §2.1 line 183) — extending a soft spot with zero in-repo precedent for *experience* facades emitting AppIntents (modal/toast facades doing so is native dialect, not precedent). The landed design instead:

- **F — per-experience intents.** `{ kind: 'report-import-read-failure' }` (fieldless) joins **both** `BuilderIntent` and `PlayerIntent`. The shared kind string lands in `AMBIGUOUS_INTENT_KINDS` (auto-derived intersection) and routes by `state.route` — existing machinery, precedent `select-cell` / `type-letter`. Each reducer mirrors its existing parse-reject surfacing, so read failure surfaces exactly where parse failure already surfaces (NFR-12):
  - Builder (`importExport.ts`): emits error `toast` event `'Could not read that file. Please try again.'`, state unchanged — identical shape to the parse-reject branch of `executeImport`.
  - Player (`lifecycle.ts`): returns `{ phase: 'import', lastImportError }` + error `toast` event — identical shape to `handleImportPuzzle`'s reject branches (banner + toast).
  - G7's AppIntent shape was not copied because G7's failure is observed *inside* the store's event loop (store-level fact → AppIntent home correct); this failure is observed in experience UI during the experience-owned import flow.
- **B — the component stops doing IO.** The drop path's `await file.text()` moves behind the port: `FilePickPort.readDroppedFile(file: File): Promise<string | null>` (never-throw §3.7; a dropped file has no cancel path, so `null` is always genuine failure; impl warns once, same as `pickFile` today — warns move to bindings at P4). `FilePicker.svelte` becomes fully presentational: props `{ label, pick, onpick, ondropfile }`; drop handler extracts `files[0]` and calls `ondropfile(file)`; no try/catch, no `console.*`. The original `onreaderror` prop is gone — failure surfacing is fully store-mediated (P4 will not need it either; see P4 update).
- **Facade actions** (native dialect, no narrowing bypass): `BuilderToolbarActions.importDroppedFile(file)` / `PlayerImportScreenActions.importDroppedFile(file)` — read via `readDroppedFile`; `null` → dispatch `report-import-read-failure`; text → dispatch `request-import-puzzle` / `import-puzzle`. Drop and pick converge on the same import intents.

The two original findings stand unchanged in substance:

1. **Line 19-21, remove.** `triggerPick` wraps `await pick()` in try/catch + `console.warn('FilePicker: pickFile failed', err)`. The port never throws (§3.7, AD line 205: "Consumers add no redundant catch layers"); this catch is unreachable and its warn site contradicts AD line 314 ("a `null` result from `pick` … `onpick` is not called and nothing is logged"). Under F+B the whole handler is `const text = await pick(); if (text === null) return; onpick(text);` — code drift from the AD as written, no AD amendment needed for this half.
2. **Line 44-46, replace with a toast.** `onDrop` reads the dropped file with `await file.text()` directly; on rejection it only `console.warn`s and swallows. The user dropped a file and nothing visibly happens — exactly the NFR-12 "silently ignored or failing the console" case. Note the asymmetry this fixes: a *picked* file that parses to garbage gets a toast/banner downstream (Player `import-puzzle` reject path; Builder confirm-import path), but a file that cannot even be *read* got nothing.

### P3 — `StoragePort` write methods return `void`; autosave failure is invisible data loss ✅ (landed 2026-09-08)

`saveBuilder` / `savePlayerProgress` / `clearBuilder` / `clearPlayerProgress` caught, warned, and returned `void` (`localStoragePort.ts:25, 32, 47, 54`). The `void` return meant the bindings layer *could not know* a write failed — `persistenceScheduler.doSaveBuilder` / `doSavePlayer` called the port bare (AD line 205 mandated this) and had no failure channel. Effect: with localStorage persistently failing (quota exceeded ~5 MB on large grids, privacy modes, disabled storage), every debounced autosave failed for the whole session and the user had zero signal that **nothing was being saved**. Same flaw class as G7 (`DownloadPort` void-return).

**Design decision (2026-09-08, human sign-off: W1 construction move, per-slice latches, write-driven re-toast cadence, export-hint copy).** The proposed fix above had five defects, found during plan review and resolved as:

- **PD1 — wiring.** "Scheduler needs a dispatch callback (facade-injected)" was confused (facades never touch the scheduler) and hid a real construction cycle: the store takes the scheduler as an argument, while failure surfacing needs the store's dispatch — whoever built the scheduler could never wire it. Resolved by **W1**: `createAppStore` constructs the scheduler internally from `ports.storage` (`options.persistenceDebounceMs`, default 400 ms), so the failure handler is a factory-wired closure — no registration hook, no two-phase init, no cycle. Bonus: removes a latent injection mismatch (the scheduler's storage and the store's `ports.storage` could previously diverge).
- **PD2 — policy home.** Latch / warn / toast / re-arm policy lives in the **appStore** (G7 precedent: the point with dispatch context), not the scheduler. The scheduler stays a mechanical debounce/serialize/clear machine that reports every *attempted* write via `onWriteResult(slice, err)` — saves (timer), clears (synchronous), and `flush()`; skipped writes (import-phase player) report nothing.
- **PD3 — one toast conflated the slices.** Builder and player saves are independent channels (separate timers, F8 split). Landed: **per-slice** fieldless AppIntents `report-builder-save-failure` / `report-player-save-failure`, per-slice latches, per-slice copy.
- **PD4 — clears.** Clear failures arm the same slice latch (toast). Builder stale blob self-heals — the next successful save overwrites it. A failed `clearPlayerProgress(key)` leaves a stale keyed blob that resurrects only if that exact puzzle is re-imported (accepted edge, human-approved).
- **PD5 — amendment list completed** (below).

Surfacing behaviour: first failure of an episode → `console.warn` once + error toast; latch re-arms only after a subsequent successful write in that slice; while armed, **write-driven re-toast cadence** — `options.saveFailureRetoastMs`, default 60 s (a failed write landing ≥ N after the slice's last toast re-toasts; reminders ride on attempted writes, so an idle session — no writes, nothing new lost — never nags; no wall-clock timer). Copy: "Saving failed — your Builder changes are not being kept. Download an export to keep a copy." / "Saving failed — your solving progress is not being kept."

Also landed: a **re-entrant dispatch guard** — the write-result handler fires synchronously inside `performExternalEvent`'s clear cases during a dispatch batch; a nested `dispatch` would run a second work-queue against the outer loop's stale local state (lost-update with multi-event batches). Re-entrant dispatches now join the active work-queue (F6 fix generalized).

Port shape: writes return `Error | null` silently (non-`Error` throws coerced, G7 Task A idiom); loads keep the benign `null` + single warn site (absent ≡ failed → NFR-9 fallback; no observer needed). `InMemoryStoragePort` gained one-shot `nextWriteError` injection (mirrors `StubDownloadPort.nextDownloadError`). ~30 test call sites lost their scheduler argument; the appStore scheduler-identity test was rewritten to assert the internal scheduler persists via the injected port.

AD amendments (2026-09-08): §1.3 intents row; §2.1 appStore row + scheduler row + port never-throw paragraph (reads-benign/writes-`Error|null` principle) + main.ts row; §2.2 external-effects bullet (+ write-failure channel); §2.4 signature block + dispatch note; §3.7 `StoragePort` block + never-throw comment; §4.1 `AppIntent` block + steps 7-8; §4.5 steps 1-2 (reporting, latches, cadence, clears); §7 test-construction recipe.

### P4 — `FilePickPort.pickFile(): Promise<string | null>` conflates cancel with failure 🟠

The single `null` channel means "user cancelled" and "the pick genuinely failed" are indistinguishable to every consumer. AD line 314 then mandates that `null` be a silent no-op ("cancel is not an error; the port already warned once if the pick genuinely failed") — so a user who clicks **Pick a puzzle JSON file** / **Import** and has the dialog fail to open (`input.click()` throw — `filePickPort.ts:68`) or the file read fail (`:58`) sees the button do nothing. A port-internal `console.warn` is not user surfacing; NFR-12 (line 270) says user-facing errors go to the toast system "rather than … failing the console". The AD sentence at line 314 is internally inconsistent with NFR-12 on this point — that is the challenge, not the code.

Proposed fix:
- Widen the return to a discriminated union, e.g. `type PickResult = { kind: 'picked'; text: string } | { kind: 'cancelled' } | { kind: 'failed'; error: Error }` (statelessness rule intact — no instance state). Port's four warns move to the bindings layer per G7 Task A; `'cancelled'` stays fully silent.
- `FilePicker.svelte` `pick` prop widens to `() => Promise<PickResult>`; `'cancelled'` → silent return (current null behaviour); `'failed'` → invoke the new `onreaderror` prop from P2 (one error path for pick + drop).
- Facades pass the widened `pickFile()` through (AD line 286 updated).

**Update 2026-09-08 (after P2 F+B landed in design):** P4 no longer adds an `onreaderror` prop — it no longer exists. With the facade consuming drop reads (`importDroppedFile`), the natural continuation is: `pickFile()` widens to `PickResult`; the facade's `pickFile()` consumes `'failed'` itself (dispatch `report-import-read-failure`, return `null` to the leaf) so the leaf's silent-null behaviour covers cancel only; `readDroppedFile` re-baselines onto the same union (or keeps `string | null` — `null` can only mean failure there). Port warns still move to bindings as planned. Specify precisely when P4 is scheduled.

Requires AD amendment: §3.5a `FilePickPort` signature + §3.7 line 764-765 + AD lines 286 & 314. **Fold open smell P1 (dialog-cancel promise leak, `code_smells.md`) into this same task** — it touches the same settle/cleanup logic in `filePickPort.ts`.

## AD challenges (per human's standing invitation)

The human has authorized challenging AD where it conflicts with good design. Two challenges, both resting on precedent *inside this project* (G7) rather than outside opinion:

1. **§3.7 "never-throw + benign value" is sound for reads, unsound for writes.** For loads, absent ≡ failed and both fall back identically (NFR-9) — no observer needed. For writes, failure demands an observer, and `void` forbids one. G7 already amended this principle once for `DownloadPort` ("no `Result` channel … leaves the user with zero UI signal" — archive line 505). P3 is the same argument applied to the storage port, where the failure mode (quota) is more probable than a blocked download. Proposed principle text: *"Port reads never throw and return a benign value; port writes never throw and return `Error | null` so the bindings layer can surface failure."*
2. **AD line 314's "the port already warned once if the pick genuinely failed" treats a console warn as user feedback.** It is not — NFR-12 explicitly rejects "failing the console" as surfacing. P4 resolves the conflation at the type level so NFR-12 becomes *reachable* for pick failures.

Not challenged: the §9 (line 1104) corrupt-blob warns (no pending user action; silent fallback is the correct behaviour, and a boot toast would be noise), and the G7 warn+toast pair at `appStore:51`.

Per the escalation rule, no AD amendments were made when this audit was written. **P2 sign-off received 2026-09-08 (F+B design); AD amendments landed the same day:** §1.3 module rows (`importExport.ts`, `lifecycle.ts`), §2.1 line 205 (never-throw consumer note — facade `importDroppedFile` consumes `readDroppedFile`'s null), §3.7 `FilePickPort` block (`readDroppedFile`), §4.3 `BuilderIntent` + §4.4 `PlayerIntent` unions (`report-import-read-failure` in both), §8.9 + §8.9a (read-failure cases), §7 FilePicker props row + `BuilderToolbar.svelte` / `ImportScreen.svelte` rows. **P3 sign-off received 2026-09-08 (W1 + per-slice latches + write-driven re-toast cadence + export-hint copy); AD amendments landed the same day:** §1.3 intents row, §2.1 appStore/scheduler/never-throw/main.ts rows, §2.2 external-effects bullet, §2.4 signature block, §3.7 `StoragePort` block + principle, §4.1 `AppIntent` block + steps 7-8, §4.5 steps 1-2, §7 test recipe. **P4 still awaits sign-off**; no amendments made for it.

## Nit (optional, no behaviour change)

`persistenceCodec.ts:47, 114` log the entire parsed object (`snap` / `parsed`) into the console; a corrupt blob can be arbitrarily large. Consider logging only the mismatch kind + blob length. Test assertions count warn *calls* (mocked), so argument changes are safe — but this is cosmetic; listed only for completeness.

## Test impact (when P2/P3/P4 land)

- Unchanged sites keep their asserting tests: `persistenceScheduler.test.ts:129`, `appStore.test.ts:294, 311`.
- P2: `test/builder/state/internal/importExport.test.ts` new case — `report-import-read-failure` emits error toast event, state unchanged; `test/player/state/internal/lifecycle.test.ts` new case — returns import-phase state with `lastImportError` set + error toast event; `test/app/state/intentKinds.test.ts` — kind added to both `BUILDER_KINDS` / `PLAYER_KINDS` arrays (ambiguous-intersection test auto-covers it); `test/app/state/reducer.test.ts` new ambiguous-routing case — play route → Player, build route → Builder; `test/ports/filePickPort.test.ts` — `readDroppedFile` happy path + reject→null-with-single-warn; `test/ui/bindings/builderFacade.test.ts` + `playerFacade.test.ts` — `importDroppedFile` success/failure pairs (failure asserts exact toast message + state); AppPorts literals in the five bindings test files gain `readDroppedFile`. (The earlier draft's "`appStore.test.ts` failure-injection via a fake pick" was wrong — the pick path cannot fail pre-P4 and appStore is untouched by P2; corrected here.)
- P3 (landed): `localStoragePort.test.ts` write tests flipped to "returns `Error`" + a non-`Error` coercion case; `InMemoryStoragePort.test.ts` `nextWriteError` one-shot cases; `persistenceScheduler.test.ts` `onWriteResult` reporting cases (success/failure/skip/clear/flush/coalesce/cancel); `appStore.test.ts` latch suite (toast-once, within-cadence silence, 60 s re-toast, re-arm on success, per-slice independence, failed-clear + re-entrancy guard) + rewritten internal-scheduler test; `reducer.test.ts` two toast-event cases; `intentKinds.test.ts` AppIntent loop extended.
- P4: `filePickPort.test.ts` re-baselined to the `PickResult` union; P1 leak test added (cancel event → `settle(null)`).
