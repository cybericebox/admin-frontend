import { describe, expect, it } from "vitest"
import { AllocationSchema, ComputeSchema, ManagedGroupSchema, ManagedLabSchema, ResourceObservationSchema } from "./labLifecycle"
import { allocation, managedGroup, managedLab, resourceObservation } from "@/test/labLifecycle"

describe("managed lifecycle observation contracts", () => {
  it("keeps exact decimal quantities and revisions beyond safe integers", () => {
    const lab = ManagedLabSchema.parse({ ...managedLab, Revision: "9007199254740993", ObservedRevision: "9007199254740992" })
    expect(lab.Revision).toBe("9007199254740993")
    expect(lab.ObservedRevision).toBe("9007199254740992")
    expect(lab.Resources.SnapshotQuotaBytes).toBe("9007199254740993")
    expect(ComputeSchema.parse({ CPUMillicores: "9007199254740993", MemoryBytes: "18446744073709551615" })).toEqual({
      CPUMillicores: "9007199254740993", MemoryBytes: "18446744073709551615",
    })
  })

  it("preserves logical closure with a failed physical stop and held compute", () => {
    const lab = ManagedLabSchema.parse(managedLab)
    expect(lab).toMatchObject({ DesiredState: "Stopped", ActualState: "StopFailed", CloseReason: "solved", ActualStoppedAt: null })
    expect(lab.Resources).toMatchObject({ RuntimeState: "Releasing", AllocatedRequests: { CPUMillicores: "250", MemoryBytes: "104857600" } })
  })

  it.each([12, -1, "", "01", "-1", "1.5", "1e3", "+1", " 1", "1\n"])("rejects noncanonical decimal %j", (value) => {
    expect(ManagedLabSchema.safeParse({ ...managedLab, Revision: value }).success).toBe(false)
    expect(ManagedGroupSchema.safeParse({ ...managedGroup, ObservedRevision: value }).success).toBe(false)
    expect(AllocationSchema.safeParse({ ...allocation, SnapshotQuotaBytes: value }).success).toBe(false)
    expect(ComputeSchema.safeParse({ CPUMillicores: value, MemoryBytes: "0" }).success).toBe(false)
    expect(ComputeSchema.safeParse({ CPUMillicores: "0", MemoryBytes: value }).success).toBe(false)
    expect(ResourceObservationSchema.safeParse({ ...resourceObservation, PhysicalStorageBytes: value }).success).toBe(false)
  })

  it("keeps unavailable and unknown observations without inventing release or usage", () => {
    const unknown = AllocationSchema.parse({ ...allocation, RuntimeState: "Unknown", StorageState: "Unknown", UsageAvailable: false, ObservedAt: null })
    expect(unknown).toMatchObject({ RuntimeState: "Unknown", StorageState: "Unknown", UsageAvailable: false, ObservedAt: null, ReleasedAt: null })
    expect(unknown.AllocatedRequests).toEqual({ CPUMillicores: "250", MemoryBytes: "104857600" })
    expect(ManagedGroupSchema.parse(managedGroup)).toEqual(managedGroup)
    expect(ResourceObservationSchema.parse(resourceObservation)).toEqual(resourceObservation)
  })

  it("keeps retained storage independent of confirmed compute release", () => {
    const released = AllocationSchema.parse({ ...allocation, RuntimeState: "Released", ReleasedAt: "2026-10-08T12:01:00Z",
      AllocatedRequests: { CPUMillicores: "0", MemoryBytes: "0" }, ReleasedRequests: { CPUMillicores: "250", MemoryBytes: "104857600" } })
    expect(released).toMatchObject({ RuntimeState: "Released", StorageState: "Retained", SnapshotQuotaBytes: "9007199254740993", PhysicalStorageBytesAvailable: false })
  })

  it("rejects malformed present lifecycle and allocation observations", () => {
    expect(AllocationSchema.safeParse({ ...allocation, RuntimeState: "Deleted" }).success).toBe(false)
    expect(AllocationSchema.safeParse({ ...allocation, StorageState: "Released" }).success).toBe(false)
    expect(AllocationSchema.safeParse({ ...allocation, Used: null }).success).toBe(false)
    expect(AllocationSchema.safeParse({ ...allocation, UsageAvailable: undefined }).success).toBe(false)
    expect(ManagedLabSchema.safeParse({ ...managedLab, ActualState: "ready" }).success).toBe(false)
    expect(ManagedLabSchema.safeParse({ ...managedLab, SnapshotState: "Done" }).success).toBe(false)
    expect(ManagedLabSchema.safeParse({ ...managedLab, CloseReason: "unknown" }).success).toBe(false)
    expect(ManagedLabSchema.safeParse({ ...managedLab, ID: "wrong-id" }).success).toBe(false)
    expect(ManagedLabSchema.safeParse({ ...managedLab, Generation: -1 }).success).toBe(false)
    expect(ManagedGroupSchema.safeParse({ ...managedGroup, Ready: undefined }).success).toBe(false)
    expect(ResourceObservationSchema.safeParse({ ...resourceObservation, Held: { CPUMillicores: "0", MemoryBytes: "0" } }).success).toBe(false)
  })
})
