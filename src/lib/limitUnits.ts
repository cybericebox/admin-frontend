import type { LimitKind } from "@/api/platformLimits"

/** Display units of typed limits: durations are stored in seconds, sizes in bytes. */
export type Unit = "hours" | "days" | "years" | "MiB" | "GiB"

const HOUR = 3600
const DAY = 24 * HOUR

export const UNIT_FACTOR: Record<Unit, number> = {
  hours: HOUR,
  days: DAY,
  years: 365 * DAY,
  MiB: 1024 * 1024,
  GiB: 1024 * 1024 * 1024,
}

const UNIT_KIND: Record<Unit, LimitKind> = { hours: "duration", days: "duration", years: "duration", MiB: "size", GiB: "size" }

/** The largest allowed unit that divides the value exactly, else the smallest one; none for counts. */
export function bestUnit(kind: LimitKind, value: number, allowed: Unit[]): Unit | undefined {
  const units = allowed.filter((unit) => UNIT_KIND[unit] === kind).sort((a, b) => UNIT_FACTOR[a] - UNIT_FACTOR[b])
  if (units.length === 0) return undefined
  return [...units].reverse().find((unit) => value % UNIT_FACTOR[unit] === 0) ?? units[0]
}

export function toBase(amount: number, unit: Unit | undefined): number {
  return unit ? amount * UNIT_FACTOR[unit] : amount
}

export function fromBase(value: number, unit: Unit | undefined): number {
  return unit ? value / UNIT_FACTOR[unit] : value
}
