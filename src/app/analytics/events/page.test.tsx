import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { EventsAnalytics } from "@/api/platformAnalyticsCatalog"
import Page from "./page"

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: mocks.apiGet }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true, permissions: ["*"], role: "super_admin", me: null, isLoading: false }) }))
vi.mock("@/lib/origins", () => ({ eventDomain: "cybericebox.test", apiOrigin: "", mainOrigin: "/", idOrigin: "" }))
vi.mock("echarts-for-react", () => ({ default: ({ option }: { option: { series: unknown[] } }) => <div data-testid="echart">{option.series.length} series</div> }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("period=30d"),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/analytics/events",
}))

const period = { From: "2026-09-01T00:00:00Z", To: "2026-10-01T00:00:00Z", All: false }
const report: EventsAnalytics = {
  Period: period,
  Totals: { Events: 3, Created: 2, Started: 1, Registrations: 42 },
  Series: [
    { Day: "2026-09-29T00:00:00Z", EventsCreated: 1, EventsStarted: 1, Registrations: 30 },
    { Day: "2026-09-30T00:00:00Z", EventsCreated: 1, EventsStarted: 0, Registrations: 12 },
  ],
  Statuses: [
    { Status: "not_published", Events: 1 }, { Status: "published", Events: 0 }, { Status: "started", Events: 1 },
    { Status: "finished", Events: 1 }, { Status: "withdrawn", Events: 0 },
  ],
  Events: [
    { ID: "e1", Tag: "spring", Name: "Spring CTF", Status: "finished", StartAt: "2026-09-10T10:00:00Z", FinishAt: "2026-09-10T14:00:00Z", DurationSeconds: 14400,
      Participants: 40, Teams: 10, Solves: 25, TeamsSolved: 8, CompletionRate: 0.8 },
    { ID: "e2", Tag: "draft", Name: "Draft event", Status: "not_published", StartAt: null, FinishAt: null, DurationSeconds: null,
      Participants: 0, Teams: 0, Solves: 0, TeamsSolved: 0, CompletionRate: 0 },
  ],
  EventsTotal: 250,
  EventsLimit: 200,
  Upcoming: [{ ID: "e3", Tag: "autumn", Name: "Autumn cup", StartAt: "2026-10-20T09:00:00Z", Published: true, Registrations: 17 }],
}
const empty: EventsAnalytics = {
  Period: period, Totals: { Events: 0, Created: 0, Started: 0, Registrations: 0 },
  Series: [{ Day: "2026-09-30T00:00:00Z", EventsCreated: 0, EventsStarted: 0, Registrations: 0 }],
  Statuses: [], Events: [], EventsTotal: 0, EventsLimit: 200, Upcoming: [],
}

beforeEach(() => mocks.apiGet.mockReset())

describe("platform analytics: events", () => {
  it("shows the crest while loading", async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.apiGet.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<Page />)
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0)
    expect(screen.queryByTestId("echart")).toBeNull()
    finish(report)
    await screen.findAllByTestId("echart")
  })

  it("shows the totals, the per-event table with links to the event analytics, and the upcoming events", async () => {
    mocks.apiGet.mockResolvedValue(report)
    render(<Page />)
    const table = await screen.findByRole("table", { name: "Заходи періоду" })
    expect(mocks.apiGet.mock.calls[0][0]).toMatch(/^\/api\/analytics\/events\?from=.+&to=.+$/)
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(within(table).getByRole("link", { name: "Spring CTF" })).toHaveAttribute("href", "/events/detail?id=e1")
    expect(within(table).getByText("80%")).toBeInTheDocument()
    expect(within(table).getByText("4 год")).toBeInTheDocument()
    const link = within(table).getByRole("link", { name: /spring\.cybericebox\.test/ })
    expect(link.getAttribute("href")).toMatch(/^https:\/\/spring\.cybericebox\.test\/manage\/analytics\?from=/)
    expect(screen.getByText("Показано 2 із 250 найновіших заходів (ліміт 200).")).toBeInTheDocument()
    const upcoming = screen.getByRole("table", { name: "Найближчі заходи" })
    expect(within(upcoming).getByText("Autumn cup")).toBeInTheDocument()
    expect(within(upcoming).getByText("17")).toBeInTheDocument()
    expect((await screen.findAllByTestId("echart")).length).toBe(2)
    expect(screen.getAllByRole("button", { name: "Експорт CSV" })).toHaveLength(3)
  })

  it("sorts the table by a column", async () => {
    mocks.apiGet.mockResolvedValue(report)
    render(<Page />)
    const table = await screen.findByRole("table", { name: "Заходи періоду" })
    fireEvent.click(within(table).getByRole("button", { name: /Учасники/ }))
    const first = () => within(table).getAllByRole("row")[1]
    const before = first().textContent
    fireEvent.click(within(table).getByRole("button", { name: /Учасники/ }))
    expect(first().textContent).not.toBe(before)
  })

  it("shows empty states centred in their blocks when the period has no events", async () => {
    mocks.apiGet.mockResolvedValue(empty)
    const { container } = render(<Page />)
    await waitFor(() => expect(screen.getAllByText("Немає заходів за цей період").length).toBeGreaterThan(0))
    expect(screen.getByText("Немає запланованих заходів")).toBeInTheDocument()
    expect(container.querySelectorAll("[data-empty-state]").length).toBeGreaterThanOrEqual(4)
    expect(screen.queryByTestId("echart")).toBeNull()
  })

  it("shows the load error with a retry", async () => {
    mocks.apiGet.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(report)
    render(<Page />)
    const retry = await screen.findAllByRole("button", { name: "Спробувати ще раз" })
    fireEvent.click(retry[0])
    await screen.findByRole("table", { name: "Заходи періоду" })
    expect(mocks.apiGet).toHaveBeenCalledTimes(2)
  })
})
