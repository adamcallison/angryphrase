# Code smells log (active)

Fresh log started 2026-09-07. The prior audit (A/B/C/D families, F9, all resolved) is frozen in `code_smells_archive.md`.

## Open

- **P1** `filePickPort` dialog-cancel leak on browsers that never fire `change` on cancel: promise stays pending + hidden `<input display:none>` orphaned on `<body>`. Dormant — evergreen targets (NFR-11) all fire `change`-on-cancel. Fix when needed: listen to the input `cancel` event → `settle(null)`. Fold into P4 when P4 lands (same file, same settle/cleanup logic).
- **P3** `StoragePort` write methods (`localStoragePort.ts:25, 32, 47, 54`) return `void` — autosave failure (quota etc.) invisible to bindings layer, silent data loss; same flaw class G7 fixed for `DownloadPort`. Fix: writes → `Error | null`, scheduler warns + toasts once (re-arm on success). Challenges §3.7. Full audit: `console_log_audit.md` (P3).
- **P4** `FilePickPort.pickFile(): Promise<string | null>` conflates cancel with failure; AD line 314 mandates silent no-op on the merged `null` → genuine pick failure gives user zero feedback, NFR-12 unreachable. Fix: `PickResult` discriminated union (`picked`/`cancelled`/`failed`), port warns move to bindings, `failed` → toast. Challenges §3.5a/§3.7/AD lines 286+314. Full audit: `console_log_audit.md` (P4). Updated 2026-09-08: integrates with landed P2 (facade consumes failures; no `onreaderror` prop — see audit P4 update note).

P3/P4 still require AD amendments before task specification — sign-off requested (see `console_log_audit.md` § "AD challenges"). P2 sign-off was received 2026-09-08 and has landed (see Resolved).

## Resolved

- **P2** (resolved 2026-09-08, F+B design): dead pick-catch removed + drop-read failure surfaced per NFR-12. `report-import-read-failure` intent added to BOTH Builder + Player unions (ambiguous-kind routing by `state.route`); each reducer mirrors its existing parse-reject surface (Builder: error toast event, state unchanged; Player: `lastImportError` + toast — banner and toast, same as parse rejects). Drop IO moved behind the port: `FilePickPort.readDroppedFile(file: File): Promise<string | null>` (never-throw §3.7, single warn site, null = genuine failure — drops have no cancel path). `FilePicker.svelte` fully presentational: props `{ label, pick, onpick, ondropfile }`, zero IO/catch/console. Facade actions `BuilderToolbarActions.importDroppedFile` / `PlayerImportScreenActions.importDroppedFile` read via the port and dispatch native-dialect intents (`request-import-puzzle` / `import-puzzle` on success, `report-import-read-failure` on null) — no facade-dispatch narrowing bypassed, no AppIntent. AD amended (§1.3 ×2 rows, §2.1 line 205, §3.7 `FilePickPort`, §4.3 + §4.4 unions, §8.9 + §8.9a, §7 line 314 + BuilderToolbar/ImportScreen rows). Superseded design (AppIntent + `onreaderror` prop) + rationale recorded in `console_log_audit.md` (P2). CI green: 80 test files / 1093 tests, typecheck 0/0, lint + madge clean.
