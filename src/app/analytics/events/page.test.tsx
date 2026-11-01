import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { EventsAnalytics } from "@/api/platformAnalyticsCatalog"
import Page from "./page"

const mocks = vi.hoisted(() => ({ apiGet: vi.fn(), search: "period=30d" }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: mocks.apiGet }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true, permissions: ["*"], role: "super_admin", me: null, isLoading: false }) }))
vi.mock("@/lib/origins", () => ({ eventDomain: "cybericebox.test", apiOrigin: "", mainOrigin: "/", idOrigin: "" }))
vi.mock("echarts-for-react", () => ({ default: ({ option }: { option: { series: unknown[] } }) => <div data-testid="echart">{option.series.length} series</div> }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
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

/** The report and the paged events table answer on their own paths. */
function serve(overview: EventsAnalytics, table: unknown[] = overview.Events, total = overview.EventsTotal) {
  mocks.apiGet.mockImplementation((path: string) => String(path).startsWith("/api/analytics/events/table")
    ? Promise.resolve({ Items: table, Total: total, Page: 1, PageSize: 25 })
    : Promise.resolve(overview))
}
const tableCalls = () => mocks.apiGet.mock.calls.map((c) => String(c[0])).filter((path) => path.startsWith("/api/analytics/events/table"))

beforeEach(() => { mocks.apiGet.mockReset(); mocks.search = "period=30d" })

describe("platform analytics: events", () => {
  it("shows the crest while loading", async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.apiGet.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<Page />)
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0)
    expect(screen.queryByTestId("echart")).toBeNull()
    serve(report)
    finish(report)
    await screen.findAllByTestId("echart")
  })

  it("shows the totals, the per-event table with links to the event analytics, and the upcoming events", async () => {
    serve(report)
    render(<Page />)
    const table = await screen.findByRole("table", { name: "Заходи періоду" })
    expect(mocks.apiGet.mock.calls.map((c) => String(c[0]))).toContainEqual(expect.stringMatching(/^\/api\/analytics\/events\?from=.+&to=.+$/))
    expect(tableCalls()[0]).toMatch(/\/events\/table\?.*page=1.*pageSize=25.*sortBy=start.*sortDir=desc/)
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(within(table).getByRole("link", { name: "Spring CTF" })).toHaveAttribute("href", "/events/detail?id=e1")
    expect(within(table).getByText("80%")).toBeInTheDocument()
    expect(within(table).getByText("4 год")).toBeInTheDocument()
    const link = within(table).getByRole("link", { name: /spring\.cybericebox\.test/ })
    expect(link.getAttribute("href")).toMatch(/^https:\/\/spring\.cybericebox\.test\/manage\/analytics\?from=/)
    expect(screen.getByText("Усього: 250")).toBeInTheDocument()
    const upcoming = screen.getByRole("table", { name: "Найближчі заходи" })
    expect(within(upcoming).getByText("Autumn cup")).toBeInTheDocument()
    expect(within(upcoming).getByText("17")).toBeInTheDocument()
    expect((await screen.findAllByTestId("echart")).length).toBe(2)
    expect(screen.getAllByRole("button", { name: "Експорт CSV" })).toHaveLength(3)
  })

  it("sorts the table on the server and searches it, starting again from the first page", async () => {
    serve(report)
    render(<Page />)
    const table = await screen.findByRole("table", { name: "Заходи періоду" })
    fireEvent.click(within(table).getByRole("button", { name: /Учасники/ }))
    await waitFor(() => expect(tableCalls().some((path) => path.includes("sortBy=participants") && path.includes("sortDir=asc"))).toBe(true))
    fireEvent.change(screen.getByLabelText("Пошук за назвою або тегом заходу"), { target: { value: "spring" } })
    await waitFor(() => expect(tableCalls().some((path) => path.includes("search=spring") && path.includes("page=1"))).toBe(true))
  })

  it("shows empty states centred in their blocks when the period has no events", async () => {
    serve(empty)
    const { container } = render(<Page />)
    await waitFor(() => expect(screen.getAllByText("Немає заходів за цей період").length).toBeGreaterThan(0))
    expect(screen.getByText("Немає запланованих заходів")).toBeInTheDocument()
    expect(container.querySelectorAll("[data-empty-state]").length).toBeGreaterThanOrEqual(4)
    expect(screen.queryByTestId("echart")).toBeNull()
  })

  it("shows the load error with a retry", async () => {
    mocks.apiGet.mockRejectedValue(new Error("boom"))
    render(<Page />)
    const retry = await screen.findAllByRole("button", { name: "Спробувати ще раз" })
    serve(report)
    fireEvent.click(retry[0])
    await screen.findByRole("table", { name: "Заходи періоду" })
  })

  it("with «Порівняти з попереднім» asks for the comparison, reads the current report and shows the change on the tiles", async () => {
    mocks.search = "period=30d&compare=1"
    const previous = { ...report, Totals: { Events: 2, Created: 2, Started: 1, Registrations: 21 } }
    mocks.apiGet.mockImplementation((path: string) => String(path).startsWith("/api/analytics/events/table")
      ? Promise.resolve({ Items: report.Events, Total: 2, Page: 1, PageSize: 25 })
      : Promise.resolve({ Current: report, Previous: previous, PreviousPeriod: { From: "2026-08-01T00:00:00Z", To: "2026-09-01T00:00:00Z" } }))
    render(<Page />)
    expect(await screen.findByText("42")).toBeInTheDocument()
    expect(mocks.apiGet.mock.calls.some(([path]) => String(path).startsWith("/api/analytics/events?") && String(path).includes("compare=true"))).toBe(true)
    expect(screen.getByText("+100%")).toBeInTheDocument()
  })
})
