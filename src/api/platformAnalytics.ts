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

/** GET /api/analytics/<section>?from=&to=&... */
export function getAnalytics<T>(section: string, params: AnalyticsParams = {}, init?: RequestInit): Promise<T> {
  return apiGet<T>(analyticsPath(section, params), init)
}

/** /api/analytics/<section>/export.csv?table=...&from=&to= (fetched as a blob by CsvExportButton). */
export function exportUrl(section: string, params: AnalyticsParams & { table: string }): string {
  return `/api/analytics/${section}/export.csv${analyticsQuery(params)}`
}
