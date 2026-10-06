import { UI_LOCALE } from "@/lib/locale"
import type { Metric } from "@/api/platformAnalyticsOverview"
import { t } from "@/i18n/t"

const number = new Intl.NumberFormat(UI_LOCALE)

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : number.format(value)
}

type Delta = { text: string; tone: "up" | "down" | "flat" }

/**
 * Change against the previous period: a percent when it had a base, the absolute
 * step when it had none, nothing for all time. `inverse` marks a metric where a
 * rise is bad (failures), so it shows red.
 */
export function deltaOf(metric: Metric | undefined, inverse = false): Delta | undefined {
  if (!metric || metric.Previous === null) return undefined
  const change = metric.Value - metric.Previous
  if (change === 0) return { text: "0%", tone: "flat" }
  const rising = change > 0
  const tone = rising !== inverse ? "up" : "down"
  const sign = rising ? "+" : "−"
  if (metric.Previous === 0) return { text: `${sign}${number.format(Math.abs(change))}`, tone }
  return { text: `${sign}${number.format(Math.round((Math.abs(change) / metric.Previous) * 100))}%`, tone }
}

/** «було 10» under a tile; nothing for all time. */
export function previousLine(metric: Metric | undefined): string | undefined {
  if (!metric || metric.Previous === null) return undefined
  return t("admin.platformAnalytics.overview.was", { previous: number.format(metric.Previous) })
}
