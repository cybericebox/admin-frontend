/**
 * elevations.ts — resource elevation requests (a task above the platform frame). Platform admins decide.
 * JSON PascalCase. An approval stores the requested values per device; the author may later lower them
 * under the approval, never raise them.
 */
import { apiGet, apiPost } from "@/api/client"

const BASE = "/api/exercises/elevations"

export { ELEVATION_PERM } from "@/lib/elevationPermission"

export type ElevationStatus = "pending" | "approved" | "rejected"

export type ElevationDevice = {
  DeviceID: string
  DeviceName: string
  /** Position of the variant the device belongs to (1-based). */
  Variant: number
  /** Kubernetes quantities, as requested: "500m", "2Gi". */
  CPU: string
  Memory: string
}

export type ElevationRequest = {
  ID: string
  ExerciseID: string
  ExerciseName: string
  Status: ElevationStatus
  Reason: string
  RequestedByName: string
  RequestedAt: string
  ReviewedByName: string
  ReviewedAt: string | null
  ReviewNote: string
  Devices: ElevationDevice[]
}

export type ElevationFilter = "pending" | "decided"

type Raw = Omit<ElevationRequest, "Devices" | "ReviewedByName" | "ReviewNote" | "ReviewedAt"> & Partial<Pick<ElevationRequest, "ReviewedByName" | "ReviewNote" | "ReviewedAt">> & { Devices: ElevationDevice[] | null }

function normalize(raw: Raw): ElevationRequest {
  return { ...raw, ReviewedByName: raw.ReviewedByName ?? "", ReviewNote: raw.ReviewNote ?? "", ReviewedAt: raw.ReviewedAt ?? null, Devices: raw.Devices ?? [] }
}

const path = (id: string) => `${BASE}/${encodeURIComponent(id)}`

export async function listElevations(filter: ElevationFilter): Promise<ElevationRequest[]> {
  const result = await apiGet<{ Items: Raw[] | null }>(`${BASE}?status=${filter}`)
  return (result.Items ?? []).map(normalize)
}

export async function getElevation(id: string): Promise<ElevationRequest> {
  return normalize(await apiGet<Raw>(path(id)))
}

export async function approveElevation(id: string, note: string): Promise<ElevationRequest> {
  return normalize(await apiPost<Raw>(`${path(id)}/approve`, { Note: note }))
}

export async function rejectElevation(id: string, note: string): Promise<ElevationRequest> {
  return normalize(await apiPost<Raw>(`${path(id)}/reject`, { Note: note }))
}
