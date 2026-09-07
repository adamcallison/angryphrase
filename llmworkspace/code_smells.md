# Code smells log (active)

Fresh log started 2026-09-07. The prior audit (A/B/C/D families, F9, all resolved) is frozen in `code_smells_archive.md`.

## Open

- **P1** `filePickPort` dialog-cancel leak on browsers that never fire `change` on cancel: promise stays pending + hidden `<input display:none>` orphaned on `<body>`. Dormant — evergreen targets (NFR-11) all fire `change`-on-cancel. Fix when needed: listen to the input `cancel` event → `settle(null)`. Fold into P4 when P4 lands (same file, same settle/cleanup logic).
- **P2** `FilePicker.svelte:19-21` dead try/catch around `pick()` (port never throws — §3.7 "consumers add no redundant catch layers"); `FilePicker.svelte:44-46` drop-read failure only `console.warn`s — user-facing error swallowed, violates NFR-12. Fix: remove the pick catch; surface drop-read failure via new AppIntent `report-import-read-failure` → error toast (G7 Task B pattern). Full audit: `console_log_audit.md` (P2).
- **P3** `StoragePort` write methods (`localStoragePort.ts:25, 32, 47, 54`) return `void` — autosave failure (quota etc.) invisible to bindings layer, silent data loss; same flaw class G7 fixed for `DownloadPort`. Fix: writes → `Error | null`, scheduler warns + toasts once (re-arm on success). Challenges §3.7. Full audit: `console_log_audit.md` (P3).
- **P4** `FilePickPort.pickFile(): Promise<string | null>` conflates cancel with failure; AD line 314 mandates silent no-op on the merged `null` → genuine pick failure gives user zero feedback, NFR-12 unreachable. Fix: `PickResult` discriminated union (`picked`/`cancelled`/`failed`), port warns move to bindings, `failed` → toast. Challenges §3.5a/§3.7/AD lines 286+314. Full audit: `console_log_audit.md` (P4).

All three replacements require AD amendments before task specification — sign-off requested (see `console_log_audit.md` § "AD challenges").

## Resolved

(none yet)
