import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { TaskUsageRow, TasksAnalytics } from "@/api/platformAnalyticsCatalog"
import Page from "./page"

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: mocks.apiGet }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true, permissions: ["*"], role: "super_admin", me: null, isLoading: false }) }))
vi.mock("echarts-for-react", () => ({ default: ({ option }: { option: { series: unknown[] } }) => <div data-testid="echart">{option.series.length} series</div> }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("period=30d"),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/analytics/tasks",
}))

const period = { From: "2026-09-01T00:00:00Z", To: "2026-10-01T00:00:00Z", All: false }
const row = (over: Partial<TaskUsageRow>): TaskUsageRow => ({
  ExerciseID: "x1", TaskID: "t1", Exercise: "Web basics", Task: "Login bypass", Level: "easy", Categories: ["web"], EventsUsed: 3, Attempts: 40,
  TeamsTried: 10, TeamsEngaged: 12, Solves: 9, TeamsHinted: 3, SolveRate: 0.9, HintRate: 0.25, MedianSolveSeconds: 1500, Calibration: "ok", ...over,
})
const dead = row({ ExerciseID: "x2", TaskID: "t2", Exercise: "Crypto", Task: "Broken RSA", Level: "hard", Categories: ["crypto"], EventsUsed: 1, Attempts: 5,
  TeamsTried: 5, TeamsEngaged: 5, Solves: 0, TeamsHinted: 0, SolveRate: 0, HintRate: 0, MedianSolveSeconds: null, Calibration: "too_hard" })
const report: TasksAnalytics = {
  Period: period,
  Totals: { TasksUsed: 2, Uses: 4, Attempts: 45, Solves: 9, NeverSolved: 1, SolveRate: 0.6 },
  Categories: ["crypto", "web"], Levels: ["trivial", "easy", "medium", "hard", "insane"],
  Tasks: [row({}), dead], TasksTotal: 2, TasksLimit: 200,
  Unsolved: [dead], UnsolvedTotal: 1,
  ByCategory: [{ Category: "web", Tasks: 1, Uses: 3 }, { Category: "crypto", Tasks: 1, Uses: 1 }],
  ByLevel: [{ Level: "easy", Tasks: 1, TeamsTried: 10, Solves: 9, SolveRate: 0.9 }, { Level: "hard", Tasks: 1, TeamsTried: 5, Solves: 0, SolveRate: 0 }],
}
const empty: TasksAnalytics = {
  ...report, Totals: { TasksUsed: 0, Uses: 0, Attempts: 0, Solves: 0, NeverSolved: 0, SolveRate: 0 },
  Tasks: [], TasksTotal: 0, Unsolved: [], UnsolvedTotal: 0, ByCategory: [], ByLevel: [],
}

beforeEach(() => mocks.apiGet.mockReset())

describe("platform analytics: task catalog", () => {
  it("shows the crest while loading", async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.apiGet.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<Page />)
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0)
    finish(report)
    await screen.findByRole("table", { name: "Використання й калібрування" })
  })

  it("shows usage, calibration and the never solved tasks", async () => {
    mocks.apiGet.mockResolvedValue(report)
    render(<Page />)
    const usage = await screen.findByRole("table", { name: "Використання й калібрування" })
    expect(within(usage).getByText("Login bypass")).toBeInTheDocument()
    expect(within(usage).getByText("90%")).toBeInTheDocument()
    expect(within(usage).getByText("25 хв")).toBeInTheDocument()
    expect(within(usage).getByText("25%")).toBeInTheDocument()
    expect(within(usage).getByText("Надто складне")).toBeInTheDocument()
    const unsolved = screen.getByRole("table", { name: "Ніколи не розв'язані завдання" })
    expect(within(unsolved).getByText("Broken RSA")).toBeInTheDocument()
    expect(within(unsolved).queryByText("Login bypass")).toBeNull()
    expect((await screen.findAllByTestId("echart")).length).toBe(2)
    expect(screen.getAllByRole("button", { name: "Експорт CSV" })).toHaveLength(2)
  })

  it("filters by category and level through the request, the options come from the response", async () => {
    mocks.apiGet.mockResolvedValue(report)
    render(<Page />)
    await screen.findByRole("table", { name: "Використання й калібрування" })
    fireEvent.keyDown(screen.getByRole("button", { name: "Категорія" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "web" }))
    await waitFor(() => expect(mocks.apiGet.mock.calls.at(-1)?.[0]).toMatch(/category=web/))
    fireEvent.keyDown(screen.getAllByRole("button", { name: "Рівень" })[0], { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Складний" }))
    await waitFor(() => expect(mocks.apiGet.mock.calls.at(-1)?.[0]).toMatch(/category=web&level=hard/))
  })

  it("shows empty states when no task was used", async () => {
    mocks.apiGet.mockResolvedValue(empty)
    const { container } = render(<Page />)
    await screen.findByText("Немає використаних завдань за цей період")
    expect(screen.getByText("Усі використані завдання хтось розв'язав")).toBeInTheDocument()
    expect(container.querySelectorAll("[data-empty-state]").length).toBeGreaterThanOrEqual(4)
  })

  it("shows the load error with a retry", async () => {
    mocks.apiGet.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(report)
    render(<Page />)
    const retry = await screen.findAllByRole("button", { name: "Спробувати ще раз" })
    fireEvent.click(retry[0])
    await screen.findByRole("table", { name: "Використання й калібрування" })
    expect(mocks.apiGet).toHaveBeenCalledTimes(2)
  })
})
