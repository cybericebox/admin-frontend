import { t } from "@/i18n/t"

const number = new Intl.NumberFormat("uk-UA")

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : number.format(value)
}

/** A 0..1 rate as a whole percent. */
export function formatPercent(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? "–" : `${Math.round(rate * 100)}%`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–"
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "–" : date.toLocaleString("uk-UA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** A span of seconds as «2 дн 3 год», «3 год 20 хв» or «45 хв». */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "–"
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return t("admin.platformAnalytics.duration.lessMinute")
  if (minutes < 60) return t("admin.platformAnalytics.duration.minutes", { m: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest === 0 ? t("admin.platformAnalytics.duration.hours", { h: hours }) : t("admin.platformAnalytics.duration.hoursMinutes", { h: hours, m: rest })
  }
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours === 0 ? t("admin.platformAnalytics.duration.days", { d: days }) : t("admin.platformAnalytics.duration.daysHours", { d: days, h: restHours })
}
