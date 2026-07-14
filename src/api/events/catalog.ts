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
