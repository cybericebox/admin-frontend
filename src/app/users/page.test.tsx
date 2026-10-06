import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ get: vi.fn(), canInvite: true }))
vi.mock("@/api/client", () => ({ apiGet: mocks.get }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => permission === "users.invite" ? mocks.canInvite : true }) }))
vi.mock("@/components/users/InviteUsersDialog", () => ({ default: () => null }))

import Page from "./page"
const setTestUrl = (q: string) => window.history.replaceState(null, "", q ? `/test/?${q}` : "/test/")
const testUrl = () => window.location.search.replace(/^\?/, "")

describe("admin users page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setTestUrl("")
    mocks.get.mockReset()
    mocks.canInvite = true
    mocks.get.mockResolvedValue({ Items: [{ ID: "user-1", FirstName: "Олена", LastName: "Коваль", Email: "olena@example.test", Role: "user", Status: "active", LastSeen: new Date(Date.now() - 5 * 60_000).toISOString(), CreatedAt: "2026-09-01T00:00:00Z" }], Total: 1, Page: 1, PageSize: 50 })
  })

  it("loads users and links to their detail", async () => {
    render(<Page />)
    expect(await screen.findByText("Олена Коваль")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Олена Коваль/ })).toHaveAttribute("href", "/users/detail?id=user-1")
    expect(screen.getByText(/^01\.09\.2026, \d{2}:\d{2}$/)).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith("/api/users?page=1&pageSize=50&sortBy=created&sortDir=desc")
  })

  it("shows when the user was last online and sorts by it, newest first", async () => {
    render(<Page />)
    expect(await screen.findByText("5 хвилин тому")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /admin.users.col.lastSeen/ }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/users?page=1&pageSize=50&sortBy=lastSeen&sortDir=desc"))
  })

  it("keeps column headings above rows within the scrolling table", async () => {
    const { container } = render(<Page />)
    await screen.findByText("Олена Коваль")
    expect(container.querySelector("thead")).toBeInTheDocument()
    expect(container.querySelector("table.ib-table")).toBeInTheDocument()
  })

  it("places search before filters and invitation, without an end-of-list label", async () => {
    render(<Page />)
    await screen.findByText("Олена Коваль")
    const search = screen.getByPlaceholderText("admin.users.search")
    const roles = screen.getByRole("button", { name: /admin.users.filterRolesAll/ })
    const status = screen.getByRole("button", { name: "admin.users.filterStatus" })
    const invite = screen.getByRole("button", { name: "admin.users.invite.button" })
    const before = (left: Node, right: Node) => !!(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(before(search, roles)).toBe(true)
    expect(before(roles, status)).toBe(true)
    expect(screen.queryByText("admin.users.filterRoles")).not.toBeInTheDocument()
    expect(screen.queryByText("admin.users.filterStatus")).not.toBeInTheDocument()
    for (const control of [search, roles, status, invite]) {
      expect(control).toHaveClass("h-10")
      expect(control).toHaveClass("text-sm")
    }
    expect(screen.queryByText("admin.users.endOfList")).not.toBeInTheDocument()
  })

  it("searches by name and hides invitations without permission", async () => {
    mocks.canInvite = false
    render(<Page />)
    await screen.findByText("Олена Коваль")
    expect(screen.queryByText("admin.users.invite.button")).not.toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("admin.users.search"), { target: { value: "Олена" } })
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/users?search=%D0%9E%D0%BB%D0%B5%D0%BD%D0%B0&page=1&pageSize=50&sortBy=created&sortDir=desc"))
    expect(screen.getByPlaceholderText("admin.users.search")).toHaveAttribute("type", "search")
    fireEvent.change(screen.getByPlaceholderText("admin.users.search"), { target: { value: "" } })
    expect(screen.getByPlaceholderText("admin.users.search")).toHaveValue("")
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith("/api/users?page=1&pageSize=50&sortBy=created&sortDir=desc"))
  })

  it("uses the shared empty-state icon and explains an empty search", async () => {
    mocks.get.mockResolvedValue({ Items: [], Total: 0, Page: 1, PageSize: 50 })
    render(<Page />)
    expect(await screen.findByText("admin.users.emptyInitial")).toBeInTheDocument()
    const empty = screen.getByText("admin.users.emptyInitial").closest("[data-empty-state]")
    expect(empty?.querySelector("svg")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("admin.users.search"), { target: { value: "absent" } })
    expect(await screen.findByText("admin.users.empty")).toBeInTheDocument()
    expect(screen.getByText("admin.users.empty").closest("[data-empty-state]")?.querySelector("svg")).toBeInTheDocument()
  })

  it("filters users by account status through the API", async () => {
    render(<Page />)
    await screen.findByText("Олена Коваль")
    const statusFilter = screen.getByRole("button", { name: "admin.users.filterStatus" })
    fireEvent.keyDown(statusFilter, { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "admin.status.blocked" }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/users?status=blocked&page=1&pageSize=50&sortBy=created&sortDir=desc"))
  })

  it("offers a retry when the first page fails to load", async () => {
    mocks.get.mockRejectedValueOnce(new Error("offline"))
    render(<Page />)
    expect(await screen.findByText("admin.users.loadError")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "error.load.retry" }))
    expect(await screen.findByText("Олена Коваль")).toBeInTheDocument()
  })

  it("does not show a stale page after changing status", async () => {
    let resolveOldPage: ((page: { Items: Array<{ ID: string; FirstName: string; LastName: string; Email: string; Role: string; Status: string; CreatedAt: string }>; Total: number }) => void) | undefined
    const active = { ID: "user-1", FirstName: "Олена", LastName: "Коваль", Email: "olena@example.test", Role: "user", Status: "active", CreatedAt: "2026-09-01T00:00:00Z" }
    const blocked = { ...active, ID: "user-2", FirstName: "Іван", Status: "blocked" }
    const stale = { ...active, ID: "user-3", FirstName: "Старий" }
    mocks.get.mockImplementation((path: string) => {
      if (path.includes("page=2")) return new Promise((resolve) => { resolveOldPage = resolve })
      if (path.includes("status=blocked")) return Promise.resolve({ Items: [blocked], Total: 1 })
      return Promise.resolve({ Items: [active], Total: 51 })
    })
    render(<Page />)
    expect(await screen.findByText("Олена Коваль")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.table.next" }))
    await waitFor(() => expect(resolveOldPage).toBeDefined())
    const statusFilter = screen.getByRole("button", { name: "admin.users.filterStatus" })
    fireEvent.keyDown(statusFilter, { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "admin.status.blocked" }))
    expect(await screen.findByText("Іван Коваль")).toBeInTheDocument()
    await act(async () => resolveOldPage?.({ Items: [stale], Total: 51 }))
    expect(screen.queryByText("Старий Коваль")).not.toBeInTheDocument()
  })

  it("keeps the requested page when the idle search debounce settles", async () => {
    const first = { ID: "user-1", FirstName: "Олена", LastName: "Коваль", Email: "olena@example.test", Role: "user", Status: "active", CreatedAt: "2026-09-01T00:00:00Z" }
    mocks.get.mockResolvedValue({ Items: [first], Total: 51 })
    render(<Page />)
    await screen.findByText("Олена Коваль")
    fireEvent.click(screen.getByRole("button", { name: "admin.table.next" }))
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)))
    expect(mocks.get.mock.calls.at(-1)?.[0]).toContain("page=2")
  })

  it("lets the operator retry a failed next page", async () => {
    const first = { ID: "user-1", FirstName: "Олена", LastName: "Коваль", Email: "olena@example.test", Role: "user", Status: "active", CreatedAt: "2026-09-01T00:00:00Z" }
    mocks.get.mockResolvedValueOnce({ Items: [first], Total: 51 })
      .mockRejectedValueOnce(Object.assign(new Error("offline"), { status: 503 }))
      .mockResolvedValueOnce({ Items: [{ ...first, ID: "user-2", FirstName: "Іван" }], Total: 51 })
    render(<Page />)
    await screen.findByText("Олена Коваль")
    fireEvent.click(screen.getByRole("button", { name: "admin.table.next" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("admin.users.loadError")
    expect(screen.getByRole("alert")).toHaveTextContent("error.load.code")
    fireEvent.click(screen.getByRole("button", { name: "error.load.retry" }))
    expect(await screen.findByText("Іван Коваль")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.table.previous" }))
    expect(await screen.findByText("Олена Коваль")).toBeInTheDocument()
  })

  it("keeps existing rows visible while sorting is in flight", async () => {
    const initial = { ID: "user-1", FirstName: "Олена", LastName: "Коваль", Email: "olena@example.test", Role: "user", Status: "active", CreatedAt: "2026-09-01T00:00:00Z" }
    let resolveSorted: ((page: { Items: typeof initial[]; Total: number }) => void) | undefined
    const sorted = { ...initial, ID: "user-2", FirstName: "Іван" }
    mocks.get.mockImplementation((path: string) => path.includes("sortBy=name")
      ? new Promise((resolve) => { resolveSorted = resolve })
      : Promise.resolve({ Items: [initial], Total: 2 }))
    render(<Page />)
    await screen.findByText("Олена Коваль")
    fireEvent.click(screen.getByRole("button", { name: "admin.users.col.user" }))
    expect(screen.getByText("Олена Коваль")).toBeInTheDocument()
    expect((await screen.findAllByText("admin.table.updating")).length).toBeGreaterThan(0)
    await act(async () => resolveSorted?.({ Items: [sorted], Total: 2 }))
    expect(screen.getByText("Іван Коваль")).toBeInTheDocument()
  })

  it("changes page size and shows the total in the fixed footer", async () => {
    mocks.get.mockResolvedValue({ Items: [], Total: 125, Page: 1, PageSize: 50 })
    render(<Page />)
    expect(await screen.findByText("admin.table.total: 125")).toBeInTheDocument()
    const selector = screen.getByRole("button", { name: "admin.table.perPage" })
    fireEvent.keyDown(selector, { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "25" }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/users?page=1&pageSize=25&sortBy=created&sortDir=desc"))
  })
})

describe("admin users page query string", () => {
  beforeEach(() => {
    setTestUrl("")
    mocks.get.mockReset()
    mocks.get.mockResolvedValue({ Items: [], Total: 0 })
  })
  it("restores filters, sort and page from the URL and keeps the header while empty", async () => {
    setTestUrl("status=blocked&sort=name&dir=asc&page=2")
    render(<Page />)
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/users?status=blocked&page=2&pageSize=50&sortBy=name&sortDir=asc"))
    expect(await screen.findByText("admin.users.empty")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /admin.users.col.user/ })).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })
  it("writes a changed sort to the URL and leaves defaults out", async () => {
    render(<Page />)
    await screen.findByText("admin.users.emptyInitial")
    expect(testUrl()).toBe("")
    fireEvent.click(screen.getByRole("button", { name: "admin.users.col.user" }))
    await waitFor(() => expect(testUrl()).toBe("sort=name"+String.fromCharCode(38)+"dir=asc"))
  })
})
