/**
 * auditLog.ts — the admin audit log (platform.audit.read).
 *
 * GET /api/admin/audit-log  (daemon handler adminAudit, JSON PascalCase)
 *   query: actorID (uuid), permission (exact), route (exact route template)
 *   answer: a plain array of records, newest first; the server returns at most 50
 *   and has no offset, status or period filter.
 */
import { apiGet } from "@/api/client"

export const AUDIT_LOG_LIMIT = 50

export type AuditRecord = {
  ID: string
  ActorID: string
  Permission: string
  Method: string
  Route: string
  ResponseStatus: number
  CreatedAt: string
  /** Space separated `kind:id` pairs, or empty. */
  Target: string
}

export type AuditFilters = { actorID: string; permission: string; route: string }

export function listAuditLog(filters: AuditFilters): Promise<AuditRecord[]> {
  const params = new URLSearchParams()
  if (filters.actorID) params.set("actorID", filters.actorID)
  if (filters.permission) params.set("permission", filters.permission)
  if (filters.route) params.set("route", filters.route)
  const query = params.toString()
  return apiGet<AuditRecord[]>(`/api/admin/audit-log${query ? `?${query}` : ""}`).then((rows) => rows ?? [])
}
