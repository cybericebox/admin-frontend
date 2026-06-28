# Users — Filtering + Cursor Pagination — Design

**Date:** 2026-06-28
**Repos:** `admin-frontend` (lead), `AP Backend`
**Status:** Approved — ready for implementation planning
**Extends:** the admin domain (`2026-06-28-admin-domain-design.md`, slice B Users).

## Goal

Upgrade the admin Users list to production-grade browsing: debounced search by
name/email, multi-select role filter, and cursor (keyset) pagination with
infinite scroll. Sorting is intentionally dropped (keyset order is fixed). A
dedicated user-stats endpoint feeds the dashboard, which can no longer derive
counts from a bulk page fetch once the list is cursor-based.

## Pagination model — cursor keyset

- **Order:** `created_at DESC, id DESC` (newest first; `id` is the stable
  tiebreaker so the keyset is total).
- **Cursor:** an opaque base64 token encoding the last row's `created_at` +
  `id`. The first page is requested with no cursor (the backend substitutes an
  `infinity` / max-uuid sentinel so a single keyset predicate covers both
  cases).
- **Has-more:** the use-case requests `limit + 1` rows; if it gets the extra
  row, `HasMore = true`, the extra is dropped, and `NextCursor` is the last
  *kept* row's encoded position. No `COUNT(*)` per page.
- **No sorting.** Because order is fixed, offset pagination is unnecessary; the
  Users list is cursor-only. (Offset stays only where a feature needs arbitrary
  sorting — none here; the notifications Logs tab keeps its existing
  offset/limit and is out of scope.)

## Backend (`AP Backend`)

- **List** — `GET /api/users?search=&role=<r1>&role=<r2>&cursor=&limit=`
  → `{ Users: UserRow[], NextCursor: string, HasMore: bool }`.
  - sqlc `ListUsersCursor`: keyset predicate `(created_at, id) < (cursor_ts, cursor_id)`,
    `search` ILIKE over email/first_name/last_name, and `role = ANY($roles)`
    (empty array = all roles). `ORDER BY created_at DESC, id DESC LIMIT $n`.
  - The use-case encodes/decodes the cursor (`base64(created_at_rfc3339nano|id)`),
    substitutes the `infinity`/max sentinel for an empty cursor, requests
    `limit + 1`, computes `HasMore`, and builds `NextCursor`.
  - This **replaces** the current offset-based `GET /api/users`; the offset
    `ListUsers`/`OffsetVal`/`LimitVal` path for users is removed.
  - `UserRow` shape unchanged: `{ID, FirstName, LastName, Email, Role, Status, CreatedAt}`.
  - Permission unchanged: `users.read`.
- **Stats** — `GET /api/users/stats` → `{ Total: int64, ByRole: {Role,Count}[], Blocked: int64 }`.
  - sqlc: a `GROUP BY role` count, a `status = 'blocked'` count, and total
    (reuse `CountUsers` with empty search). Permission `users.read`.

## Frontend — Users list (`admin-frontend`, `/users`)

- **Search** by name/email with a ~300ms debounce before firing the request.
- **Role filter:** checkboxes for `super_admin` / `admin` / `admin_viewer` /
  `user` (multi-select → repeated `role=` params; none checked = all).
- **Infinite scroll:** an `IntersectionObserver` sentinel near the list bottom
  auto-fetches the next cursor page and **appends** rows. Changing the search
  text or role selection resets the cursor and replaces the list.
- Row → detail and the detail actions are unchanged (from slice B).

## Dashboard (`admin-frontend`, `/dashboard`)

- Replaces the `GET /api/users?limit=1000` bulk fetch with `GET /api/users/stats`.
  Cards: Total users (`Total`), Admins (`ByRole` super_admin + admin), Blocked
  (`Blocked`).

## Out of scope

- Sorting (any column).
- The notifications Logs tab pagination (stays offset/limit).
- Per-user event participation / any other user columns.

## Build order

Backend first (cursor list query + stats query + use-case + handler), then the
frontend Users list (debounce + role checkboxes + infinite scroll), then the
dashboard switch to `/users/stats`. One implementation plan.
