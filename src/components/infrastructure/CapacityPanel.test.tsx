import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CapacityPanel } from "./CapacityPanel"
import type { CapacityObservation } from "@/api/infrastructure"

const row = (payload: unknown): CapacityObservation => ({ ID: "c1", AgentID: "a1", Sequence: 1, ObservedAt: "2026-10-19T10:00:00Z", ReceivedAt: "2026-10-19T10:00:00Z", SchemaVersion: 1, Snapshot: false, Payload: payload })

describe("capacity panel", () => {
  it("shows the reserved part of the maximum and what the existing nodes give now", () => {
    render(<CapacityPanel rows={[row({ tenant: "platform", hasCpuQuota: true, cpuQuotaMillicores: "12000", hasMemoryQuota: true, memoryQuotaBytes: "25769803776",
      cpuReservedMillicores: "3000", memoryReservedBytes: "4294967296", hasCurrent: true, currentCpuMillicores: "4000", currentMemoryBytes: "8589934592" })]}
      agents={[]} loadError="" onRetry={() => {}} />)
    expect(screen.getByText("3 vCPU / 12 vCPU")).toBeInTheDocument()
    expect(screen.getByText("Зараз на наявних вузлах: 4 vCPU і 8 ГіБ. Решту кластер додає, коли стенди її потребують.")).toBeInTheDocument()
  })

  it("says nothing about the current nodes when they give the whole maximum", () => {
    render(<CapacityPanel rows={[row({ tenant: "platform", hasCpuQuota: true, cpuQuotaMillicores: "4000", hasMemoryQuota: true, memoryQuotaBytes: "8589934592",
      hasCurrent: true, currentCpuMillicores: "4000", currentMemoryBytes: "8589934592" })]} agents={[]} loadError="" onRetry={() => {}} />)
    expect(screen.queryByText(/Зараз на наявних вузлах/)).not.toBeInTheDocument()
  })
})
