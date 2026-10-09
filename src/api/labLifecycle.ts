import { z } from "zod"

const decimal = z.string().regex(/^(0|[1-9]\d*)$/)
const optionalTime = z.string().nullable()
const actualState = z.enum(["Running", "Snapshotting", "Stopping", "Stopped", "StopFailed", "Starting", "Unknown", "Deleting", "Deleted"])
const desiredState = z.enum(["Running", "Stopped", "Deleted"])

export const ComputeSchema = z.object({ CPUMillicores: decimal, MemoryBytes: decimal })

export const AllocationSchema = z.object({
  ConfiguredRequests: ComputeSchema,
  ConfiguredLimits: ComputeSchema,
  AllocatedRequests: ComputeSchema,
  Used: ComputeSchema,
  ReleasedRequests: ComputeSchema,
  RuntimeState: z.enum(["Allocated", "Releasing", "Released", "Unknown"]),
  ObservedAt: optionalTime,
  ReleasedAt: optionalTime,
  UsageAvailable: z.boolean(),
  SnapshotQuotaBytes: decimal,
  StorageState: z.enum(["None", "Retained", "DeleteRequested", "CleanupPending", "Deleted", "Unknown"]),
  PhysicalStorageBytesAvailable: z.boolean(),
  PhysicalStorageBytes: decimal,
})

export const ManagedLabSchema = z.object({
  ID: z.string().uuid(),
  EventExerciseID: z.string().uuid(),
  TeamID: z.string().uuid(),
  ExerciseName: z.string(),
  Revision: decimal,
  ObservedRevision: decimal,
  Generation: z.number().int().nonnegative(),
  AgentUID: z.string(),
  DesiredState: desiredState,
  ActualState: actualState,
  CloseReason: z.enum(["solved", "manual", "stage", "event"]).nullable(),
  ClosedAt: optionalTime,
  ActualStoppedAt: optionalTime,
  RetentionUntil: optionalTime,
  ObservedAt: optionalTime,
  SnapshotPolicy: z.enum(["none", "required"]).nullish().transform(value => value ?? null),
  SnapshotState: z.enum(["NotRequired", "Pending", "Succeeded", "Failed", "Unknown"]),
  FailureCode: z.string(),
  FailureMessage: z.string(),
  Resources: AllocationSchema,
})

export const ManagedGroupSchema = z.object({
  Name: z.string(),
  Revision: decimal,
  ObservedRevision: decimal,
  AgentUID: z.string(),
  DesiredState: desiredState,
  ActualState: actualState,
  Ready: z.boolean(),
  ObservedAt: optionalTime,
  FailureCode: z.string(),
  FailureMessage: z.string(),
  Resources: AllocationSchema,
})

export const ResourceObservationSchema = z.object({
  ObservedAt: optionalTime,
  Complete: z.boolean(),
  Held: ComputeSchema.extend({ SnapshotQuotaBytes: decimal }),
  PendingStarts: ComputeSchema,
  GroupServices: ComputeSchema,
  PhysicalStorageBytesAvailable: z.boolean(),
  PhysicalStorageBytes: decimal,
})

export type ComputeView = z.infer<typeof ComputeSchema>
export type AllocationView = z.infer<typeof AllocationSchema>
export type ManagedLabView = z.infer<typeof ManagedLabSchema>
export type ManagedGroupView = z.infer<typeof ManagedGroupSchema>
export type ResourceObservation = z.infer<typeof ResourceObservationSchema>
