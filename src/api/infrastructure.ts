/**
 * infrastructure.ts — typed client for the platform infrastructure surface
 * (agents, laboratory monitoring, stands). Super-admin only.
 * JSON PascalCase; payload objects (protojson) keep their inner camelCase keys.
 */
import { apiGet, apiPost } from "@/api/client"
import type { OffsetPage } from "@/api/pagination"

const BASE = "/api/infrastructure"

export type InfrastructureAgent = { ID: string; Key: string; Name: string; Configured: boolean; Healthy: boolean }
export type InfrastructureStatus = {
  Available: boolean
  Healthy: boolean
  Mode: string
  Agents: InfrastructureAgent[]
  Capabilities: { Laboratories: boolean }
  Warning?: { Code: string; Message: string }
}

/** The full merged current state of one lab group. */
export type CurrentLab = {
  EventID: string
  EventName: string
  EventTeamID: string
  TeamName: string
  LabGroupName: string
  AgentID: string
  Sequence: number
  ObservedAt: string
  UpdatedAt: string
  Payload: unknown
}

export type CapacityObservation = {
  ID: string
  AgentID: string
  Sequence: number
  ObservedAt: string
  ReceivedAt: string
  SchemaVersion: number
  Snapshot: boolean
  Payload: unknown
}

export type StandStatus = "creating" | "ready" | "failed" | "removed"
export type StandStatusFilter = StandStatus | "active"

export type Stand = {
  EventID: string
  EventName: string
  EventTag: string
  TeamID: string
  TeamName: string
  Moderators: boolean
  Status: StandStatus
  Reason: string
  UpdatedAt: string | null
  StatusChangedAt: string | null
  Generation: number
}

export type StandEventOption = { ID: string; Name: string; Tag: string }

export type StandKind = "event" | "moderators"
export type StandsFilter = { eventId?: string; status?: string; kind?: string; search?: string; page: number; pageSize: number }

/** Live state of a catalog test lab; "unknown" when the agent did not answer. */
export type TestLabStatus = "creating" | "ready" | "failed" | "unknown"

/** A catalog test lab: an exercise test deploy running on the infrastructure. */
export type TestLab = {
  ID: string
  GroupName: string
  ExerciseID: string
  ExerciseName: string
  /** 1-based position of the variant in its version; 0 when it is gone. */
  VariantNumber: number
  AuthorID: string
  AuthorName: string
  AuthorEmail: string
  CreatedAt: string
  ExpiresAt: string
  /** The lease is over but the lab is not cleaned up yet. */
  Expired: boolean
  Status: TestLabStatus
}

export type TestLabsFilter = { search?: string; page: number; pageSize: number }

type StandCounts = { Total: number; Creating: number; Ready: number; Failed: number; Removed: number; Active: number }

export type InfrastructureSummary = {
  /** Every team stand, the moderators team included. */
  Stands: StandCounts
  /** The moderators-team part of Stands. */
  Moderators?: StandCounts
  /** Catalog test labs, not team stands. */
  TestLabs?: { Total: number; Active: number; Expired: number }
  Capacity: { Available: boolean; CPUPercent: number | null; MemoryPercent: number | null }
}

export const getInfrastructureStatus = () => apiGet<InfrastructureStatus>(`${BASE}/status`)
export const getCurrentLabs = (includeRecent: boolean) =>
  apiGet<CurrentLab[]>(`${BASE}/monitoring/current${includeRecent ? "?includeRecent=true" : ""}`)
export const getCurrentCapacity = () => apiGet<CapacityObservation[]>(`${BASE}/monitoring/capacity/current`)
export const getInfrastructureSummary = () => apiGet<InfrastructureSummary>(`${BASE}/summary`)
export const listStandEvents = () => apiGet<StandEventOption[]>(`${BASE}/stands/events`)

export function listStands(filter: StandsFilter): Promise<OffsetPage<Stand>> {
  const params = new URLSearchParams({ page: String(filter.page), pageSize: String(filter.pageSize) })
  if (filter.eventId) params.set("eventId", filter.eventId)
  if (filter.status) params.set("status", filter.status)
  if (filter.kind) params.set("kind", filter.kind)
  if (filter.search) params.set("search", filter.search)
  return apiGet<OffsetPage<Stand>>(`${BASE}/stands?${params}`)
}

export const recreateStand = (eventId: string, teamId: string) =>
  apiPost<unknown>(`${BASE}/stands/${encodeURIComponent(eventId)}/${encodeURIComponent(teamId)}/recreate`, {})

export function listTestLabs(filter: TestLabsFilter): Promise<OffsetPage<TestLab>> {
  const params = new URLSearchParams({ page: String(filter.page), pageSize: String(filter.pageSize) })
  if (filter.search) params.set("search", filter.search)
  return apiGet<OffsetPage<TestLab>>(`${BASE}/test-labs?${params}`)
}

export const terminateTestLab = (id: string) => apiPost<unknown>(`${BASE}/test-labs/${encodeURIComponent(id)}/terminate`, {})
