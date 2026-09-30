import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ApiError } from "@/api/client"

const mock = vi.hoisted(() => ({ access: vi.fn(), overview: vi.fn(), integrity: vi.fn(), usage: vi.fn() }))
vi.mock("@/i18n/t", () => ({ t: (key: string, vars?: Record<string, unknown>) => vars ? `${key}${JSON.stringify(vars)}` : key }))
vi.mock("@/lib/origins", () => ({ publicDomain: "cybericebox-dev.pp.ua", apiOrigin: "", mainOrigin: "/", idOrigin: "" }))
vi.mock("@/api/events/analytics", async (importActual) => ({
  ...(await importActual<typeof import("@/api/events/analytics")>()),
  getEventAnalyticsAccess: mock.access, getEventAnalyticsOverview: mock.overview, getEventIntegrity: mock.integrity, getEventAnalyticsUsage: mock.usage,
}))

import { EventAnalyticsTab } from "./EventAnalyticsTab"

const overview = {
  Participants: { Registered: 120, Approved: 100, Pending: 5, Invited: 3, Active: 42 },
  Teams: { Total: 30, Admitted: 28, Incomplete: 2 },
  Attempts: 1500, Correct: 300, Solves: 250, HintsOpened: 17, HintPoints: 85,
  Stands: { Creating: 1, Ready: 20, Failed: 2 },
}

const counts = { cross_flag: 1, no_access: 0, no_lab: 0, too_fast: 1, first_try_hard: 0, shared_wrong: 1, burst: 0, brute_force: 0, follows_solve: 0 }
const item = {
  TeamChallengeID: "tc-1", TeamID: "team-1", TeamName: "Red Team", ChallengeID: "ch-1", ChallengeName: "SQL Injection", Level: "hard" as const,
  Solved: true, At: "2026-10-01T10:00:00Z", Review: { Note: "Looks fine", ReviewedBy: "Ірина", ReviewedAt: "2026-10-01T11:00:00Z" },
  Signals: [
    { Kind: "too_fast" as const, Count: 0, Extra: 0, Seconds: 30, Baseline: 120, Teams: [], Info: false, Answers: [], Owner: null, At: null },
    { Kind: "shared_wrong" as const, Count: 2, Extra: 0, Seconds: 0, Baseline: 0, Teams: [{ ID: "team-2", Name: "Blue Team" }], Info: false, Owner: null, At: null,
      Answers: [{ Value: "flag{wrong}", Order: [{ TeamID: "team-2", TeamName: "Blue Team", At: "2026-10-01T09:00:00Z" }, { TeamID: "team-1", TeamName: "Red Team", At: "2026-10-01T09:01:00Z" }] }] },
  ],
}
const crossFlag = {
  ...item, TeamChallengeID: "tc-2", TeamID: "team-3", TeamName: "Green Team", ChallengeID: "ch-2", ChallengeName: "XSS", Level: "easy" as const, Solved: false, Review: null,
  Signals: [{ Kind: "cross_flag" as const, Count: 3, Extra: 0, Seconds: 0, Baseline: 0, Teams: [], Info: false, Answers: [], At: "2026-10-01T12:00:00Z",
    Owner: { TeamID: "team-9", TeamName: "Black Team", ChallengeID: "ch-7", ChallengeName: "CSRF", SameTask: false } }],
}
const integrity = { Items: [item, crossFlag], Total: 2, Counts: counts }

function setup({ canOpenJournal = false }: { canOpenJournal?: boolean } = {}) {
  return render(<EventAnalyticsTab eventID="event-1" tag="spring" canOpenJournal={canOpenJournal} />)
}

describe("EventAnalyticsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.access.mockResolvedValue({ Sections: true, Sensitive: true })
    mock.overview.mockResolvedValue(overview)
    mock.integrity.mockResolvedValue(integrity)
    mock.usage.mockResolvedValue({ Available: false, At: "2026-10-01T10:00:00Z", Users: [], Summary: { Users: 0, OnlineNow: 0, VPNUsers: 0, ProxyUsers: 0, Sessions: 0, OnlineSeconds: 0, RxBytes: 0, TxBytes: 0, ProxyRequests: 0, ProxyBytes: 0 } })
  })

  it("shows the key figures of the event", async () => {
    setup()
    expect(await screen.findByText("120")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(screen.getByText("1 500")).toBeInTheDocument()
    expect(screen.getByText("250")).toBeInTheDocument()
    expect(screen.getByText("admin.events.analytics.stat.attemptsNote" + JSON.stringify({ correct: 300, share: "20%" }))).toBeInTheDocument()
    expect(mock.overview).toHaveBeenCalledWith("event-1")
  })

  it("lists every flagged solve with all signals, evidence and the review", async () => {
    setup()
    const table = await screen.findByRole("table", { name: "admin.events.analytics.integrity.tableLabel" })
    const rows = within(table).getAllByRole("row")
    expect(rows).toHaveLength(3)
    const first = within(rows[1])
    expect(first.getByText("Red Team")).toBeInTheDocument()
    expect(first.getByText("SQL Injection")).toBeInTheDocument()
    expect(first.getByText("admin.events.analytics.level.hard")).toBeInTheDocument()
    expect(first.getAllByText("admin.events.analytics.integrity.kind.too_fast").length).toBeGreaterThan(0)
    expect(first.getByText(/evidence\.too_fast.*"s\\":30.*level\.hard.*"m\\":2/)).toBeInTheDocument()
    expect(first.getByText("flag{wrong}")).toBeInTheDocument()
    expect(first.getByText(/answerOrder.*"n":1.*Blue Team/)).toBeInTheDocument()
    expect(first.getByText(/answerOrder.*"n":2.*Red Team/)).toBeInTheDocument()
    expect(first.getByText(/reviewNote.*Looks fine/)).toBeInTheDocument()
    expect(first.getByText(/reviewedBy.*Ірина/)).toBeInTheDocument()
    const second = within(rows[2])
    expect(second.getByText("admin.events.analytics.integrity.unsolved")).toBeInTheDocument()
    expect(second.getByText(/evidence.cross_flag.*Black Team.*CSRF/)).toBeInTheDocument()
    expect(second.getByText("admin.events.analytics.integrity.notReviewed")).toBeInTheDocument()
  })

  it("filters by signal kind and review state", async () => {
    setup()
    await screen.findByRole("table", { name: "admin.events.analytics.integrity.tableLabel" })
    expect(mock.integrity).toHaveBeenLastCalledWith("event-1", { signal: null, reviewed: "no" })
    fireEvent.click(screen.getByRole("button", { name: /admin.events.analytics.integrity.kind.too_fast/ }))
    await waitFor(() => expect(mock.integrity).toHaveBeenLastCalledWith("event-1", { signal: "too_fast", reviewed: "no" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.events.analytics.integrity.reviewedOption.all" }))
    await waitFor(() => expect(mock.integrity).toHaveBeenLastCalledWith("event-1", { signal: "too_fast", reviewed: "all" }))
    // the previous rows stay while the new answer is on its way
    expect(screen.getByRole("table")).toBeInTheDocument()
  })

  it("shows the centered empty state when nothing is flagged", async () => {
    mock.integrity.mockResolvedValue({ Items: [], Total: 0, Counts: counts })
    setup()
    expect(await screen.findByText("admin.events.analytics.integrity.empty")).toBeInTheDocument()
  })

  it("offers no attempts link to a moderator who is not assigned", async () => {
    setup({ canOpenJournal: false })
    await screen.findByRole("table")
    expect(screen.queryByText("admin.events.analytics.integrity.openJournal")).not.toBeInTheDocument()
    expect(document.querySelector('a[href*="/manage/submissions"]')).toBeNull()
  })

  it("links an assigned write moderator to the attempts journal on the event site", async () => {
    setup({ canOpenJournal: true })
    await screen.findByRole("table")
    const links = screen.getAllByRole("link", { name: "admin.events.analytics.integrity.openJournal" })
    expect(links).toHaveLength(2)
    const href = new URL(links[0].getAttribute("href") ?? "")
    expect(href.origin).toBe("https://spring.cybericebox-dev.pp.ua")
    expect(href.pathname).toBe("/manage/submissions")
    expect(href.searchParams.get("tab")).toBe("attempts")
    expect(href.searchParams.get("challengeId")).toBe("ch-1")
    expect(href.searchParams.get("teamId")).toBe("team-1")
    expect(links[0]).toHaveAttribute("target", "_blank")
  })

  it("shows the no-access state for admin_viewer and never asks for integrity", async () => {
    mock.access.mockResolvedValue({ Sections: true, Sensitive: false })
    setup()
    expect(await screen.findByText("admin.events.analytics.integrity.noAccess")).toBeInTheDocument()
    expect(mock.integrity).not.toHaveBeenCalled()
    expect(screen.getByText("120")).toBeInTheDocument()
  })

  it("shows the no-access state when integrity answers 403", async () => {
    mock.integrity.mockRejectedValue(new ApiError(403, {}))
    setup()
    expect(await screen.findByText("admin.events.analytics.integrity.noAccess")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows a retryable load error for the table and the figures", async () => {
    mock.integrity.mockRejectedValueOnce(new ApiError(500, {})).mockResolvedValue(integrity)
    mock.overview.mockRejectedValueOnce(new ApiError(500, {})).mockResolvedValue(overview)
    setup()
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2))
    for (const alert of screen.getAllByRole("alert")) fireEvent.click(within(alert).getByRole("button", { name: "error.load.retry" }))
    expect(await screen.findByText("120")).toBeInTheDocument()
    expect(await screen.findByRole("table")).toBeInTheDocument()
  })

  it("opens the event's analytics on the event site in a new tab", async () => {
    setup()
    const link = await screen.findByRole("link", { name: /admin.events.analytics.openSite/ })
    const href = new URL(link.getAttribute("href") ?? "")
    expect(href.origin).toBe("https://spring.cybericebox-dev.pp.ua")
    expect(href.pathname).toBe("/manage/analytics")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
  })
})
