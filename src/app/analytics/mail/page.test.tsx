import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import Page from "./page"

const mocks = vi.hoisted(() => ({ apiGet: vi.fn(), apiGetBlob: vi.fn() }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: mocks.apiGet, apiGetBlob: mocks.apiGetBlob }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("period=30d"),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/analytics/mail",
}))
vi.mock("echarts-for-react", () => ({ default: ({ option }: { option: { series: { name: string }[] } }) => <div data-testid="echart">{option.series.map((s) => s.name).join("|")}</div> }))

const report = {
  Period: { From: "2026-09-01T00:00:00Z", To: "2026-09-30T00:00:00Z", All: false },
  Transport: "", Type: "", IncludeTests: false,
  Sent: 18, Failed: 2, Total: 20, FailureRate: 0.1, Fallbacks: 1,
  Daily: [{ Day: "2026-09-28T00:00:00Z", Sent: 8, Failed: 2, Fallbacks: 0 }, { Day: "2026-09-29T00:00:00Z", Sent: 10, Failed: 0, Fallbacks: 1 }],
  ByTransport: [{ Key: "platform", Sent: 16, Failed: 2, Fallbacks: 0, Total: 18, FailureRate: 0.111 }, { Key: "unknown", Sent: 2, Failed: 0, Fallbacks: 1, Total: 2, FailureRate: 0 }],
  ByType: [{ Key: "user.account_created", Sent: 18, Failed: 2, Fallbacks: 1, Total: 20, FailureRate: 0.1 }],
  Errors: [{ Code: "550 5.1.1", Message: "smtp <address>: Recipient address rejected", Total: 2, LastAt: "2026-09-29T10:00:00Z" }],
  Options: { Transports: ["platform", "unknown"], Types: ["user.account_created"] },
}
const empty = { ...report, Sent: 0, Failed: 0, Total: 0, FailureRate: 0, Fallbacks: 0, Daily: [], ByTransport: [], ByType: [], Errors: [], Options: { Transports: [], Types: [] } }

beforeEach(() => { mocks.apiGet.mockReset(); mocks.apiGetBlob.mockReset() })

describe("mail analytics page", () => {
  it("shows the crest inside every block while loading", () => {
    mocks.apiGet.mockReturnValue(new Promise(() => {}))
    render(<Page />)
    expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(5)
  })

  it("shows the empty state in the blocks", async () => {
    mocks.apiGet.mockResolvedValue(empty)
    const { container } = render(<Page />)
    expect(await screen.findByText("Помилок доставки за цей період немає")).toBeInTheDocument()
    expect(screen.getAllByText("Листів за цей період не було").length).toBeGreaterThanOrEqual(3)
    expect(container.querySelectorAll("[data-empty-state]").length).toBeGreaterThanOrEqual(4)
  })

  it("shows LoadError with a retry that reloads", async () => {
    mocks.apiGet.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(report)
    render(<Page />)
    const retries = await screen.findAllByRole("button", { name: "Спробувати ще раз" })
    fireEvent.click(retries[0])
    expect(await screen.findByText("smtp <address>: Recipient address rejected")).toBeInTheDocument()
    expect(mocks.apiGet).toHaveBeenCalledTimes(2)
  })

  it("renders the report with translated transports and no auto refresh", async () => {
    mocks.apiGet.mockResolvedValue(report)
    render(<Page />)
    expect(await screen.findByText("smtp <address>: Recipient address rejected")).toBeInTheDocument()
    expect(mocks.apiGet.mock.calls[0][0]).toMatch(/^\/api\/analytics\/mail\?from=.+&to=.+$/)
    expect(screen.getAllByText("10%").length).toBeGreaterThanOrEqual(1)
    const transports = screen.getByRole("table", { name: "За транспортом" })
    expect(within(transports).getByText("Платформа")).toBeInTheDocument()
    expect(within(transports).getByText("Не вказано")).toBeInTheDocument()
    expect(screen.getByText("550 5.1.1")).toBeInTheDocument()
    expect(screen.queryByRole("switch", { name: /Автооновлення/ })).not.toBeInTheDocument()
    expect((await screen.findAllByTestId("echart"))[0]).toHaveTextContent("Надіслано|З помилкою")
  })

  it("refetches with the chosen filters and passes them to the CSV export", async () => {
    mocks.apiGet.mockResolvedValue(report)
    mocks.apiGetBlob.mockResolvedValue({ blob: new Blob(["x"]), filename: "x.csv" })
    URL.createObjectURL = vi.fn(() => "blob:x")
    URL.revokeObjectURL = vi.fn()
    render(<Page />)
    await screen.findByText("550 5.1.1")

    fireEvent.keyDown(screen.getByRole("button", { name: "Транспорт", expanded: false }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Платформа" }))
    await waitFor(() => expect(mocks.apiGet.mock.calls.at(-1)?.[0]).toContain("transport=platform"))
    fireEvent.click(screen.getByRole("switch", { name: /Враховувати тестові листи/ }))
    await waitFor(() => expect(mocks.apiGet.mock.calls.at(-1)?.[0]).toMatch(/transport=platform.*includeTests=true|includeTests=true.*transport=platform/))
    await screen.findByText("550 5.1.1")

    fireEvent.click(screen.getAllByRole("button", { name: "Експорт CSV" })[0])
    await waitFor(() => expect(mocks.apiGetBlob).toHaveBeenCalled())
    const path = mocks.apiGetBlob.mock.calls[0][0] as string
    expect(path).toContain("/api/analytics/mail/export.csv")
    expect(path).toContain("table=daily")
    expect(path).toContain("transport=platform")
    expect(path).toContain("includeTests=true")
  })

  it("has a manual reload that refetches", async () => {
    mocks.apiGet.mockResolvedValue(report)
    render(<Page />)
    await screen.findByText("550 5.1.1")
    fireEvent.click(screen.getByRole("button", { name: "Оновити" }))
    await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledTimes(2))
  })
})
