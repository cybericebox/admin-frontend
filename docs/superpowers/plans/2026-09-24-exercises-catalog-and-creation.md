# Exercises Catalog and Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the platform exercise catalog the same predictable table behavior as users and events, then validate the exercise-creation path.

**Architecture:** Add an opt-in offset-page form of `GET /api/exercises`, preserving its existing cursor contract for other consumers. The admin catalog consumes the offset form and reuses `TablePagination`, `SortableHeader`, and `EmptyState`. Creation uses a dedicated `/exercises/new` page and is checked from the create link through the resulting detail page.

**Tech Stack:** Go/Gin, PostgreSQL/sqlc, Next.js/React, Vitest, Go tests.

**Spec:** This plan's Requirements section records the user's decisions from the active 2026-09-24 conversation.

## Requirements

- Page sizes 25, 50, 100; total, page X of Y, previous/next; scroll only rows while headers and footer remain fixed.
- Search, tag filter, and column sorting execute over the full server-side result set, not merely the loaded page.
- Keep existing rows visible during refresh and use the small loader at a fixed footer position.
- Empty collection and filtered-empty result use the shared icon with distinct short copy.
- Creation honors current authorization and validation, then opens the created exercise. The user explicitly chose a dedicated page instead of a modal. Visual inspection must be reported separately from automated tests.
- Do not overwrite or commit unrelated dirty-tree changes; existing cursor API remains compatible.

## Global Constraints

- Work in the current `feature/base-redesign` and `feature/superadmin-infrastructure-read` branches, as previously approved by the user.
- Use brand-derived tokens and current shared components, not fixed palette values.
- Do not assert UI verification if the browser surface cannot be operated.

## Review Focus

- A page request finishing after a changed filter must not replace the new result.
- A failed page request must preserve the last good rows and expose retry.
- Sorting and counting must be applied before LIMIT/OFFSET and use a deterministic UUID tie-breaker.
- Null/empty tags and mixed draft+published version pointers must have stable sort/filter behavior.
- A create request that fails or remains pending must not close the form or navigate.

---

### Task 1: Backend offset page

**Files:** `AP Backend/internal/delivery/repository/postgres/queries/exercises.sql`, generated `exercises.sql.go` and mocks, `exerciseRepo/repository.go`, `useCase/exercise/{input,catalog}.go`, `handler/exercise/{handler,handler_test}.go`, `postgres/exercises_integration_test.go`.

**Interfaces:** `ExercisesFilter` gains `Page`, `SortBy`, `SortDir`, and optional version-state filter; `ListExercises` keeps the cursor path when `Page == 0`. `GET /api/exercises?page=1&pageSize=25` returns `pagination.OffsetPage`.

- [x] Write PostgreSQL integration tests for multiple pages and state filters; verify sorting and filtered totals in real PostgreSQL. The paging test was red before the query existed.
- [x] Add `ListExercisesPage` SQL and generated bindings. Whitelist sort fields/directions in the use case and keep the existing cursor query intact.
- [x] Add an HTTP contract test that `page` selects the offset response and a cursor request keeps `NextCursor`. Run it red, implement the handler branch, run green.
- [x] Run focused Go tests for repository, use case, and exercise handler; check the generated SQL diff.

### Task 2: Admin exercise table

**Files:** `admin-frontend/src/api/exercises/catalog.ts`, `src/app/exercises/page.tsx`, their tests, and `messages/{uk,en}.json`.

**Interfaces:** `listExercisesPage({search,tags,status,page,pageSize,sortBy,sortDir})` returns `OffsetPage<ExerciseListItem>`; legacy `listExercises` remains available.

- [x] Write tests for page-size/total, header-click sorting, filter reset, no-blink refresh, retry, and row-scroll reset; run red.
- [x] Replace cursor sentinel with a fixed-height card, internal row scroll, sticky headers, fixed `TablePagination`, and shared empty states. Keep controls at matching height and the create action on the right.
- [x] Run the page/API tests, full admin tests, build, and focused lint. Final run: 671 tests passed, production build passed, affected-file lint passed.

### Task 3: Exercise creation and UI gate

**Files:** `admin-frontend/src/app/exercises/{page.tsx,new/page.tsx,detail/page.tsx}`, associated tests; backend creation files only if a proven defect requires them.

**Interfaces:** `createExercise({Name,Description,Tags})` must return the new ID and navigate to `/exercises/detail?id=...`; failure leaves entered values available.

- [x] Inspect the current create action, form validation, API response, detail loader, and permission gate. Add a failing test for a typed-but-uncommitted tag, then verify pending/error behavior.
- [x] Move creation to a dedicated page, add a multiline description, and run focused tests, full suite, and production build.
- [x] Inspect create/list/detail/draft entry through the authenticated dev UI at desktop and narrow widths. A temporary QA exercise was created, its draft saved and published, then the exercise and its versions were permanently deleted; the catalog returned to zero items. The version timestamp was localized to Ukrainian with seconds and checked in the live UI.

## Verification and handoff

Review the affected diff without touching unrelated changes. No commit or merge is implied by this plan; the current worktrees contain existing user changes.
