import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { Metric, OverviewReport } from "@/api/platformAnalyticsOverview"

const mocks = vi.hoisted(() => ({ apiGet: vi.fn(), period: "30d" }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: mocks.apiGet }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(`period=${mocks.period}`),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/analytics",
}))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("echarts-for-react", () => ({ default: ({ option }: { option: { series: unknown[] } }) => <div data-testid="echart">{option.series.length} series</div> }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

import Page from "./page"

const metric = (value: number, previous: number | null): Metric => ({ Value: value, Previous: previous })
const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}T00:00:00Z`

function report(over: Partial<OverviewReport> = {}, previous = true): OverviewReport {
  const p = (value: number, prev: number) => metric(value, previous ? prev : null)
  return {
    Period: { From: day(1), To: day(30), All: !previous, Previous: previous ? { From: day(1), To: day(1) } : null },
    Users: { Total: 1200, New: p(60, 50), Active: p(300, 400) },
    Events: { Draft: 1, Published: 2, Running: 3, Finished: 4, Archived: 5, Total: 15, New: p(2, 1) },
    Participants: { Registered: p(80, 40), Approved: p(70, 70) },
    Activity: { Attempts: p(500, 250), Solves: p(90, 100) },
    Mail: { Sent: p(700, 600), Failed: p(9, 3) },
    Stands: { Ready: 8, Creating: 1, Failed: 2, Failures: p(5, 0) },
    Series: {
      NewUsers: [{ Day: day(1), New: 3 }, { Day: day(2), New: 5 }],
      Activity: [{ Day: day(1), Attempts: 10, Solves: 2 }],
      Mail: [{ Day: day(1), Sent: 4, Failed: 1 }],
    },
    ...over,
  }
}

beforeEach(() => {
  mocks.apiGet.mockReset()
  mocks.period = "30d"
})

describe("analytics overview page", () => {
  it("shows the crest inside the tiles and charts while loading", () => {
    mocks.apiGet.mockReturnValue(new Promise(() => {}))
    render(<Page />)
    expect(screen.getAllByRole("status").length).toBeGreaterThan(12)
  })

  it("shows the tiles with their change against the previous period, each linking to its section", async () => {
    mocks.apiGet.mockResolvedValue(report())
    render(<Page />)
    const users = await screen.findByRole("link", { name: "Нові акаунти" })
    expect(users).toHaveAttribute("href", "/analytics/users")
    expect(within(users.parentElement as HTMLElement).getByText("+20%")).toBeInTheDocument()
    expect(within(users.parentElement as HTMLElement).getByText("було 50")).toBeInTheDocument()
    // a fall of a good metric is red-toned text, a rise of failures too (inverse)
    const failed = screen.getByRole("link", { name: "Листи з помилкою" }).parentElement as HTMLElement
    expect(within(failed).getByText("+200%")).toHaveClass("text-destructive")
    const active = screen.getByRole("link", { name: "Активні акаунти" }).parentElement as HTMLElement
    expect(within(active).getByText("−25%")).toHaveClass("text-destructive")
    // no base: the step is absolute
    expect(within(screen.getByRole("link", { name: "Збої стендів" }).parentElement as HTMLElement).getByText("+5")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: "Схвалені учасники" }).parentElement as HTMLElement).getByText("0%")).toBeInTheDocument()
    expect(screen.getByText("чернетки 1 · опубліковані 2 · тривають 3 · завершені 4")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Спроби" })).toHaveAttribute("href", "/analytics/tasks")
    expect(screen.getByRole("link", { name: "Листи надіслано" })).toHaveAttribute("href", "/analytics/mail")
    expect(screen.getByRole("link", { name: "Стенди працюють" })).toHaveAttribute("href", "/analytics/infrastructure")
    expect(await screen.findAllByTestId("echart")).toHaveLength(3)
    expect(mocks.apiGet.mock.calls[0][0]).toMatch(/^\/api\/analytics\/overview\?from=.+&to=.+$/)
  })

  it("has no delta for all time and asks without a lower bound", async () => {
    mocks.period = "all"
    mocks.apiGet.mockResolvedValue(report({}, false))
    render(<Page />)
    await screen.findByRole("link", { name: "Нові акаунти" })
    expect(screen.queryByText("+20%")).toBeNull()
    expect(screen.queryByText(/^було/)).toBeNull()
    expect(mocks.apiGet.mock.calls[0][0]).toBe("/api/analytics/overview")
  })

  it("shows the empty state in each chart when the period has no activity", async () => {
    mocks.apiGet.mockResolvedValue(report({ Series: { NewUsers: [{ Day: day(1), New: 0 }], Activity: [{ Day: day(1), Attempts: 0, Solves: 0 }], Mail: [] } }))
    const { container } = render(<Page />)
    await screen.findByRole("link", { name: "Нові акаунти" })
    await waitFor(() => expect(container.querySelectorAll("[data-empty-state]")).toHaveLength(3))
    expect(screen.queryByTestId("echart")).toBeNull()
  })

  it("shows the error state with a retry and reloads", async () => {
    mocks.apiGet.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(report())
    render(<Page />)
    const retry = await screen.findAllByRole("button", { name: "Спробувати ще раз" })
    fireEvent.click(retry[0])
    await screen.findByText("1 200")
    expect(mocks.apiGet).toHaveBeenCalledTimes(2)
  })

  it("has an auto-refresh switch, off by default", async () => {
    mocks.apiGet.mockResolvedValue(report())
    render(<Page />)
    expect(await screen.findByRole("switch", { name: /Автооновлення/ })).toHaveAttribute("aria-checked", "false")
  })
})
