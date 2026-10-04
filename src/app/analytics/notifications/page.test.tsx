import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import Page from "./page"

const mocks = vi.hoisted(() => ({ apiGet: vi.fn(), apiGetBlob: vi.fn() }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: mocks.apiGet, apiGetBlob: mocks.apiGetBlob }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("period=30d"),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/analytics/notifications",
}))
vi.mock("echarts-for-react", () => ({ default: ({ option }: { option: { series: { name: string }[] } }) => <div data-testid="echart">{option.series.map((s) => s.name).join("|")}</div> }))

const report = {
  Period: { From: "2026-09-01T00:00:00Z", To: "2026-09-30T00:00:00Z", All: false },
  Channel: "", Transport: "", Type: "", IncludeTests: false,
  Sent: 18, Failed: 2, Total: 20, FailureRate: 0.1, Fallbacks: 1,
  Daily: [{ Day: "2026-09-28T00:00:00Z", Sent: 8, Failed: 2, Fallbacks: 0 }, { Day: "2026-09-29T00:00:00Z", Sent: 10, Failed: 0, Fallbacks: 1 }],
  ByTransport: [{ Key: "platform", Sent: 16, Failed: 2, Fallbacks: 0, Total: 18, FailureRate: 0.111 }, { Key: "unknown", Sent: 2, Failed: 0, Fallbacks: 1, Total: 2, FailureRate: 0 }],
  ByChannel: [{ Key: "email", Sent: 18, Failed: 2, Deferred: 4, Fallbacks: 1, Total: 20, FailureRate: 0.1 }, { Key: "in_app", Sent: 30, Failed: 0, Deferred: 0, Fallbacks: 0, Total: 30, FailureRate: 0 }],
  ByType: [{ Key: "user.account_created", Sent: 18, Failed: 2, Fallbacks: 1, Total: 20, FailureRate: 0.1 }],
  Errors: [{ Code: "550 5.1.1", Message: "smtp <address>: Recipient address rejected", Total: 2, LastAt: "2026-09-29T10:00:00Z" }],
  Options: { Transports: ["platform", "unknown"], Types: ["user.account_created"] },
}
const empty = { ...report, Sent: 0, Failed: 0, Total: 0, FailureRate: 0, Fallbacks: 0, Daily: [], ByTransport: [], ByChannel: [], ByType: [], Errors: [], Options: { Transports: [], Types: [] } }

beforeEach(() => { mocks.apiGet.mockReset(); mocks.apiGetBlob.mockReset() })

describe("notifications analytics page", () => {
  it("shows the crest inside every block while loading", () => {
    mocks.apiGet.mockReturnValue(new Promise(() => {}))
    render(<Page />)
    expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(6)
  })

  it("shows the empty state in the blocks", async () => {
    mocks.apiGet.mockResolvedValue(empty)
    const { container } = render(<Page />)
    expect(await screen.findByText("Помилок доставки за цей період немає")).toBeInTheDocument()
    expect(screen.getAllByText("Сповіщень за цей період не було").length).toBeGreaterThanOrEqual(4)
    expect(container.querySelectorAll("[data-empty-state]").length).toBeGreaterThanOrEqual(5)
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

  it("shows the channel table with delivered, failed and deferred counts", async () => {
    mocks.apiGet.mockResolvedValue(report)
    render(<Page />)
    await screen.findByText("550 5.1.1")
    const channels = screen.getByRole("table", { name: "За каналом" })
    expect(within(channels).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(expect.arrayContaining(["Канал", "Надіслано", "З помилкою", "Відкладено"]))
    const email = within(within(channels).getByText("Пошта").closest("tr") as HTMLElement)
    expect(email.getByText("4")).toBeInTheDocument()
    expect(email.getByText("10%")).toBeInTheDocument()
    expect(within(within(channels).getByText("На сайті").closest("tr") as HTMLElement).getByText("30")).toBeInTheDocument()
  })

  it("filters by channel: asks for it, exports it, and hides the email-only blocks for in-app", async () => {
    mocks.apiGet.mockResolvedValue(report)
    mocks.apiGetBlob.mockResolvedValue({ blob: new Blob(["x"]), filename: "x.csv" })
    URL.createObjectURL = vi.fn(() => "blob:x")
    URL.revokeObjectURL = vi.fn()
    render(<Page />)
    await screen.findByText("550 5.1.1")
    expect(mocks.apiGet.mock.calls[0][0]).not.toContain("channel=")

    fireEvent.keyDown(screen.getByRole("button", { name: "Канал", expanded: false }), { key: "ArrowDown" })
    expect(await screen.findByRole("menuitemradio", { name: "Пошта" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("menuitemradio", { name: "На сайті" }))
    await waitFor(() => expect(mocks.apiGet.mock.calls.at(-1)?.[0]).toContain("channel=in_app"))
    await waitFor(() => expect(screen.queryByRole("table", { name: "За транспортом" })).not.toBeInTheDocument())
    expect(screen.queryByText("Найчастіші помилки")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Транспорт" })).not.toBeInTheDocument()
    expect(screen.getByRole("table", { name: "За каналом" })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: "Експорт CSV" })[0])
    await waitFor(() => expect(mocks.apiGetBlob).toHaveBeenCalled())
    expect(mocks.apiGetBlob.mock.calls[0][0]).toContain("channel=in_app")
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
