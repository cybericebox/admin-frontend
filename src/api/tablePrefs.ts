// The view of a table kept on the server per person (docs/specs/UI-TABLES.md). Own session only.
//   GET    /api/auth/account/table-prefs/{tableKey}   -> prefs, or null when none is saved
//   PUT    /api/auth/account/table-prefs/{tableKey}   -> the saved prefs (every field optional)
//   DELETE /api/auth/account/table-prefs/{tableKey}   -> «Скинути вигляд»
import { apiDelete, apiGet, apiPut } from "@/api/client"

export type TablePrefs = {
  ColumnOrder?: string[]
  ColumnWidths?: Record<string, number>
  Hidden?: string[]
  Sort?: { Key: string; Dir: "asc" | "desc" } | null
  PageSize?: number
}

const path = (tableKey: string) => `/api/auth/account/table-prefs/${encodeURIComponent(tableKey)}`

export const getTablePrefs = (tableKey: string) => apiGet<TablePrefs | null>(path(tableKey))
export const putTablePrefs = (tableKey: string, prefs: TablePrefs) => apiPut<TablePrefs>(path(tableKey), prefs)
export const deleteTablePrefs = (tableKey: string) => apiDelete<void>(path(tableKey))
