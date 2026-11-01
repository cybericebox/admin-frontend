// GET /api/dashboard/summary: one answer for the start page, each block only if the caller may see it (null / empty otherwise).
import { apiGet } from "@/api/client"

export type AttentionKind = "failed_stands" | "events_without_reservation" | "pending_elevations" | "open_errors" | "mail_failures"
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
  mail_failures: "/analytics/notifications",
}

export const getDashboardSummary = () => apiGet<DashboardSummary>("/api/dashboard/summary")
