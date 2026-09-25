# Admin «Заходи» (Events) Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin-frontend section for managing platform **events** (subdomain `Tag`, optional `Name`, availability window `AvailableFrom … ArchiveAt`, derived `Status`), replacing the current `/events` "coming soon" stub.

**Architecture:** Mirror the exercises-catalog section end-to-end but thinner — no versions/variants/topology/draft-publish. A typed API client (`src/api/events/catalog.ts`), zod schema + datetime helpers (`src/lib/eventSchemas.ts`), a FullCode→i18n error map (`src/lib/eventErrors.ts`), a shared create/edit `EventDialog`, and the list page. Only lifecycle actions are Archive and Delete.

**Tech Stack:** Next.js 16 (static export), React 19, react-hook-form + zod v4 (`zodResolver`), `t()` from `@/i18n/t`, base `Dialog` primitive (no dedicated AlertDialog exists — confirms are built from `Dialog`+`DialogClose`, the pattern used in `src/app/exercises/detail/page.tsx`). Tests: vitest + @testing-library/react.

## Global Constraints

- **Repo/branch:** `admin-frontend` @ `feature/base-redesign`. Do NOT create a new branch; commit here.
- **Backend contract (source of truth):** `AP Backend internal/delivery/controller/http/handler/event/dto.go`. Response envelope `{Status,Data}` is unwrapped by `src/api/client.ts` (callers receive `Data` directly). Times are RFC3339. `Status` ∈ `"pending" | "active" | "archived"`.
- **Routes:** GET `/api/events?search=&cursor=&pageSize=` (`events.read`), POST `/api/events` (`events.write`), GET `/api/events/:id`, PUT `/api/events/:id`, POST `/api/events/:id/archive`, DELETE `/api/events/:id`.
- **Domain error FullCodes** (`FullCode = informCode*10000 + objectCode*100 + detailCode`; EventObjectCode=11): `31101` ErrEventNotFound, `41102` ErrEventExists, `71103` ErrEventModified, `21104` ErrEventTagInvalid, `21105` ErrEventDatesInvalid, `21106` ErrEventNameTooLong.
- **Backend invariants (UI validates for UX only, never authoritatively):** Tag `^[a-z0-9]+$` len 3–64; Name optional ≤255; `ArchiveAt` strictly after `AvailableFrom`; tag uniqueness among simultaneously-live events.
- **LINT GATE per task:** scoped `npx eslint <own new/changed paths>` clean **AND** whole-repo `npm run test` green (`vitest run`). Whole-repo `npm run lint` is RED at baseline (pre-existing unrelated errors) — do NOT expect it green.
- **COMMIT DISCIPLINE:** the working tree carries FOREIGN uncommitted WIP (Dockerfile, `deploy/*`, notifications tests, BlockEditor, untracked `.claude/`). **NEVER** `git add -A`/`.`/`-u`. Stage ONLY each task's own explicit paths, then `git show --stat HEAD` to confirm only your files landed. If a foreign file leaks: `git reset --soft HEAD~1`, re-stage only your paths, recommit.
- **i18n:** every new key added to **both** `messages/en.json` and `messages/uk.json` (flat dotted keys); all user-facing copy Ukrainian. `admin.nav.events` ("Заходи") + `admin.loading` already exist — reuse, do not re-add.
- **Envelope client:** `apiGet/apiPost/apiPut/apiPatch/apiDelete` from `@/api/client` already exist and unwrap `Data`. `ApiError.body` holds the raw envelope `{ Status: { Code, Message } }`.

---

### Task 1: Events API client

**Files:**
- Create: `src/api/events/catalog.ts`
- Test: `src/api/events/catalog.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `apiPut`, `apiDelete` from `@/api/client`.
- Produces:
  - `type EventStatus = "pending" | "active" | "archived"`
  - `type Event = { ID, Tag, Name, AvailableFrom, ArchiveAt, Status: EventStatus, CreatedAt, UpdatedAt }` (all strings except Status)
  - `type EventsListResponse = { Events: Event[]; NextCursor: string; HasMore: boolean }`
  - `type EventInput = { Tag: string; Name: string; AvailableFrom: string; ArchiveAt: string }` (RFC3339 strings)
  - `type EventsFilter = { search?: string; cursor?: string; pageSize?: number }`
  - `listEvents(filter?) → Promise<EventsListResponse>`, `getEvent(id) → Promise<Event>`, `createEvent(input) → Promise<Event>`, `updateEvent(id, input) → Promise<Event>`, `archiveEvent(id) → Promise<Event>`, `deleteEvent(id) → Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// src/api/events/catalog.test.ts
/**
 * catalog.test.ts — paths, query params and null-normalize for the events client.
 * vi.mock('@/api/client') intercepts all HTTP calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client')

import * as client from '@/api/client'
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  archiveEvent,
  deleteEvent,
} from './catalog'

const mockApiGet = vi.mocked(client.apiGet)
const mockApiPost = vi.mocked(client.apiPost)
const mockApiPut = vi.mocked(client.apiPut)
const mockApiDelete = vi.mocked(client.apiDelete)

const EV_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const rawEvent = {
  ID: EV_ID,
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00:00Z',
  ArchiveAt: '2026-03-08T00:00:00Z',
  Status: 'pending',
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

const input = {
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00:00Z',
  ArchiveAt: '2026-03-08T00:00:00Z',
}

describe('listEvents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with the bare base path when no filter', async () => {
    mockApiGet.mockResolvedValueOnce({ Events: [], NextCursor: '', HasMore: false })
    await listEvents()
    expect(mockApiGet.mock.calls[0][0]).toBe('/api/events')
  })

  it('builds search, cursor and pageSize params', async () => {
    mockApiGet.mockResolvedValueOnce({ Events: [], NextCursor: '', HasMore: false })
    await listEvents({ search: 'ctf', cursor: EV_ID, pageSize: 50 })
    expect(mockApiGet.mock.calls[0][0]).toBe(`/api/events?search=ctf&cursor=${EV_ID}&pageSize=50`)
  })

  it('normalises a null Events array to []', async () => {
    mockApiGet.mockResolvedValueOnce({ Events: null, NextCursor: '', HasMore: false })
    const empty = await listEvents()
    expect(empty.Events).toEqual([])
  })
})

describe('getEvent', () => {
  beforeEach(() => vi.clearAllMocks())
  it('GETs /:id', async () => {
    mockApiGet.mockResolvedValueOnce(rawEvent)
    const result = await getEvent(EV_ID)
    expect(mockApiGet.mock.calls[0][0]).toBe(`/api/events/${EV_ID}`)
    expect(result.Tag).toBe('springctf')
  })
})

describe('createEvent', () => {
  beforeEach(() => vi.clearAllMocks())
  it('POSTs the input body to the base path', async () => {
    mockApiPost.mockResolvedValueOnce(rawEvent)
    await createEvent(input)
    expect(mockApiPost.mock.calls[0][0]).toBe('/api/events')
    expect(mockApiPost.mock.calls[0][1]).toEqual(input)
  })
})

describe('updateEvent', () => {
  beforeEach(() => vi.clearAllMocks())
  it('PUTs /:id with the input body', async () => {
    mockApiPut.mockResolvedValueOnce(rawEvent)
    await updateEvent(EV_ID, input)
    expect(mockApiPut.mock.calls[0][0]).toBe(`/api/events/${EV_ID}`)
    expect(mockApiPut.mock.calls[0][1]).toEqual(input)
  })
})

describe('archiveEvent', () => {
  beforeEach(() => vi.clearAllMocks())
  it('POSTs /:id/archive with an empty body', async () => {
    mockApiPost.mockResolvedValueOnce({ ...rawEvent, Status: 'archived' })
    const result = await archiveEvent(EV_ID)
    expect(mockApiPost.mock.calls[0][0]).toBe(`/api/events/${EV_ID}/archive`)
    expect(mockApiPost.mock.calls[0][1]).toEqual({})
    expect(result.Status).toBe('archived')
  })
})

describe('deleteEvent', () => {
  beforeEach(() => vi.clearAllMocks())
  it('DELETEs /:id', async () => {
    mockApiDelete.mockResolvedValueOnce(undefined)
    await deleteEvent(EV_ID)
    expect(mockApiDelete.mock.calls[0][0]).toBe(`/api/events/${EV_ID}`)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/events/catalog.test.ts`
Expected: FAIL — `Failed to resolve import "./catalog"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/api/events/catalog.ts
/**
 * catalog.ts — typed client for the platform events catalog.
 *
 * Routes: GET/POST /api/events, GET/PUT/DELETE /api/events/:id, POST /api/events/:id/archive.
 * JSON PascalCase; envelope {Status,Data} unwrapped by client.ts.
 * Pagination: cursor + pageSize (opaque cursor, paging driven by HasMore).
 */
import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client"

const BASE = "/api/events"

export type EventStatus = "pending" | "active" | "archived"

export type Event = {
  ID: string
  Tag: string
  Name: string
  AvailableFrom: string
  ArchiveAt: string
  Status: EventStatus
  CreatedAt: string
  UpdatedAt: string
}

export type EventsListResponse = {
  Events: Event[]
  NextCursor: string
  HasMore: boolean
}

export type EventInput = {
  Tag: string
  Name: string
  AvailableFrom: string
  ArchiveAt: string
}

export type EventsFilter = {
  search?: string
  cursor?: string
  pageSize?: number
}

type RawListResponse = {
  Events: Event[] | null
  NextCursor: string
  HasMore: boolean
}

function buildListQuery(filter?: EventsFilter): string {
  const p = new URLSearchParams()
  if (filter?.search) p.set("search", filter.search)
  if (filter?.cursor) p.set("cursor", filter.cursor)
  if (filter?.pageSize) p.set("pageSize", String(filter.pageSize))
  return p.toString()
}

/** GET /api/events?search=&cursor=&pageSize= */
export async function listEvents(filter?: EventsFilter): Promise<EventsListResponse> {
  const qs = buildListQuery(filter)
  const raw = await apiGet<RawListResponse>(qs ? `${BASE}?${qs}` : BASE)
  return { Events: raw.Events ?? [], NextCursor: raw.NextCursor, HasMore: raw.HasMore }
}

/** GET /api/events/:id */
export function getEvent(id: string): Promise<Event> {
  return apiGet<Event>(`${BASE}/${id}`)
}

/** POST /api/events */
export function createEvent(input: EventInput): Promise<Event> {
  return apiPost<Event>(BASE, input)
}

/** PUT /api/events/:id */
export function updateEvent(id: string, input: EventInput): Promise<Event> {
  return apiPut<Event>(`${BASE}/${id}`, input)
}

/** POST /api/events/:id/archive (empty body) */
export function archiveEvent(id: string): Promise<Event> {
  return apiPost<Event>(`${BASE}/${id}/archive`, {})
}

/** DELETE /api/events/:id */
export function deleteEvent(id: string): Promise<void> {
  return apiDelete<void>(`${BASE}/${id}`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/events/catalog.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Gate + commit**

```bash
npx eslint src/api/events/catalog.ts src/api/events/catalog.test.ts
npm run test
git add src/api/events/catalog.ts src/api/events/catalog.test.ts
git show --stat HEAD  # after commit: confirm ONLY these two paths
git commit -m "feat(admin/events): typed events catalog API client"
```

Expected: eslint clean; `npm run test` green (whole suite); commit touches only the two files.

---

### Task 2: Event form schema + datetime helpers

**Files:**
- Create: `src/lib/eventSchemas.ts`
- Test: `src/lib/eventSchemas.test.ts`

**Interfaces:**
- Consumes: `z` from `zod`, `t` from `@/i18n/t`.
- Produces:
  - `const TAG_RE = /^[a-z0-9]+$/`
  - `eventFormSchema` (zod object with a cross-field refine)
  - `type EventFormValues = { Tag: string; Name: string; AvailableFrom: string; ArchiveAt: string }` (all `datetime-local` strings for the two dates)
  - `isoToLocal(iso: string): string` — RFC3339 → `"YYYY-MM-DDTHH:mm"` local, `""` for empty/invalid
  - `localToIso(local: string): string` — `"YYYY-MM-DDTHH:mm"` local → RFC3339 UTC, `""` for empty/invalid

Uses `admin.events.val.*` i18n keys inside zod messages (added in Task 4; tests mock `t` as identity so the key string surfaces).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/eventSchemas.test.ts
/**
 * eventSchemas.test.ts — tag/name/date validation + datetime round-trip.
 * t is mocked identity so a zod message equals its i18n key.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { eventFormSchema, isoToLocal, localToIso } from './eventSchemas'

const valid = {
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00',
  ArchiveAt: '2026-03-08T00:00',
}

describe('eventFormSchema', () => {
  it('accepts a valid form', () => {
    expect(eventFormSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a tag with uppercase or symbols', () => {
    expect(eventFormSchema.safeParse({ ...valid, Tag: 'Spring-CTF' }).success).toBe(false)
  })

  it('rejects a tag shorter than 3 or longer than 64', () => {
    expect(eventFormSchema.safeParse({ ...valid, Tag: 'ab' }).success).toBe(false)
    expect(eventFormSchema.safeParse({ ...valid, Tag: 'a'.repeat(65) }).success).toBe(false)
  })

  it('accepts an empty name but rejects one over 255 chars', () => {
    expect(eventFormSchema.safeParse({ ...valid, Name: '' }).success).toBe(true)
    expect(eventFormSchema.safeParse({ ...valid, Name: 'x'.repeat(256) }).success).toBe(false)
  })

  it('rejects when ArchiveAt is not strictly after AvailableFrom', () => {
    const r = eventFormSchema.safeParse({ ...valid, ArchiveAt: valid.AvailableFrom })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === 'admin.events.val.dates')).toBe(true)
    }
  })

  it('rejects empty date fields', () => {
    expect(eventFormSchema.safeParse({ ...valid, AvailableFrom: '' }).success).toBe(false)
    expect(eventFormSchema.safeParse({ ...valid, ArchiveAt: '' }).success).toBe(false)
  })
})

describe('datetime helpers', () => {
  it('round-trips a local value through localToIso → isoToLocal', () => {
    const local = '2026-03-01T09:30'
    expect(isoToLocal(localToIso(local))).toBe(local)
  })

  it('returns "" for empty or invalid input', () => {
    expect(isoToLocal('')).toBe('')
    expect(isoToLocal('not-a-date')).toBe('')
    expect(localToIso('')).toBe('')
    expect(localToIso('not-a-date')).toBe('')
  })

  it('localToIso produces a Z-terminated RFC3339 string', () => {
    expect(localToIso('2026-03-01T09:30')).toMatch(/Z$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/eventSchemas.test.ts`
Expected: FAIL — `Failed to resolve import "./eventSchemas"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/eventSchemas.ts
/**
 * eventSchemas.ts — zod mirror of the backend event validation + datetime
 * conversion between RFC3339 (API) and the datetime-local input value.
 * The server is authoritative; this only improves UX before the request.
 */
import { z } from "zod"
import { t } from "@/i18n/t"

export const TAG_RE = /^[a-z0-9]+$/

export const eventFormSchema = z
  .object({
    Tag: z
      .string()
      .regex(TAG_RE, t("admin.events.val.tag"))
      .min(3, t("admin.events.val.tag"))
      .max(64, t("admin.events.val.tag")),
    Name: z.string().max(255, t("admin.events.val.name")),
    AvailableFrom: z.string().min(1, t("admin.events.val.availableFrom")),
    ArchiveAt: z.string().min(1, t("admin.events.val.archiveAt")),
  })
  .refine(
    (v) => {
      const from = new Date(v.AvailableFrom).getTime()
      const to = new Date(v.ArchiveAt).getTime()
      return Number.isFinite(from) && Number.isFinite(to) && to > from
    },
    { message: t("admin.events.val.dates"), path: ["ArchiveAt"] },
  )

export type EventFormValues = z.infer<typeof eventFormSchema>

/** RFC3339 → "YYYY-MM-DDTHH:mm" (local time). "" for empty/invalid. */
export function isoToLocal(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" (local) → RFC3339 UTC. "" for empty/invalid. */
export function localToIso(local: string): string {
  if (!local) return ""
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/eventSchemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
npx eslint src/lib/eventSchemas.ts src/lib/eventSchemas.test.ts
npm run test
git add src/lib/eventSchemas.ts src/lib/eventSchemas.test.ts
git show --stat HEAD
git commit -m "feat(admin/events): zod form schema + datetime-local helpers"
```

---

### Task 3: Event error dictionary (FullCode → i18n key)

**Files:**
- Create: `src/lib/eventErrors.ts`
- Test: `src/lib/eventErrors.test.ts`

**Interfaces:**
- Consumes: `ApiError` from `@/api/client`, `t` from `@/i18n/t`.
- Produces:
  - `const ERR_EVENT_EXISTS = 41102`, `const ERR_EVENT_MODIFIED = 71103`
  - `const CODE_TO_KEY: Record<number, string>` — the six event FullCodes → `admin.events.err.*`
  - `eventErrorCode(e: unknown): number | null`
  - `eventErrorMessage(e: unknown): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/eventErrors.test.ts
/**
 * eventErrors.test.ts — FullCode → i18n key dictionary for event domain errors.
 * t is mocked "key → key" to assert the key choice specifically.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { ApiError } from '@/api/client'
import {
  eventErrorCode,
  eventErrorMessage,
  ERR_EVENT_EXISTS,
  ERR_EVENT_MODIFIED,
} from './eventErrors'

function apiError(status: number, code: number, message: string): ApiError {
  return new ApiError(status, { Status: { Code: code, Message: message } }, message)
}

describe('eventErrorCode', () => {
  it('extracts the FullCode from the envelope body', () => {
    expect(eventErrorCode(apiError(409, 71103, 'modified'))).toBe(71103)
  })
  it('returns null for non-ApiError values', () => {
    expect(eventErrorCode(new Error('boom'))).toBeNull()
  })
})

describe('eventErrorMessage', () => {
  it('maps each known event code to its i18n key', () => {
    expect(eventErrorMessage(apiError(404, 31101, 'x'))).toBe('admin.events.err.notFound')
    expect(eventErrorMessage(apiError(409, ERR_EVENT_EXISTS, 'x'))).toBe('admin.events.err.exists')
    expect(eventErrorMessage(apiError(409, ERR_EVENT_MODIFIED, 'x'))).toBe('admin.events.err.modified')
    expect(eventErrorMessage(apiError(422, 21104, 'x'))).toBe('admin.events.err.tagInvalid')
    expect(eventErrorMessage(apiError(422, 21105, 'x'))).toBe('admin.events.err.datesInvalid')
    expect(eventErrorMessage(apiError(422, 21106, 'x'))).toBe('admin.events.err.nameTooLong')
  })

  it('falls back to generic + backend Status.Message for unknown codes', () => {
    expect(eventErrorMessage(apiError(500, 42, 'weird backend fact')))
      .toBe('admin.events.err.generic: weird backend fact')
  })

  it('falls back to plain generic for non-ApiError', () => {
    expect(eventErrorMessage(new TypeError('offline'))).toBe('admin.events.err.generic')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/eventErrors.test.ts`
Expected: FAIL — `Failed to resolve import "./eventErrors"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/eventErrors.ts
/**
 * eventErrors.ts — FullCode → i18n key dictionary for event domain errors.
 *
 * FullCode = informCode*10000 + objectCode*100 + detailCode (EventObjectCode = 11;
 * inform 2=InvalidData, 3=NotFound, 4=Exists, 7=Conflict).
 * Source: AP Backend internal/model/event/errors.go.
 * Unknown code → generic + backend Status.Message. 401/403 never reach here.
 */
import { ApiError } from "@/api/client"
import { t } from "@/i18n/t"

export const ERR_EVENT_EXISTS = 41102
export const ERR_EVENT_MODIFIED = 71103

export const CODE_TO_KEY: Record<number, string> = {
  31101: "admin.events.err.notFound",
  41102: "admin.events.err.exists",
  71103: "admin.events.err.modified",
  21104: "admin.events.err.tagInvalid",
  21105: "admin.events.err.datesInvalid",
  21106: "admin.events.err.nameTooLong",
}

type EnvelopeBody = { Status?: { Code?: number; Message?: string } }

/** FullCode from the error body, or null (not an ApiError / no envelope). */
export function eventErrorCode(e: unknown): number | null {
  if (!(e instanceof ApiError)) return null
  const body = e.body as EnvelopeBody | null | undefined
  const code = body?.Status?.Code
  return typeof code === "number" ? code : null
}

/** Human-readable (Ukrainian) message for any events API error. */
export function eventErrorMessage(e: unknown): string {
  const code = eventErrorCode(e)
  if (code !== null) {
    const key = CODE_TO_KEY[code]
    if (key) return t(key)
    const message = ((e as ApiError).body as EnvelopeBody | null | undefined)?.Status?.Message
    if (message) return `${t("admin.events.err.generic")}: ${message}`
  }
  return t("admin.events.err.generic")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/eventErrors.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
npx eslint src/lib/eventErrors.ts src/lib/eventErrors.test.ts
npm run test
git add src/lib/eventErrors.ts src/lib/eventErrors.test.ts
git show --stat HEAD
git commit -m "feat(admin/events): FullCode → i18n error dictionary"
```

---

### Task 4: i18n keys + parity guard

**Files:**
- Modify: `messages/uk.json`, `messages/en.json`
- Create: `src/i18n/eventsI18n.test.ts`

**Interfaces:**
- Consumes: `CODE_TO_KEY` from `@/lib/eventErrors` (Task 3), `en.json`/`uk.json`.
- Produces: the full `admin.events.*` key block (identical key SET in both catalogs; Ukrainian values in uk, English in en) + a parity-guard test.

- [ ] **Step 1: Write the failing parity test**

```ts
// src/i18n/eventsI18n.test.ts
/**
 * eventsI18n.test.ts — parity guard for the admin.events* key namespace.
 * (1) en.json and uk.json carry the SAME admin.events* key sets;
 * (2) every error-dictionary key resolves in both catalogs;
 * (3) no admin.events* value is blank.
 */
import { describe, it, expect } from "vitest"
import en from "../../messages/en.json"
import uk from "../../messages/uk.json"
import { CODE_TO_KEY } from "@/lib/eventErrors"

const evKeys = (cat: Record<string, string>) =>
  Object.keys(cat).filter((k) => k.startsWith("admin.events")).sort()

describe("admin.events* i18n parity", () => {
  it("en and uk define the same admin.events* keys", () => {
    const enKeys = evKeys(en as Record<string, string>)
    const ukKeys = evKeys(uk as Record<string, string>)
    expect(ukKeys).toEqual(enKeys)
    expect(enKeys.length).toBeGreaterThan(0)
  })

  it("every error-dictionary key exists in both catalogs", () => {
    for (const key of Object.values(CODE_TO_KEY)) {
      expect((en as Record<string, string>)[key], `en missing ${key}`).toBeTruthy()
      expect((uk as Record<string, string>)[key], `uk missing ${key}`).toBeTruthy()
    }
  })

  it("no admin.events* value is blank", () => {
    for (const cat of [en, uk] as Record<string, string>[]) {
      for (const k of evKeys(cat)) expect(cat[k].trim(), `blank value for ${k}`).not.toBe("")
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/i18n/eventsI18n.test.ts`
Expected: FAIL — the `admin.events*` key sets are empty / unequal (only `admin.nav.events` exists, which does not start with `admin.events`).

- [ ] **Step 3: Add the key block to BOTH catalogs**

Insert these entries into `messages/uk.json` (valid JSON — add commas; the JSON is flat, key order is irrelevant to the parity test which sorts):

```json
"admin.events.search": "Пошук заходів",
"admin.events.create.button": "Створити",
"admin.events.empty": "Заходів ще немає",
"admin.events.loadError": "Не вдалося завантажити заходи",
"admin.events.loadingMore": "Завантаження…",
"admin.events.endOfList": "Це всі заходи",
"admin.events.col.tag": "Тег",
"admin.events.col.name": "Назва",
"admin.events.col.status": "Статус",
"admin.events.col.window": "Період",
"admin.events.col.updated": "Оновлено",
"admin.events.status.pending": "Очікує",
"admin.events.status.active": "Активний",
"admin.events.status.archived": "Архівний",
"admin.events.create.title": "Новий захід",
"admin.events.create.description": "Створіть захід із піддоменом і періодом доступності.",
"admin.events.edit.title": "Редагувати захід",
"admin.events.edit.description": "Змініть тег, назву або період доступності.",
"admin.events.field.tag": "Тег (піддомен)",
"admin.events.field.name": "Назва",
"admin.events.field.availableFrom": "Доступний від",
"admin.events.field.archiveAt": "Архівувати о",
"admin.events.dialog.submit": "Зберегти",
"admin.events.dialog.cancel": "Скасувати",
"admin.events.action.edit": "Редагувати",
"admin.events.action.archive": "Архівувати",
"admin.events.action.delete": "Видалити",
"admin.events.archive.title": "Архівувати захід?",
"admin.events.archive.body": "Захід стане недоступним одразу. Дію не можна скасувати.",
"admin.events.archive.confirm": "Архівувати",
"admin.events.delete.title": "Видалити захід?",
"admin.events.delete.body": "Захід буде видалено назавжди. Дію не можна скасувати.",
"admin.events.delete.confirm": "Видалити",
"admin.events.val.tag": "Тег: 3–64 символи, лише малі латинські літери та цифри",
"admin.events.val.name": "Назва має бути не довшою за 255 символів",
"admin.events.val.availableFrom": "Вкажіть дату початку доступності",
"admin.events.val.archiveAt": "Вкажіть дату архівації",
"admin.events.val.dates": "Дата архівації має бути пізніше за дату початку",
"admin.events.err.generic": "Не вдалося виконати операцію",
"admin.events.err.notFound": "Захід не знайдено",
"admin.events.err.exists": "Активний захід із таким тегом уже існує",
"admin.events.err.modified": "Дані змінилися на сервері — оновіть сторінку",
"admin.events.err.tagInvalid": "Некоректний тег: 3–64 символи, лише малі латинські літери та цифри",
"admin.events.err.datesInvalid": "Дата архівації має бути пізніше за дату початку",
"admin.events.err.nameTooLong": "Назва задовга (макс. 255 символів)",
```

Insert the SAME keys into `messages/en.json` with English values:

```json
"admin.events.search": "Search events",
"admin.events.create.button": "Create",
"admin.events.empty": "No events yet",
"admin.events.loadError": "Failed to load events",
"admin.events.loadingMore": "Loading…",
"admin.events.endOfList": "That's all events",
"admin.events.col.tag": "Tag",
"admin.events.col.name": "Name",
"admin.events.col.status": "Status",
"admin.events.col.window": "Window",
"admin.events.col.updated": "Updated",
"admin.events.status.pending": "Pending",
"admin.events.status.active": "Active",
"admin.events.status.archived": "Archived",
"admin.events.create.title": "New event",
"admin.events.create.description": "Create an event with a subdomain and availability window.",
"admin.events.edit.title": "Edit event",
"admin.events.edit.description": "Change the tag, name, or availability window.",
"admin.events.field.tag": "Tag (subdomain)",
"admin.events.field.name": "Name",
"admin.events.field.availableFrom": "Available from",
"admin.events.field.archiveAt": "Archive at",
"admin.events.dialog.submit": "Save",
"admin.events.dialog.cancel": "Cancel",
"admin.events.action.edit": "Edit",
"admin.events.action.archive": "Archive",
"admin.events.action.delete": "Delete",
"admin.events.archive.title": "Archive event?",
"admin.events.archive.body": "The event becomes unavailable immediately. This cannot be undone.",
"admin.events.archive.confirm": "Archive",
"admin.events.delete.title": "Delete event?",
"admin.events.delete.body": "The event will be permanently deleted. This cannot be undone.",
"admin.events.delete.confirm": "Delete",
"admin.events.val.tag": "Tag: 3–64 chars, lowercase latin letters and digits only",
"admin.events.val.name": "Name must be at most 255 characters",
"admin.events.val.availableFrom": "Enter the availability start date",
"admin.events.val.archiveAt": "Enter the archive date",
"admin.events.val.dates": "Archive date must be after the availability start",
"admin.events.err.generic": "The operation could not be completed",
"admin.events.err.notFound": "Event not found",
"admin.events.err.exists": "A live event with this tag already exists",
"admin.events.err.modified": "The data changed on the server — reload the page",
"admin.events.err.tagInvalid": "Invalid tag: 3–64 chars, lowercase latin letters and digits only",
"admin.events.err.datesInvalid": "Archive date must be after the availability start",
"admin.events.err.nameTooLong": "Name is too long (max 255 characters)",
```

- [ ] **Step 4: Run test to verify it passes + JSON stays valid**

Run: `npx vitest run src/i18n/eventsI18n.test.ts`
Expected: PASS (3 tests). If a JSON parse error appears, a comma is missing/trailing — fix it.

- [ ] **Step 5: Gate + commit**

```bash
npx eslint src/i18n/eventsI18n.test.ts
npm run test
git add messages/uk.json messages/en.json src/i18n/eventsI18n.test.ts
git show --stat HEAD
git commit -m "feat(admin/events): admin.events.* i18n keys + parity guard"
```

---

### Task 5: EventDialog (shared create/edit)

**Files:**
- Create: `src/components/events/EventDialog.tsx`
- Test: `src/components/events/EventDialog.test.tsx`

**Interfaces:**
- Consumes: `createEvent`, `updateEvent`, `type Event` from `@/api/events/catalog` (Task 1); `eventFormSchema`, `isoToLocal`, `localToIso`, `type EventFormValues` from `@/lib/eventSchemas` (Task 2); `eventErrorMessage` from `@/lib/eventErrors` (Task 3); ui `Dialog/Form/Input/Button/Alert` primitives.
- Produces: `export function EventDialog(props: { open: boolean; onOpenChange: (v: boolean) => void; event?: Event; onSaved: (e: Event) => void }): JSX.Element`. Create mode when `event` is undefined; edit mode pre-fills via `isoToLocal`. On success calls `onSaved(saved)` then `onOpenChange(false)`; on error shows `eventErrorMessage(e)` in an inline Alert.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/events/EventDialog.test.tsx
/**
 * EventDialog.test.tsx — create vs edit mode, validation surfacing,
 * correct API call + backend-error surfacing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/api/events/catalog', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
}))

import { createEvent, updateEvent } from '@/api/events/catalog'
import { ApiError } from '@/api/client'
import { EventDialog } from './EventDialog'

const mockCreate = vi.mocked(createEvent)
const mockUpdate = vi.mocked(updateEvent)

const EV_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const existing = {
  ID: EV_ID,
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00:00Z',
  ArchiveAt: '2026-03-08T00:00:00Z',
  Status: 'pending' as const,
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

function fillValidForm(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText('admin.events.field.tag'), { target: { value: 'autumnctf' } })
  fireEvent.change(within(dialog).getByLabelText('admin.events.field.name'), { target: { value: 'Autumn CTF' } })
  fireEvent.change(within(dialog).getByLabelText('admin.events.field.availableFrom'), { target: { value: '2026-09-01T09:00' } })
  fireEvent.change(within(dialog).getByLabelText('admin.events.field.archiveAt'), { target: { value: '2026-09-08T09:00' } })
}

describe('EventDialog — create mode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the create title and calls createEvent with an RFC3339 window', async () => {
    mockCreate.mockResolvedValue({ ...existing, Tag: 'autumnctf', Name: 'Autumn CTF' })
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    render(<EventDialog open onOpenChange={onOpenChange} onSaved={onSaved} />)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('admin.events.create.title')).toBeInTheDocument()
    fillValidForm(dialog)
    fireEvent.click(within(dialog).getByText('admin.events.dialog.submit'))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const arg = mockCreate.mock.calls[0][0]
    expect(arg).toMatchObject({ Tag: 'autumnctf', Name: 'Autumn CTF' })
    expect(arg.AvailableFrom).toMatch(/Z$/)
    expect(arg.ArchiveAt).toMatch(/Z$/)
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('surfaces a validation error and does not call the API on an invalid tag', async () => {
    render(<EventDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('admin.events.field.tag'), { target: { value: 'BAD TAG' } })
    fireEvent.change(within(dialog).getByLabelText('admin.events.field.availableFrom'), { target: { value: '2026-09-01T09:00' } })
    fireEvent.change(within(dialog).getByLabelText('admin.events.field.archiveAt'), { target: { value: '2026-09-08T09:00' } })
    fireEvent.click(within(dialog).getByText('admin.events.dialog.submit'))

    expect(await within(dialog).findByText('admin.events.val.tag')).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('surfaces a mapped backend error (tag already used)', async () => {
    mockCreate.mockRejectedValue(new ApiError(409, { Status: { Code: 41102 } }))
    render(<EventDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    const dialog = await screen.findByRole('dialog')
    fillValidForm(dialog)
    fireEvent.click(within(dialog).getByText('admin.events.dialog.submit'))

    expect(await within(dialog).findByText('admin.events.err.exists')).toBeInTheDocument()
  })
})

describe('EventDialog — edit mode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pre-fills the tag and calls updateEvent with the event id', async () => {
    mockUpdate.mockResolvedValue({ ...existing, Name: 'Spring CTF 2' })
    const onSaved = vi.fn()
    render(<EventDialog open onOpenChange={vi.fn()} event={existing} onSaved={onSaved} />)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('admin.events.edit.title')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('admin.events.field.tag')).toHaveValue('springctf')

    fireEvent.change(within(dialog).getByLabelText('admin.events.field.name'), { target: { value: 'Spring CTF 2' } })
    fireEvent.click(within(dialog).getByText('admin.events.dialog.submit'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockUpdate.mock.calls[0][0]).toBe(EV_ID)
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/events/EventDialog.test.tsx`
Expected: FAIL — `Failed to resolve import "./EventDialog"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/events/EventDialog.tsx
"use client"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { t } from "@/i18n/t"
import { createEvent, updateEvent, type Event } from "@/api/events/catalog"
import { eventFormSchema, isoToLocal, localToIso, type EventFormValues } from "@/lib/eventSchemas"
import { eventErrorMessage } from "@/lib/eventErrors"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  event?: Event
  onSaved: (e: Event) => void
}

function toDefaults(event?: Event): EventFormValues {
  return {
    Tag: event?.Tag ?? "",
    Name: event?.Name ?? "",
    AvailableFrom: isoToLocal(event?.AvailableFrom ?? ""),
    ArchiveAt: isoToLocal(event?.ArchiveAt ?? ""),
  }
}

export function EventDialog({ open, onOpenChange, event, onSaved }: Props) {
  const isEdit = event !== undefined
  const [error, setError] = useState<string | null>(null)
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: toDefaults(event),
  })
  const busy = form.formState.isSubmitting

  // Re-seed the form each time the dialog opens for a (possibly different) event.
  useEffect(() => {
    if (open) {
      form.reset(toDefaults(event))
      setError(null)
    }
  }, [open, event, form])

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    const input = {
      Tag: values.Tag,
      Name: values.Name,
      AvailableFrom: localToIso(values.AvailableFrom),
      ArchiveAt: localToIso(values.ArchiveAt),
    }
    try {
      const saved = isEdit ? await updateEvent(event.ID, input) : await createEvent(input)
      onSaved(saved)
      onOpenChange(false)
    } catch (e) {
      setError(eventErrorMessage(e))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(isEdit ? "admin.events.edit.title" : "admin.events.create.title")}</DialogTitle>
          <DialogDescription>
            {t(isEdit ? "admin.events.edit.description" : "admin.events.create.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <FormField control={form.control} name="Tag" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.events.field.tag")}</FormLabel>
                <FormControl><Input {...field} disabled={busy} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="Name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.events.field.name")}</FormLabel>
                <FormControl><Input {...field} disabled={busy} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="AvailableFrom" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.events.field.availableFrom")}</FormLabel>
                <FormControl><Input type="datetime-local" {...field} disabled={busy} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="ArchiveAt" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.events.field.archiveAt")}</FormLabel>
                <FormControl><Input type="datetime-local" {...field} disabled={busy} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                {t("admin.events.dialog.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>{t("admin.events.dialog.submit")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/events/EventDialog.test.tsx`
Expected: PASS. (If `getByLabelText` fails for a datetime-local field, confirm `ui/input` forwards `type` — it spreads `...props`, so it does.)

- [ ] **Step 5: Gate + commit**

```bash
npx eslint src/components/events/EventDialog.tsx src/components/events/EventDialog.test.tsx
npm run test
git add src/components/events/EventDialog.tsx src/components/events/EventDialog.test.tsx
git show --stat HEAD
git commit -m "feat(admin/events): shared create/edit EventDialog"
```

---

### Task 6: Events list page (replace the stub)

**Files:**
- Modify (overwrite): `src/app/events/page.tsx`
- Test: `src/app/events/page.test.tsx`

**Interfaces:**
- Consumes: `listEvents`, `archiveEvent`, `deleteEvent`, `type Event`, `type EventStatus` from `@/api/events/catalog`; `eventErrorMessage` from `@/lib/eventErrors`; `EventDialog` from `@/components/events/EventDialog`; `useRole` from `@/lib/useRole`; ui `Dialog/Input/Button/Spinner`.
- Produces: the default-exported `/events` list page. No new exports consumed elsewhere.

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/events/page.test.tsx
/**
 * page.test.tsx — events catalog: row render, debounced search, RBAC-gated
 * actions, create/edit dialog open, archive + delete confirm flows.
 * EventDialog is stubbed (its own test covers internals).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import React from 'react'

const h = vi.hoisted(() => ({ canWrite: true }))

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({
    me: null, role: 'admin', isLoading: false, permissions: ['*'],
    can: (p: string) => (p === 'events.write' ? h.canWrite : true),
  }),
}))
vi.mock('@/api/events/catalog', () => ({
  listEvents: vi.fn(),
  archiveEvent: vi.fn(),
  deleteEvent: vi.fn(),
}))
vi.mock('@/components/events/EventDialog', () => ({
  EventDialog: ({ open, event, onSaved }: { open: boolean; event?: { ID: string }; onSaved: (e: unknown) => void }) =>
    open
      ? React.createElement(
          'div',
          { role: 'dialog' },
          event ? 'edit-mode' : 'create-mode',
          React.createElement('button', { onClick: () => onSaved({ ID: event?.ID ?? 'new' }) }, 'mock-save'),
        )
      : null,
}))

import { listEvents, archiveEvent, deleteEvent } from '@/api/events/catalog'
import Page from './page'

const mockList = vi.mocked(listEvents)
const mockArchive = vi.mocked(archiveEvent)
const mockDelete = vi.mocked(deleteEvent)

class IO { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('IntersectionObserver', IO)

const EV_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const activeEvent = {
  ID: EV_ID,
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00:00Z',
  ArchiveAt: '2026-03-08T00:00:00Z',
  Status: 'active' as const,
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

describe('events catalog page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.canWrite = true
    mockList.mockResolvedValue({ Events: [activeEvent], NextCursor: '', HasMore: false })
  })

  it('renders a row with tag, name and an active status badge', async () => {
    render(<Page />)
    expect(await screen.findByText('springctf')).toBeInTheDocument()
    expect(screen.getByText('Spring CTF')).toBeInTheDocument()
    expect(screen.getByText('admin.events.status.active')).toBeInTheDocument()
  })

  it('renders the empty state', async () => {
    mockList.mockResolvedValue({ Events: [], NextCursor: '', HasMore: false })
    render(<Page />)
    expect(await screen.findByText('admin.events.empty')).toBeInTheDocument()
  })

  it('debounces search and passes it to listEvents', async () => {
    render(<Page />)
    await screen.findByText('springctf')
    fireEvent.change(screen.getByPlaceholderText('admin.events.search'), { target: { value: 'ctf' } })
    await waitFor(() => {
      const calls = mockList.mock.calls
      expect(calls[calls.length - 1][0]).toMatchObject({ search: 'ctf' })
    })
  })

  it('hides the create button without events.write', async () => {
    h.canWrite = false
    render(<Page />)
    await screen.findByText('springctf')
    expect(screen.queryByText('admin.events.create.button')).not.toBeInTheDocument()
  })

  it('opens the create dialog from the header button', async () => {
    render(<Page />)
    await screen.findByText('springctf')
    fireEvent.click(screen.getByText('admin.events.create.button'))
    expect(await screen.findByText('create-mode')).toBeInTheDocument()
  })

  it('opens the edit dialog from a row action', async () => {
    render(<Page />)
    await screen.findByText('springctf')
    fireEvent.click(screen.getByText('admin.events.action.edit'))
    expect(await screen.findByText('edit-mode')).toBeInTheDocument()
  })

  it('hides row actions without events.write', async () => {
    h.canWrite = false
    render(<Page />)
    await screen.findByText('springctf')
    expect(screen.queryByText('admin.events.action.edit')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.events.action.archive')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.events.action.delete')).not.toBeInTheDocument()
  })

  it('archives after confirming and swaps the row to archived', async () => {
    mockArchive.mockResolvedValue({ ...activeEvent, Status: 'archived' })
    render(<Page />)
    await screen.findByText('springctf')
    fireEvent.click(screen.getByText('admin.events.action.archive'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText('admin.events.archive.confirm'))
    await waitFor(() => expect(mockArchive).toHaveBeenCalledWith(EV_ID))
    expect(await screen.findByText('admin.events.status.archived')).toBeInTheDocument()
  })

  it('does not show Archive for an already-archived event', async () => {
    mockList.mockResolvedValue({ Events: [{ ...activeEvent, Status: 'archived' }], NextCursor: '', HasMore: false })
    render(<Page />)
    await screen.findByText('springctf')
    expect(screen.queryByText('admin.events.action.archive')).not.toBeInTheDocument()
  })

  it('deletes after confirming and removes the row', async () => {
    mockDelete.mockResolvedValue(undefined)
    render(<Page />)
    await screen.findByText('springctf')
    fireEvent.click(screen.getByText('admin.events.action.delete'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText('admin.events.delete.confirm'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(EV_ID))
    await waitFor(() => expect(screen.queryByText('springctf')).not.toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/events/page.test.tsx`
Expected: FAIL — the current stub renders `admin.comingSoon`, so `findByText('springctf')` times out and the action buttons don't exist.

- [ ] **Step 3: Write the implementation (overwrite the stub)**

```tsx
// src/app/events/page.tsx
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import {
  listEvents, archiveEvent, deleteEvent, type Event, type EventStatus,
} from "@/api/events/catalog"
import { eventErrorMessage } from "@/lib/eventErrors"
import { EventDialog } from "@/components/events/EventDialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"

const PAGE = 50

const STATUS_STYLE: Record<EventStatus, string> = {
  pending: "bg-secondary/40 text-muted-foreground",
  active: "bg-primary/15 text-primary",
  archived: "bg-secondary/40 text-muted-foreground",
}

function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>
      {t(`admin.events.status.${status}`)}
    </span>
  )
}

function fmt(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString()
}

type Confirming = { kind: "archive" | "delete"; event: Event }

export default function Page() {
  const { can } = useRole()
  const writable = can("events.write")

  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [rows, setRows] = useState<Event[]>([])
  const [cursor, setCursor] = useState("")
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const buildFilter = useCallback(
    (cur: string) => ({
      ...(debounced ? { search: debounced } : {}),
      ...(cur ? { cursor: cur } : {}),
      pageSize: PAGE,
    }),
    [debounced],
  )

  // Reset pagination synchronously during render when the filter changes.
  const [appliedFilterKey, setAppliedFilterKey] = useState(debounced)
  if (debounced !== appliedFilterKey) {
    setAppliedFilterKey(debounced)
    setLoading(true); setError(false); setRows([]); setCursor(""); setHasMore(false)
  }

  const reload = useCallback(() => {
    setLoading(true); setError(false)
    listEvents(buildFilter(""))
      .then((d) => { setRows(d.Events); setCursor(d.NextCursor); setHasMore(d.HasMore) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [buildFilter])

  useEffect(() => {
    let cancelled = false
    listEvents(buildFilter(""))
      .then((d) => { if (!cancelled) { setRows(d.Events); setCursor(d.NextCursor); setHasMore(d.HasMore) } })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [buildFilter])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !cursor) return
    setLoadingMore(true)
    listEvents(buildFilter(cursor))
      .then((d) => {
        setRows((prev) => [...prev, ...d.Events])
        setCursor(d.NextCursor); setHasMore(d.HasMore)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [hasMore, loadingMore, cursor, buildFilter])

  const loadMoreRef = useRef(loadMore)
  useEffect(() => { loadMoreRef.current = loadMore })
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current() },
      { rootMargin: "200px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // create → refetch first page; edit → replace the row in place.
  const onCreated = useCallback(() => { reload() }, [reload])
  const onEdited = useCallback((updated: Event) => {
    setRows((prev) => prev.map((r) => (r.ID === updated.ID ? updated : r)))
  }, [])

  function closeConfirm(next: boolean) {
    if (!next) { setConfirming(null); setConfirmError(null) }
  }

  async function runConfirm() {
    if (!confirming) return
    setConfirmBusy(true); setConfirmError(null)
    try {
      if (confirming.kind === "archive") {
        const updated = await archiveEvent(confirming.event.ID)
        setRows((prev) => prev.map((r) => (r.ID === updated.ID ? updated : r)))
      } else {
        await deleteEvent(confirming.event.ID)
        setRows((prev) => prev.filter((r) => r.ID !== confirming.event.ID))
      }
      setConfirming(null)
    } catch (e) {
      setConfirmError(eventErrorMessage(e))
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="frost-panel frost-in rounded-lg p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.events.search")}
          className="max-w-sm"
        />
        {writable && (
          <Button className="ml-auto" onClick={() => setCreateOpen(true)}>{t("admin.events.create.button")}</Button>
        )}
      </div>

      <EventDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={onCreated} />
      <EventDialog
        open={editing !== null}
        event={editing ?? undefined}
        onOpenChange={(v) => { if (!v) setEditing(null) }}
        onSaved={onEdited}
      />

      {error ? (
        <p className="py-8 text-center text-sm text-destructive">{t("admin.events.loadError")}</p>
      ) : loading ? (
        <div className="flex justify-center py-8"><Spinner label={t("admin.loading")} /></div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.events.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("admin.events.col.tag")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.events.col.name")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.events.col.status")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.events.col.window")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.events.col.updated")}</th>
                {writable && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => (
                <tr key={ev.ID} className="border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">{ev.Tag}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{ev.Name || "—"}</span>
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={ev.Status} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(ev.AvailableFrom)} → {fmt(ev.ArchiveAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {ev.UpdatedAt ? new Date(ev.UpdatedAt).toLocaleDateString() : "—"}
                  </td>
                  {writable && (
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(ev)}>
                          {t("admin.events.action.edit")}
                        </Button>
                        {ev.Status !== "archived" && (
                          <Button variant="outline" size="sm" onClick={() => setConfirming({ kind: "archive", event: ev })}>
                            {t("admin.events.action.archive")}
                          </Button>
                        )}
                        <Button variant="destructive" size="sm" onClick={() => setConfirming({ kind: "delete", event: ev })}>
                          {t("admin.events.action.delete")}
                        </Button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div ref={sentinelRef} className="h-6" />
      {loadingMore && <p className="py-2 text-center text-xs text-muted-foreground">{t("admin.events.loadingMore")}</p>}
      {!loading && !hasMore && rows.length > 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">{t("admin.events.endOfList")}</p>
      )}

      <Dialog open={confirming !== null} onOpenChange={closeConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(confirming?.kind === "delete" ? "admin.events.delete.title" : "admin.events.archive.title")}
            </DialogTitle>
            <DialogDescription>
              {t(confirming?.kind === "delete" ? "admin.events.delete.body" : "admin.events.archive.body")}
            </DialogDescription>
          </DialogHeader>
          {confirmError && <p className="text-sm text-destructive">{confirmError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={confirmBusy}>{t("admin.events.dialog.cancel")}</Button>
            </DialogClose>
            <Button
              variant={confirming?.kind === "delete" ? "destructive" : "default"}
              disabled={confirmBusy}
              onClick={runConfirm}
            >
              {t(confirming?.kind === "delete" ? "admin.events.delete.confirm" : "admin.events.archive.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/events/page.test.tsx`
Expected: PASS (10 tests). Then the full suite: `npm run test`.

- [ ] **Step 5: Build check + gate + commit**

```bash
npx eslint src/app/events/page.tsx src/app/events/page.test.tsx
npm run test
npm run build   # confirm /events route builds (static export)
git add src/app/events/page.tsx src/app/events/page.test.tsx
git show --stat HEAD
git commit -m "feat(admin/events): events list page with create/edit/archive/delete"
```

Expected: eslint clean; full suite green; `next build` succeeds with the `/events` route; commit touches only the two files.

---

## Self-Review notes (spec coverage)

- API client (list/get/create/update/archive/delete, null-Events normalize, opaque cursor) → **Task 1**.
- Schema + `isoToLocal`/`localToIso` + `EventFormValues` → **Task 2**.
- `eventErrors` (six FullCodes, exported consts, `eventErrorMessage`) → **Task 3**.
- i18n `admin.events.*` in both catalogs + parity guard → **Task 4**.
- `EventDialog` (create/edit, RHF+zod, datetime conversion, error Alert) → **Task 5**.
- List page (debounced search, infinite scroll, filter-reset, columns Tag/Name/Status/Window/Updated, status badge, RBAC-gated create + row actions, Archive hidden when archived, in-place row update / refetch on create, confirm dialogs, states) → **Task 6**.
- RBAC: `can("events.write")` gates create + row actions; the backend gate is authoritative (unchanged).
- Out of scope (no detail route, versions, stats, grants, bulk) respected — only Archive + Delete lifecycle.
