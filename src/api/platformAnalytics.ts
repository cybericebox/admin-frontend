import { apiGet } from "@/api/client"

// Platform-level analytics API. JSON is PascalCase like the rest of the API and
// arrives through the usual apiGet envelope handling. Period params `from` / `to`
// are RFC 3339 strings; absent means all time.
export type AnalyticsParams = Record<string, string | number | boolean | null | undefined>

export function analyticsQuery(params: AnalyticsParams = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ""
}

export function analyticsPath(section: string, params: AnalyticsParams = {}): string {
  return `/api/analytics/${section}${analyticsQuery(params)}`
}

/** With `compare=true` the answer is wrapped: the current report, the same report for the previous period of the same length (null for all time) and that period. */
export type Compared<T> = { Current: T; Previous: T | null; PreviousPeriod: { From: string; To: string } | null }

/** GET /api/analytics/<section>?from=&to=&... ; with `compare` the wrapped answer comes back as it is (see getAnalyticsCompared). */
export function getAnalytics<T>(section: string, params: AnalyticsParams = {}, init?: RequestInit): Promise<T> {
  return apiGet<T>(analyticsPath(section, params), init)
}

/** The current report of an answer that may be wrapped by compare; the previous one (or null) beside it. */
export function unwrapCompared<T>(answer: T | Compared<T>, compare: boolean): { current: T; previous: T | null } {
  if (!compare) return { current: answer as T, previous: null }
  const wrapped = answer as Compared<T>
  return { current: wrapped.Current, previous: wrapped.Previous ?? null }
}

/** /api/analytics/<section>/export.csv?table=...&from=&to= (fetched as a blob by CsvExportButton). */
export function exportUrl(section: string, params: AnalyticsParams & { table: string }): string {
  return `/api/analytics/${section}/export.csv${analyticsQuery(params)}`
}
