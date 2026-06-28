# Admin Domain — Design

**Date:** 2026-06-28
**Repos:** `admin-frontend` (lead), `AP Backend`
**Status:** Approved — ready for implementation planning

## Goal

Build the admin domain UI (admin-frontend) and the supporting API (AP Backend).
Deliver, in this iteration, three areas: a basic Dashboard, Users management
(list + detail + actions), and super-admin-only Notification management
(statistics, logs, global settings, templates). The `events` and `exercises`
domains and the per-user notification preferences are explicitly out of scope
for now.

Work ships in three slices: **A** (RBAC realign + shell), **B** (Dashboard +
Users), **C** (Notifications management). Each slice gets its own implementation
plan; this document is the shared design.

## Context (current state)

- **admin-frontend**: Next 16 / React 19 / Radix primitives / react-hook-form /
  zod / tailwind ("frost" DS theme). Data fetching is plain `fetch` in
  `useEffect` (no React Query). `src/api/client.ts` exposes
  `apiGet/apiPost/apiPut/apiPatch/apiDelete`. `src/lib/useRole.tsx` exposes
  `role`, `canManage` (admin|super_admin), `canManagePlatform` (super_admin).
  Shell exists (`AdminShell`, `Sidebar`, `TopBar`). **All `app/*/page.tsx` are
  10-line stubs.**
- **AP Backend**: hexagonal, gin router under `/api`. Existing routes relevant
  here:
  - Users: `GET /api/users`, `PATCH /api/users/:id/role`,
    `PATCH /api/users/:id/status`, `DELETE /api/users/:id`,
    `POST /api/users/invite`.
  - Platform settings: `GET /api/settings`, `GET /api/settings/:key`,
    `PUT /api/settings/:key`.
  - Notifications: `inbox` (self), `templates/inapp` + `templates/email`
    (full CRUD + status), `settings/global` (GET/PUT) + `settings/user` (self),
    `catalog` (`types`, `types/:type`), `test` (POST).
  - RBAC lives in `internal/model/rbac/permission.go` (dotted-prefix
    permissions, static role→perms map).
  - Notification dispatch data is **already persisted**:
    `notification_dispatches` (id, notification_type, recipient_user_id, status,
    created_at, updated_at) and `notification_dispatch_targets` (dispatch_id,
    channel, status, error, attempts, updated_at). Statuses: dispatch
    `pending|started|done`, target `done|error`. No new tables are needed for
    logs/statistics — only read endpoints.

## Domains and roles

Three product domains, super-set by super_admin:

- **Users** — full user management (incl. invites). admin: RW, viewer: R.
- **Events** — event catalog (later). admin: RW, viewer: R.
- **Exercises** — exercise catalog (later). admin: RW, viewer: R.

Plus **Platform Settings** — super_admin only. Currently its only content is
**Notification management** (templates + global settings + statistics + logs +
test). Future: Identity settings, Audit log (super_admin only).

## RBAC realignment (slice A, `AP Backend`)

The current `rolePermissions` map gives regular `admin` full write on
`notifications` and `platform.settings`, which contradicts the requirement that
notification/platform management is **super_admin only**. New target:

```go
RoleSuperAdmin:  {PermAll},                                  // "*"
RoleAdmin:       {PermUsers, PermNotificationsSelf},         // + events, exercises when those domains land
RoleAdminViewer: {PermUsersRead, PermNotificationsSelf},     // + events.read, exercises.read later
RoleUser:        {PermNotificationsSelf},
```

Rules:
- `notifications.self` (own inbox + own per-user settings) stays on every role —
  it is a user-level capability, not management.
- `admin` and `viewer` lose `platform.settings.*` and all notification
  *management* perms (`notifications.templates.*`, `notifications.settings.*`,
  `notifications.test`). These remain reachable only via `*` (super_admin).
- `events.*` / `exercises.*` permission constants are **not** introduced in
  slice A (those domains are not built yet). They are added when the domains
  land. Until then `admin`/`viewer` simply hold the users + self set above.
- Update `permission_test.go` to assert: admin cannot write templates / global
  settings / platform settings; viewer is read-only on users; super_admin
  retains everything; `CanAssignRole` still makes super_admin assignable only by
  super_admin.

## Navigation / IA (slice A, `admin-frontend`)

Grouped sidebar with section headers and a divider. Platform Settings section
renders only when `canManagePlatform`.

```
Dashboard                          (visible to admin / super_admin)
── Domains ──                      (section header)
  Users                            (admin RW, viewer R)
  Events        (later — hidden)
  Exercises     (later — hidden)
──────── divider ────────
── Platform Settings ──            (section header, super_admin only)
  Notifications  ▸                 (expandable group)
      Statistics   (landing/default)
      Logs
      Global Settings
      Templates
  Identity        (later — hidden)
  Audit Log       (later — hidden)
```

- `Sidebar` is extended to model sections (header + items) and an expandable
  group for Notifications. Items carry a visibility predicate
  (`canManage` / `canManagePlatform` / hidden).
- `AdminShell` title resolution updated for the new routes; Events / Exercises /
  Identity / Audit Log are hidden until their slices.
- Notification sub-pages live under a single section route with Radix tabs (see
  slice C), default tab = Statistics.

## Slice B — Dashboard + Users

### Dashboard (`admin-frontend`, `/dashboard`)

Basic, always visible to admin/super_admin. Stat cards over existing data:
- Total users / by role / by status (derived from `GET /api/users`).
- (super_admin only) notification send health for a recent period — done vs
  error counts (from `GET /api/notifications/stats`, slice C). Until slice C
  ships, this card is omitted or shows a placeholder.

No charts initially — numbers + light badges, consistent with the frost theme.

### Users list (`admin-frontend`, `/users`)

- Table: email, name, role, status, created date.
- Client-side search/filter over the fetched list.
- Role and status rendered as badges.
- Row click → detail (`/users/[id]`).
- Source: `GET /api/users` (exists).

### User detail (`admin-frontend`, `/users/[id]`)

- Profile view: email, name, role, status, created/last-login dates, sign-in
  methods (email / google).
- Actions:
  - Change role — `PATCH /api/users/:id/role`, gated by `CanAssignRole`
    (a super_admin role is only assignable by a super_admin; UI hides
    disallowed targets).
  - Block / unblock — `PATCH /api/users/:id/status`.
  - Delete — `DELETE /api/users/:id` behind a confirm dialog.
- Password reset by admin is **out of scope** (decided).

### Backend (slice B, `AP Backend`)

New endpoint:
- `GET /api/users/:id` → single user profile. Permission `users.read`. Returns
  the same shape as a list row plus any detail fields (sign-in methods, dates).
  All other user actions already exist.

## Slice C — Notification management (super_admin)

A single section under Platform Settings with four Radix tabs; the landing
(default) tab is **Statistics**.

### Statistics tab

Aggregates over `notification_dispatches` / `notification_dispatch_targets`:
- Total dispatches; done vs error; breakdown by `notification_type` and by
  `channel`; over a selectable period.
- Backend (new): `GET /api/notifications/stats` (read). Permission:
  `notifications.templates.read` (held only by super_admin under the new RBAC).
  Query params for period/grouping TBD in the slice-C plan.

### Logs tab

- Paginated list of dispatches: notification_type (the "rule"),
  recipient, status, time. Filters: type / status / channel / date range.
- Expanding a row reveals its targets (channel, status, error, attempts) inline
  or in a modal.
- Backend (new):
  - `GET /api/notifications/dispatches` — paginated + filterable list.
  - `GET /api/notifications/dispatches/:id` — dispatch detail with targets.
  - Permission `notifications.templates.read`.

### Global Settings tab

- Per `notification_type` + `channel`: `enabled`, `user_can_change`,
  `user_default`.
- Backend (exists): `GET /api/notifications/settings/global`,
  `PUT /api/notifications/settings/global`.

### Templates tab

- In-app and email templates: list, create, update, status (draft/active),
  delete.
- "Send test" action → `POST /api/notifications/test`.
- Backend (exists): `templates/inapp` + `templates/email` CRUD + status;
  `catalog` for the type list; `test`.

## New backend endpoints (summary)

| Method | Path | Permission | Slice |
|---|---|---|---|
| GET | `/api/users/:id` | `users.read` | B |
| GET | `/api/notifications/stats` | `notifications.templates.read` | C |
| GET | `/api/notifications/dispatches` | `notifications.templates.read` | C |
| GET | `/api/notifications/dispatches/:id` | `notifications.templates.read` | C |

Everything else reuses existing endpoints.

## Out of scope (now)

- Events and Exercises domains (catalog CRUD, their permissions).
- Per-user notification preferences UI.
- Admin-triggered password reset.
- Identity settings; Audit log.

## Build order

A (RBAC + shell) → B (Dashboard + Users) → C (Notifications management). Each
slice is implemented and verified on the current feature branches
(`admin-frontend@feature/base-redesign`, `AP Backend@feature/backend-frontend-proxy`)
and gets its own implementation plan.
