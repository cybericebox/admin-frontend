/**
 * privacyPolicy.ts — the retention periods the Privacy Policy states, published by the main site.
 *
 *   GET <main origin>/legal/retention.json   { "<RetentionKey>": { "value": 30, "unit": "days" | "months" | "years" }, … }
 *
 * The keys are the names of the daemon retention settings. The file is the one source of the periods: the Policy text reads
 * it, and the retention settings are checked against it. Periods come back in seconds (a month is 30 days, a year 365).
 */
import { mainOrigin } from "@/lib/origins"

const DAY = 24 * 3600
const UNIT_SECONDS: Record<string, number> = { days: DAY, months: 30 * DAY, years: 365 * DAY }

export const POLICY_RETENTION_URL = `${mainOrigin}/legal/retention.json`

/** Policy periods in seconds by retention setting name. */
export type PolicyRetention = Record<string, number>

export async function getPolicyRetention(): Promise<PolicyRetention> {
  const response = await fetch(POLICY_RETENTION_URL, { cache: "no-cache", credentials: "omit" })
  if (!response.ok) throw Object.assign(new Error(`policy retention: HTTP ${response.status}`), { status: response.status })
  return parsePolicyRetention(await response.json())
}

/** Seconds per key; an entry that is not a positive whole number of a known unit makes the whole file invalid. */
export function parsePolicyRetention(data: unknown): PolicyRetention {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("policy retention: not an object")
  const out: PolicyRetention = {}
  for (const [key, period] of Object.entries(data)) {
    const { value, unit } = (period ?? {}) as { value?: unknown; unit?: unknown }
    const factor = typeof unit === "string" ? UNIT_SECONDS[unit] : undefined
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || !factor) throw new Error(`policy retention: bad period ${key}`)
    out[key] = value * factor
  }
  return out
}
