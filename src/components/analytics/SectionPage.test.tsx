import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SectionPage } from "./SectionPage"
import { useAnalyticsResource } from "./useAnalyticsResource"

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: mocks.apiGet }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("period=7d"),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/analytics/events",
}))

function Body() {
  const r = useAnalyticsResource<{ Total: number }>("events", { kind: "x" })
  if (r.loading) return <p>loading</p>
  if (r.error) return <button onClick={r.reload}>retry</button>
  return <p>total {r.data?.Total}</p>
}

beforeEach(() => mocks.apiGet.mockReset())

describe("SectionPage + useAnalyticsResource", () => {
  it("fetches with the period from the shell and extra params, then shows data", async () => {
    mocks.apiGet.mockResolvedValue({ Total: 5 })
    render(<SectionPage title="Events" subtitle="sub"><Body /></SectionPage>)
    expect(screen.getByText("Events")).toBeInTheDocument()
    await screen.findByText("total 5")
    const [path, init] = mocks.apiGet.mock.calls[0]
    expect(path).toMatch(/^\/api\/analytics\/events\?from=.+&to=.+&kind=x$/)
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(mocks.apiGet).toHaveBeenCalledTimes(1)
  })
  it("reloads after an error", async () => {
    mocks.apiGet.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ Total: 1 })
    render(<SectionPage title="Events"><Body /></SectionPage>)
    fireEvent.click(await screen.findByRole("button", { name: "retry" }))
    await screen.findByText("total 1")
  })
  it("shows the admin error screen on 403", async () => {
    const { ApiError } = await import("@/api/client")
    mocks.apiGet.mockRejectedValueOnce(new ApiError(403, null))
    render(<SectionPage title="Events"><Body /></SectionPage>)
    await waitFor(() => expect(screen.getByText("Немає доступу до аналітики")).toBeInTheDocument())
  })
  it("has an auto-refresh switch only when the page enables it", () => {
    mocks.apiGet.mockResolvedValue({ Total: 1 })
    const { unmount } = render(<SectionPage title="A"><p>x</p></SectionPage>)
    expect(screen.queryByRole("switch")).toBeNull()
    unmount()
    render(<SectionPage title="A" autoRefresh="off"><p>x</p></SectionPage>)
    expect(screen.getByRole("switch", { name: /Автооновлення/ })).toHaveAttribute("aria-checked", "false")
  })
})
