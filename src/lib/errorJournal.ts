import {
  MAX_NOTIFY_CHATS, MAX_NOTIFY_EMAILS,
  type ErrorFilters, type ErrorGroup, type ErrorStreamEvent, type NotFoundStats,
} from "@/api/errorJournal"

const time = (iso: string | undefined) => (iso ? Date.parse(iso) : NaN)

/** Whether a group belongs to the list the filters describe (the same rules the server applies). */
export function groupMatches(group: ErrorGroup, filters: ErrorFilters): boolean {
  if (filters.kinds.length && !filters.kinds.includes(group.Kind)) return false
  if (filters.status && group.Status !== filters.status) return false
  const q = filters.q.trim().toLowerCase()
  if (q && !group.Title.toLowerCase().includes(q) && !group.Source.toLowerCase().includes(q)) return false
  const seen = Date.parse(group.LastSeenAt)
  const from = time(filters.from)
  const to = time(filters.to)
  if (!Number.isNaN(from) && seen < from) return false
  if (!Number.isNaN(to) && seen > to) return false
  return true
}

export type GroupPage = { items: ErrorGroup[]; total: number }

const byLastSeen = (a: ErrorGroup, b: ErrorGroup) => Date.parse(b.LastSeenAt) - Date.parse(a.LastSeenAt)

/**
 * Applies one live "error-group" event to the loaded page, in place: the row is replaced (or dropped when
 * it no longer fits the filters), a new group joins the top of the first page. Pages after the first only
 * keep the total honest. The page never reloads, so nothing flashes.
 */
export function applyStreamEvent(page: GroupPage, event: ErrorStreamEvent, filters: ErrorFilters, limit: number, offset: number): GroupPage {
  const group = event.Group
  const index = page.items.findIndex((item) => item.ID === group.ID)
  const fits = groupMatches(group, filters)
  if (index >= 0) {
    if (!fits) return { items: page.items.filter((item) => item.ID !== group.ID), total: Math.max(0, page.total - 1) }
    const items = page.items.slice()
    items[index] = group
    return { items: items.sort(byLastSeen), total: page.total }
  }
  if (!fits) return page
  const total = event.New ? page.total + 1 : page.total
  if (offset > 0) return { items: page.items, total }
  const items = [...page.items, group].sort(byLastSeen)
  return { items: items.slice(0, limit), total }
}

/** Replaces a group's row with the server's answer. Returns the same page when nothing changes. */
export function replaceGroup(page: GroupPage, group: ErrorGroup): GroupPage {
  const index = page.items.findIndex((item) => item.ID === group.ID)
  if (index < 0) return page
  const current = page.items[index]
  if (JSON.stringify(current) === JSON.stringify(group)) return page
  const items = page.items.slice()
  items[index] = group
  return { ...page, items }
}

// ---- Settings validation ----------------------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const CHAT_NUMBER = /^-?\d{1,20}$/
const CHAT_CHANNEL = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/

export const isEmailAddress = (value: string) => EMAIL.test(value.trim())
/** A chat id is a number (negative for groups) or @channel. */
export const isChatID = (value: string) => CHAT_NUMBER.test(value.trim()) || CHAT_CHANNEL.test(value.trim())

export type SettingsDraft = { emails: string[]; chats: { chatID: string; label: string }[] }
export type SettingsIssue = { key: string; vars?: Record<string, string | number>; field: "emails" | "chats" }

/** Problems the server would reject, found first so the person sees them next to the field. */
export function validateSettings(draft: SettingsDraft): SettingsIssue[] {
  const issues: SettingsIssue[] = []
  if (draft.emails.length > MAX_NOTIFY_EMAILS) issues.push({ field: "emails", key: "admin.errors.settings.tooManyEmails", vars: { max: MAX_NOTIFY_EMAILS } })
  const seenEmails = new Set<string>()
  for (const email of draft.emails) {
    const value = email.trim()
    if (!isEmailAddress(value)) issues.push({ field: "emails", key: "admin.errors.settings.emailInvalid", vars: { value } })
    else if (seenEmails.has(value.toLowerCase())) issues.push({ field: "emails", key: "admin.errors.settings.emailDuplicate", vars: { value } })
    seenEmails.add(value.toLowerCase())
  }
  if (draft.chats.length > MAX_NOTIFY_CHATS) issues.push({ field: "chats", key: "admin.errors.settings.tooManyChats", vars: { max: MAX_NOTIFY_CHATS } })
  const seenChats = new Set<string>()
  for (const chat of draft.chats) {
    const value = chat.chatID.trim()
    if (!isChatID(value)) issues.push({ field: "chats", key: "admin.errors.settings.chatInvalid", vars: { value } })
    else if (seenChats.has(value.toLowerCase())) issues.push({ field: "chats", key: "admin.errors.settings.chatDuplicate", vars: { value } })
    seenChats.add(value.toLowerCase())
  }
  return issues
}

// ---- 404 statistics ---------------------------------------------------------------------------------

const DAY_MS = 86_400_000

/** Hits per day (all routes together), oldest first, for the line chart; days without a 404 count as zero. */
export function notFoundPerDay(stats: NotFoundStats): [string, number][] {
  const perDay = new Map<string, number>()
  for (const row of stats.Days) perDay.set(row.Day, (perDay.get(row.Day) ?? 0) + row.Hits)
  const first = Date.parse(stats.From)
  const last = Date.parse(stats.To)
  if (perDay.size > 0 && !Number.isNaN(first) && !Number.isNaN(last) && last >= first && (last - first) / DAY_MS <= 400) {
    for (let at = Math.floor(first / DAY_MS) * DAY_MS; at <= last; at += DAY_MS) {
      const day = new Date(at).toISOString().slice(0, 10)
      if (!perDay.has(day)) perDay.set(day, 0)
    }
  }
  return [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b))
}
