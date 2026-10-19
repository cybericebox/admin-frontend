import { describe, expect, it } from "vitest"
import { agentDisplayName, capacityMetrics, formatBytes } from "./infrastructureMonitoring"

describe("capacityMetrics", () => {
  it("reads the agent capacity: the maximum the calendar plans with, what is reserved and what the nodes give now", () => {
    expect(capacityMetrics({
      tenant: "platform", hasCpuQuota: true, cpuQuotaMillicores: "12000", hasMemoryQuota: true, memoryQuotaBytes: "25769803776",
      cpuReservedMillicores: "1500", hasCurrent: true, currentCpuMillicores: "4000", currentMemoryBytes: "8589934592",
    })).toEqual({
      capacityCpuMillicores: 12000, capacityMemoryBytes: 25769803776, reservedCpuMillicores: 1500, reservedMemoryBytes: 0,
      currentCpuMillicores: 4000, currentMemoryBytes: 8589934592,
    })
  })

  it("has no limit without a quota, and no current capacity from an older agent", () => {
    expect(capacityMetrics({ tenant: "platform", cpuReservedMillicores: "100" })).toEqual({
      capacityCpuMillicores: null, capacityMemoryBytes: null, reservedCpuMillicores: 100, reservedMemoryBytes: 0,
      currentCpuMillicores: null, currentMemoryBytes: null,
    })
  })

  it("does not turn an unrelated payload into a zero-capacity report", () => {
    expect(capacityMetrics({ cpu: 4 })).toBeNull()
  })
})

describe("formatBytes", () => {
  it("keeps small traffic counters legible instead of rounding them to zero mebibytes", () => {
    expect(formatBytes(0)).toBe("0 Б")
    expect(formatBytes(4096)).toBe("4 КіБ")
    expect(formatBytes(1048576)).toBe("1 МіБ")
  })
})

describe("agentDisplayName", () => {
  it("shows the translated label for the configured primary agent regardless of stored name", () => {
    expect(agentDisplayName({ Key: "configured-primary", Name: "" })).toBe("Основний агент")
    expect(agentDisplayName({ Key: "configured-primary", Name: "Configured primary agent" })).toBe("Основний агент")
  })
  it("falls back from name to key for other agents", () => {
    expect(agentDisplayName({ Key: "a", Name: "Lab A" })).toBe("Lab A")
    expect(agentDisplayName({ Key: "a", Name: "" })).toBe("a")
  })
})
