import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
const stand = { EventID: "event-1", EventName: "Осінній CTF", EventTag: "autumn", TeamID: "team-1", TeamName: "Червоні", Moderators: false, Status: "failed", Reason: "ImagePullBackOff: web", UpdatedAt: "2026-09-24T12:00:00Z", StatusChangedAt: "2026-09-24T12:00:00Z", Generation: 2 }
const currentLab = (over: object = {}) => ({ EventID: "event-1", EventName: "Осінній CTF", EventTeamID: "team-1", TeamName: "Червоні", LabGroupName: "e-1-t-1", AgentID: "agent-1", Sequence: 8, ObservedAt: "2026-09-24T12:00:00Z", UpdatedAt: "2026-09-24T12:00:00Z", Payload: {}, ...over })
const testLab = { ID: "lab-1", GroupName: "t-1", ExerciseID: "ex-1", ExerciseName: "Вебуразливість", VariantNumber: 2, AuthorID: "user-1", AuthorName: "Анна Лі", AuthorEmail: "ann@example.test", CreatedAt: "2026-09-24T10:00:00Z", ExpiresAt: "2026-09-24T12:00:00Z", Expired: false, Status: "ready" }
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
    serve({ current: [currentLab()], capacity: [capacityRow({ cpu: 4 })] })
    render(<Page />)
    expect((await screen.findAllByText("Primary")).length).toBeGreaterThan(0)
    expect(screen.getByText("Режим: доступно")).toBeInTheDocument()
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

  it("shows requested versus allocatable CPU and memory from protojson capacity", async () => {
    serve({ capacity: [capacityRow({
      allocatableCpuMillicores: "4000", requestedCpuMillicores: "1500",
      allocatableMemoryBytes: "8589934592", requestedMemoryBytes: "3221225472",
      nodes: [{ name: "node-a", allocatableCpuMillicores: "4000", requestedCpuMillicores: "1500", allocatableMemoryBytes: "8589934592", requestedMemoryBytes: "3221225472" }],
    })] })
    render(<Page />)
    const cpu = await screen.findByRole("progressbar", { name: "CPU агента Primary" })
    expect(cpu).toHaveAttribute("aria-valuenow", "1500")
    expect(cpu).toHaveAttribute("aria-valuemax", "4000")
    const memory = screen.getByRole("progressbar", { name: "Пам’ять агента Primary" })
    expect(memory).toHaveAttribute("aria-valuenow", "3221225472")
    expect(memory).toHaveAttribute("aria-valuemax", "8589934592")
    expect(screen.getByText("node-a")).toBeInTheDocument()
    expect(document.getElementById("capacity")).not.toBeNull()
  })

  it("keeps an overcommitted resource bar accessible without hiding its real usage", async () => {
    serve({ capacity: [capacityRow({ allocatableCpuMillicores: "4000", requestedCpuMillicores: "5000" })] })
    render(<Page />)
    const cpu = await screen.findByRole("progressbar", { name: "CPU агента Primary" })
    expect(cpu).toHaveAttribute("aria-valuenow", "4000")
    expect(cpu).toHaveAttribute("aria-valuemax", "4000")
    expect(screen.getByText("5 vCPU / 4 vCPU")).toBeInTheDocument()
    expect(screen.getByText("Перевищено доступну ємність.")).toBeInTheDocument()
  })

  it("keeps agent status visible when the current state fails to load", async () => {
    serve({ current: new Error("monitoring unavailable") })
    render(<Page />)
    expect(await screen.findByText("Режим: доступно")).toBeInTheDocument()
    expect(screen.getByText("Не вдалося завантажити спостереження лабораторій.")).toBeInTheDocument()
    expect(screen.queryByText("Немає даних про поточний стан лабораторій.")).not.toBeInTheDocument()
  })

  it("keeps agent status visible when capacity fails to load", async () => {
    serve({ capacity: new Error("capacity unavailable") })
    render(<Page />)
    expect(await screen.findByText("Режим: доступно")).toBeInTheDocument()
    expect(screen.getByText("Не вдалося завантажити ресурси кластера.")).toBeInTheDocument()
    expect(screen.queryByText("Немає даних про ресурси кластера.")).not.toBeInTheDocument()
  })

  it("shows resource, VPN traffic, access-rule, and deletion facts without exposing secret fields", async () => {
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
    expect(screen.getByText("CPU: 0,25 vCPU")).toBeInTheDocument()
    expect(screen.getByText("Отримано: 1 МіБ")).toBeInTheDocument()
    expect(screen.getByText("Передано: 2 МіБ")).toBeInTheDocument()
    expect(screen.getByText("Заборонено")).toBeInTheDocument()
    expect(screen.getByText("5 пакетів, 4 КіБ")).toBeInTheDocument()
    expect(screen.getByText("Видалено: old-lab")).toBeInTheDocument()
    expect(screen.queryByText(/hidden-spec|hidden-key|hidden-config/)).not.toBeInTheDocument()
  })

  describe("stands", () => {
    it("renders the stands table with the event site link and applies URL filters", async () => {
      search = "status=failed&eventId=event-1"
      serve({ stands: { Items: [stand, { ...stand, TeamID: "team-2", TeamName: "", Moderators: true, Status: "creating", Reason: "" }], Total: 2, Page: 1, PageSize: 25 } })
      render(<Page />)
      const table = (await screen.findByText("Червоні")).closest("table") as HTMLElement
      expect(within(table).getByText("ImagePullBackOff: web")).toBeInTheDocument()
      expect(within(table).getByText("Команда модераторів")).toBeInTheDocument()
      expect(within(table).getByText("Помилка")).toBeInTheDocument()
      expect(within(table).getByText("Готується")).toBeInTheDocument()
      // The link into /manage carries this admin page, so the event can offer the way back.
      const eventLink = new URL(within(table).getAllByRole("link")[0].getAttribute("href") ?? "")
      expect(eventLink.origin + eventLink.pathname).toBe("https://autumn.localhost/manage/labs")
      expect(eventLink.searchParams.get("from")).toBe(window.location.href)
      const call = apiGet.mock.calls.map((c) => c[0] as string).find((path) => path.startsWith("/api/infrastructure/stands?"))!
      const query = new URLSearchParams(call.split("?")[1])
      expect(query.get("status")).toBe("failed")
      expect(query.get("eventId")).toBe("event-1")
      expect(query.get("page")).toBe("1")
    })

    it("sends the search text to the API after a pause", async () => {
      render(<Page />)
      fireEvent.change(await screen.findByLabelText("Пошук за заходом або командою"), { target: { value: "red" } })
      await waitFor(() => expect(apiGet.mock.calls.some((c) => String(c[0]).includes("/stands?") && String(c[0]).includes("search=red"))).toBe(true))
    })

    it("shows a centered empty state when nothing matches", async () => {
      render(<Page />)
      expect(await screen.findByText("Стендів ще немає.")).toBeInTheDocument()
    })

    it("hides the recreate action without infrastructure.write", async () => {
      permissions = ["infrastructure.read"]
      serve({ stands: { Items: [stand], Total: 1, Page: 1, PageSize: 25 } })
      render(<Page />)
      await screen.findByText("Червоні")
      expect(screen.queryByRole("button", { name: /Перестворити стенд/ })).not.toBeInTheDocument()
    })

    it("recreates a stand after confirmation naming the event and team", async () => {
      serve({ stands: { Items: [stand, { ...stand, TeamID: "team-9", TeamName: "Сірі", Status: "removed" }], Total: 2, Page: 1, PageSize: 25 } })
      apiPost.mockResolvedValue({})
      render(<Page />)
      await screen.findByText("Червоні")
      expect(screen.getAllByRole("button", { name: /Перестворити стенд/ })).toHaveLength(1)
      fireEvent.click(screen.getByRole("button", { name: /Перестворити стенд/ }))
      const dialog = await screen.findByRole("dialog")
      expect(dialog).toHaveTextContent("«Червоні»")
      expect(dialog).toHaveTextContent("«Осінній CTF»")
      expect(dialog).toHaveTextContent("VPN-конфігурації залишаться чинними")
      expect(apiPost).not.toHaveBeenCalled()
      fireEvent.click(within(dialog).getByRole("button", { name: "Перестворити" }))
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/infrastructure/stands/event-1/team-1/recreate", {}))
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    })

    it("keeps the dialog open with a localized error when recreating fails", async () => {
      serve({ stands: { Items: [stand], Total: 1, Page: 1, PageSize: 25 } })
      apiPost.mockRejectedValue(new Error("boom"))
      render(<Page />)
      await screen.findByText("Червоні")
      fireEvent.click(screen.getByRole("button", { name: /Перестворити стенд/ }))
      fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Перестворити" }))
      expect(await screen.findByRole("alert")).toBeInTheDocument()
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
  })

  describe("stand kind filter", () => {
    it("sends the kind to the API and keeps it in the filtered empty state", async () => {
      search = "kind=moderators"
      render(<Page />)
      expect(await screen.findByText("За цими умовами стендів не знайдено.")).toBeInTheDocument()
      const call = apiGet.mock.calls.map((c) => c[0] as string).find((path) => path.startsWith("/api/infrastructure/stands?"))!
      expect(new URLSearchParams(call.split("?")[1]).get("kind")).toBe("moderators")
    })
  })

  describe("test labs", () => {
    it("lists catalog test labs with author, exercise, variant, lease and live status", async () => {
      serve({ testLabs: { Items: [testLab, { ...testLab, ID: "lab-2", Status: "unknown", Expired: true, VariantNumber: 0 }], Total: 2, Page: 1, PageSize: 25 } })
      render(<Page />)
      const table = (await screen.findAllByText("Вебуразливість"))[0].closest("table") as HTMLElement
      expect(screen.getByText("Тестові лабораторії завдань")).toBeInTheDocument()
      expect(within(table).getAllByRole("link", { name: "Анна Лі" })[0]).toHaveAttribute("href", "/users/detail?id=user-1")
      expect(within(table).getAllByText("ann@example.test")[0]).toBeInTheDocument()
      expect(within(table).getAllByRole("link", { name: /Вебуразливість/ })[0].getAttribute("href")).toMatch(/\/detail\?id=ex-1$/)
      expect(within(table).getByText("Варіант 2")).toBeInTheDocument()
      expect(within(table).getByText("Готова")).toBeInTheDocument()
      expect(within(table).getByText("Невідомо")).toBeInTheDocument()
      expect(within(table).getByText("Строк минув")).toBeInTheDocument()
    })

    it("shows a centered empty state and a load error with retry", async () => {
      render(<Page />)
      expect(await screen.findByText("Тестових лабораторій зараз немає.")).toBeInTheDocument()
      serve({ testLabs: new Error("boom") })
      fireEvent.click(screen.getByRole("button", { name: /Оновити/ }))
      expect(await screen.findByText("Не вдалося завантажити тестові лабораторії.")).toBeInTheDocument()
    })

    it("searches through the API after a pause", async () => {
      render(<Page />)
      fireEvent.change(await screen.findByLabelText("Пошук за завданням або автором"), { target: { value: "web" } })
      await waitFor(() => expect(apiGet.mock.calls.some((c) => String(c[0]).includes("/test-labs?") && String(c[0]).includes("search=web"))).toBe(true))
    })

    it("hides the end action without infrastructure.write", async () => {
      permissions = ["infrastructure.read"]
      serve({ testLabs: { Items: [testLab], Total: 1, Page: 1, PageSize: 25 } })
      render(<Page />)
      await screen.findByText("Вебуразливість")
      expect(screen.queryByRole("button", { name: /Завершити лабораторію/ })).not.toBeInTheDocument()
    })

    it("ends a lab after a danger confirmation naming the exercise and author", async () => {
      serve({ testLabs: { Items: [testLab], Total: 1, Page: 1, PageSize: 25 } })
      apiPost.mockResolvedValue({})
      render(<Page />)
      await screen.findByText("Вебуразливість")
      fireEvent.click(screen.getByRole("button", { name: /Завершити лабораторію/ }))
      const dialog = await screen.findByRole("dialog")
      expect(dialog).toHaveTextContent("«Вебуразливість»")
      expect(dialog).toHaveTextContent("«Анна Лі»")
      expect(apiPost).not.toHaveBeenCalled()
      fireEvent.click(within(dialog).getByRole("button", { name: "Завершити" }))
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/infrastructure/test-labs/lab-1/terminate", {}))
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    })

    it("keeps the dialog open with a localized error when ending fails", async () => {
      serve({ testLabs: { Items: [testLab], Total: 1, Page: 1, PageSize: 25 } })
      apiPost.mockRejectedValue(new Error("boom"))
      render(<Page />)
      await screen.findByText("Вебуразливість")
      fireEvent.click(screen.getByRole("button", { name: /Завершити лабораторію/ }))
      fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Завершити" }))
      expect(await screen.findByRole("alert")).toBeInTheDocument()
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
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
      expect(screen.getByText("Оновлено 0 с тому")).toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
      expect(screen.getByText("Оновлено 5 с тому")).toBeInTheDocument()
    })
  })
})
