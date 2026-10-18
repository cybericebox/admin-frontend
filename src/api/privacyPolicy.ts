/**
 * privacyPolicy.ts — the retention periods the Privacy Policy states, published by the main site.
 *
 *   GET <main origin>/legal/retention.json   { "<RetentionKey>": { "value": 30, "unit": "days" | "months" | "years", "kind": "after" | "upTo" | "over" | "plus" | "for" }, … }
 *
 * The keys are the names of the daemon retention settings. The file is the one source of the periods: the Policy text reads
 * it, and the retention settings are checked against it. Periods come back in seconds (a month is 30 days, a year 365).
 */
import { mainOrigin } from "@/lib/origins"

const DAY = 24 * 3600
const UNIT_SECONDS: Record<string, number> = { days: DAY, months: 30 * DAY, years: 365 * DAY }

export const POLICY_RETENTION_URL = `${mainOrigin}/legal/retention.json`

/**
 * Policy periods by retention setting name, in seconds, with how the Policy phrases each: «через N» (after), «до N» (upTo),
 * «понад N» (over), «ще N» after the event ends (plus), a bare «N» (for). Only «upTo» is an upper bound; the rest are exact.
 */
export type PolicyKind = "after" | "upTo" | "over" | "plus" | "for"
export type PolicyPeriod = { seconds: number; kind: PolicyKind }
export type PolicyRetention = Record<string, PolicyPeriod>
const KINDS: PolicyKind[] = ["after", "upTo", "over", "plus", "for"]

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
    const { value, unit, kind } = (period ?? {}) as { value?: unknown; unit?: unknown; kind?: unknown }
    const factor = typeof unit === "string" ? UNIT_SECONDS[unit] : undefined
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || !factor || !KINDS.includes(kind as PolicyKind)) throw new Error(`policy retention: bad period ${key}`)
    out[key] = { seconds: value * factor, kind: kind as PolicyKind }
  }
  return out
}
