// The one place the UI language tag lives (UI ships in Ukrainian, see i18n/t.ts).
// Dates and numbers are always formatted through these helpers, never with an
// inline locale literal.
export const UI_LOCALE = "uk-UA"

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(UI_LOCALE, options)
}

export function formatDateTime(iso: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—"
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(UI_LOCALE, options)
}

// The one date format of tables and detail pages: 06.10.2026, 19:05 (users, events, ...).
const LIST_DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }
const LIST_DATE_TIME: Intl.DateTimeFormatOptions = { ...LIST_DATE, hour: "2-digit", minute: "2-digit" }

export function formatListDateTime(iso: string | null | undefined): string {
  return formatDateTime(iso, LIST_DATE_TIME)
}

export function formatListDate(iso: string | null | undefined): string {
  return formatDateTime(iso, LIST_DATE)
}
