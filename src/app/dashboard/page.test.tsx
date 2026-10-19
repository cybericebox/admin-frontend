import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import Page from "./page"

const api = vi.hoisted(() => ({ get: vi.fn(), events: vi.fn() }))
vi.mock("@/api/client", () => ({ apiGet: api.get }))
vi.mock("@/api/events/catalog", () => ({ listEvents: api.events }))
const rights = vi.hoisted(() => ({ denied: new Set<string>() }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => !rights.denied.has(permission) }) }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))

describe("operational overview", () => {
  beforeEach(() => {
    rights.denied = new Set()
    api.get.mockReset()
    api.events.mockReset()
    api.get.mockImplementation((path: string) => {
      if (path === "/api/users/stats") return Promise.resolve({ Total: 12 })
      if (path === "/api/infrastructure/status") return Promise.resolve({ Available: false, Healthy: false, agents: [] })
      if (path === "/api/infrastructure/summary") return Promise.resolve({ Stands: { Total: 9, Creating: 1, Ready: 6, Failed: 2, Removed: 0, Active: 7 }, TestLabs: { Total: 4, Active: 3, Expired: 1 }, Capacity: { Available: true, CPUPercent: 42.5, MemoryPercent: null } })
      if (path.startsWith("/api/notifications/stats")) return Promise.resolve({ Total: 20, ByStatus: [] })
      return Promise.reject(new Error(path))
    })
    api.events.mockResolvedValue({ Items: [{ ID: "e1", Name: "Осінній CTF", Tag: "autumn", Status: "active" }], Total: 1 })
  })

  it("shows real platform signals and paths to the corresponding sections", async () => {
    render(<Page />)
    expect(await screen.findByText("Осінній CTF")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("admin.dashboard.infra.disconnected")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "admin.dashboard.allEvents" })).toHaveAttribute("href", "/events")
    expect(api.get).toHaveBeenCalledWith("/api/infrastructure/status")
    expect(api.get).toHaveBeenCalledWith("/api/users/stats")
  })

  it("counts failed deliveries per channel, even when the dispatch itself is done", async () => {
    api.get.mockImplementation((path: string) => {
      if (path.startsWith("/api/notifications/stats")) return Promise.resolve({ Total: 2, ByStatus: [{ Key: "done", Count: 2 }], ByChannel: [{ Channel: "email", Status: "error", Count: 2 }, { Channel: "inapp", Status: "done", Count: 2 }] })
      if (path === "/api/users/stats") return Promise.resolve({ Total: 12 })
      return Promise.reject(new Error(path))
    })
    render(<Page />)
    const tile = (await screen.findByText("admin.dashboard.deliveryErrors7d")).closest("a")!
    await waitFor(() => expect(tile).toHaveTextContent("2"))
  })

  it("shows stand and cluster tiles that click through to the filtered labs list", async () => {
    render(<Page />)
    const failed = (await screen.findByText("admin.dashboard.standsFailed")).closest("a")!
    expect(failed).toHaveAttribute("href", "/labs?status=failed")
    expect(failed).toHaveTextContent("2")
    const active = screen.getByText("admin.dashboard.standsActive").closest("a")!
    expect(active).toHaveAttribute("href", "/labs?status=active")
    // Team stands (7) and catalog test labs (3) are all labs on the infrastructure.
    expect(active).toHaveTextContent("10")
    expect(active).toHaveTextContent("admin.dashboard.testLabsActive")
    const cpu = screen.getByText("admin.dashboard.clusterCpu").closest("a")!
    expect(cpu).toHaveAttribute("href", "/labs#capacity")
    expect(cpu).toHaveTextContent("42,5%")
    expect(screen.getByText("admin.dashboard.clusterMemory").closest("a")).toHaveTextContent("—")
  })

  it("polls the infrastructure tiles and pauses while the tab is hidden", async () => {
    vi.useFakeTimers()
    const statusCalls = () => api.get.mock.calls.filter((c) => c[0] === "/api/infrastructure/summary").length
    render(<Page />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(statusCalls()).toBe(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(statusCalls()).toBe(2)
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true })
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(statusCalls()).toBe(2)
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false })
    vi.useRealTimers()
  })

  it("keeps available sections visible if one feed fails", async () => {
    api.get.mockImplementation((path: string) => path === "/api/users/stats" ? Promise.reject(new Error("users")) : Promise.resolve({ Available: false, Healthy: false, agents: [], Total: 20, ByStatus: [] }))
    render(<Page />)
    expect(await screen.findByText("Осінній CTF")).toBeInTheDocument()
    expect(screen.getByText("admin.dashboard.infra.disconnected")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("admin.dashboard.partialError")
  })

  it("retries failed overview data without leaving the page", async () => {
    let attempts = 0
    api.get.mockImplementation((path: string) => {
      if (path === "/api/users/stats") return ++attempts === 1 ? Promise.reject(new Error("offline")) : Promise.resolve({ Total: 12 })
      if (path === "/api/infrastructure/status") return Promise.resolve({ Available: false, Healthy: false })
      if (path.startsWith("/api/notifications/stats")) return Promise.resolve({ Total: 20, ByStatus: [] })
      return Promise.reject(new Error(path))
    })
    render(<Page />)
    fireEvent.click(await screen.findByRole("button", { name: "error.load.retry" }))
    await waitFor(() => expect(screen.getByText("12")).toBeInTheDocument())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("sends the users tile to the analytics page with analytics.read and to the users list without it", async () => {
    const { unmount } = render(<Page />)
    expect((await screen.findByText("admin.dashboard.users")).closest("a")).toHaveAttribute("href", "/analytics/users")
    unmount()
    rights.denied = new Set(["analytics.read"])
    render(<Page />)
    expect((await screen.findByText("admin.dashboard.users")).closest("a")).toHaveAttribute("href", "/users")
  })

  it("links each recent event to its page and shows the same lifecycle status as the events list", async () => {
    api.events.mockResolvedValue({ Items: [{ ID: "e1", Name: "Осінній CTF", Tag: "autumn", Status: "active", LifecycleStatus: "started" }], Total: 1 })
    render(<Page />)
    expect(await screen.findByRole("link", { name: "Осінній CTF" })).toHaveAttribute("href", "/events/detail?id=e1")
    expect(screen.getByText("admin.events.lifecycle.started")).toBeInTheDocument()
  })
})
