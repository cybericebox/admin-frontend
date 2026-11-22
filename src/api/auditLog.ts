/**
 * auditLog.ts — the admin audit log (platform.audit.read).
 *
 * GET /api/admin/audit-log  (daemon handler adminAudit, JSON PascalCase)
 *   query, all optional: actorID (uuid), permission (exact), route (template contains the text),
 *   method (POST/PUT/PATCH/DELETE; GET is only audited exports), status (code 409 or class 4xx),
 *   from / to (RFC3339, inclusive; to before from is a 400), targetKind (kind token),
 *   targetID (contains), cursor (opaque), limit (1-200, default 50).
 *   answer: { Items, NextCursor }, newest first; NextCursor is "" on the last page, Items is never null.
 */
import { apiGet } from "@/api/client"

export const AUDIT_PAGE_SIZE = 50

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
  Changes?: AuditChange[] | null
}

/** One changed field. A secret, or a field the route does not list, has Redacted and no values. */
export type AuditChange = { Field: string; Before?: string | null; After?: string | null; Redacted?: boolean }

export type AuditPage = { Items: AuditRecord[]; NextCursor: string; /** Of the whole filter; on the first page only. */ Total: number | null }

export type AuditFilters = {
  actorID: string
  permission: string
  route: string
  method: string
  /** Exact code («409») or a class («4xx»). */
  status: string
  /** RFC3339 instants, or "". */
  from: string
  to: string
  targetKind: string
  targetID: string
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = { actorID: "", permission: "", route: "", method: "", status: "", from: "", to: "", targetKind: "", targetID: "" }

export function auditQuery(filters: AuditFilters, cursor = ""): string {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(filters)) if (value) params.set(name, value)
  if (cursor) params.set("cursor", cursor)
  const query = params.toString()
  return `/api/admin/audit-log${query ? `?${query}` : ""}`
}

export function listAuditLog(filters: AuditFilters, cursor = ""): Promise<AuditPage> {
  return apiGet<AuditPage>(auditQuery(filters, cursor)).then((page) => ({ Items: page?.Items ?? [], NextCursor: page?.NextCursor ?? "", Total: page?.Total ?? null }))
}

/** GET /api/admin/audit-log/export: the CSV of the same filter (the Changes column as text). */
export function auditExportPath(filters: AuditFilters): string {
  return auditQuery(filters).replace("/api/admin/audit-log", "/api/admin/audit-log/export")
}
