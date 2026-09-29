import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import Page from "./page"

const apiGet = vi.fn()
vi.mock("@/api/client", () => ({ apiGet: (...args: unknown[]) => apiGet(...args) }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

describe("infrastructure page", () => {
  it("shows agent availability and current monitoring from the infrastructure API", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.endsWith("/status")) return Promise.resolve({ Available: true, Healthy: true, mode: "available", agents: [{ id: "agent-1", key: "primary", name: "Primary", configured: true, healthy: true }], capabilities: { laboratories: true } })
      if (path.endsWith("/capacity/current")) return Promise.resolve([{ id: "capacity-1", agentId: "agent-1", observedAt: "2026-09-24T12:00:00Z", payload: { cpu: 4 } }])
      return Promise.resolve([{ id: "lab-1", eventId: "event-1", eventTeamId: "team-1", labGroupName: "Team A", agentId: "agent-1", observedAt: "2026-09-24T12:00:00Z", payload: {} }])
    })
    render(<Page />)
    expect((await screen.findAllByText("Primary")).length).toBeGreaterThan(0)
    expect(screen.getByText("Режим: доступно")).toBeInTheDocument()
    expect(screen.getByText("Team A")).toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledWith("/api/infrastructure/status")
    expect(apiGet).toHaveBeenCalledWith("/api/infrastructure/monitoring/current")
    expect(apiGet).toHaveBeenCalledWith("/api/infrastructure/monitoring/capacity/current")
  })

  it("explains a missing agent without exposing backend English messages", async () => {
    apiGet.mockImplementation((path: string) => path.endsWith("/status")
      ? Promise.resolve({ Available: false, Healthy: false, mode: "missing_config", agents: [], capabilities: { laboratories: false }, warning: { code: "infrastructure_unavailable", message: "No infrastructure agent is configured" } })
      : Promise.resolve([]))
    render(<Page />)
    expect(await screen.findByText("Режим: не налаштовано")).toBeInTheDocument()
    expect(screen.getByText("Агент лабораторій не налаштований.")).toBeInTheDocument()
    expect(screen.queryByText("No infrastructure agent is configured")).not.toBeInTheDocument()
  })

  it("shows requested versus allocatable CPU and memory from protojson capacity", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.endsWith("/status")) return Promise.resolve({ Available: true, Healthy: true, mode: "available", agents: [{ id: "agent-1", key: "primary", name: "Primary", configured: true, healthy: true }], capabilities: { laboratories: true } })
      if (path.endsWith("/capacity/current")) return Promise.resolve([{ id: "capacity-1", agentId: "agent-1", observedAt: "2026-09-24T12:00:00Z", payload: {
        allocatableCpuMillicores: "4000", requestedCpuMillicores: "1500",
        allocatableMemoryBytes: "8589934592", requestedMemoryBytes: "3221225472",
        nodes: [{ name: "node-a", allocatableCpuMillicores: "4000", requestedCpuMillicores: "1500", allocatableMemoryBytes: "8589934592", requestedMemoryBytes: "3221225472" }],
      } }])
      return Promise.resolve([])
    })
    render(<Page />)
    const cpu = await screen.findByRole("progressbar", { name: "CPU агента Primary" })
    expect(cpu).toHaveAttribute("aria-valuenow", "1500")
    expect(cpu).toHaveAttribute("aria-valuemax", "4000")
    const memory = screen.getByRole("progressbar", { name: "Пам’ять агента Primary" })
    expect(memory).toHaveAttribute("aria-valuenow", "3221225472")
    expect(memory).toHaveAttribute("aria-valuemax", "8589934592")
    expect(screen.getByText("node-a")).toBeInTheDocument()
  })

  it("keeps an overcommitted resource bar accessible without hiding its real usage", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.endsWith("/status")) return Promise.resolve({ Available: true, Healthy: true, mode: "available", agents: [{ id: "agent-1", key: "primary", name: "Primary", configured: true, healthy: true }], capabilities: { laboratories: true } })
      if (path.endsWith("/capacity/current")) return Promise.resolve([{ id: "capacity-1", agentId: "agent-1", observedAt: "2026-09-24T12:00:00Z", payload: { allocatableCpuMillicores: "4000", requestedCpuMillicores: "5000" } }])
      return Promise.resolve([])
    })
    render(<Page />)
    const cpu = await screen.findByRole("progressbar", { name: "CPU агента Primary" })
    expect(cpu).toHaveAttribute("aria-valuenow", "4000")
    expect(cpu).toHaveAttribute("aria-valuemax", "4000")
    expect(screen.getByText("5 vCPU / 4 vCPU")).toBeInTheDocument()
    expect(screen.getByText("Перевищено доступну ємність.")).toBeInTheDocument()
  })

  it("labels a delta as the last update, not a complete current state", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.endsWith("/status")) return Promise.resolve({ Available: true, Healthy: true, mode: "available", agents: [], capabilities: { laboratories: true } })
      if (path.endsWith("/capacity/current")) return Promise.resolve([])
      return Promise.resolve([{ id: "lab-1", eventId: "event-1", eventTeamId: "team-1", labGroupName: "Team A", agentId: "agent-1", observedAt: "2026-09-24T12:00:00Z", snapshot: false, payload: { sequence: "8", snapshot: false, labs: [] } }])
    })
    render(<Page />)
    expect(await screen.findByText("Team A")).toBeInTheDocument()
    expect(screen.getByText("Останні оновлення лабораторій")).toBeInTheDocument()
    expect(screen.getByText("Часткове оновлення")).toBeInTheDocument()
  })

  it("keeps agent status visible when laboratory observations fail to load", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.endsWith("/status")) return Promise.resolve({ Available: true, Healthy: true, mode: "available", agents: [{ id: "agent-1", key: "primary", name: "Primary", configured: true, healthy: true }], capabilities: { laboratories: true } })
      if (path.endsWith("/capacity/current")) return Promise.resolve([])
      return Promise.reject(new Error("monitoring unavailable"))
    })
    render(<Page />)
    expect(await screen.findByText("Режим: доступно")).toBeInTheDocument()
    expect(screen.getByText("Не вдалося завантажити спостереження лабораторій.")).toBeInTheDocument()
    expect(screen.queryByText("Немає спостережень лабораторій.")).not.toBeInTheDocument()
  })

  it("keeps agent status visible when capacity observations fail to load", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.endsWith("/status")) return Promise.resolve({ Available: true, Healthy: true, mode: "available", agents: [{ id: "agent-1", key: "primary", name: "Primary", configured: true, healthy: true }], capabilities: { laboratories: true } })
      if (path.endsWith("/capacity/current")) return Promise.reject(new Error("capacity unavailable"))
      return Promise.resolve([])
    })
    render(<Page />)
    expect(await screen.findByText("Режим: доступно")).toBeInTheDocument()
    expect(screen.getByText("Не вдалося завантажити ресурси кластера.")).toBeInTheDocument()
    expect(screen.queryByText("Немає даних про ресурси кластера.")).not.toBeInTheDocument()
  })

  it("shows resource, VPN traffic, access-rule, and deletion facts without exposing secret fields", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.endsWith("/status")) return Promise.resolve({ Available: true, Healthy: true, mode: "available", agents: [], capabilities: { laboratories: true } })
      if (path.endsWith("/capacity/current")) return Promise.resolve([])
      return Promise.resolve([{ id: "lab-1", eventId: "event-1", eventTeamId: "team-1", labGroupName: "team-a", agentId: "agent-1", observedAt: "2026-09-24T12:00:00Z", snapshot: false, payload: {
        groups: [{ name: "team-a", status: { phase: "Ready", vpnRegistered: true } }],
        labs: [{ name: "web-lab", status: { phase: "Running", ready: true, devices: [{ name: "web", usageAvailable: true, cpuMillicores: "250", memoryBytes: "104857600", restartCount: 2 }] }, specJson: "hidden-spec" }],
        clients: [{ name: "vpn-client", publicKey: "hidden-key", status: { assignedIp: "10.0.0.2", ready: true, config: "hidden-config", statistics: { rxBytes: "1048576", txBytes: "2097152" } } }],
        policies: [{ status: { state: "Applied", rules: [{ clientName: "vpn-client", labName: "web-lab", action: "LAB_GROUP_ACCESS_ACTION_DENY", packets: "5", bytes: "4096" }] } }],
        deletedKeys: [{ kind: "lab", labGroupName: "team-a", name: "old-lab" }],
      } }])
    })
    render(<Page />)
    fireEvent.click(await screen.findByText("Переглянути показники"))
    expect(screen.getByText("web-lab")).toBeInTheDocument()
    expect(screen.getByText("web")).toBeInTheDocument()
    expect(screen.getByText("CPU: 0,25 vCPU")).toBeInTheDocument()
    expect(screen.getByText("Отримано: 1 МіБ")).toBeInTheDocument()
    expect(screen.getByText("Передано: 2 МіБ")).toBeInTheDocument()
    expect(screen.getByText("Заборонено")).toBeInTheDocument()
    expect(screen.getByText("5 пакетів, 4 КіБ")).toBeInTheDocument()
    expect(screen.getByText("Видалено: old-lab")).toBeInTheDocument()
    expect(screen.queryByText(/hidden-spec|hidden-key|hidden-config/)).not.toBeInTheDocument()
  })
})
