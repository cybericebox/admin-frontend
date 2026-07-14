# Admin «Заходи» (Events) Section — Design

**Goal:** Build the admin-frontend section for managing platform **events** (tenancy: subdomain `Tag`, optional `Name`, availability window `AvailableFrom … ArchiveAt`, derived `Status`). Mirrors the existing exercises-catalog section end-to-end, but thinner: no versions, variants, topology, or draft/publish. Replaces the current `/events` "coming soon" stub.

**Repo / branch:** `admin-frontend` @ `feature/base-redesign`.

**Backend:** AP Backend platform-event CRUD (branch `feature/single-domain-auth-model`), routes under `/api/events`, RBAC `events.read` / `events.write`. Response envelope `{Status,Data}` is unwrapped by `src/api/client.ts`.

**Stack:** Next.js 16 (static export), React 19, react-hook-form + zod v4, next-intl-style `t()`, vitest. No new dependencies.

## Backend contract (source of truth)

Response DTOs (`AP Backend internal/delivery/controller/http/handler/event/dto.go`):

- `eventResponse { ID, Tag, Name, AvailableFrom, ArchiveAt, Status, CreatedAt, UpdatedAt }` — all times RFC3339; `Status` is a lowercase string `"pending" | "active" | "archived"`.
- `eventsListResponse { Events: eventResponse[] | null, NextCursor: string (uuid), HasMore: bool }`.
- `createEventRequest` / `updateEventRequest`: `{ Tag, Name, AvailableFrom, ArchiveAt }` (RFC3339 times).

Routes:

| Method | Path | Gate | Purpose |
|--------|------|------|---------|
| GET | `/api/events?search=&cursor=&pageSize=` | `events.read` | list (keyset by `(created_at,id)` desc) |
| POST | `/api/events` | `events.write` | create |
| GET | `/api/events/:id` | `events.read` | read one |
| PUT | `/api/events/:id` | `events.write` | update (Tag/Name/window) |
| POST | `/api/events/:id/archive` | `events.write` | archive (collapses `ArchiveAt` to now) |
| DELETE | `/api/events/:id` | `events.write` | delete |

Backend invariants (server-enforced; the UI validates for UX only, never authoritatively):
- Tag: `^[a-z0-9]+$`, length 3–64.
- Name: optional, ≤ 255 chars.
- `ArchiveAt` must be strictly after `AvailableFrom`; a zero `AvailableFrom` defaults to now.
- Subdomain-tag uniqueness among **simultaneously-live** events (create/update reject a second live event with the same tag → `ErrEventExists` 409).
- `Status` is derived: before `AvailableFrom` → pending; `[AvailableFrom, ArchiveAt)` → active; `≥ ArchiveAt` → archived (archived wins, so an early archive reads archived).

Domain error FullCodes (`FullCode = informCode*10000 + objectCode*100 + detailCode`; **EventObjectCode = 11**; inform 2=InvalidData, 3=NotFound, 4=Exists, 7=Conflict — verify against `AP Backend internal/model/event/errors.go`):

| FullCode | Var | Meaning | UI message intent |
|----------|-----|---------|-------------------|
| 31101 | ErrEventNotFound | 404 | event gone (reload list) |
| 41102 | ErrEventExists | 409 | tag already used by a live event |
| 71103 | ErrEventModified | 409 | modified concurrently (reload) |
| 21104 | ErrEventTagInvalid | 422 | tag format/length |
| 21105 | ErrEventDatesInvalid | 422 | archive must be after availability |
| 21106 | ErrEventNameTooLong | 422 | name > 255 |

## Architecture

New units, each with one responsibility, mirroring the exercises section:

### `src/api/events/catalog.ts` — typed API client
Mirrors `src/api/exercises/catalog.ts`.

```
BASE = "/api/events"

type EventStatus = "pending" | "active" | "archived"
type Event = { ID, Tag, Name, AvailableFrom, ArchiveAt, Status: EventStatus, CreatedAt, UpdatedAt }
type EventsListResponse = { Events: Event[], NextCursor: string, HasMore: boolean }
type EventInput = { Tag, Name, AvailableFrom, ArchiveAt }   // RFC3339 strings
type EventsFilter = { search?, cursor?, pageSize? }
```

Functions (all return domain-normalized objects; a `null` `Events` array normalizes to `[]`):
- `listEvents(filter?) → EventsListResponse` — GET with `buildListQuery` (search/cursor/pageSize, mirror exercises).
- `getEvent(id) → Event`.
- `createEvent(input: EventInput) → Event` — POST BASE.
- `updateEvent(id, input: EventInput) → Event` — PUT `BASE/:id`.
- `archiveEvent(id) → Event` — POST `BASE/:id/archive` (empty body).
- `deleteEvent(id) → void` — DELETE `BASE/:id`.

Cursor is treated as an opaque string exactly like exercises (`NextCursor` fed back as `cursor`; paging is driven by `HasMore`, not by inspecting the cursor value).

### `src/lib/eventSchemas.ts` — zod validation + datetime conversion
- `eventFormSchema`: `Tag` (`/^[a-z0-9]+$/`, 3–64), `Name` (string, ≤255, may be empty), `AvailableFrom` + `ArchiveAt` as `datetime-local` strings (`"YYYY-MM-DDTHH:mm"`), refined so `ArchiveAt > AvailableFrom`.
- Helpers `isoToLocal(iso)` / `localToIso(local)` converting between RFC3339 (backend) and the `datetime-local` input value. `localToIso` uses `new Date(local).toISOString()`; `isoToLocal` formats a Date to local `YYYY-MM-DDTHH:mm`.
- `type EventFormValues`.

### `src/lib/eventErrors.ts` — FullCode → i18n key
Mirrors `src/lib/exerciseErrors.ts`: a `CODE_TO_KEY` map for the six event FullCodes above, exported code consts where a caller needs to branch (e.g. `ERR_EVENT_EXISTS`, `ERR_EVENT_MODIFIED`), and `eventErrorMessage(e: unknown): string` returning a localized message (unknown code → generic + backend `Status.Message`; 401/403 never reach here).

### `src/components/events/EventDialog.tsx` — shared create/edit dialog
- Props: `{ open, onOpenChange, event?: Event, onSaved: (e: Event) => void }`. `event` absent → create mode; present → edit mode (fields pre-filled via `isoToLocal`).
- RHF + `zodResolver(eventFormSchema)`; fields: Tag, Name, AvailableFrom (`<input type="datetime-local">`), ArchiveAt (`datetime-local`).
- Submit → `createEvent` or `updateEvent(event.ID, …)` with `localToIso` conversion; on success call `onSaved(created)` and close; on error show `eventErrorMessage(e)` in an inline `Alert`.
- Uses shared `ui/dialog`, `ui/form`, `ui/input`, `ui/button`, `ui/alert` — same primitives as the exercise create dialog.

### `src/app/events/page.tsx` — list page (replaces the stub)
Mirrors `src/app/exercises/page.tsx` list mechanics:
- Debounced (300ms) `search` input; infinite scroll via `IntersectionObserver` sentinel; the render-time filter-reset pattern (reset rows/cursor when the debounced filter changes).
- Table columns: **Tag**, **Name**, **Status** (badge: pending=muted, active=primary, archived=secondary/grey), **Window** (`AvailableFrom → ArchiveAt`, localized dates+time), **Updated**.
- Header: search input + «Створити» button (rendered only when `can("events.write")`).
- Row actions (each gated by `can("events.write")`): **Edit** (opens `EventDialog` in edit mode), **Archive** (shown only when `Status !== "archived"`; confirm → `archiveEvent`), **Delete** (confirm → `deleteEvent`, destructive).
- After create/edit/archive/delete: update the affected row in place (or re-fetch the first page for create) so the list reflects the change without a full reload.
- States mirror exercises: loading spinner, load error, empty, end-of-list, loading-more.
- Confirmations use the shared confirm/alert-dialog primitive already used elsewhere in the admin (reuse; do not add a new dependency).

### i18n
Add an `admin.events.*` key block to **both** `messages/uk.json` and `messages/en.json` (parity guard enforces equality). Covers: page (search placeholder, create button, empty, loadError, loadingMore, endOfList, loading), columns (tag/name/status/window/updated), status labels (pending/active/archived), dialog (create/edit titles + descriptions, field labels tag/name/availableFrom/archiveAt, submit/cancel), row actions + confirms (edit, archive + archive-confirm title/body, delete + delete-confirm title/body), and the six error keys (`admin.events.err.*`). All user-facing strings Ukrainian; `admin.nav.events` ("Заходи") already exists.

## RBAC
Route/nav visibility is already handled by the shell; mutations are gated in-UI via `can("events.write")` (the authoritative check is the backend gate — the UI gate is UX only). No changes to `useRole`/permission plumbing; `events.*` resolves through the same `can()` the exercises section uses.

## Testing (vitest, mirror exercises test style)
- `src/api/events/catalog.test.ts` — list normalization (`null` Events → `[]`), query building, and that create/update/archive/delete hit the right method+path with the right body.
- `src/lib/eventSchemas.test.ts` — tag pattern + length bounds, name length, `ArchiveAt > AvailableFrom` refinement, `isoToLocal`/`localToIso` round-trip.
- `src/lib/eventErrors.test.ts` — each FullCode maps to its key; unknown → generic.
- `src/app/events/page.test.tsx` — renders list, search filters, create/edit dialog opens, write-gated buttons hidden without permission, archive/delete confirm flow, status badge rendering.
- `src/components/events/EventDialog.test.tsx` — create vs edit mode, validation errors surface, submit calls the right API and reports backend errors.
- i18n parity: the existing parity guard must stay green with the new keys added to both locales.

## Out of scope (YAGNI)
Per-event content (lives in the per-event domain), stats, user grants, bulk operations, a separate `/events/detail` route, and any change to the events backend. Archive and Delete are the only lifecycle actions.

## Gates (admin-frontend conventions)
- Per task: scoped `npx eslint <own new/changed paths>` clean + whole-repo `npm run test` green. Whole-repo `npm run lint` is RED at baseline (pre-existing unrelated errors) — do **not** expect it green.
- Commit discipline: the working tree carries foreign uncommitted WIP (Dockerfile/deploy/*, notifications tests, BlockEditor). **Never** `git add -A`; stage only each task's own paths.
- Every new i18n key added to **both** `messages/en.json` and `messages/uk.json`; user-facing copy Ukrainian.
