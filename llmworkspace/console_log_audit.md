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
| 16, 17, 18, 21 | `src/ports/localStoragePort.ts:25, 32, 47, 54` — `saveBuilder` / `clearBuilder` / `savePlayerProgress` / `clearPlayerProgress` catch+warn+`void` | **Replace (P3)** — challenge to §3.7 | See "AD challenge 1" |
| 19, 22–25 (partial) | `src/ports/filePickPort.ts` — lines 14, 25, 58, 68 | **Keep until P4 lands, then move to bindings** | §3.7 + AD line 780 ("impl warns once on genuine failure; cancel is silent"); on P4 the warns move to the bindings layer per the G7 Task A pattern |
| 26 | `src/ui/shared/FilePicker.svelte:20` — `pickFile failed` catch | **Remove (P2)** | Dead code: §3.7 never-throw contract + AD §2.1 line 205 "Consumers add no redundant catch layers" — the port cannot throw, so this catch is unreachable |
| 27 | `src/ui/shared/FilePicker.svelte:45` — drop read failed | **Replace with toast (P2)** | NFR-12 (line 270): user-facing errors "surfaced via the toast system (FR-92) rather than silently ignored or failing the console" |

(27 rows because the localStoragePort write sites are counted individually above; total distinct `console.warn` call sites in `src/` = 26.)

## Keep rationale (summary)

All corrupt-blob / NFR-9 sites (`persistenceCodec`, `main.ts`, `appStore:78,86`) warn and *correctly* give no toast: no user action is pending, the mandated fallback (fresh Builder / import screen) already happened, and a boot-time toast about an internal blob would be noise. The bindings-layer download warn (`appStore:51`) is half of a warn+toast pair by design (G7). Port-adapter warns are the sanctioned "single warn site" (§3.7) wherever the failure maps to a *distinguishable* benign return.

## Replace findings

### P2 — `FilePicker.svelte`: dead catch + drop-read failure invisible to the user 🟠

Two defects in one file — the only component-level `console.warn` in the codebase (the drop path bypasses the port by design; see `filePickPort.ts:3-5`).

1. **Line 19-21, remove.** `triggerPick` wraps `await pick()` in try/catch + `console.warn('FilePicker: pickFile failed', err)`. The port never throws (§3.7, AD line 205: "Consumers add no redundant catch layers"); this catch is unreachable and its warn site contradicts AD line 314 ("a `null` result from `pick` … `onpick` is not called and nothing is logged"). Fix: delete the try/catch, keep `if (text === null) return; onpick(text);`. No AD amendment needed — this is code drift from the AD as written.
2. **Line 44-46, replace with a toast.** `onDrop` reads the dropped file with `await file.text()` directly; on rejection it only `console.warn`s and swallows. The user dropped a file and nothing visibly happens — exactly the NFR-12 "silently ignored or failing the console" case. Note the asymmetry: a *picked* file that parses to garbage gets a toast/banner downstream (Player `import-puzzle` reject path; Builder confirm-import path), but a file that cannot even be *read* gets nothing.

   Proposed fix (G7 Task B pattern, precedent `report-download-failure`): new `AppIntent` variant `{ kind: 'report-import-read-failure' }` → `reduceApp` emits error toast ("Could not read that file. Please try again."); `FilePicker.svelte` gains a required `onreaderror: () => void` prop invoked in the catch; `ImportScreen.svelte` and `BuilderToolbar.svelte` wire it to a facade action that dispatches the intent. Requires AD amendment (§7 line 314 FilePicker props row; §4.1 `reduceApp` responsibilities; §1.3 `intents.ts` row).

### P3 — `StoragePort` write methods return `void`; autosave failure is invisible data loss 🟠

`saveBuilder` / `savePlayerProgress` / `clearBuilder` / `clearPlayerProgress` catch, warn, and return `void` (`localStoragePort.ts:25, 32, 47, 54`). The `void` return means the bindings layer *cannot know* a write failed — `persistenceScheduler.doSaveBuilder` / `doSavePlayer` call the port bare (AD line 205 mandates this) and have no failure channel. Effect: with localStorage persistently failing (realistic: quota exceeded ~5 MB on large grids, privacy modes, disabled storage), every debounced autosave fails for the whole session, the console fills with warns, and the user has zero signal that **nothing is being saved**. This is the same flaw class as G7 (`DownloadPort` void-return), already conceded and fixed for downloads.

Proposed fix (mirror G7 Task A/B):
- Widen the four write signatures `void` → `Error | null` (null = success) in `domain/ports/ports.ts` + `localStoragePort.ts` impl (coerce non-`Error` throws like G7 Task A); port stops warning on writes — responsibility moves to the scheduler (the caller with context).
- `persistenceScheduler`: on a failed write, warn once **and** surface a single error toast ("Saving failed — your progress is not being kept"), re-armed only after a subsequent successful write (avoids a toast every 400 ms debounce tick). Scheduler needs a dispatch callback (facade-injected) for the toast — same shape as the G7 bindings-layer dispatch.
- Loads (`loadBuilder`, `loadPlayerProgress`) keep the benign `null` contract unchanged (P3 does not touch them — absent ≡ failed collapses to the same NFR-9 fallback).

Requires AD amendment: §3.5a port signatures, §3.7 (line 205 + 764-765 never-throw text), §9.3 file tree note, plus `InMemoryStoragePort` fake + `localStoragePort.test.ts` / `persistenceScheduler.test.ts` updates.

### P4 — `FilePickPort.pickFile(): Promise<string | null>` conflates cancel with failure 🟠

The single `null` channel means "user cancelled" and "the pick genuinely failed" are indistinguishable to every consumer. AD line 314 then mandates that `null` be a silent no-op ("cancel is not an error; the port already warned once if the pick genuinely failed") — so a user who clicks **Pick a puzzle JSON file** / **Import** and has the dialog fail to open (`input.click()` throw — `filePickPort.ts:68`) or the file read fail (`:58`) sees the button do nothing. A port-internal `console.warn` is not user surfacing; NFR-12 (line 270) says user-facing errors go to the toast system "rather than … failing the console". The AD sentence at line 314 is internally inconsistent with NFR-12 on this point — that is the challenge, not the code.

Proposed fix:
- Widen the return to a discriminated union, e.g. `type PickResult = { kind: 'picked'; text: string } | { kind: 'cancelled' } | { kind: 'failed'; error: Error }` (statelessness rule intact — no instance state). Port's four warns move to the bindings layer per G7 Task A; `'cancelled'` stays fully silent.
- `FilePicker.svelte` `pick` prop widens to `() => Promise<PickResult>`; `'cancelled'` → silent return (current null behaviour); `'failed'` → invoke the new `onreaderror` prop from P2 (one error path for pick + drop).
- Facades pass the widened `pickFile()` through (AD line 286 updated).

Requires AD amendment: §3.5a `FilePickPort` signature + §3.7 line 764-765 + AD lines 286 & 314. **Fold open smell P1 (dialog-cancel promise leak, `code_smells.md`) into this same task** — it touches the same settle/cleanup logic in `filePickPort.ts`.

## AD challenges (per human's standing invitation)

The human has authorized challenging AD where it conflicts with good design. Two challenges, both resting on precedent *inside this project* (G7) rather than outside opinion:

1. **§3.7 "never-throw + benign value" is sound for reads, unsound for writes.** For loads, absent ≡ failed and both fall back identically (NFR-9) — no observer needed. For writes, failure demands an observer, and `void` forbids one. G7 already amended this principle once for `DownloadPort` ("no `Result` channel … leaves the user with zero UI signal" — archive line 505). P3 is the same argument applied to the storage port, where the failure mode (quota) is more probable than a blocked download. Proposed principle text: *"Port reads never throw and return a benign value; port writes never throw and return `Error | null` so the bindings layer can surface failure."*
2. **AD line 314's "the port already warned once if the pick genuinely failed" treats a console warn as user feedback.** It is not — NFR-12 explicitly rejects "failing the console" as surfacing. P4 resolves the conflation at the type level so NFR-12 becomes *reachable* for pick failures.

Not challenged: the §9 (line 1104) corrupt-blob warns (no pending user action; silent fallback is the correct behaviour, and a boot toast would be noise), and the G7 warn+toast pair at `appStore:51`.

Per the escalation rule, no AD amendments have been made in this audit — P2/P3/P4 each name the sections to amend and await sign-off before any task is specified.

## Nit (optional, no behaviour change)

`persistenceCodec.ts:47, 114` log the entire parsed object (`snap` / `parsed`) into the console; a corrupt blob can be arbitrarily large. Consider logging only the mismatch kind + blob length. Test assertions count warn *calls* (mocked), so argument changes are safe — but this is cosmetic; listed only for completeness.

## Test impact (when P2/P3/P4 land)

- Unchanged sites keep their asserting tests: `persistenceScheduler.test.ts:129`, `appStore.test.ts:294, 311`.
- P2: new `reducer.test.ts` case for `report-import-read-failure` (G7 Task B test shape); `appStore.test.ts` failure-injection via a fake pick.
- P3: `localStoragePort.test.ts` write-path tests flip from "does not throw" → "returns `Error`" (G7 Task A test shape); `InMemoryStoragePort` gains failure injection (mirror `StubDownloadPort.nextDownloadError`); `persistenceScheduler.test.ts` gains toast-once/re-arm cases.
- P4: `filePickPort.test.ts` re-baselined to the `PickResult` union; P1 leak test added (cancel event → `settle(null)`).
