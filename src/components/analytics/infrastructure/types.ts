// GET /api/analytics/infrastructure (PascalCase JSON). Aggregates only.
export type StandCounts = { Active: number; Creating: number; Ready: number; Failed: number; Removed: number }
import type { LabResources } from "@/api/infrastructure"
export type LabKind = "event" | "moderators" | "test"
export type KindHours = { Kind: LabKind; Hours: number; Labs: number }
export type StandHoursEvent = { EventID: string; EventName: string; Hours: number; Stands: number }
export type PeakPoint = { At: string; Peak: number }
export type FailureReason = { Code: string; Labs: number; Stands: number; Events: number; LastAt: string }
export type CapacityPoint = {
  At: string
  AllocatableCPUMillicores: number
  RequestedCPUMillicores: number
  AllocatableMemoryBytes: number
  RequestedMemoryBytes: number
  Agents: number
}

export type InfrastructureData = {
  Period: { From: string; To: string; All: boolean }
  /** Granularity of Peaks. */
  Bucket: "hour" | "day"
  /** Every team stand, the moderators team included. */
  Stands: StandCounts
  /** The moderators-team part of Stands. */
  Moderators?: StandCounts
  /** Catalog test labs, not team stands. */
  TestLabs?: { Active: number; Expired: number }
  /** TotalHours counts team stands; Kinds splits by kind and AllHours adds the test labs. */
  StandHours: { TotalHours: number; TotalEvents: number; Events: StandHoursEvent[]; Kinds?: KindHours[]; AllHours?: number }
  /** What the labs of each kind use right now. */
  Resources?: Record<"Event" | "Moderators" | "Test", LabResources>
  /** Team stands only; TestLabPeaks test labs only; AllPeaks every lab at once. */
  Peaks: PeakPoint[]
  TestLabPeaks?: PeakPoint[]
  AllPeaks?: PeakPoint[]
  PeakMax: number
  AllPeakMax?: number
  Failures: FailureReason[]
  FailedLabs: number
  FailedStands: number
  Capacity: CapacityPoint[]
  CapacityStepSeconds: number
}

/** What every block of the page receives from the single resource. */
export type InfrastructureResource = {
  data: InfrastructureData | undefined
  loading: boolean
  error: unknown
  reload: () => void
}
