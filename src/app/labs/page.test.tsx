import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import Page from "./page"

const apiGet = vi.fn()
const apiPost = vi.fn()
let search = ""
let permissions = ["infrastructure.read", "infrastructure.write"]
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: (...args: unknown[]) => apiGet(...args), apiPost: (...args: unknown[]) => apiPost(...args) }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (perm: string) => permissions.includes(perm) }) }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }))

const agent = { ID: "agent-1", Key: "primary", Name: "Primary", Configured: true, Healthy: true }
const okStatus = { Available: true, Healthy: true, Mode: "available", Agents: [agent], Capabilities: { Laboratories: true } }
const currentLab = (over: object = {}) => ({ EventID: "event-1", EventName: "Осінній CTF", EventTeamID: "team-1", TeamName: "Червоні", LabGroupName: "e-1-t-1", AgentID: "agent-1", Sequence: 8, ObservedAt: "2026-09-24T12:00:00Z", UpdatedAt: "2026-09-24T12:00:00Z", Payload: {}, ...over })
const capacityRow = (payload: unknown) => ({ ID: "capacity-1", AgentID: "agent-1", Sequence: 1, ObservedAt: "2026-09-24T12:00:00Z", ReceivedAt: "2026-09-24T12:00:00Z", SchemaVersion: 1, Snapshot: true, Payload: payload })

type Routes = { status?: unknown; current?: unknown; capacity?: unknown; stands?: unknown; events?: unknown; testLabs?: unknown }
function serve(routes: Routes = {}) {
  const pick = (value: unknown, fallback: unknown) => value instanceof Error ? Promise.reject(value) : Promise.resolve(value ?? fallback)
  apiGet.mockImplementation((path: string) => {
    if (path.endsWith("/status")) return pick(routes.status, okStatus)
    if (path.includes("/monitoring/capacity/current")) return pick(routes.capacity, [])
    if (path.includes("/monitoring/current")) return pick(routes.current, [])
    if (path.includes("/test-labs")) return pick(routes.testLabs, { Items: [], Total: 0, Page: 1, PageSize: 25 })
    if (path.includes("/stands/events")) return pick(routes.events, [{ ID: "event-1", Name: "Осінній CTF", Tag: "autumn" }])
    if (path.includes("/stands")) return pick(routes.stands, { Items: [], Total: 0, Page: 1, PageSize: 25 })
    return Promise.reject(new Error(path))
  })
}

beforeEach(() => {
  apiGet.mockReset()
  apiPost.mockReset()
  search = ""
  permissions = ["infrastructure.read", "infrastructure.write"]
  serve()
})
afterEach(() => { vi.useRealTimers() })

describe("infrastructure page", () => {
  it("shows agent availability and current state with names instead of ids", async () => {
    search = "tab=current"
    serve({ current: [currentLab()], capacity: [capacityRow({ cpu: 4 })] })
    render(<Page />)
    expect((await screen.findAllByText("Primary")).length).toBeGreaterThan(0)
    expect(screen.getByText("Доступна")).toBeInTheDocument()
    expect(screen.queryByText(/Режим:/)).not.toBeInTheDocument()
    expect(screen.getByText("Поточний стан лабораторій")).toBeInTheDocument()
    expect(screen.getAllByText("Осінній CTF").length).toBeGreaterThan(0)
    expect(screen.getByText("Червоні")).toBeInTheDocument()
    expect(screen.queryByText("event-1")).not.toBeInTheDocument()
    expect(screen.queryByText("Часткове оновлення")).not.toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledWith("/api/infrastructure/status")
    expect(apiGet).toHaveBeenCalledWith("/api/infrastructure/monitoring/current")
    expect(apiGet).toHaveBeenCalledWith("/api/infrastructure/monitoring/capacity/current")
  })

  it("shows the translated label for the configured primary agent, not the stored name", async () => {
    serve({ status: { ...okStatus, Agents: [{ ...agent, Key: "configured-primary", Name: "" }] } })
    render(<Page />)
    expect((await screen.findAllByText("Основний агент")).length).toBeGreaterThan(0)
  })

  it("asks for recent events only when the toggle is on", async () => {
    search = "tab=current"
    render(<Page />)
    fireEvent.click(await screen.findByRole("switch", { name: "Показати недавні заходи" }))
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/api/infrastructure/monitoring/current?includeRecent=true"))
  })

  it("shows only a not-connected state, without refresh or tables, when no agent is configured", async () => {
    serve({ status: { Available: false, Healthy: false, Mode: "missing_config", Agents: [], Capabilities: { Laboratories: false }, Warning: { Code: "infrastructure_unavailable", Message: "No infrastructure agent is configured" } } })
    render(<Page />)
    expect(await screen.findByText(/Лабораторії не підключено/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Оновити/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByText("No infrastructure agent is configured")).not.toBeInTheDocument()
  })

  it("shows the reserved part of the agent capacity from protojson, and what the existing nodes give now", async () => {
    search = "tab=capacity"
    serve({ capacity: [capacityRow({
      tenant: "platform", hasCpuQuota: true, cpuQuotaMillicores: "4000", cpuReservedMillicores: "1500",
      hasMemoryQuota: true, memoryQuotaBytes: "8589934592", memoryReservedBytes: "3221225472",
      hasCurrent: true, currentCpuMillicores: "2000", currentMemoryBytes: "4294967296",
    })] })
    render(<Page />)
    const cpu = await screen.findByRole("progressbar", { name: "CPU агента Primary" })
    expect(cpu).toHaveAttribute("aria-valuenow", "1500")
    expect(cpu).toHaveAttribute("aria-valuemax", "4000")
    const memory = screen.getByRole("progressbar", { name: "Памʼять агента Primary" })
    expect(memory).toHaveAttribute("aria-valuenow", "3221225472")
    expect(memory).toHaveAttribute("aria-valuemax", "8589934592")
    expect(screen.getByText(/Зараз на наявних вузлах: 2 vCPU і 4 ГіБ/)).toBeInTheDocument()
    expect(document.getElementById("capacity")).not.toBeNull()
  })

  it("keeps an overcommitted resource bar accessible without hiding its real usage", async () => {
    search = "tab=capacity"
    serve({ capacity: [capacityRow({ tenant: "platform", hasCpuQuota: true, cpuQuotaMillicores: "4000", cpuReservedMillicores: "5000" })] })
    render(<Page />)
    const cpu = await screen.findByRole("progressbar", { name: "CPU агента Primary" })
    expect(cpu).toHaveAttribute("aria-valuenow", "4000")
    expect(cpu).toHaveAttribute("aria-valuemax", "4000")
    expect(screen.getByText("5 vCPU / 4 vCPU")).toBeInTheDocument()
    expect(screen.getByText("Перевищено доступну ємність.")).toBeInTheDocument()
  })

  it("says an unhealthy agent once: one chip, one reason line, the agent row keeps its own chip", async () => {
    serve({ status: { ...okStatus, Healthy: false, Mode: "unhealthy", Agents: [{ ...agent, Healthy: false }], Warning: { Code: "agent_unhealthy", Message: "x" } } })
    render(<Page />)
    expect(await screen.findByText("Потребує уваги")).toBeInTheDocument()
    expect(screen.queryByText(/Режим:/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/потребує уваги/i)).toHaveLength(1)
    expect(screen.getByRole("alert")).toHaveTextContent("Агент лабораторій не відповідає")
    expect(screen.getByText("Недоступний")).toBeInTheDocument()
  })

  it("keeps agent status visible when the current state fails to load", async () => {
    search = "tab=current"
    serve({ current: new Error("monitoring unavailable") })
    render(<Page />)
    expect(await screen.findByText("Доступна")).toBeInTheDocument()
    expect(screen.getByText("Не вдалося завантажити спостереження лабораторій.")).toBeInTheDocument()
    expect(screen.queryByText("Немає даних про поточний стан лабораторій.")).not.toBeInTheDocument()
  })

  it("keeps agent status visible when capacity fails to load", async () => {
    search = "tab=capacity"
    serve({ capacity: new Error("capacity unavailable") })
    render(<Page />)
    expect(await screen.findByText("Доступна")).toBeInTheDocument()
    expect(screen.getByText("Не вдалося завантажити ресурси кластера.")).toBeInTheDocument()
    expect(screen.queryByText("Немає даних про ресурси кластера.")).not.toBeInTheDocument()
  })

  it("shows resource, VPN traffic, access-rule, and deletion facts without exposing secret fields", async () => {
    search = "tab=current"
    serve({ current: [currentLab({ LabGroupName: "team-a", Payload: {
      groups: [{ name: "team-a", status: { phase: "Ready", vpnRegistered: true } }],
      labs: [{ name: "web-lab", status: { phase: "Running", ready: true, devices: [{ name: "web", usageAvailable: true, cpuMillicores: "250", memoryBytes: "104857600", restartCount: 2 }] }, specJson: "hidden-spec" }],
      clients: [{ name: "vpn-client", publicKey: "hidden-key", status: { assignedIp: "10.0.0.2", ready: true, config: "hidden-config", statistics: { rxBytes: "1048576", txBytes: "2097152" } } }],
      policies: [{ status: { state: "Applied", rules: [{ clientName: "vpn-client", labName: "web-lab", action: "LAB_GROUP_ACCESS_ACTION_DENY", packets: "5", bytes: "4096" }] } }],
      deletedKeys: [{ kind: "lab", labGroupName: "team-a", name: "old-lab" }],
    } })] })
    render(<Page />)
    fireEvent.click(await screen.findByText("Переглянути показники"))
    expect(screen.getByText("web-lab")).toBeInTheDocument()
    expect(screen.getByText("web")).toBeInTheDocument()
    expect(screen.getByText("CPU: 250 мілі-ядер")).toBeInTheDocument()
    expect(screen.getByText("Отримано: 1 МіБ")).toBeInTheDocument()
    expect(screen.getByText("Передано: 2 МіБ")).toBeInTheDocument()
    expect(screen.getByText("Заборонено")).toBeInTheDocument()
    expect(screen.getByText("5 пакетів, 4 КіБ")).toBeInTheDocument()
    expect(screen.getByText("Видалено: old-lab")).toBeInTheDocument()
    expect(screen.queryByText(/hidden-spec|hidden-key|hidden-config/)).not.toBeInTheDocument()
  })

  describe("auto-refresh", () => {
    const listCalls = () => apiGet.mock.calls.filter((c) => String(c[0]).endsWith("/status")).length
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden })
      document.dispatchEvent(new Event("visibilitychange"))
    }
    afterEach(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }) })

    it("polls every 20 seconds, pauses while the tab is hidden and resumes when visible", async () => {
      vi.useFakeTimers()
      render(<Page />)
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(listCalls()).toBe(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
      expect(listCalls()).toBe(2)
      setHidden(true)
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
      expect(listCalls()).toBe(2)
      setHidden(false)
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(listCalls()).toBe(3)
    })

    it("shows how long ago the data was updated", async () => {
      vi.useFakeTimers()
      render(<Page />)
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(screen.getByText("Оновлено щойно")).toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
      expect(screen.getByText("Оновлено 5 с тому")).toBeInTheDocument()
    })
  })
})
