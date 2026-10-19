import { ApiError } from "@/api/client"
import type { Amount, Conflict, Maintenance, Reservation, ReservationKind, ReservationPart, Timeline } from "@/api/resourceCalendar"

export const CODE_DOES_NOT_FIT = 72504
export const CODE_ALREADY_DECIDED = 72506
export const CODE_NO_RESERVATION = 32513

export const MAX_RANGE_DAYS = 31
export const MIB = 1024 ** 2

export type Resource = "cpu" | "memory"

/** True when the backend answered «does not fit»: the same call can repeat with AllowConflicts. */
export const isDoesNotFit = (error: unknown) => error instanceof ApiError && error.code === CODE_DOES_NOT_FIT

export const amountOf = (amount: Amount | null | undefined, resource: Resource) => (resource === "cpu" ? amount?.CPUMillicores : amount?.MemoryBytes) ?? 0

export type Bar = {
  id: string
  kind: ReservationKind
  eventID: string
  label: string
  from: number
  to: number
  /** The rectangle: from y0 up to y1 (the resource unit: millicores or bytes). */
  y0: number
  y1: number
  size: number
  covered: boolean
}

export type TimelineModel = {
  from: number
  to: number
  bars: Bar[]
  /** The always-on test pool band, from 0 up to `pool`. */
  pool: number
  /** The capacity line; null when no limited agent reports one. */
  capacity: number | null
  /** An agent has no quota on this resource, so the line is only a part of the real capacity. */
  unlimited: boolean
  conflicts: { from: number; to: number; poolShort: boolean }[]
  /** Highest point to draw: the stack, the pool and the capacity. */
  top: number
}

const ms = (iso: string) => Date.parse(iso)

export function barLabel(reservation: Reservation): string {
  if (reservation.Kind === "event") return reservation.EventName || reservation.EventTag
  return reservation.OwnerID
}

/**
 * Lays the reservations of one resource out as rectangles. The test pool is the bottom band;
 * every reservation sits above it, and reservations that overlap in time stack on top of
 * each other, so a rectangle's height is exactly its size.
 */
export function buildTimelineModel(timeline: Timeline, resource: Resource): TimelineModel {
  const pool = amountOf(timeline.Capacity.TestPool, resource)
  const placed: Bar[] = []
  const sorted = (timeline.Reservations ?? [])
    .map((reservation) => ({ reservation, size: amountOf(reservation.Size, resource) }))
    .filter(({ size }) => size > 0)
    .sort((a, b) => ms(a.reservation.From) - ms(b.reservation.From) || b.size - a.size)
  for (const { reservation, size } of sorted) {
    const from = ms(reservation.From)
    const to = ms(reservation.To)
    const overlapping = placed.filter((bar) => bar.from < to && from < bar.to)
    // The lowest level where the rectangle fits between the ones it overlaps.
    const levels = [pool, ...overlapping.map((bar) => bar.y1)].sort((a, b) => a - b)
    const y0 = levels.find((level) => overlapping.every((bar) => level + size <= bar.y0 || level >= bar.y1)) ?? pool
    placed.push({ id: reservation.ID, kind: reservation.Kind, eventID: reservation.EventID, label: barLabel(reservation), from, to, y0, y1: y0 + size, size, covered: reservation.Covered })
  }
  const unlimited = (resource === "cpu" ? timeline.Capacity.CPUUnlimited : timeline.Capacity.MemoryUnlimited)
  const total = amountOf(timeline.Capacity.Total, resource)
  const capacity = total > 0 ? total : null
  return {
    from: ms(timeline.From),
    to: ms(timeline.To),
    bars: placed,
    pool,
    capacity,
    unlimited,
    conflicts: (timeline.Conflicts ?? []).map((conflict) => ({ from: ms(conflict.From), to: ms(conflict.To), poolShort: conflict.PoolShort })),
    top: Math.max(pool, capacity ?? 0, ...placed.map((bar) => bar.y1)),
  }
}

export type MaintenanceBand = {
  window: Maintenance
  /** Position inside the range, in percent of its width; the band is clipped to the range. */
  left: number
  width: number
  /** The window has no end: it runs past the right edge. */
  open: boolean
}

export type MaintenanceTrack = { agentID: string; agentName: string; bands: MaintenanceBand[] }

/** One track per agent, with the announced maintenance windows placed on the range of the timeline. */
export function buildMaintenanceTracks(timeline: Timeline): MaintenanceTrack[] {
  const from = ms(timeline.From)
  const span = ms(timeline.To) - from
  const tracks = new Map<string, MaintenanceTrack>()
  if (span <= 0) return []
  for (const window of timeline.Maintenance ?? []) {
    const start = Math.max(from, ms(window.From))
    const end = window.To === null ? from + span : Math.min(from + span, ms(window.To))
    if (end <= start) continue
    const track = tracks.get(window.AgentID) ?? { agentID: window.AgentID, agentName: window.AgentName, bands: [] }
    track.bands.push({ window, left: ((start - from) / span) * 100, width: ((end - start) / span) * 100, open: window.To === null })
    tracks.set(window.AgentID, track)
  }
  return [...tracks.values()].sort((a, b) => a.agentName.localeCompare(b.agentName))
}

/** Reservations the admin has to look at: not covered by resources, or listed in a conflict. */
export function attentionIDs(timeline: Timeline): Set<string> {
  const ids = new Set<string>()
  for (const reservation of timeline.Reservations ?? []) if (!reservation.Covered) ids.add(reservation.ID)
  for (const conflict of timeline.Conflicts ?? []) for (const id of conflict.ReservationIDs ?? []) ids.add(id)
  return ids
}

export function hasConflicts(conflicts: Conflict[] | null | undefined): boolean {
  return (conflicts?.length ?? 0) > 0
}

/** A window for the timeline: `days` (1..31) from the start of today. */
export function rangeFrom(start: Date, days: number): { from: string; to: string } {
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + Math.min(MAX_RANGE_DAYS, Math.max(1, days)))
  return { from: from.toISOString(), to: to.toISOString() }
}

/** CPU millicores and memory MiB as the form shows them; "" is «not set». */
export type AmountText = { cpu: string; memoryMiB: string }
export const EMPTY_AMOUNT: AmountText = { cpu: "", memoryMiB: "" }

export function amountToText(amount: Amount | null | undefined): AmountText {
  if (!amount) return EMPTY_AMOUNT
  return { cpu: amount.CPUMillicores ? String(amount.CPUMillicores) : "", memoryMiB: amount.MemoryBytes ? String(Math.round(amount.MemoryBytes / MIB)) : "" }
}

/** null when both fields are empty (the value is left to the default); an Amount otherwise. */
export function textToAmount(text: AmountText): Amount | null {
  if (text.cpu.trim() === "" && text.memoryMiB.trim() === "") return null
  return { CPUMillicores: Number(text.cpu) || 0, MemoryBytes: Math.round((Number(text.memoryMiB) || 0) * MIB) }
}

export const isAmountEmpty = (amount: Amount | null | undefined) => !amount || (amount.CPUMillicores === 0 && amount.MemoryBytes === 0)

export const GIB = 1024 ** 3
/** The platform ties CPU to memory: 250 millicores per GiB (the backend's milliCPUPerGiB). */
export const MILLICPU_PER_GIB = 250

/** Memory in GB as the form shows it: at most two decimals, no trailing zeros; "0" for none. */
export function gbText(bytes: number): string {
  return String(Math.round((bytes / GIB) * 100) / 100)
}

/** An amount from a memory text in GB; CPU follows the memory. null when the text is not a number. */
export function gbToAmount(text: string): Amount | null {
  const value = text.trim() === "" ? 0 : Number(text)
  if (!Number.isFinite(value) || value < 0) return null
  return { CPUMillicores: Math.round(value * MILLICPU_PER_GIB), MemoryBytes: Math.round(value * GIB) }
}

/** «3,4» for 3.4 GB, with the platform's decimal comma. */
export const formatGBValue = (bytes: number) => new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(bytes / GIB)

/** The notice the cluster gives before it deletes the labs a shrink leaves out, in minutes (the laboratory default). */
export const SHRINK_NOTICE_MINUTES = 5

/** One agent's part of a reservation's size, as the backend splits it: ceil(size x units / teams) per resource. */
export function shareAmount(next: Pick<Reservation, "Size" | "Teams" | "Placement">, agentID: string): Amount {
  const units = (next.Placement ?? []).find((share) => share.AgentID === agentID)?.Units ?? 0
  const teams = Math.max(next.Teams, 1)
  return { CPUMillicores: Math.ceil((next.Size.CPUMillicores * units) / teams), MemoryBytes: Math.ceil((next.Size.MemoryBytes * units) / teams) }
}

/**
 * Whether a change takes the reservation below what already runs in it, the way the backend holds it back: a part
 * whose new share (none when its agent leaves the placement) is under what it uses, or an end earlier than the
 * cluster's notice from now (and than the current end) while labs run. Such a change waits for the admin's confirmation.
 */
export function shrinksBelowUse(parts: ReservationPart[] | null | undefined, next: Pick<Reservation, "Size" | "Teams" | "Placement" | "To">, currentTo: string, now: number): boolean {
  const live = (parts ?? []).filter((part) => !part.Retiring && part.Groups > 0)
  if (live.length === 0) return false
  const below = live.some((part) => {
    const share = shareAmount(next, part.AgentID)
    return share.CPUMillicores < part.Used.CPUMillicores || share.MemoryBytes < part.Used.MemoryBytes
  })
  if (below) return true
  const earliest = Math.min(now + SHRINK_NOTICE_MINUTES * 60_000, Date.parse(currentTo))
  return Date.parse(next.To) < earliest
}
