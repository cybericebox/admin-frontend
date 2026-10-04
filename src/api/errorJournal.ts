/**
 * errorJournal.ts — the platform error journal (platform.errors.read / platform.errors.write).
 * Daemon handler: handler/errorJournal. JSON PascalCase inside the usual {Status, Data} envelope.
 */
import { apiGet, apiPatch, apiPost, apiPut } from "@/api/client"
import { apiOrigin } from "@/lib/origins"

export const ERROR_KINDS = ["http_5xx", "panic", "http_403", "http_429", "job", "queue", "mail", "lab_agent_offline", "lab_deploy", "lab_cert_expiry", "lab_component"] as const
export type ErrorKind = (typeof ERROR_KINDS)[number]
export const ERROR_STATUSES = ["open", "resolved", "ignored"] as const
export type ErrorStatus = (typeof ERROR_STATUSES)[number]

export const MAX_NOTIFY_EMAILS = 20
export const MAX_NOTIFY_CHATS = 20

export type ErrorGroup = {
  ID: string
  Kind: ErrorKind
  Source: string
  Title: string
  Status: ErrorStatus
  Occurrences: number
  FirstSeenAt: string
  LastSeenAt: string
  ResolvedAt: string | null
  LastNotifiedAt: string | null
}

export type ErrorSample = {
  ID: string
  OccurredAt: string
  Message: string
  Stack: string
  Method: string
  Route: string
  HTTPStatus: number | null
  RequestID: string
  UserID: string | null
  Role: string
  Permission: string
  Limiter: string
  Details: Record<string, string> | null
}

export type ErrorGroupList = { Items: ErrorGroup[]; Total: number; Limit: number; Offset: number }
export type ErrorGroupDetail = { Group: ErrorGroup; Samples: ErrorSample[] }

export type ErrorFilters = {
  kinds: ErrorKind[]
  status: ErrorStatus | ""
  q: string
  /** RFC 3339, on last seen. */
  from?: string
  to?: string
}

export function groupListPath(filters: ErrorFilters, limit: number, offset: number): string {
  const params = new URLSearchParams()
  if (filters.kinds.length) params.set("kind", filters.kinds.join(","))
  if (filters.status) params.set("status", filters.status)
  if (filters.q) params.set("q", filters.q)
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  params.set("limit", String(limit))
  params.set("offset", String(offset))
  return `/api/admin/errors?${params.toString()}`
}

export function listErrorGroups(filters: ErrorFilters, limit: number, offset: number, signal?: AbortSignal): Promise<ErrorGroupList> {
  return apiGet<ErrorGroupList>(groupListPath(filters, limit, offset), { signal }).then((list) => ({ ...list, Items: list.Items ?? [] }))
}

export function getErrorGroup(id: string): Promise<ErrorGroupDetail> {
  return apiGet<ErrorGroupDetail>(`/api/admin/errors/${encodeURIComponent(id)}`).then((detail) => ({ ...detail, Samples: detail.Samples ?? [] }))
}

export function setErrorGroupStatus(id: string, status: ErrorStatus): Promise<ErrorGroup> {
  return apiPatch<ErrorGroup>(`/api/admin/errors/${encodeURIComponent(id)}/status`, { Status: status })
}

export type NotFoundStats = {
  From: string
  To: string
  /** One row per day and route; an empty Route counts every unmatched path (bots) together. */
  Days: { Day: string; Route: string; Hits: number }[]
  Routes: { Route: string; Hits: number }[]
  Total: number
}

export function getNotFoundStats(range: { from?: string; to?: string }): Promise<NotFoundStats> {
  const params = new URLSearchParams()
  if (range.from) params.set("from", range.from)
  if (range.to) params.set("to", range.to)
  const query = params.toString()
  return apiGet<NotFoundStats>(`/api/admin/errors/not-found${query ? `?${query}` : ""}`)
    .then((stats) => ({ ...stats, Days: stats.Days ?? [], Routes: stats.Routes ?? [] }))
}

export type TelegramChat = { ChatID: string; Label: string; Failing: boolean; FailingSince: string | null; LastError: string }
export type ErrorSettings = { Emails: string[]; EmailToSuperAdmins: boolean; TelegramEnabled: boolean; TelegramChats: TelegramChat[]; UpdatedAt: string }
export type ErrorSettingsInput = { Emails: string[]; EmailToSuperAdmins: boolean; TelegramChats: { ChatID: string; Label: string }[] }
export type TestResult = { Channel: "telegram" | "email" | string; Target: string; Label: string; OK: boolean; Error: string }

export function getErrorSettings(): Promise<ErrorSettings> {
  return apiGet<ErrorSettings>("/api/admin/errors/settings").then((s) => ({ ...s, Emails: s.Emails ?? [], TelegramChats: s.TelegramChats ?? [] }))
}

export function saveErrorSettings(input: ErrorSettingsInput): Promise<ErrorSettings> {
  return apiPut<ErrorSettings>("/api/admin/errors/settings", input).then((s) => ({ ...s, Emails: s.Emails ?? [], TelegramChats: s.TelegramChats ?? [] }))
}

export function sendErrorTest(): Promise<TestResult[]> {
  return apiPost<{ Results: TestResult[] }>("/api/admin/errors/settings/test", {}).then((r) => r.Results ?? [])
}

/** Server-sent stream: "error-group" events and a heartbeat. Nothing is replayed. */
export const errorStreamUrl = (): string | null => (apiOrigin ? `${apiOrigin}/api/admin/errors/stream` : null)

export type ErrorStreamEvent = { Group: ErrorGroup; Sample: ErrorSample | null; New: boolean }
