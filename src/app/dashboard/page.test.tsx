import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import Page from "./page"

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/api/client", () => ({ apiGet: api.get }))
const rights = vi.hoisted(() => ({ denied: new Set<string>() }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => !rights.denied.has(permission) }) }))
vi.mock("@/i18n/t", () => ({ t: (key: string, vars?: Record<string, unknown>) => vars ? `${key}:${JSON.stringify(vars)}` : key }))

const wire = {
  Attention: [
    { Kind: "failed_stands", Count: 2, Target: "stands", Items: [{ ID: "s1", Label: "Осінній CTF · Лисиці", Count: 1, At: null }] },
    { Kind: "events_without_reservation", Count: 1, Target: "reservations", Items: [{ ID: "e9", Label: "Весняний CTF", Count: 0, At: null }] },
    { Kind: "open_errors", Count: 1, Target: "errors", Items: [] },
  ],
  CurrentAndUpcoming: [{ EventID: "e1", Name: "Осінній CTF", Tag: "autumn", StartAt: "2026-11-02T09:00:00Z", FinishAt: null, Running: true, Participants: 40, Teams: 10, StandsReady: 8, StandsTotal: 10 }],
  Trends7d: { Days: ["1", "2", "3", "4", "5", "6", "7"], Registrations: [1, 2, 3, 4, 5, 6, 7], ActiveUsers: [2, 2, 2, 2, 2, 2, 2], Solves: [0, 0, 0, 0, 0, 0, 0] },
  Infrastructure: { CPUAllocatableMillicores: 8000, CPUReservedMillicores: 3320, MemoryAllocatableBytes: 1000, MemoryReservedBytes: 600, Agents: 2, ActiveStands: 7, FailedStands: 2 },
}
const summary = wire

describe("dashboard", () => {
  beforeEach(() => {
    rights.denied = new Set()
    api.get.mockReset()
    api.get.mockResolvedValue(summary)
  })

  it("lists what needs attention as links to the place to fix it", async () => {
    render(<Page />)
    const stands = await screen.findByRole("link", { name: /admin.dashboard.attention.failed_stands/ })
    expect(stands).toHaveAttribute("href", "/labs?status=failed")
    expect(screen.getByRole("link", { name: "Осінній CTF · Лисиці" })).toHaveAttribute("href", "/labs?status=failed")
    expect(screen.getByRole("link", { name: "Весняний CTF" })).toHaveAttribute("href", "/events/detail?id=e9")
    expect(screen.getByRole("link", { name: /admin.dashboard.attention.open_errors/ })).toHaveAttribute("href", "/errors")
  })

  it("shows running events with their counts, the 7-day trends and the infrastructure", async () => {
    render(<Page />)
    expect(await screen.findByRole("link", { name: "Осінній CTF" })).toHaveAttribute("href", "/events/detail?id=e1")
    expect(screen.getByText(/admin.dashboard.eventCounts.*"stands":"8\/10"/)).toBeInTheDocument()
    expect(screen.getAllByRole("img", { name: /admin.dashboard.trendLabel/ })).toHaveLength(3)
    expect(screen.getByText("41,5%")).toBeInTheDocument()
    expect(screen.getByText("60%")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "admin.dashboard.action.createEvent" })).toHaveAttribute("href", "/events/new")
    expect(screen.getByRole("link", { name: "admin.dashboard.action.invite" })).toHaveAttribute("href", "/users?invite=1")
  })

  it("hides a block the backend did not send and the actions the person may not use", async () => {
    rights.denied = new Set(["events.write", "users.invite"])
    api.get.mockResolvedValue({ Attention: [], CurrentAndUpcoming: null, Trends7d: null, Infrastructure: null })
    render(<Page />)
    expect(await screen.findByText("admin.dashboard.attentionNone")).toBeInTheDocument()
    expect(screen.queryByText("admin.dashboard.nowSoon")).not.toBeInTheDocument()
    expect(screen.queryByText("admin.dashboard.trends")).not.toBeInTheDocument()
    expect(screen.queryByText("admin.dashboard.infrastructure")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "admin.dashboard.action.createEvent" })).not.toBeInTheDocument()
  })

  it("offers a retry when the first load fails and keeps the page when a refresh fails", async () => {
    api.get.mockRejectedValueOnce(new Error("offline"))
    render(<Page />)
    expect(await screen.findByText("admin.dashboard.loadError")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "error.load.retry" }))
    expect(await screen.findByRole("link", { name: /failed_stands/ })).toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  })
})
