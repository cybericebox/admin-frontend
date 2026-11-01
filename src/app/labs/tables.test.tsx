import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import Page from "./page"

const apiGet = vi.fn()
const apiPost = vi.fn()
let permissions = ["infrastructure.read", "infrastructure.write"]
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: (...args: unknown[]) => apiGet(...args), apiPost: (...args: unknown[]) => apiPost(...args) }))
vi.mock("@/api/tablePrefs", () => ({ getTablePrefs: () => Promise.resolve(null), putTablePrefs: () => Promise.resolve({}), deleteTablePrefs: () => Promise.resolve() }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (perm: string) => permissions.includes(perm) }) }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }))

const agent = { ID: "agent-1", Key: "primary", Name: "Primary", Configured: true, Healthy: true }
const okStatus = { Available: true, Healthy: true, Mode: "available", Agents: [agent], Capabilities: { Laboratories: true } }
const stand = { EventID: "event-1", EventName: "Осінній CTF", EventTag: "autumn", TeamID: "team-1", TeamName: "Червоні", Moderators: false, Status: "failed", Reason: "ImagePullBackOff: web", UpdatedAt: "2026-09-24T12:00:00Z", StatusChangedAt: null, Generation: 2 }
const testLab = { ID: "lab-1", GroupName: "t-1", ExerciseID: "ex-1", ExerciseName: "Вебуразливість", VariantNumber: 2, AuthorID: "user-1", AuthorName: "Анна Лі", AuthorEmail: "ann@example.test", CreatedAt: "2026-09-24T12:00:00Z", ExpiresAt: "2026-09-25T12:00:00Z", Status: "ready", Expired: false }
const page = (Items: unknown[]) => ({ Items, Total: Items.length, Page: 1, PageSize: 50 })

function serve(stands: unknown[] = [], testLabs: unknown[] = []) {
  apiGet.mockImplementation((path: string) => {
    if (path.endsWith("/status")) return Promise.resolve(okStatus)
    if (path.endsWith("/summary")) return Promise.resolve({ Stands: { Total: 3, Creating: 0, Ready: 1, Failed: 2, Removed: 0, Active: 1 }, TestLabs: { Total: 1, Active: 1, Expired: 0 }, Capacity: { Available: true, CPUPercent: 40, MemoryPercent: 50 } })
    if (path.includes("/monitoring/")) return Promise.resolve([])
    if (path.includes("/test-labs")) return Promise.resolve(page(testLabs))
    if (path.includes("/stands/events")) return Promise.resolve([{ ID: "event-1", Name: "Осінній CTF", Tag: "autumn" }])
    if (path.includes("/stands")) return Promise.resolve(page(stands))
    return Promise.reject(new Error(path))
  })
}
const call = (needle: string) => apiGet.mock.calls.map((c) => String(c[0])).filter((path) => path.includes(needle)).at(-1)!

beforeEach(() => {
  apiGet.mockReset(); apiPost.mockReset(); window.localStorage.clear()
  permissions = ["infrastructure.read", "infrastructure.write"]
  window.history.replaceState(null, "", "/test/")
  serve()
})

describe("stands tab", () => {
  it("shows the KPI strip and the stands with sortable columns, a labelled «Перестворити» and the status filter from the dashboard link", async () => {
    window.history.replaceState(null, "", "/test/?status=failed")
    serve([stand, { ...stand, TeamID: "team-2", TeamName: "", Moderators: true, Status: "creating", Reason: "" }])
    render(<Page />)
    expect(await screen.findByText("Червоні")).toBeInTheDocument()
    expect(screen.getByText("Команда модераторів")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Генерація|Покоління/ })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Перестворити стенд/ }).length).toBeGreaterThan(0)
    await waitFor(() => expect(new URLSearchParams(call("/stands?").split("?")[1]).get("status")).toBe("failed"))
    expect(window.location.search).toContain("f.status=in%3Afailed")
  })

  it("sorts on the server by clicking a column", async () => {
    serve([stand])
    render(<Page />)
    await screen.findByText("Червоні")
    fireEvent.click(screen.getByRole("button", { name: /Покоління|Генерація/ }))
    await waitFor(() => expect(new URLSearchParams(call("/stands?").split("?")[1]).get("sortBy")).toBe("generation"))
  })

  it("recreates one stand after a danger confirmation, and several in bulk with a confirmation naming the count", async () => {
    serve([stand, { ...stand, TeamID: "team-9", TeamName: "Сірі", Status: "removed" }])
    apiPost.mockResolvedValue({ Results: [{ EventID: "event-1", TeamID: "team-1", Ok: true }] })
    render(<Page />)
    await screen.findByText("Червоні")
    // a removed stand has no «Перестворити» and cannot be selected
    expect(screen.getAllByRole("button", { name: "Перестворити стенд" })).toHaveLength(1)
    expect(screen.getByRole("checkbox", { name: /Сірі/ })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Перестворити стенд" }))
    const dialog = await screen.findByRole("dialog")
    expect(apiPost).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Перестворити" }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/infrastructure/stands/bulk/recreate", { Stands: [{ EventID: "event-1", TeamID: "team-1" }] }))
  })

  it("hides recreate and the select column without infrastructure.write", async () => {
    permissions = ["infrastructure.read"]
    serve([stand])
    render(<Page />)
    await screen.findByText("Червоні")
    expect(screen.queryByRole("button", { name: "Перестворити стенд" })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: /Вибрати всі/ })).not.toBeInTheDocument()
  })
})

describe("test labs tab", () => {
  beforeEach(() => { window.history.replaceState(null, "", "/test/?tab=testLabs") })

  it("lists the labs with author link, exercise, variant and status", async () => {
    serve([], [testLab, { ...testLab, ID: "lab-2", Status: "unknown", Expired: true, VariantNumber: 0 }])
    render(<Page />)
    const lab = (await screen.findAllByRole("link", { name: "Анна Лі" }))[0]
    expect(lab).toHaveAttribute("href", "/users/detail?id=user-1")
    expect(screen.getByText("Варіант 2")).toBeInTheDocument()
    expect(screen.getByText("Строк минув")).toBeInTheDocument()
  })

  it("finishes labs in bulk after a confirmation, with a per-lab result", async () => {
    serve([], [testLab])
    apiPost.mockResolvedValue({ Results: [{ ID: "lab-1", Ok: true }] })
    render(<Page />)
    await screen.findAllByText("Вебуразливість")
    fireEvent.click(screen.getByRole("checkbox", { name: /Вибрати всі/ }))
    fireEvent.click(within(screen.getByRole("region", { name: /Вибрані рядки/ })).getByRole("button", { name: /Завершити/ }))
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Завершити" }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/infrastructure/test-labs/bulk/terminate", { IDs: ["lab-1"] }))
  })
})
