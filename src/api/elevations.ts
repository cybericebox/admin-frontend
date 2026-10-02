/**
 * elevations.ts — resource elevation requests (devices above the platform frame). A super admin decides.
 * JSON PascalCase, CPU in millicores, memory in bytes. An approval stores the values per device; the author
 * may later lower them under the approval, never raise them.
 */
import { apiGet, apiPost } from "@/api/client"

export { ELEVATION_READ_PERM, ELEVATION_WRITE_PERM } from "@/lib/elevationPermission"

const BASE = "/api/exercises/resource-elevations"

export type ElevationStatus = "pending" | "approved" | "rejected"

export type ElevationDevice = { DeviceID: string; Name: string; CPUMillicores: number; MemoryBytes: number }

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
}

/** "" lists every request. */
export type ElevationFilter = ElevationStatus | ""

type Raw = Partial<ElevationRequest> & Pick<ElevationRequest, "ID" | "Status">

function normalize(raw: Raw): ElevationRequest {
  return {
    ID: raw.ID, ExerciseID: raw.ExerciseID ?? "", ExerciseName: raw.ExerciseName ?? "", VersionID: raw.VersionID ?? "",
    Status: raw.Status, Reason: raw.Reason ?? "", Requested: raw.Requested ?? [], Approved: raw.Approved ?? [],
    DecisionNote: raw.DecisionNote ?? "", RequestedByName: raw.RequestedByName ?? "", RequestedAt: raw.RequestedAt ?? "",
    DecidedByName: raw.DecidedByName ?? "", DecidedAt: raw.DecidedAt ?? null,
  }
}

export async function listElevations(filter: ElevationFilter): Promise<ElevationRequest[]> {
  const result = await apiGet<Raw[] | null>(`${BASE}${filter ? `?status=${filter}` : ""}`)
  return (result ?? []).map(normalize)
}

/** There is no single-request route: the detail finds the request in the full list. */
export async function findElevation(id: string): Promise<ElevationRequest | null> {
  return (await listElevations("")).find((item) => item.ID === id) ?? null
}

/** Omitting devices approves what was requested; values may be lower, never above the ceiling. */
export async function decideElevation(id: string, input: { Approve: boolean; Note: string; Devices?: Pick<ElevationDevice, "DeviceID" | "CPUMillicores" | "MemoryBytes">[] }): Promise<ElevationRequest> {
  return normalize(await apiPost<Raw>(`${BASE}/${encodeURIComponent(id)}/decide`, input))
}
