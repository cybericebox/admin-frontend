import { t } from "@/i18n/t"

const F = "admin.platformAnalytics.mail.funnel."

/** A span of seconds as «45 с», «12 хв», «3 год 20 хв» or «2 д 4 год»; «—» without a value. */
export function formatFunnelDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return t(F + "noValue")
  if (seconds < 60) return t(F + "dur.s", { s: Math.max(0, Math.round(seconds)) })
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return t(F + "dur.m", { m: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest === 0 ? t(F + "dur.h", { h: hours }) : t(F + "dur.hm", { h: hours, m: rest })
  }
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours === 0 ? t(F + "dur.d", { d: days }) : t(F + "dur.dh", { d: days, h: restHours })
}

/** A 0..1 rate as a whole percent; «—» for null. */
export function formatFunnelRate(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? t(F + "noValue") : `${Math.round(rate * 100)}%`
}
