import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), put: vi.fn(), post: vi.fn(), denied: new Set<string>() }))
vi.mock("@/api/client", async (original) => ({ ...(await original<object>()), apiGet: mocks.get, apiPatch: mocks.patch, apiPut: mocks.put, apiPost: mocks.post }))
vi.mock("@/i18n/t", () => ({ t: (key: string, vars?: Record<string, string | number>) => vars ? `${key} ${JSON.stringify(vars)}` : key }))
vi.mock("@/lib/origins", async (original) => ({ ...(await original<object>()), apiOrigin: "https://api.example.test" }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => !mocks.denied.has(permission) }) }))
const toastError = vi.hoisted(() => vi.fn())
vi.mock("@/components/ui/toast", () => ({ toast: { error: toastError, success: vi.fn(), warning: vi.fn() } }))

import Page from "./page"

class FakeSource {
  static last: FakeSource | null = null
  listeners = new Map<string, ((e: MessageEvent) => void)[]>()
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) { FakeSource.last = this }
  addEventListener(name: string, fn: (e: MessageEvent) => void) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]) }
  close() {}
  emit(name: string, data: unknown) { for (const fn of this.listeners.get(name) ?? []) fn({ data: JSON.stringify(data) } as MessageEvent) }
}

const group = (over: object = {}) => ({ ID: "g1", Kind: "http_5xx", Source: "/api/x", Title: "database is down", Status: "open", Occurrences: 3, FirstSeenAt: "2026-10-01T10:00:00Z", LastSeenAt: "2026-10-01T11:00:00Z", ResolvedAt: null, LastNotifiedAt: null, ...over })
const list = (items: object[]) => ({ Items: items, Total: items.length, Limit: 50, Offset: 0 })

describe("errors page", () => {
  beforeEach(() => {
    mocks.get.mockReset(); mocks.patch.mockReset(); mocks.denied = new Set(); toastError.mockReset()
    mocks.get.mockImplementation(() => Promise.resolve(list([group()])))
    FakeSource.last = null
    vi.stubGlobal("EventSource", FakeSource)
    window.history.pushState({}, "", "/errors")
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it("lists groups linking to the detail path and sends the filters", async () => {
    render(<Page />)
    const link = await screen.findByRole("link", { name: "database is down" })
    expect(link).toHaveAttribute("href", "/errors/g1")
    fireEvent.keyDown(screen.getByRole("button", { name: "admin.errors.filter.status" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "admin.errors.status.resolved" }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(expect.stringContaining("status=resolved"), expect.anything()))
    expect(screen.getByText("database is down")).toBeInTheDocument() // the rows stay while the next answer loads
  })

  it("shows nothing without platform.errors.read", () => {
    mocks.denied = new Set(["platform.errors.read"])
    render(<Page />)
    expect(screen.getByText("admin.errors.noAccess")).toBeInTheDocument()
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it("updates a row and adds a new group from the live stream without refetching", async () => {
    render(<Page />)
    await screen.findByText("database is down")
    const source = FakeSource.last!
    expect(source.url).toBe("https://api.example.test/api/admin/errors/stream")
    const before = mocks.get.mock.calls.length
    act(() => source.emit("error-group", { Group: group({ Occurrences: 9, Title: "database is down" }), Sample: null, New: false }))
    act(() => source.emit("error-group", { Group: group({ ID: "g2", Title: "mail failed", Kind: "mail", LastSeenAt: "2026-10-02T00:00:00Z" }), Sample: null, New: true }))
    expect(await screen.findByText("mail failed")).toBeInTheDocument()
    expect(screen.getByText("9")).toBeInTheDocument()
    expect(mocks.get.mock.calls.length).toBe(before)
  })

  it("switches the status at once, keeps other rows usable, and rolls back with a toast on error", async () => {
    mocks.get.mockImplementation(() => Promise.resolve(list([group(), group({ ID: "g2", Title: "second" })])))
    let reject!: (e: unknown) => void
    mocks.patch.mockImplementation(() => new Promise((_, no) => { reject = no }))
    render(<Page />)
    await screen.findByText("second")
    const first = screen.getAllByRole("radio", { name: "admin.errors.status.ignored" })[0]
    fireEvent.click(first)
    expect(first).toHaveAttribute("aria-checked", "true") // before the server answers
    expect(screen.getAllByRole("radio", { name: "admin.errors.status.resolved" })[1]).toBeEnabled()
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("/api/admin/errors/g1/status", { Status: "ignored" }))
    await act(async () => { reject(new Error("boom")) })
    await waitFor(() => expect(screen.getAllByRole("radio", { name: "admin.errors.status.ignored" })[0]).toHaveAttribute("aria-checked", "false"))
    expect(screen.getAllByRole("radio", { name: "admin.errors.status.open" })[0]).toHaveAttribute("aria-checked", "true")
    expect(toastError).toHaveBeenCalled()
  })

  it("is read-only without platform.errors.write", async () => {
    mocks.denied = new Set(["platform.errors.write"])
    render(<Page />)
    await screen.findByText("database is down")
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
  })

  it("renders /errors/<groupID> as one group, its stack as text and the user as a link", async () => {
    const id = "11111111-1111-4111-8111-111111111111"
    const user = "22222222-2222-4222-8222-222222222222"
    window.history.pushState({}, "", `/errors/${id}`)
    mocks.get.mockImplementation((path: string) => path.startsWith("/api/users/")
      ? Promise.resolve({ ID: user, FirstName: "Олена", LastName: "Коваль", Email: "o@example.test" })
      : Promise.resolve({ Group: group({ ID: id }), Samples: [{ ID: "s1", OccurredAt: "2026-10-01T11:00:00Z", Message: "<img src=x onerror=alert(1)>", Stack: "<b>frame</b>\nmain.go:1", Method: "GET", Route: "/api/x", HTTPStatus: 500, RequestID: "req-1", UserID: user, Role: "admin", Permission: "", Limiter: "", Details: { attempt: "2" } }] }))
    const { container } = render(<Page />)
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith(`/api/admin/errors/${id}`)
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("pre b")).toBeNull()
    expect(screen.getByText(/<b>frame<\/b>/)).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "Олена Коваль" })).toHaveAttribute("href", `/users/detail?id=${user}`)
    expect(screen.getByText("req-1", { exact: false })).toBeInTheDocument()
  })
})
