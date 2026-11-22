/**
 * elevations.ts — resource elevation requests (devices above the platform frame). A super admin decides.
 * JSON PascalCase, CPU in millicores, memory in bytes, sizes in fixed blocks. An approval stores the block count per device;
 * the author may later lower it under the approval, never raise it.
 */
import { apiGet, apiPost } from "@/api/client"

export { ELEVATION_READ_PERM, ELEVATION_WRITE_PERM } from "@/lib/elevationPermission"

const BASE = "/api/exercises/elevations"

export type ElevationStatus = "pending" | "approved" | "rejected"

export type ElevationDevice = { DeviceID: string; Name: string; Blocks: number; CPUMillicores: number; MemoryBytes: number }

/** One offered device size: a whole number of fixed blocks. Presets come ascending. */
export type ResourcePreset = { ID: string; Blocks: number; CPUMillicores: number; MemoryBytes: number }

export async function getResourcePresets(): Promise<ResourcePreset[]> {
  const caps = await apiGet<{ Resources?: { Presets?: ResourcePreset[] | null } | null }>("/api/exercises/capabilities")
  return caps.Resources?.Presets ?? []
}

/** The cluster capacity next to a request: what it asks, what is free now, whether it fits (null when the cluster is not measured). */
export type ElevationCapacity = {
  CapacityCPUMillicores: number
  CapacityMemoryBytes: number
  FreeCPUMillicores: number
  FreeMemoryBytes: number
  CPUUnlimited: boolean
  MemoryUnlimited: boolean
  AskedCPUMillicores: number
  AskedMemoryBytes: number
  Fits: boolean
}

export type ElevationRequest = {
  ID: string
  ExerciseID: string
  ExerciseName: string
  VersionID: string
  Status: ElevationStatus
  Reason: string
  Requested: ElevationDevice[]
  Approved: ElevationDevice[]
  DecisionNote: string
  RequestedByName: string
  RequestedAt: string
  DecidedByName: string
  DecidedAt: string | null
  /** The author's user id: the key of their request history. */
  RequestedBy: string
  Capacity: ElevationCapacity | null
}

/** "" lists every request. */
/** "decided" is approved and rejected together. */
export type ElevationFilter = ElevationStatus | "decided" | ""

type Raw = Partial<ElevationRequest> & Pick<ElevationRequest, "ID" | "Status">

function normalize(raw: Raw): ElevationRequest {
  return {
    ID: raw.ID, ExerciseID: raw.ExerciseID ?? "", ExerciseName: raw.ExerciseName ?? "", VersionID: raw.VersionID ?? "",
    Status: raw.Status, Reason: raw.Reason ?? "", Requested: raw.Requested ?? [], Approved: raw.Approved ?? [],
    DecisionNote: raw.DecisionNote ?? "", RequestedByName: raw.RequestedByName ?? "", RequestedAt: raw.RequestedAt ?? "",
    DecidedByName: raw.DecidedByName ?? "", DecidedAt: raw.DecidedAt ?? null, RequestedBy: raw.RequestedBy ?? "", Capacity: raw.Capacity ?? null,
  }
}

export async function listElevations(filter: ElevationFilter): Promise<ElevationRequest[]> {
  const result = await apiGet<Raw[] | null>(`${BASE}${filter ? `?status=${filter}` : ""}`)
  return (result ?? []).map(normalize)
}

/** Every request of one author (GET ?author=): their history; the screen shows the latest few. */
export async function listAuthorElevations(authorId: string): Promise<ElevationRequest[]> {
  const result = await apiGet<Raw[] | null>(`${BASE}?author=${encodeURIComponent(authorId)}`)
  return (result ?? []).map(normalize)
}

export async function getElevation(id: string): Promise<ElevationRequest> {
  return normalize(await apiGet<Raw>(`${BASE}/${encodeURIComponent(id)}`))
}

/** Omitting devices approves what was requested; each device gets an offered block count, never above the requested one. */
export async function decideElevation(id: string, input: { Approve: boolean; Note: string; Devices?: Pick<ElevationDevice, "DeviceID" | "Blocks">[] }): Promise<ElevationRequest> {
  const { Approve, ...body } = input
  return normalize(await apiPost<Raw>(`${BASE}/${encodeURIComponent(id)}/${Approve ? "approve" : "reject"}`, Approve ? body : { Note: body.Note }))
}
