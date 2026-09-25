# Exercise Task Editor and Flag Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved task-tab layout and safe fixed/template flag authoring, validation and generation across the admin UI and API.

**Architecture:** Preserve the existing `Flag []string` snapshot field, using `template:ICE{...}` only for new template candidates. A small shared Go model package parses and resolves candidates; the backend remains authoritative, while a matching TypeScript parser supplies immediate editing feedback. Existing task navigation, media API and Lexical editor are extended rather than replaced.

**Tech Stack:** Go, Gin, JSONB snapshots, Next.js, React Hook Form, Zod, Lexical, Vitest, Testing Library.

**Spec:** `../specs/2026-09-25-exercise-tasks-and-flag-patterns-design.md`

## Global Constraints

- Work in existing `feature/base-redesign` and `feature/superadmin-infrastructure-read` branches; preserve unrelated dirty changes, stage only owned hunks.
- Keep the approved CyberICEBox palette and tokens; Ukrainian interface labels; no image thumbnails in the admin editor.
- Fixed flags remain `ICE{...}`; templates are stored as `template:ICE{...}` in existing `Flag []string`, with no schema migration.
- Default generator is 20 cryptographic bytes; configurable `EXERCISE_FLAG_RANDOM_BYTES` and `EXERCISE_FLAG_WARNING_BITS` default to 20.
- A static task requires exactly one fixed flag at publication, but may lack it in a saved draft; only container/VM devices may be linked.
- Never save flags or secret values to local browser storage; do not change already materialized team flags.
- Only the exercise task tab and necessary backend/editor support are in scope; no participant card or topology-tab redesign.

## Review Focus

- Large character-class products must not overflow or bias weighted selection; Task 1 tests `big.Int` weights and a deterministic boundary.
- Legacy literal flags containing metacharacters must stay literal; Task 1 tests existing `ICE{a[0-9]}` as fixed.
- Deleting a linked device must not silently turn a dynamic task static or lose flags; Task 4 tests the missing-device state.
- Typing before/after a Lexical token must preserve both neighbors and formatting; Task 5 tests insertion in a populated text node.
- File drop while switching tasks must target only the currently selected task; Task 4 tests task-specific upload dispatch.

---

### Task 1: Flag grammar, cardinality and weighted resolver

**Files:**
- Create: `AP Backend/internal/model/flagpattern/pattern.go`, `pattern_test.go`
- Modify: `AP Backend/internal/model/teamChallenge/flag.go`, `challenge_test.go`

**Interfaces:**
- Produces: `flagpattern.Parse(candidate string) (Pattern, error)`, `Pattern.Cardinality() *big.Int`, `Pattern.Generate(io.Reader) (string, error)`, `flagpattern.Resolve([]string, int, io.Reader) (string, error)`.
- Consumes: existing `Flag []string`; caller supplies random byte count and `crypto/rand.Reader`.

- [ ] **Step 1: Write failing Go table tests** for fixed `ICE{a[0-9]}` staying literal, `template:ICE{room-[A-C\d]\l}` yielding 338 possibilities, `[A-Cxyz1-3\d]` yielding 16, invalid classes/ranges/escapes, and a weight-boundary reader selecting a fixed vs template candidate.
  ```go
  p, err := flagpattern.Parse(`template:ICE{room-[A-C\d]\l}`)
  require.NoError(t, err)
  require.Equal(t, "338", p.Cardinality().String())
  ```
- [ ] **Step 2: Verify red.** Run `go test ./internal/model/flagpattern ./internal/model/teamChallenge`; expected: missing package/API or focused failed assertions.
- [ ] **Step 3: Implement parser and resolver.** Scan one token at a time, expand/dedupe classes, multiply `big.Int` sizes, choose a candidate by `crypto/rand.Int`-equivalent rejection sampling and then one symbol per slot; retain literal candidate values. Keep `teamChallengeModel.ResolveExpectedFlag` as the compatibility wrapper for existing callers.
- [ ] **Step 4: Verify green.** Run `go test ./internal/model/flagpattern ./internal/model/teamChallenge`; expected: all targeted tests pass.
- [ ] **Step 5: Stage only these files and commit** `feat(exercises): resolve weighted flag templates` if no user-owned hunks overlap.

### Task 2: Server validation and shared flag policy

**Files:**
- Modify: `AP Backend/internal/model/exercise/version.go`, `version_test.go`; `internal/config/config.go`, `config_test.go`; `internal/delivery/controller/http/handler/exercise/handler.go`, `handler_test.go`; `internal/useCase/event/team_challenge.go` and dependency wiring as needed.
- Create: `AP Backend/internal/delivery/controller/http/handler/exercise/flag_policy.go`

**Interfaces:**
- Consumes: Task 1 `flagpattern.Parse`/`Resolve`.
- Produces: `GET /api/exercises/flag-policy` JSON data `{RandomHexLength, RandomBits, WarningBits}` and configurable runtime random byte count.

- [ ] **Step 1: Write failing tests**: draft accepts zero static flags; publication rejects static zero/multiple/templates; duplicate exact literals or templates rejected; mixed fixed/template accepted; invalid config fails validation; policy route exposes configured values and requires `exercises.read`.
  ```go
  version.Variants[0].Tasks[0].Flag = nil
  require.NoError(t, version.ValidateStructure())
  require.Error(t, version.ValidateForPublish())
  ```
- [ ] **Step 2: Verify red.** Run `go test ./internal/model/exercise ./internal/config ./internal/delivery/controller/http/handler/exercise ./internal/useCase/event`; expected: focused new assertions fail.
- [ ] **Step 3: Implement validation, config and route.** Validate each candidate through `flagpattern.Parse`, compare duplicate strings within type, enforce static publish arity, reject linked non-compute devices, and route a policy derived from validated config. Pass the same byte count to event materialization; do not mutate existing team flags.
- [ ] **Step 4: Verify green.** Re-run the command above; expected: all targeted tests pass.
- [ ] **Step 5: Stage only owned files and commit** `feat(exercises): validate flags and expose generation policy` if staging is safe.

### Task 3: Client flag grammar and form

**Files:**
- Create: `admin-frontend/src/lib/flagPattern.ts`, `flagPattern.test.ts`; `src/api/exercises/flagPolicy.ts`, `flagPolicy.test.ts`
- Modify: `admin-frontend/src/lib/exerciseSchemas.ts`, `exerciseSchemas.test.ts`; `src/components/exercises/FlagInput.tsx`, `FlagInput.test.tsx`; `messages/uk.json`, `messages/en.json`.

**Interfaces:**
- Consumes: Task 2 policy `{RandomHexLength,RandomBits,WarningBits}` and `Flag []string`.
- Produces: `parseFlagCandidate(raw: string)` with candidate type, cardinality `bigint`, deterministic example and `log₂` estimate; `FlagInput` receives `linkedDeviceID` and policy.

- [ ] **Step 1: Write failing parser/schema/UI tests** for grammar parity, exact duplicate rejection, warning-only fixed/template overlap, empty static draft, policy unavailable/retry, zero-candidate dynamic example from policy, add button text «Додати прапор» and fixed/template toggling.
  ```ts
  expect(parseFlagCandidate(String.raw`template:ICE{room-[A-C\d]\l}`).cardinality).toBe(338n)
  expect(draftSchema.safeParse(staticDraftWithNoFlag).success).toBe(true)
  ```
- [ ] **Step 2: Verify red.** Run `npm test -- --run src/lib/flagPattern.test.ts src/lib/exerciseSchemas.test.ts src/components/exercises/FlagInput.test.tsx src/api/exercises/flagPolicy.test.ts`; expected: focused failures.
- [ ] **Step 3: Implement parser, policy API and UI.** Mirror the Go grammar without executing regex input; keep `template:` only in saved values, show per-entry count/entropy and warnings, and never invent policy values during fetch failure.
- [ ] **Step 4: Verify green.** Re-run focused tests; expected: pass.
- [ ] **Step 5: Stage only owned files and commit** `feat(exercises): author fixed and template flags` if safe.

### Task 4: Focused task navigation and attachments

**Files:**
- Modify: `admin-frontend/src/components/exercises/TaskAccordion.tsx`, `TaskForm.tsx`, `AttachmentList.tsx`, related component tests, `messages/uk.json`, `messages/en.json`, task-specific styles.

**Interfaces:**
- Consumes: Task 3 `FlagInput` props and existing file upload API.
- Produces: selected task editor with nav-row delete; card-level file drop delegates to selected task's attachment list, without thumbnails.

- [ ] **Step 1: Write failing component tests** for two tasks/two variants, nav-row delete with confirmation, name+ID device labels, missing-device error retaining flags, whole-card drop routing to active task, file row without image preview, and reserved error-height behavior.
  ```tsx
  fireEvent.drop(screen.getByTestId("task-drop-zone"), { dataTransfer: { files: [file] } })
  expect(uploadForTask).toHaveBeenCalledWith(selectedTaskId, file)
  ```
- [ ] **Step 2: Verify red.** Run `npm test -- --run src/components/exercises/TaskAccordion.test.tsx src/components/exercises/TaskForm.test.tsx src/components/exercises/AttachmentList.test.tsx`; expected: focused failures.
- [ ] **Step 3: Implement layout and interactions.** Preserve variant-wide task identity/difficulty; move delete next to nav item, reserve field-error space, align bounded columns, use accessible drop overlay and selected-task upload, leave palette unchanged.
- [ ] **Step 4: Verify green.** Re-run focused tests; expected: pass.
- [ ] **Step 5: Stage only owned files and commit** `feat(exercises): polish focused task editor` if safe.

### Task 5: Inline placeholders and editor stability

**Files:**
- Modify: `AP Backend/internal/model/exercise/placeholder.go`, `internal/useCase/exercise/lifecycle.go`, focused tests; `admin-frontend/src/components/exercises/PlaceholderList.tsx`, `TaskForm.tsx`, `src/components/notifications/editor/RichTextEditor.tsx` and focused tests; DTO/schema types for placeholder key.

**Interfaces:**
- Consumes: existing Lexical `VariableNode`, placeholder definitions and variant topology.
- Produces: stable placeholder key in snapshots and inline token insertion at caret; validation of missing referenced definitions at publish.

- [ ] **Step 1: Write failing Go and Vitest tests** for key normalization/reopen, deleted-key publish error, insertion preserving adjacent text and formatting, and topology-unavailable options omitted for new insertion while old tokens stay visible.
  ```ts
  expect(editorTextAfterInsert).toContain("before")
  expect(editorTextAfterInsert).toContain("after")
  ```
- [ ] **Step 2: Verify red.** Run focused package tests `go test ./internal/model/exercise ./internal/useCase/exercise` and `npm test -- --run src/components/notifications/editor/RichTextEditor.test.tsx src/components/exercises/PlaceholderList.test.tsx`; expected: focused failures.
- [ ] **Step 3: Implement stable keys and inline insertion dialog.** Normalize only editable drafts, validate variable references, retain old published snapshots; insert/configure dynamic tokens at the caret from one editor dialog, show disabled topology sources with reasons, preserve legacy static tokens, and offer mask control for both subnet kinds. Fix token replacement so only the query range is replaced and maintain fixed editor geometry while typing.
- [ ] **Step 4: Verify green.** Re-run focused commands; expected: pass.
- [ ] **Step 5: Stage only owned files and commit** `feat(exercises): insert stable inline placeholders` if safe.

### Task 6: Integration and visual gate

**Files:**
- Modify only files implicated by a failing test/visual check; record exact scope in this plan's ledger.

**Interfaces:**
- Consumes: Tasks 1–5; produces verified task-tab behavior on current services.

- [ ] **Step 1: Add any missing integration regression tests** exposed by backend/frontend interaction (especially empty static draft save and template publication).
- [ ] **Step 2: Run full suites.** `go test ./...` from `AP Backend`; `npm test -- --run`, `npm run build` from `admin-frontend`; expected: pass or report pre-existing failures by name.
- [ ] **Step 3: Inspect Chrome UI** at wide/narrow widths with one/two tasks, two variants, no device and one named VM; check drag/drop, errors, tooltips, typing without layout shift, file rows without previews.
- [ ] **Step 4: Fix only proven regressions using RED→GREEN tests, then re-run affected suites.** Expected: no newly introduced failures; explicitly report any inaccessible live service.
- [ ] **Step 5: Review the whole diff and stage/commit only owned files** if staging can exclude pre-existing changes.

## Self-review

- Sections 1–8 of the spec map to Tasks 1–6; participant card/topology redesign remain excluded.
- Interfaces use the same `template:` marker, policy field names and placeholder key across task boundaries.
- Review Focus cases are pinned to named tests in Tasks 1, 4 and 5.
