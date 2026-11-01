// Platform analytics period: a preset in the URL (?period=30d), resolved to the
// RFC 3339 (UTC) `from` / `to` the API takes. `all` means no bounds.
export const PERIOD_PRESETS = ["7d", "30d", "90d", "all"] as const
export type PeriodPreset = (typeof PERIOD_PRESETS)[number]
export const DEFAULT_PERIOD: PeriodPreset = "30d"

const DAY_MS = 86_400_000
const DAYS: Record<Exclude<PeriodPreset, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 }

export function parsePreset(value: string | null | undefined): PeriodPreset {
  return (PERIOD_PRESETS as readonly string[]).includes(value ?? "") ? (value as PeriodPreset) : DEFAULT_PERIOD
}

export type PeriodRange = { from?: string; to?: string }

export function periodRange(preset: PeriodPreset, now: number = Date.now()): PeriodRange {
  if (preset === "all") return {}
  return { from: new Date(now - DAYS[preset] * DAY_MS).toISOString(), to: new Date(now).toISOString() }
}

/** A custom range typed as dates (YYYY-MM-DD, the local days, both inclusive) as the RFC 3339 bounds the API takes. */
export function customRange(from: string, to: string): PeriodRange | null {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T23:59:59.999`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  return { from: start.toISOString(), to: end.toISOString() }
}
