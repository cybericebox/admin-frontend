// Platform users (admin): the list with its filters, the person's participations and the account actions.
//   GET  /api/users                                  offset page (users.read)
//   GET  /api/users/{id}/participations              events and teams of the person (users.read)
//   POST /api/users/{id}/sessions/end                end all sessions (users.status.write)
//   POST /api/users/{id}/invitation/resend           resend the sign-up invitation, incomplete accounts only (users.invite)
//   POST /api/users/bulk/{action}                    {UserIDs} (max 200) -> {Results: [{UserID, Ok, Code?, Error?}]}, in request order
import { apiGet, apiPost } from "@/api/client"
import type { OffsetPage } from "@/api/pagination"
import { isComplete, type FilterBag } from "@/components/table/filters"

export type UserRow = {
  ID: string
  FirstName: string
  LastName: string
  Email: string
  EmailConfirmed?: boolean
  Picture?: string
  SignInMethods?: string[]
  Role: string
  Status: string
  LastSeen?: string
  CreatedAt: string
}

export type Participation = {
  EventID: string
  EventName: string
  EventTag: string
  TeamID?: string
  TeamName?: string
  Role?: string // participant | captain | member
}

export type BulkAction = "resend-invitation" | "block" | "unblock" | "end-sessions"
export type BulkResult = { UserID: string; Ok: boolean; Code?: string; Error?: string }

export const SIGN_IN_FILTERS = ["password", "google", "passkey"] as const

export type UserQuery = {
  search: string
  bag: FilterBag
  page: number
  pageSize: number
  sortBy: string
  sortDir: "asc" | "desc"
}

/** The filters a user's bag sends: only operators the backend knows (see the page's FilterDefs). */
export function userFilterParams(bag: FilterBag, p: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const value = (key: string) => (isComplete(bag[key]) ? bag[key].v : [])
  value("role").forEach((role) => p.append("role", role))
  if (value("status")[0]) p.set("status", value("status")[0])
  if (value("confirmed")[0]) p.set("emailConfirmed", value("confirmed")[0])
  if (value("signIn")[0]) p.set("signIn", value("signIn")[0])
  if (value("inactive")[0]) p.set("inactiveDays", value("inactive")[0])
  return p
}

/** The query string of the list request; an unset filter is left out. */
export function usersQuery(query: UserQuery): string {
  const p = new URLSearchParams()
  if (query.search) p.set("search", query.search)
  userFilterParams(query.bag, p)
  p.set("page", String(query.page))
  p.set("pageSize", String(query.pageSize))
  p.set("sortBy", query.sortBy)
  p.set("sortDir", query.sortDir)
  return p.toString()
}

/** Counts of one filter field's values under the other filters (GET /api/users/facets, users.read); null when unknown. */
export async function getUserFacets(field: string, search: string, others: FilterBag): Promise<Record<string, number> | null> {
  const p = new URLSearchParams({ field })
  if (search) p.set("search", search)
  userFilterParams(others, p)
  try {
    const res = await apiGet<{ Counts?: Record<string, number> } | null>(`/api/users/facets?${p}`)
    return res?.Counts ?? null
  } catch { return null }
}

export const listUsers = (query: UserQuery) => apiGet<OffsetPage<UserRow>>(`/api/users?${usersQuery(query)}`)
export const listParticipations = (id: string) => apiGet<Participation[]>(`/api/users/${encodeURIComponent(id)}/participations`)
export const endUserSessions = (id: string) => apiPost<void>(`/api/users/${encodeURIComponent(id)}/sessions/end`, {})
export const resendInvitation = (id: string) => apiPost<void>(`/api/users/${encodeURIComponent(id)}/invitation/resend`, {})
export async function bulkUsers(action: BulkAction, ids: string[]): Promise<BulkResult[]> {
  const res = await apiPost<{ Results?: BulkResult[] }>(`/api/users/bulk/${action}`, { UserIDs: ids })
  return res.Results ?? []
}
