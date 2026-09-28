import { describe, expect, it } from "vitest"
import { capacityMetrics, formatBytes } from "./infrastructureMonitoring"

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
