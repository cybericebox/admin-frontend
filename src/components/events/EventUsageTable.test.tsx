import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ApiError } from "@/api/client"

const mock = vi.hoisted(() => ({ usage: vi.fn() }))
vi.mock("@/i18n/t", () => ({ t: (key: string, vars?: Record<string, unknown>) => vars ? `${key}${JSON.stringify(vars)}` : key }))
vi.mock("@/api/events/analytics", async (importActual) => ({ ...(await importActual<typeof import("@/api/events/analytics")>()), getEventAnalyticsUsage: mock.usage }))

import { EventUsageTable, usageState } from "./EventUsageTable"
import en from "../../../messages/en.json"
import uk from "../../../messages/uk.json"

const at = "2026-10-01T10:00:00Z"
const none = { Sessions: 0, Seconds: 0, RxBytes: 0, TxBytes: 0, Recent: [] }
const noProxy = { Requests: 0, BytesIn: 0, BytesOut: 0, FirstAt: null, LastAt: null }
const summary = { Users: 3, OnlineNow: 1, VPNUsers: 2, ProxyUsers: 1, Sessions: 3, OnlineSeconds: 600, RxBytes: 1024, TxBytes: 2048, ProxyRequests: 12, ProxyBytes: 4096 }
const report = {
  Available: true, At: at, Summary: summary,
  Users: [
    { UserID: "u-bob", UserName: "Bob", TeamID: "t2", TeamName: "Red", LastSeenAt: null, LastLabAt: null, VPN: { Online: false, LastHandshakeAt: at, FirstAt: at, Sessions: 1, Seconds: 0, RxBytes: 0, TxBytes: 0, Recent: [] }, Proxy: noProxy, Labs: [] },
    { UserID: "u-ann", UserName: "Ann", TeamID: "t1", TeamName: "Blue", LastSeenAt: at, LastLabAt: null,
      VPN: { Online: true, LastHandshakeAt: at, FirstAt: at, Sessions: 2, Seconds: 600, RxBytes: 1024, TxBytes: 2048, Recent: [{ StartedAt: at, EndedAt: at, Seconds: 600, RxBytes: 1024, TxBytes: 2048 }] },
      Proxy: { Requests: 12, BytesIn: 3072, BytesOut: 1024, FirstAt: at, LastAt: at },
      Labs: [{ ChallengeID: "c1", Task: "Web login", Surface: "proxy" as const, Attempts: 12, BytesIn: 3072, BytesOut: 1024, FirstAt: at, LastAt: at }] },
    { UserID: "u-cid", UserName: "", TeamID: "t2", TeamName: "Red", LastSeenAt: null, LastLabAt: null, VPN: { Online: false, LastHandshakeAt: null, FirstAt: null, ...none }, Proxy: noProxy, Labs: [] },
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

  it("has the last online and last in a laboratory columns", async () => {
    render(<EventUsageTable eventID="event-1" />)
    const table = await screen.findByRole("table", { name: "admin.events.analytics.usage.tableLabel" })
    expect(within(table).getByText("admin.events.analytics.usage.col.seen")).toBeInTheDocument()
    expect(within(table).getByText("admin.events.analytics.usage.col.lab")).toBeInTheDocument()
  })

  it("opens the sessions and the task access of a participant", async () => {
    render(<EventUsageTable eventID="event-1" />)
    await screen.findByRole("table")
    expect(screen.queryByText("Web login")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: `admin.events.analytics.usage.toggle${JSON.stringify({ name: "Ann" })}` }))
    expect(await screen.findByText("Web login")).toBeInTheDocument()
    expect(screen.getByText("admin.events.analytics.usage.surface.proxy")).toBeInTheDocument()
  })

  it("keeps lab-only VPN traffic separate from participant attempts in the existing five cells", async () => {
    mock.usage.mockResolvedValue({ ...report, Users: [{ ...report.Users[2], UserName: "Ann",
      Labs: [{ ChallengeID: "lab-only", Task: "Lab initiated", Surface: "vpn", Attempts: 0, LabInitiatedAttempts: 7, BytesIn: 20, BytesOut: 10, FirstAt: null, LastAt: null }],
    }] })
    render(<EventUsageTable eventID="event-1" />)
    const participants = await screen.findByRole("table", { name: "admin.events.analytics.usage.tableLabel" })
    expect(within(participants).getByText("admin.events.analytics.usage.state.never")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: `admin.events.analytics.usage.toggle${JSON.stringify({ name: "Ann" })}` }))
    const labs = screen.getByRole("table", { name: "admin.events.analytics.usage.detail.labs" })
    expect(within(labs).getAllByRole("columnheader")).toHaveLength(5)
    const cells = within(within(labs).getAllByRole("row")[1]).getAllByRole("cell")
    expect(cells).toHaveLength(5)
    expect(within(cells[2]).getByText("0")).toBeInTheDocument()
    expect(within(cells[2]).getByText(`admin.events.analytics.usage.detail.labInitiated${JSON.stringify({ count: "7" })}`)).toBeInTheDocument()
    expect(cells[4]).toHaveTextContent("—")
    expect(labs).not.toHaveTextContent("0001")
  })

  it.each([
    { Surface: "vpn", LabInitiatedAttempts: 0 },
    { Surface: "vpn" },
    { Surface: "proxy", LabInitiatedAttempts: 7 },
  ])("does not show lab-origin detail for $Surface with $LabInitiatedAttempts", async (extra) => {
    mock.usage.mockResolvedValue({ ...report, Users: [{ ...report.Users[1],
      Labs: [{ ChallengeID: "c1", Task: "Existing task", Attempts: 3, BytesIn: 0, BytesOut: 0, FirstAt: at, LastAt: at, ...extra }],
    }] })
    render(<EventUsageTable eventID="event-1" />)
    await screen.findByRole("table")
    fireEvent.click(screen.getByRole("button", { name: `admin.events.analytics.usage.toggle${JSON.stringify({ name: "Ann" })}` }))
    const labs = screen.getByRole("table", { name: "admin.events.analytics.usage.detail.labs" })
    const cells = within(within(labs).getAllByRole("row")[1]).getAllByRole("cell")
    expect(cells).toHaveLength(5)
    expect(cells[2]).toHaveTextContent(/^3$/)
    expect(labs).not.toHaveTextContent("admin.events.analytics.usage.detail.labInitiated")
  })

  it("maintains the same translated secondary label in both catalogs", () => {
    const key = "admin.events.analytics.usage.detail.labInitiated"
    expect((uk as Record<string, string>)[key]).toBe("З боку лабораторії: {count}")
    expect((en as Record<string, string>)[key]).toBe("Started by the lab: {count}")
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
