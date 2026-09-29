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

export type EventInput = {
  Tag: string
  Name: string
  AvailableFrom: string
  ArchiveAt: string | null
}

/** Creation-only fields: the infrastructure flag cannot change after creation. */
export type EventCreateInput = EventInput & {
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
