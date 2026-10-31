// Platform users (admin): the list with its filters, the person's participations and the account actions.
//   GET  /api/users                                  offset page (users.read)
//   GET  /api/users/{id}/participations              events and teams of the person (users.read)
//   POST /api/users/{id}/sessions/end                end all sessions (users.status.write)
//   POST /api/users/{id}/invitation/resend           resend the sign-up invitation, incomplete accounts only (users.invite)
//   POST /api/users/bulk/{action}                    {IDs} -> {Results: [{ID, Ok, Code?}]}, one result per account
import { apiGet, apiPost } from "@/api/client"
import type { OffsetPage } from "@/api/pagination"

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
  Role?: string
}

export type BulkAction = "resend-invitation" | "block" | "unblock" | "end-sessions"
export type BulkResult = { ID: string; Ok: boolean; Code?: string }

export const SIGN_IN_FILTERS = ["email", "google", "passkey"] as const
export const INACTIVE_DAYS = [7, 30, 90, 180, 365] as const

export type UserFilters = {
  search: string
  roles: string[]
  status: string
  confirmed: string
  signIn: string
  inactiveDays: string
  page: number
  pageSize: number
  sortBy: string
  sortDir: "asc" | "desc"
}

/** The query string of the list request; an unset filter is left out. */
export function usersQuery(filters: UserFilters): string {
  const p = new URLSearchParams()
  if (filters.search) p.set("search", filters.search)
  filters.roles.forEach((role) => p.append("role", role))
  if (filters.status !== "all") p.set("status", filters.status)
  if (filters.confirmed !== "all") p.set("emailConfirmed", filters.confirmed === "yes" ? "true" : "false")
  if (filters.signIn !== "all") p.set("signIn", filters.signIn)
  if (filters.inactiveDays !== "0") p.set("inactiveDays", filters.inactiveDays)
  p.set("page", String(filters.page))
  p.set("pageSize", String(filters.pageSize))
  p.set("sortBy", filters.sortBy)
  p.set("sortDir", filters.sortDir)
  return p.toString()
}

export const listUsers = (filters: UserFilters) => apiGet<OffsetPage<UserRow>>(`/api/users?${usersQuery(filters)}`)
export const listParticipations = (id: string) => apiGet<Participation[]>(`/api/users/${encodeURIComponent(id)}/participations`)
export const endUserSessions = (id: string) => apiPost<void>(`/api/users/${encodeURIComponent(id)}/sessions/end`, {})
export const resendInvitation = (id: string) => apiPost<void>(`/api/users/${encodeURIComponent(id)}/invitation/resend`, {})
export async function bulkUsers(action: BulkAction, ids: string[]): Promise<BulkResult[]> {
  const res = await apiPost<{ Results?: BulkResult[] }>(`/api/users/bulk/${action}`, { IDs: ids })
  return res.Results ?? []
}
