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
