import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import Page from "./page"

const mocks = vi.hoisted(() => ({ apiGet: vi.fn(), apiGetBlob: vi.fn() }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: mocks.apiGet, apiGetBlob: mocks.apiGetBlob }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("period=7d"),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/analytics/infrastructure",
}))
vi.mock("echarts-for-react", () => ({ default: ({ option }: { option: { series: { name: string }[] } }) => <div data-testid="echart">{option.series.map((s) => s.name).join("|")}</div> }))

const report = {
  Period: { From: "2026-09-23T00:00:00Z", To: "2026-09-30T00:00:00Z", All: false },
  Bucket: "hour",
  Stands: { Active: 7, Creating: 2, Ready: 5, Failed: 1, Removed: 9 },
  StandHours: { TotalHours: 42.5, TotalEvents: 3, Events: [
    { EventID: "e1", EventName: "Осінній CTF", Hours: 30, Stands: 6 },
    { EventID: "e2", EventName: "Зимовий CTF", Hours: 12.5, Stands: 3 },
  ] },
  Peaks: [{ At: "2026-09-29T10:00:00Z", Peak: 4 }, { At: "2026-09-29T11:00:00Z", Peak: 6 }],
  PeakMax: 6,
  Failures: [{ Code: "image_pull", Labs: 3, Stands: 1, Events: 1, LastAt: "2026-09-29T10:00:00Z" }, { Code: "brand_new_code", Labs: 1, Stands: 0, Events: 1, LastAt: "2026-09-28T10:00:00Z" }],
  FailedLabs: 4,
  FailedStands: 1,
  Capacity: [{ At: "2026-09-29T10:00:00Z", AllocatableCPUMillicores: 8000, RequestedCPUMillicores: 2000, AllocatableMemoryBytes: 8589934592, RequestedMemoryBytes: 1073741824, Agents: 2 }],
  CapacityStepSeconds: 300,
}
const empty = { ...report, Stands: { Active: 0, Creating: 0, Ready: 0, Failed: 0, Removed: 0 }, StandHours: { TotalHours: 0, TotalEvents: 0, Events: [] }, Peaks: [], PeakMax: 0, Failures: [], FailedLabs: 0, FailedStands: 0, Capacity: [] }

beforeEach(() => { mocks.apiGet.mockReset(); mocks.apiGetBlob.mockReset() })

describe("infrastructure analytics page", () => {
  it("shows the crest inside every block while loading", () => {
    mocks.apiGet.mockReturnValue(new Promise(() => {}))
    render(<Page />)
    expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(5)
    expect(screen.queryByText("Осінній CTF")).not.toBeInTheDocument()
  })

  it("shows the empty state in the blocks when the period has nothing", async () => {
    mocks.apiGet.mockResolvedValue(empty)
    const { container } = render(<Page />)
    expect(await screen.findByText("Стенди не працювали за цей період")).toBeInTheDocument()
    expect(screen.getByText("Збоїв за цей період не було")).toBeInTheDocument()
    expect(screen.getByText("Активних стендів за цей період не було")).toBeInTheDocument()
    expect(container.querySelectorAll("[data-empty-state]").length).toBeGreaterThanOrEqual(5)
    expect(screen.queryByTestId("echart")).not.toBeInTheDocument()
  })

  it("shows LoadError with a retry that reloads", async () => {
    mocks.apiGet.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(report)
    render(<Page />)
    const retries = await screen.findAllByRole("button", { name: "Спробувати ще раз" })
    expect(retries.length).toBeGreaterThan(1)
    fireEvent.click(retries[0])
    expect(await screen.findByText("Осінній CTF")).toBeInTheDocument()
    expect(mocks.apiGet).toHaveBeenCalledTimes(2)
  })

  it("renders the report: tiles, stand-hours, translated failure reasons, charts", async () => {
    mocks.apiGet.mockResolvedValue(report)
    render(<Page />)
    expect(await screen.findByText("Осінній CTF")).toBeInTheDocument()
    expect(mocks.apiGet.mock.calls[0][0]).toMatch(/^\/api\/analytics\/infrastructure\?from=.+&to=.+$/)
    expect(screen.getByRole("link", { name: "Осінній CTF" })).toHaveAttribute("href", "/events/detail?id=e1")
    expect(screen.getByRole("link", { name: "Активні стенди зараз" })).toHaveAttribute("href", "/labs")
    expect(screen.getByRole("link", { name: "Стенди зі збоєм зараз" })).toHaveAttribute("href", "/labs?status=failed")
    const failures = screen.getByRole("table", { name: "Збої за причинами" })
    expect(within(failures).getByText("Не вдалося завантажити образ")).toBeInTheDocument()
    expect(within(failures).getByText("Інша причина")).toBeInTheDocument()
    expect(screen.getByText("42,5")).toBeInTheDocument()
    const charts = await screen.findAllByTestId("echart")
    expect(charts.map((c) => c.textContent)).toEqual(["Активні стенди", "Доступно|Зарезервовано", "Доступно|Зарезервовано"])
  })

  it("offers auto refresh, off by default, and exports each table with the period", async () => {
    mocks.apiGet.mockResolvedValue(report)
    mocks.apiGetBlob.mockResolvedValue({ blob: new Blob(["x"]), filename: "x.csv" })
    URL.createObjectURL = vi.fn(() => "blob:x")
    URL.revokeObjectURL = vi.fn()
    render(<Page />)
    await screen.findByText("Осінній CTF")
    expect(screen.getByRole("switch", { name: /Автооновлення/ })).toHaveAttribute("aria-checked", "false")
    const buttons = screen.getAllByRole("button", { name: "Експорт CSV" })
    expect(buttons).toHaveLength(4)
    fireEvent.click(buttons[1])
    await waitFor(() => expect(mocks.apiGetBlob).toHaveBeenCalled())
    expect(mocks.apiGetBlob.mock.calls[0][0]).toMatch(/^\/api\/analytics\/infrastructure\/export\.csv\?from=.+&to=.+&table=stand_hours$/)
  })
})
