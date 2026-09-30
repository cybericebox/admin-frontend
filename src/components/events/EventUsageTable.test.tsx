import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ApiError } from "@/api/client"

const mock = vi.hoisted(() => ({ usage: vi.fn() }))
vi.mock("@/i18n/t", () => ({ t: (key: string, vars?: Record<string, unknown>) => vars ? `${key}${JSON.stringify(vars)}` : key }))
vi.mock("@/api/events/analytics", async (importActual) => ({ ...(await importActual<typeof import("@/api/events/analytics")>()), getEventAnalyticsUsage: mock.usage }))

import { EventUsageTable, usageState } from "./EventUsageTable"

const at = "2026-10-01T10:00:00Z"
const none = { Sessions: 0, Seconds: 0, RxBytes: 0, TxBytes: 0, Recent: [] }
const noProxy = { Requests: 0, BytesIn: 0, BytesOut: 0, FirstAt: null, LastAt: null }
const summary = { Users: 3, OnlineNow: 1, VPNUsers: 2, ProxyUsers: 1, Sessions: 3, OnlineSeconds: 600, RxBytes: 1024, TxBytes: 2048, ProxyRequests: 12, ProxyBytes: 4096 }
const report = {
  Available: true, At: at, Summary: summary,
  Users: [
    { UserID: "u-bob", UserName: "Bob", TeamID: "t2", TeamName: "Red", VPN: { Online: false, LastHandshakeAt: at, FirstAt: at, Sessions: 1, Seconds: 0, RxBytes: 0, TxBytes: 0, Recent: [] }, Proxy: noProxy, Labs: [] },
    { UserID: "u-ann", UserName: "Ann", TeamID: "t1", TeamName: "Blue",
      VPN: { Online: true, LastHandshakeAt: at, FirstAt: at, Sessions: 2, Seconds: 600, RxBytes: 1024, TxBytes: 2048, Recent: [{ StartedAt: at, EndedAt: at, Seconds: 600, RxBytes: 1024, TxBytes: 2048 }] },
      Proxy: { Requests: 12, BytesIn: 3072, BytesOut: 1024, FirstAt: at, LastAt: at },
      Labs: [{ ChallengeID: "c1", Task: "Web login", Surface: "proxy" as const, Attempts: 12, BytesIn: 3072, BytesOut: 1024, FirstAt: at, LastAt: at }] },
    { UserID: "u-cid", UserName: "", TeamID: "t2", TeamName: "Red", VPN: { Online: false, LastHandshakeAt: null, FirstAt: null, ...none }, Proxy: noProxy, Labs: [] },
  ],
}

beforeEach(() => { vi.clearAllMocks(); mock.usage.mockResolvedValue(report) })

describe("EventUsageTable", () => {
  it("lists online participants first and marks the ones that never connected", async () => {
    render(<EventUsageTable eventID="event-1" />)
    const table = await screen.findByRole("table", { name: "admin.events.analytics.usage.tableLabel" })
    const rows = within(table).getAllByRole("row").slice(1)
    expect(within(rows[0]).getByText("Ann")).toBeInTheDocument()
    expect(within(rows[0]).getByText("admin.events.analytics.usage.state.online")).toBeInTheDocument()
    expect(within(rows[1]).getByText("Bob")).toBeInTheDocument()
    expect(within(rows[1]).getByText("admin.events.analytics.usage.state.offline")).toBeInTheDocument()
    expect(within(rows[2]).getByText("admin.events.analytics.usage.unnamed")).toBeInTheDocument()
    expect(within(rows[2]).getByText("admin.events.analytics.usage.state.never")).toBeInTheDocument()
    expect(mock.usage).toHaveBeenCalledWith("event-1")
  })

  it("opens the sessions and the task access of a participant", async () => {
    render(<EventUsageTable eventID="event-1" />)
    await screen.findByRole("table")
    expect(screen.queryByText("Web login")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: `admin.events.analytics.usage.toggle${JSON.stringify({ name: "Ann" })}` }))
    expect(await screen.findByText("Web login")).toBeInTheDocument()
    expect(screen.getByText("admin.events.analytics.usage.surface.proxy")).toBeInTheDocument()
  })

  it("says so when the event has no infrastructure", async () => {
    mock.usage.mockResolvedValue({ ...report, Available: false, Users: [] })
    render(<EventUsageTable eventID="event-1" />)
    expect(await screen.findByText("admin.events.analytics.usage.unavailable")).toBeInTheDocument()
    expect(screen.queryByRole("table")).toBeNull()
  })

  it("shows the no-access state on a 403 and the load error otherwise", async () => {
    mock.usage.mockRejectedValue(new ApiError(403, null))
    const { unmount } = render(<EventUsageTable eventID="event-1" />)
    expect(await screen.findByText("admin.events.analytics.noAccess")).toBeInTheDocument()
    unmount()
    mock.usage.mockRejectedValue(new Error("boom"))
    render(<EventUsageTable eventID="event-1" />)
    await waitFor(() => expect(screen.getByText("admin.events.analytics.usage.loadFailed")).toBeInTheDocument())
  })
})

describe("usageState", () => {
  it("follows the server's online flag and the last handshake only", () => {
    const user = (Online: boolean, last: string | null) => ({ VPN: { Online, LastHandshakeAt: last } }) as Parameters<typeof usageState>[0]
    expect(usageState(user(true, at))).toBe("online")
    expect(usageState(user(false, at))).toBe("offline")
    expect(usageState(user(false, null))).toBe("never")
  })
})
