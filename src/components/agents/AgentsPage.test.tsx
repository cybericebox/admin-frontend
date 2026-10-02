import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ApiError } from "@/api/client"
import { AgentsPage } from "./AgentsPage"
import { agentState, capacityText, featureChips, parsePriority } from "./agentView"
import type { Agent } from "@/api/agents"

const apiGet = vi.fn()
const apiPost = vi.fn()
const apiPut = vi.fn()
const apiDelete = vi.fn()
let permissions = ["infrastructure.read", "infrastructure.write"]
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  apiGet: (...a: unknown[]) => apiGet(...a), apiPost: (...a: unknown[]) => apiPost(...a), apiPut: (...a: unknown[]) => apiPut(...a), apiDelete: (...a: unknown[]) => apiDelete(...a),
}))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (perm: string) => permissions.includes(perm) }) }))

const agent = (over: Partial<Agent> = {}): Agent => ({
  ID: "a1", Name: "Київ", Source: "admin", Endpoint: "agent.test:443", Enabled: true, Priority: 10, HasCA: false, InUse: false, Tenant: "tenant-a", AccessKeyID: "k1", RetiredKeys: 0, Groups: 0,
  Capacity: { CPUMillicores: 4000, MemoryBytes: 8 * 1024 ** 3, SeenAt: "2026-10-01T10:00:00Z" },
  Features: { PersistenceAvailable: true, PersistenceDefaultDebounceMs: 0, PersistenceWriteQuotaBytes: 0, PersistenceMaxFileSizeBytes: 0, PersistenceExcludedPaths: null, ImageCacheEnabled: false, ImageCacheRegistries: null, SchedulerEnabled: true, SchedulerMaxPods: 5, LabsDomain: "", VPNEndpoint: "", ProxyAccessTokenMaxTTLSeconds: 0, ProxySessionMaxTTLSeconds: 0 },
  FeaturesAt: "2026-10-01T10:00:00Z", ArchivedAt: null, CertExpiresAt: "2099-01-01T00:00:00Z", Connected: true, Healthy: true, LatencyMs: 12, Error: "", CreatedAt: "2026-09-01T00:00:00Z", UpdatedAt: "2026-09-01T00:00:00Z", ...over,
})

function serve(items: Agent[] | Error) {
  apiGet.mockImplementation((path: string) => {
    if (path.includes("/delete-preview")) return Promise.resolve({ RunningGroups: 0, FutureReservations: [] })
    return items instanceof Error ? Promise.reject(items) : Promise.resolve({ Items: items })
  })
}

beforeEach(() => {
  for (const m of [apiGet, apiPost, apiPut, apiDelete]) m.mockReset()
  permissions = ["infrastructure.read", "infrastructure.write"]
})
afterEach(() => { vi.useRealTimers() })

describe("agent view helpers", () => {
  it("derives the state, capacity, features and priority", () => {
    expect(agentState(agent())).toBe("online")
    expect(agentState(agent({ Healthy: false }))).toBe("unreachable")
    expect(agentState(agent({ Connected: false }))).toBe("offline")
    expect(agentState(agent({ ArchivedAt: "2026-10-01T00:00:00Z" }))).toBe("archived")
    expect(capacityText(agent({ Capacity: { CPUMillicores: null, MemoryBytes: null, SeenAt: "2026-10-01T10:00:00Z" } }))).toContain("без обмеження")
    expect(capacityText(agent({ Capacity: { CPUMillicores: null, MemoryBytes: null, SeenAt: null } }))).toBe("—")
    expect(featureChips(agent({ Features: null }))).toBeNull()
    expect(featureChips(agent())).toHaveLength(3)
    expect(parsePriority("0")).toBe(0)
    expect(parsePriority("10001")).toBeNull()
    expect(parsePriority("")).toBeNull()
  })
})

describe("agents page", () => {
  it("lists agents with status, source, tenant, capacity and features", async () => {
    serve([agent(), agent({ ID: "a2", Name: "Львів", Source: "env", Priority: 20, Features: null, Connected: false })])
    render(<AgentsPage />)
    const row = await screen.findByTestId("agent-a1")
    expect(within(row).getByText("На зв'язку")).toBeInTheDocument()
    expect(within(row).getByText("Додано вручну")).toBeInTheDocument()
    expect(within(row).getByText(/tenant-a/)).toBeInTheDocument()
    expect(within(row).getByText(/Збереження стану: так/)).toBeInTheDocument()
    const second = screen.getByTestId("agent-a2")
    expect(within(second).getByText("З конфігурації")).toBeInTheDocument()
    expect(within(second).getByText("Не підключено")).toBeInTheDocument()
    expect(within(second).getByText("Агент ще не повідомив свої можливості")).toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledWith("/api/infrastructure/agents")
  })

  it("shows the centered empty state and the load error with a retry", async () => {
    serve([])
    const { unmount } = render(<AgentsPage />)
    expect(await screen.findByText(/Агентів ще немає/)).toBeInTheDocument()
    unmount()
    serve(new ApiError(500, null))
    render(<AgentsPage />)
    expect(await screen.findByText("Не вдалося завантажити агентів")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Спробувати ще раз" })).toBeInTheDocument()
  })

  it("loads archived agents with the toggle", async () => {
    serve([agent()])
    render(<AgentsPage />)
    await screen.findByTestId("agent-a1")
    fireEvent.click(screen.getByRole("switch", { name: "Показати видалені" }))
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/api/infrastructure/agents?archived=1"))
  })

  it("saves the enable switch instantly and keeps the other controls enabled while it is pending", async () => {
    serve([agent(), agent({ ID: "a2", Name: "Львів", Priority: 20 })])
    let finish: (value: Agent) => void = () => undefined
    apiPut.mockImplementation(() => new Promise<Agent>((resolve) => { finish = resolve }))
    render(<AgentsPage />)
    await screen.findByTestId("agent-a1")
    const first = screen.getByRole("switch", { name: "Агент «Київ» увімкнено" })
    const second = screen.getByRole("switch", { name: "Агент «Львів» увімкнено" })
    fireEvent.click(first)
    expect(first).toHaveAttribute("aria-checked", "false")
    expect(first).toBeEnabled()
    expect(second).toBeEnabled()
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith("/api/infrastructure/agents/a1", { Name: "Київ", Priority: 10, Enabled: false, CAPEM: "" }))
    await act(async () => finish(agent({ Enabled: false })))
    expect(first).toHaveAttribute("aria-checked", "false")
  })

  it("rolls the switch back with a message when the save fails", async () => {
    serve([agent()])
    apiPut.mockRejectedValue(new ApiError(409, null, "x", undefined, 71415))
    render(<AgentsPage />)
    await screen.findByTestId("agent-a1")
    fireEvent.click(screen.getByRole("switch", { name: "Агент «Київ» увімкнено" }))
    await waitFor(() => expect(screen.getByRole("switch", { name: "Агент «Київ» увімкнено" })).toHaveAttribute("aria-checked", "true"))
  })

  it("enrolls an agent with a hidden token and maps the error code", async () => {
    serve([])
    apiPost.mockRejectedValueOnce(new ApiError(400, null, "x", undefined, 21414)).mockResolvedValueOnce(agent())
    render(<AgentsPage />)
    fireEvent.click(await screen.findByRole("button", { name: /Додати агента/ }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Додати" }))
    expect(await within(dialog).findByText("Вкажіть назву агента, до 64 символів.")).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/^Назва/), { target: { value: "Київ" } })
    fireEvent.change(within(dialog).getByLabelText(/^Адреса/), { target: { value: "https://x" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Додати" }))
    expect(await within(dialog).findByText(/хост:порт/)).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/^Адреса/), { target: { value: "agent.test:443" } })
    const token = within(dialog).getByLabelText(/^Токен реєстрації/)
    expect(token).toHaveAttribute("type", "password")
    fireEvent.change(token, { target: { value: "secret" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Додати" }))
    expect(await within(dialog).findByText("Агент відхилив токен реєстрації")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Додати" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(apiPost).toHaveBeenLastCalledWith("/api/infrastructure/agents", { Name: "Київ", Endpoint: "agent.test:443", EnrollmentToken: "secret", CAPEM: "", Enabled: true, Priority: 100 })
  })

  async function openMenu(name: string) {
    await screen.findByTestId("agent-a1")
    fireEvent.pointerDown(screen.getByRole("button", { name: "Дії з агентом «Київ»" }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole("menuitem", { name }))
  }

  it("blocks the delete while lab groups run", async () => {
    serve([agent({ Groups: 2 })])
    apiGet.mockImplementation((path: string) => path.includes("/delete-preview") ? Promise.resolve({ RunningGroups: 2, FutureReservations: [] }) : Promise.resolve({ Items: [agent({ Groups: 2 })] }))
    render(<AgentsPage />)
    await openMenu("Видалити")
    expect(await screen.findByText("Агента «Київ» не можна видалити")).toBeInTheDocument()
    expect(apiDelete).not.toHaveBeenCalled()
  })

  it("lists future reservations in the delete confirmation and deletes with confirm=1", async () => {
    serve([agent()])
    apiGet.mockImplementation((path: string) => path.includes("/delete-preview")
      ? Promise.resolve({ RunningGroups: 0, FutureReservations: [{ ReservationID: "r1", EventID: "e1", EventName: "Осінній CTF", CPUMillicores: 2000, MemoryBytes: 2 * 1024 ** 3, StartsAt: "2099-01-01T10:00:00Z", EndsAt: "2099-01-01T12:00:00Z" }] })
      : Promise.resolve({ Items: [agent()] }))
    apiDelete.mockResolvedValue({})
    render(<AgentsPage />)
    await openMenu("Видалити")
    const dialog = await screen.findByRole("alertdialog").catch(() => screen.findByRole("dialog"))
    expect(within(dialog).getByText("Осінній CTF")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Видалити" }))
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith("/api/infrastructure/agents/a1?confirm=1"))
  })

  it("hides the write actions without infrastructure.write", async () => {
    permissions = ["infrastructure.read"]
    serve([agent()])
    render(<AgentsPage />)
    await screen.findByTestId("agent-a1")
    expect(screen.queryByRole("button", { name: /Додати агента/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Дії з агентом «Київ»" })).not.toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Агент «Київ» увімкнено" })).toBeDisabled()
  })
})
