import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { UsersPerson, UsersReport } from "@/api/platformAnalyticsOverview"

const mocks = vi.hoisted(() => ({ apiGet: vi.fn(), granted: new Set<string>(["analytics.read"]) }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: mocks.apiGet }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("period=30d"),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/analytics/users",
}))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("echarts-for-react", () => ({ default: ({ option }: { option: { series: unknown[] } }) => <div data-testid="echart">{option.series.length} series</div> }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => mocks.granted.has(permission) }) }))

import Page from "./page"

const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}T00:00:00Z`

function report(over: Partial<UsersReport> = {}): UsersReport {
  return {
    Period: { From: day(1), To: day(30), All: false, Previous: { From: day(1), To: day(1) } },
    Total: 1200, Blocked: 7,
    ByRole: [{ Role: "user", Count: 1190 }, { Role: "super_admin", Count: 2 }],
    New: { Value: 60, Previous: 50 }, Active: { Value: 300, Previous: 400 },
    AvgDailyActive: 12.5,
    Registrations: [{ Day: day(1), New: 3 }, { Day: day(2), New: 5 }],
    ActiveByDay: [{ Day: day(1), DAU: 4, WAU: 9 }],
    Methods: [{ Method: "password", Total: 800, New: 30 }, { Method: "google", Total: 300, New: 30 }, { Method: "both", Total: 60, New: 0 }, { Method: "none", Total: 0, New: 0 }],
    Retention: { One: 100, Two: 30, ThreePlus: 10, Never: 1060 },
    ...over,
  }
}

const people: UsersPerson[] = [
  { ID: "u1", Name: "Ada Lovelace", Email: "ada@example.test", Role: "user", EventsJoined: 5, Solves: 22 },
  { ID: "u2", Name: "", Email: "grace@example.test", Role: "admin", EventsJoined: 3, Solves: 0 },
]

function serve(usersResult: () => Promise<unknown>) {
  mocks.apiGet.mockImplementation((path: string) => path.startsWith("/api/analytics/users/people") ? Promise.resolve(people) : usersResult())
}

beforeEach(() => {
  mocks.apiGet.mockReset()
  mocks.granted = new Set(["analytics.read"])
})

describe("analytics users page", () => {
  it("shows the crest while loading", () => {
    mocks.apiGet.mockReturnValue(new Promise(() => {}))
    render(<Page />)
    expect(screen.getAllByRole("status").length).toBeGreaterThan(5)
  })

  it("shows the stats bound to the period, activity, methods, retention and roles", async () => {
    serve(() => Promise.resolve(report()))
    render(<Page />)
    const total = await screen.findByRole("link", { name: "Усього облікових записів" })
    expect(total).toHaveAttribute("href", "/users")
    expect(within(total.closest("div.relative") as HTMLElement).getByText("1 200")).toBeInTheDocument()
    expect(screen.getByText("+20%")).toBeInTheDocument()
    expect(screen.getByText("−25%")).toBeInTheDocument()
    expect(screen.getByText("12,5")).toBeInTheDocument()
    expect(screen.getByText("Без жодного заходу: 1 060")).toBeInTheDocument()
    const roles = screen.getByRole("table", { name: "За ролями" })
    expect(within(roles).getByText("Суперадміністратор")).toBeInTheDocument()
    expect(await screen.findAllByTestId("echart")).toHaveLength(4)
    expect(mocks.apiGet.mock.calls[0][0]).toMatch(/^\/api\/analytics\/users\?from=.+&to=.+$/)
  })

  it("hides the people table and never asks for it without analytics.users.read", async () => {
    serve(() => Promise.resolve(report()))
    render(<Page />)
    await screen.findByRole("link", { name: "Усього облікових записів" })
    expect(screen.queryByText("Найактивніші користувачі")).toBeNull()
    expect(mocks.apiGet.mock.calls.some(([path]) => String(path).includes("/people"))).toBe(false)
  })

  it("shows the people table to a caller holding analytics.users.read", async () => {
    mocks.granted = new Set(["analytics.read", "analytics.users.read"])
    serve(() => Promise.resolve(report()))
    render(<Page />)
    const table = await screen.findByRole("table", { name: "Найактивніші користувачі" })
    expect(within(table).getByText("Ada Lovelace")).toBeInTheDocument()
    expect(within(table).getByText("grace@example.test")).toBeInTheDocument()
    expect(mocks.apiGet.mock.calls.some(([path]) => path === "/api/analytics/users/people")).toBe(true)
  })

  it("shows the empty states when nothing happened in the period", async () => {
    serve(() => Promise.resolve(report({
      Registrations: [{ Day: day(1), New: 0 }], ActiveByDay: [{ Day: day(1), DAU: 0, WAU: 0 }],
      Methods: [], Retention: { One: 0, Two: 0, ThreePlus: 0, Never: 0 }, ByRole: [],
    })))
    const { container } = render(<Page />)
    await screen.findByRole("link", { name: "Усього облікових записів" })
    await waitFor(() => expect(container.querySelectorAll("[data-empty-state]")).toHaveLength(5))
    expect(screen.queryByTestId("echart")).toBeNull()
  })

  it("shows the error state with a retry and reloads", async () => {
    let calls = 0
    serve(() => (++calls === 1 ? Promise.reject(new Error("boom")) : Promise.resolve(report())))
    render(<Page />)
    const retry = await screen.findAllByRole("button", { name: "Спробувати ще раз" })
    fireEvent.click(retry[0])
    await screen.findByText("1 200")
    expect(calls).toBe(2)
  })
})
