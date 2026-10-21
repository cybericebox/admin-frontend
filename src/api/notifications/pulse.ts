/**
 * pulse.ts — the notifications pulse and the inbox "news" call.
 * GET /api/notifications/pulse?site=..[&event=] → {Banners, Inbox: {Cursor, Unread} | null} (ETag/304, guests get Inbox null).
 * GET /api/notifications/inbox?site=..[&event=]&since=<cursor> → new items (oldest first), Unread, Counts, OtherEventsCount.
 */
import { apiGet } from '@/api/client'

export const PULSE_SITE = 'admin'

export type PulseInbox = { Cursor: string; Unread: number }
export type Pulse = { Banners: string; Inbox: PulseInbox | null }

export type InboxSince<T> = {
  Cursor: string
  Items: T[] | null
  Unread: number
  Counts?: unknown
  OtherEventsCount?: unknown
}

function scope(event?: string): string {
  const query = new URLSearchParams({ site: PULSE_SITE })
  if (event) query.set('event', event)
  return query.toString()
}

/** Plain GET: no cache override, so the browser revalidates by ETag and the server may answer 304. */
export function fetchPulse(event?: string): Promise<Pulse> {
  return apiGet<Pulse>(`/api/notifications/pulse?${scope(event)}`, undefined, { retry: false })
}

/** Empty `since` = baseline. */
export function fetchInboxSince<T>(since: string, event?: string): Promise<InboxSince<T>> {
  const query = new URLSearchParams({ site: PULSE_SITE })
  if (event) query.set('event', event)
  query.set('since', since)
  return apiGet<InboxSince<T>>(`/api/notifications/inbox?${query.toString()}`)
}
