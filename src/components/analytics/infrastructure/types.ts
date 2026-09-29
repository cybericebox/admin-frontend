// GET /api/analytics/infrastructure (PascalCase JSON). Aggregates only.
export type StandCounts = { Active: number; Creating: number; Ready: number; Failed: number; Removed: number }
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
  Stands: StandCounts
  StandHours: { TotalHours: number; TotalEvents: number; Events: StandHoursEvent[] }
  Peaks: PeakPoint[]
  PeakMax: number
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
