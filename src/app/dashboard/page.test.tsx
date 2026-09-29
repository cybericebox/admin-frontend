import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import Page from "./page"

const api = vi.hoisted(() => ({ get: vi.fn(), events: vi.fn() }))
vi.mock("@/api/client", () => ({ apiGet: api.get }))
vi.mock("@/api/events/catalog", () => ({ listEvents: api.events }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))

describe("operational overview", () => {
  beforeEach(() => {
    api.get.mockReset()
    api.events.mockReset()
    api.get.mockImplementation((path: string) => {
      if (path === "/api/users/stats") return Promise.resolve({ Total: 12 })
      if (path === "/api/infrastructure/status") return Promise.resolve({ Available: false, Healthy: false, agents: [] })
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
    expect(screen.queryByRole("link", { name: "Осінній CTF" })).not.toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith("/api/infrastructure/status")
    expect(api.get).toHaveBeenCalledWith("/api/users/stats")
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
    fireEvent.click(await screen.findByRole("button", { name: "admin.dashboard.retry" }))
    await waitFor(() => expect(screen.getByText("12")).toBeInTheDocument())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
