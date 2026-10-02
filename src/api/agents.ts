/**
 * agents.ts — typed client for the laboratory agents (enrolled clusters). Super-admin only.
 * JSON PascalCase. Keys and the enrollment token never come back from the server.
 */
import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client"

const BASE = "/api/infrastructure/agents"

export type AgentSource = "env" | "admin"

export type AgentCapacity = { CPUMillicores: number | null; MemoryBytes: number | null; SeenAt: string | null }

export type AgentFeatures = {
  PersistenceAvailable: boolean
  PersistenceDefaultDebounceMs: number
  PersistenceWriteQuotaBytes: number
  PersistenceMaxFileSizeBytes: number
  PersistenceExcludedPaths: string[] | null
  ImageCacheEnabled: boolean
  ImageCacheRegistries: string[] | null
  SchedulerEnabled: boolean
  SchedulerMaxPods: number
  LabsDomain: string
  VPNEndpoint: string
  ProxyAccessTokenMaxTTLSeconds: number
  ProxySessionMaxTTLSeconds: number
}

export type UnmetRequirement = { Resource: "deviceCpu" | "deviceMemory" | "devices"; Required: number; Max: number }

export type Agent = {
  ID: string
  Name: string
  Source: AgentSource
  Endpoint: string
  Enabled: boolean
  Priority: number
  HasCA: boolean
  InUse: boolean
  Tenant: string
  AccessKeyID: string
  RetiredKeys: number
  Groups: number
  Capacity: AgentCapacity
  Features: AgentFeatures | null
  /** false: the agent's maxima are below the platform frame; it is not used. */
  MeetsRequirements: boolean
  /** Which maxima fall short of the platform frame; empty when the agent meets it. */
  Unmet: UnmetRequirement[] | null
  FeaturesAt: string | null
  ArchivedAt: string | null
  CertExpiresAt: string | null
  Connected: boolean
  Healthy: boolean
  LatencyMs: number
  Error: string
  CreatedAt: string
  UpdatedAt: string
}

export type EnrollAgentInput = { Name: string; Endpoint: string; EnrollmentToken: string; CAPEM: string; Enabled: boolean; Priority: number }
// Partial update: a field left out stays. ClearCA is the only way to remove the stored CA.
export type UpdateAgentInput = { Name?: string; Enabled?: boolean; Priority?: number; ClearCA?: boolean }

export type ReservationImpact = {
  ReservationID: string
  EventID: string
  EventName: string
  CPUMillicores: number
  MemoryBytes: number
  StartsAt: string
  EndsAt: string
}
export type DeletePreview = { RunningGroups: number; FutureReservations: ReservationImpact[] | null }

const path = (id: string) => `${BASE}/${encodeURIComponent(id)}`

export const listAgents = (archived: boolean) => apiGet<{ Items: Agent[] | null }>(`${BASE}${archived ? "?archived=1" : ""}`)
export const enrollAgent = (input: EnrollAgentInput) => apiPost<Agent>(BASE, input)
export const updateAgent = (id: string, input: UpdateAgentInput) => apiPut<Agent>(path(id), input)
export const previewAgentDelete = (id: string) => apiGet<DeletePreview>(`${path(id)}/delete-preview`)
export const deleteAgent = (id: string) => apiDelete<unknown>(`${path(id)}?confirm=1`)
export const checkAgent = (id: string) => apiPost<Agent>(`${path(id)}/check`, {})
export const reconnectAgent = (id: string, EnrollmentToken: string, CAPEM: string) => apiPost<Agent>(`${path(id)}/reconnect`, { EnrollmentToken, CAPEM })
export const renewAgentCertificate = (id: string) => apiPost<Agent>(`${path(id)}/renew-certificate`, {})
export const rotateAgentAccessKey = (id: string) => apiPost<Agent>(`${path(id)}/rotate-access-key`, {})
