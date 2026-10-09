const compute = { CPUMillicores: "250", MemoryBytes: "104857600" }

export const allocation = {
  ConfiguredRequests: compute, ConfiguredLimits: compute, AllocatedRequests: compute,
  Used: compute, ReleasedRequests: { CPUMillicores: "0", MemoryBytes: "0" },
  RuntimeState: "Releasing" as const, ObservedAt: "2026-10-08T12:00:00Z", ReleasedAt: null,
  UsageAvailable: true, SnapshotQuotaBytes: "9007199254740993", StorageState: "Retained" as const,
  PhysicalStorageBytesAvailable: false, PhysicalStorageBytes: "0",
}

export const managedLab = {
  ID: "00000000-0000-4000-8000-000000000100", EventExerciseID: "00000000-0000-4000-8000-000000000200",
  TeamID: "00000000-0000-4000-8000-000000000300", ExerciseName: "Shared environment",
  Revision: "12", ObservedRevision: "11", Generation: 1, AgentUID: "lab-uid",
  DesiredState: "Stopped" as const, ActualState: "StopFailed" as const, CloseReason: "solved" as const,
  ClosedAt: "2026-10-08T12:00:00Z", ActualStoppedAt: null, RetentionUntil: "2026-10-08T13:00:00Z",
  ObservedAt: "2026-10-08T12:00:00Z", SnapshotPolicy: null, SnapshotState: "Failed" as const,
  FailureCode: "CaptureFailed", FailureMessage: "snapshot capture failed", Resources: allocation,
}

export const managedGroup = {
  Name: "team-group", Revision: "12", ObservedRevision: "11", AgentUID: "group-uid",
  DesiredState: "Running" as const, ActualState: "Running" as const, Ready: true,
  ObservedAt: "2026-10-08T12:00:00Z", FailureCode: "", FailureMessage: "", Resources: allocation,
}

export const resourceObservation = {
  ObservedAt: "2026-10-08T12:00:00Z", Complete: false,
  Held: { CPUMillicores: "325", MemoryBytes: "138412032", SnapshotQuotaBytes: "9007199254740993" },
  PendingStarts: { CPUMillicores: "25", MemoryBytes: "16777216" },
  GroupServices: { CPUMillicores: "50", MemoryBytes: "16777216" },
  PhysicalStorageBytesAvailable: false, PhysicalStorageBytes: "0",
}
