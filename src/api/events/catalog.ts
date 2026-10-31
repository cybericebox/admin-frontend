/**
 * catalog.ts — typed client for the platform events catalog.
 *
 * Routes: GET/POST /api/events, GET/PUT/DELETE /api/events/:id, POST /api/events/:id/archive.
 * JSON PascalCase; envelope {Status,Data} unwrapped by client.ts.
 * Pagination: cursor + pageSize (opaque cursor; a further page exists iff the
 * response carries a NextCursor).
 */
import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client"
import type { CursorPage, OffsetPage } from "@/api/pagination"
import { isUnsetEventDate } from "@/lib/eventDates"
import { isComplete, withoutKey, type FilterBag } from "@/components/table/filters"

const BASE = "/api/events"

function normalizeEvent(value: Event): Event {
  return isUnsetEventDate(value.ArchiveAt) ? { ...value, ArchiveAt: null } : value
}

export type EventStatus = "pending" | "active" | "archived"
export type EventLifecycleStatus = "not_published" | "published" | "started" | "finished" | "withdrawn"
export type EventManager = { UserID: string; Role: number; CreatedAt: string }

export type Event = {
  ID: string
  Tag: string
  Name: string
  AvailableFrom: string
  ArchiveAt: string | null
  Status: EventStatus
  LifecycleStatus?: EventLifecycleStatus
  /** Admin-set at creation; changeable only before publication (older API builds omit it). */
  InfrastructureAllowed?: boolean
  CreatedAt: string
  UpdatedAt: string
}

/** A row of the admin list: the event with its counts (null/absent while the backend does not send them). */
export type EventRow = Event & { ParticipantsCount?: number; TeamsCount?: number; StandsReady?: number; StandsTotal?: number }

export type EventInput = {
  Tag: string
  Name: string
  AvailableFrom: string
  ArchiveAt: string | null
}

/** Creation-only fields: the infrastructure flag cannot change after creation. */
export type EventCreateInput = EventInput & {
  /** Copy the schedule, settings and organizers of this event (name, tag and start come from the body). */
  CopyFromEventID?: string
  /** Omitted: the backend enables it when infrastructure is available. */
  InfrastructureAllowed?: boolean
}

export type EventsFilter = {
  search?: string
  cursor?: string
  pageSize?: number
}

export type EventsPageFilter = {
  search?: string
  status?: string
  page: number
  pageSize: number
  sortBy: string
  sortDir: "asc" | "desc"
}

export async function listEventsPage(filter: EventsPageFilter): Promise<OffsetPage<Event>> {
  const params = new URLSearchParams()
  if (filter.search) params.set("search", filter.search)
  if (filter.status) params.set("status", filter.status)
  params.set("page", String(filter.page))
  params.set("pageSize", String(filter.pageSize))
  params.set("sortBy", filter.sortBy)
  params.set("sortDir", filter.sortDir)
  const raw = await apiGet<OffsetPage<Event>>(`${BASE}?${params}`)
  return { ...raw, Items: (raw.Items ?? []).map(normalizeEvent) }
}

function buildListQuery(filter?: EventsFilter): string {
  const p = new URLSearchParams()
  if (filter?.search) p.set("search", filter.search)
  if (filter?.cursor) p.set("cursor", filter.cursor)
  if (filter?.pageSize) p.set("pageSize", String(filter.pageSize))
  return p.toString()
}

/** GET /api/events?search=&cursor=&pageSize= */
export async function listEvents(filter?: EventsFilter): Promise<CursorPage<Event>> {
  const qs = buildListQuery(filter)
  const raw = await apiGet<CursorPage<Event>>(qs ? `${BASE}?${qs}` : BASE)
  return { Items: (raw.Items ?? []).map(normalizeEvent), Total: raw.Total ?? 0, NextCursor: raw.NextCursor }
}

/** GET /api/events/:id */
export async function getEvent(id: string): Promise<Event> {
  return normalizeEvent(await apiGet<Event>(`${BASE}/${id}`))
}

/** POST /api/events */
export async function createEvent(input: EventCreateInput): Promise<Event> {
  return normalizeEvent(await apiPost<Event>(BASE, input))
}

/**
 * GET /api/infrastructure/status → whether infrastructure tasks can be allowed.
 * Requires infrastructure.read; callers without it should not ask.
 */
export async function getInfrastructureAvailable(): Promise<boolean> {
  const status = await apiGet<{ Available: boolean; Healthy?: boolean }>("/api/infrastructure/status")
  return status.Available && status.Healthy !== false
}

/** PUT /api/events/:id */
export async function updateEvent(id: string, input: EventInput): Promise<Event> {
  return normalizeEvent(await apiPut<Event>(`${BASE}/${id}`, input))
}

/** PUT /api/events/:id/infrastructure — refused after publication and while infrastructure sets are attached. */
export async function setEventInfrastructure(id: string, allowed: boolean): Promise<Event> {
  return normalizeEvent(await apiPut<Event>(`${BASE}/${id}/infrastructure`, { InfrastructureAllowed: allowed }))
}

/** POST /api/events/:id/archive (empty body) */
export async function archiveEvent(id: string): Promise<Event> {
  return normalizeEvent(await apiPost<Event>(`${BASE}/${id}/archive`, {}))
}

/** DELETE /api/events/:id */
export function deleteEvent(id: string): Promise<void> {
  return apiDelete<void>(`${BASE}/${id}`)
}

/** GET /api/events/:id/managers */
export function listEventManagers(id: string): Promise<EventManager[]> {
  return apiGet<EventManager[]>(`${BASE}/${encodeURIComponent(id)}/managers`)
}

/** The schedule part of GET /api/events/:id/manage/lifecycle: a configured event has a start, a finish is optional. */
export type EventSchedule = { Configured: boolean; StartAt: string | null; FinishAt: string | null }

export function getEventSchedule(id: string): Promise<EventSchedule> {
  return apiGet<EventSchedule>(`${BASE}/${encodeURIComponent(id)}/manage/lifecycle`)
}

// ---- The admin list (docs/specs/ADMIN.md §2) ----
export type EventListQuery = { search: string; bag: FilterBag; page: number; pageSize: number; sortBy: string; sortDir: "asc" | "desc" }

const value = (bag: FilterBag, key: string) => (isComplete(bag[key]) ? bag[key] : undefined)

/** The filters of a bag as query parameters: status (repeated), start period, organizer (repeated), infrastructure. */
export function eventFilterParams(bag: FilterBag, p: URLSearchParams = new URLSearchParams()): URLSearchParams {
  value(bag, "status")?.v.forEach((status) => p.append("status", status))
  const period = value(bag, "period")
  if (period) {
    const [a = "", b = ""] = period.v
    const from = period.op === "before" ? "" : a
    const to = period.op === "before" ? a : period.op === "between" ? b : ""
    p.set("period", `${from ? new Date(`${from}T00:00:00`).toISOString() : ""},${to ? new Date(`${to}T23:59:59`).toISOString() : ""}`)
  }
  value(bag, "organizer")?.v.forEach((id) => p.append("organizerID", id))
  const infra = value(bag, "infrastructure")?.v[0]
  if (infra) p.set("infrastructure", infra)
  return p
}

export async function listEventsIndex(query: EventListQuery): Promise<OffsetPage<EventRow>> {
  const params = new URLSearchParams()
  if (query.search) params.set("search", query.search)
  eventFilterParams(query.bag, params)
  params.set("page", String(query.page))
  params.set("pageSize", String(query.pageSize))
  params.set("sortBy", query.sortBy)
  params.set("sortDir", query.sortDir)
  const raw = await apiGet<OffsetPage<EventRow>>(`${BASE}?${params}`)
  return { ...raw, Items: (raw.Items ?? []).map(normalizeEvent) }
}

/** Counts of one filter field's values under the other filters (GET /api/events/facets); null when unknown. */
export async function getEventFacets(field: string, search: string, others: FilterBag): Promise<Record<string, number> | null> {
  const p = new URLSearchParams({ field })
  if (search) p.set("search", search)
  eventFilterParams(withoutKey(others, field), p)
  try {
    const res = await apiGet<{ Counts?: Record<string, number> } | null>(`${BASE}/facets?${p}`)
    return res?.Counts ?? null
  } catch { return null }
}

export type EventOrganizer = { UserID: string; Name: string; Email: string }
/** GET /api/events/organizers: everyone who manages at least one event. */
export const listEventOrganizers = () => apiGet<EventOrganizer[] | null>(`${BASE}/organizers`).then((items) => items ?? [])

export type BulkArchiveResult = { EventID: string; Ok: boolean; Code?: string; Error?: string }
/** POST /api/events/bulk/archive {EventIDs} (1..200): one result per event, in request order. */
export async function bulkArchiveEvents(ids: string[]): Promise<BulkArchiveResult[]> {
  const res = await apiPost<{ Results?: BulkArchiveResult[] }>(`${BASE}/bulk/archive`, { EventIDs: ids })
  return res.Results ?? []
}
