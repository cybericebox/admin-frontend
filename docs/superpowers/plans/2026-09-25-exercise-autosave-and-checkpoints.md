# Exercise editor autosave and recovery

## Contract

- Keep the approved brand palette. Editor changes here affect behavior and status only.
- Debounce server autosave by five seconds after the last edit. Reuse the single draft slot; never create one history entry per keystroke.
- Save only structurally valid snapshots. Keep the existing sanitized local copy for incomplete/offline new-exercise forms; never persist flag values or plaintext secrets in browser storage.
- Serialize writes. An older response must not replace newer edits. Leave a visible unsaved/error state and retain the unload warning until the latest snapshot is acknowledged.
- Add deliberate server checkpoints separately from frequent autosaves, with a safe restore path that does not silently destroy the current draft.

## Tasks

1. Add failing draft-editor tests for debounced save, invalid form, read-only mode, in-flight edits, manual save, and failure/retry. Implement serialized autosave against the existing PUT draft API.
2. Extend new-exercise editing to autosave once identity and content pass validation. Recover incomplete edits locally, and recover acknowledged drafts from the server after reload. Add tests before implementation.
3. Add explicit checkpoint/restore backend contract and admin controls, with tests for ownership, current-draft preservation, secret masking and version list semantics. Do not rewrite the existing rollback route's behavior accidentally.

## Verification

- Run focused Vitest and Go tests after each task, then the relevant admin build and backend package tests.
- Inspect the current branch's dirty diff before changes; do not include unrelated files in commits.

## Current result

- Tasks 1–3 are implemented in the current admin/backend worktrees. New and existing exercise editors debounce server saves by five seconds; invalid new forms retain a sanitized local copy.
- A checkpoint is explicit, not created for every autosave. Restore preserves the current draft as a checkpoint in one SQL statement before replacing its content. The legacy rollback route remains unchanged for compatibility.
- Frontend suite and production build passed; backend `go test ./...` and `make vet` passed. The real signed-in browser flow remains to be checked when the admin/backend services are running together.
