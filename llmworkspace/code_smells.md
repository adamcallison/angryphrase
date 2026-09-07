# Code smells log (active)

Fresh log started 2026-09-07. The prior audit (A/B/C/D families, F9, all resolved) is frozen in `code_smells_archive.md`.

## Open

- **P1** `filePickPort` dialog-cancel leak on browsers that never fire `change` on cancel: promise stays pending + hidden `<input display:none>` orphaned on `<body>`. Dormant — evergreen targets (NFR-11) all fire `change`-on-cancel. Fix when needed: listen to the input `cancel` event → `settle(null)`.

## Resolved

(none yet)
