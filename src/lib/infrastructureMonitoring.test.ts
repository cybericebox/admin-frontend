import { describe, expect, it } from "vitest"
import { agentDisplayName, capacityMetrics, formatBytes } from "./infrastructureMonitoring"

describe("capacityMetrics", () => {
  it("reads omitted protojson request fields as zero when capacity data is present", () => {
    expect(capacityMetrics({
      allocatableCpuMillicores: "4000",
      allocatableMemoryBytes: "8589934592",
      nodes: [{ name: "node-a", allocatableCpuMillicores: "4000", allocatableMemoryBytes: "8589934592" }],
    })).toMatchObject({
      requestedCpuMillicores: 0,
      requestedMemoryBytes: 0,
      nodes: [{ requestedCpuMillicores: 0, requestedMemoryBytes: 0 }],
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
