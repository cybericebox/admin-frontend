// GET /api/admin/dashboard: one answer for the start page, each block only if the caller may see it (null / empty otherwise).
// The wire shape is mapped to the shape the page reads.
import { apiGet } from "@/api/client"

export type AttentionKind = "failed_stands" | "events_without_reservation" | "pending_elevations" | "open_errors" | "mail_errors"
export type AttentionItem = { Kind: AttentionKind; Count: number; Items?: { Label: string; Href: string }[] | null }
export type DashboardEvent = {
  ID: string
  Name: string
  Tag: string
  LifecycleStatus?: string
  StartAt?: string | null
  FinishAt?: string | null
  Running: boolean
  Participants?: number
  Teams?: number
  StandsReady?: number
  StandsTotal?: number
}
export type DashboardTrends = { Days: string[]; Signups: number[]; ActiveUsers: number[]; Solves: number[] }
export type DashboardInfra = { CPUPercent?: number | null; MemoryPercent?: number | null; StandsActive?: number; StandsFailed?: number; Healthy?: boolean; Available?: boolean }
export type DashboardSummary = {
  Attention?: AttentionItem[] | null
  Events?: DashboardEvent[] | null
  Trends?: DashboardTrends | null
  Infra?: DashboardInfra | null
}

/** Where a kind's own list lives in the admin: the row links there; its Items link to single places. */
export const ATTENTION_HREF: Record<AttentionKind, string> = {
  failed_stands: "/labs?status=failed",
  events_without_reservation: "/resources?tab=needs",
  pending_elevations: "/elevations",
  open_errors: "/errors",
  mail_errors: "/analytics/notifications",
}

type WireAttention = { Kind: AttentionKind; Count: number; Target?: string; Items?: { ID: string; Label: string; Count?: number; At?: string | null }[] | null }
type WireEvent = { EventID: string; Name: string; Tag: string; StartAt?: string | null; FinishAt?: string | null; Running: boolean; Participants?: number; Teams?: number; StandsReady?: number; StandsTotal?: number }
type WireDashboard = {
  Attention?: WireAttention[] | null
  CurrentAndUpcoming?: WireEvent[] | null
  Trends7d?: { Days: string[]; Registrations: number[]; ActiveUsers: number[]; Solves: number[] } | null
  Infrastructure?: { CPUAllocatableMillicores: number; CPUReservedMillicores: number; MemoryAllocatableBytes: number; MemoryReservedBytes: number; Agents: number; ActiveStands: number; FailedStands: number } | null
}

const percent = (reserved: number, allocatable: number) => (allocatable > 0 ? (reserved / allocatable) * 100 : null)

/** The wire answer as the page reads it: percentages from reserved / allocatable, links of the single items by kind. */
export function mapDashboard(wire: WireDashboard): DashboardSummary {
  return {
    Attention: (wire.Attention ?? []).map((item) => ({
      Kind: item.Kind, Count: item.Count,
      Items: (item.Items ?? []).map((entry) => ({ Label: entry.Label, Href: item.Kind === "events_without_reservation" ? `/events/detail?id=${encodeURIComponent(entry.ID)}` : ATTENTION_HREF[item.Kind] })),
    })),
    // null when the caller may not see events (the block is hidden); the wire sends an empty list then, so an empty list stays «nothing now».
    Events: wire.CurrentAndUpcoming == null ? null : wire.CurrentAndUpcoming.map((event) => ({ ID: event.EventID, Name: event.Name, Tag: event.Tag, StartAt: event.StartAt, FinishAt: event.FinishAt, Running: event.Running, Participants: event.Participants, Teams: event.Teams, StandsReady: event.StandsReady, StandsTotal: event.StandsTotal })),
    Trends: wire.Trends7d ? { Days: wire.Trends7d.Days, Signups: wire.Trends7d.Registrations, ActiveUsers: wire.Trends7d.ActiveUsers, Solves: wire.Trends7d.Solves } : null,
    Infra: wire.Infrastructure ? {
      CPUPercent: percent(wire.Infrastructure.CPUReservedMillicores, wire.Infrastructure.CPUAllocatableMillicores),
      MemoryPercent: percent(wire.Infrastructure.MemoryReservedBytes, wire.Infrastructure.MemoryAllocatableBytes),
      StandsActive: wire.Infrastructure.ActiveStands, StandsFailed: wire.Infrastructure.FailedStands,
    } : null,
  }
}

export const getDashboardSummary = () => apiGet<WireDashboard>("/api/admin/dashboard").then(mapDashboard)
