import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ get: vi.fn(), allowed: true }))
vi.mock("@/api/client", () => ({ apiGet: mocks.get }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/lib/origins", async (original) => ({ ...(await original<object>()), exercisesOrigin: "https://exercises.example.test" }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => mocks.allowed || permission !== "platform.audit.read" }) }))

import Page from "./page"

const ACTOR = "11111111-1111-4111-8111-111111111111"
const EVENT = "22222222-2222-4222-8222-222222222222"
const row = (over: object = {}) => ({ ID: "r1", ActorID: ACTOR, Permission: "events.write", Method: "PATCH", Route: "/api/events/:id", ResponseStatus: 200, CreatedAt: new Date().toISOString(), Target: `event:${EVENT}`, ...over })

function answer(rows: object[]) {
  mocks.get.mockImplementation((path: string) => {
    if (path.startsWith("/api/users/")) return Promise.resolve({ ID: ACTOR, FirstName: "Олена", LastName: "Коваль", Email: "o@example.test" })
    if (path.startsWith("/api/users?")) return Promise.resolve({ Items: [{ ID: ACTOR, FirstName: "Олена", LastName: "Коваль", Email: "o@example.test" }], Total: 1 })
    return Promise.resolve(rows)
  })
}

describe("admin audit log page", () => {
  beforeEach(() => { mocks.get.mockReset(); mocks.allowed = true; answer([row()]) })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it("lists records with the actor and the target as links", async () => {
    render(<Page />)
    const actor = await screen.findByRole("link", { name: "Олена Коваль" })
    expect(actor).toHaveAttribute("href", `/users/detail?id=${ACTOR}`)
    expect(screen.getByRole("link", { name: /admin.audit.target.event 22222222/ })).toHaveAttribute("href", `/events/detail?id=${EVENT}`)
    expect(screen.getByText("events.write")).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith("/api/admin/audit-log")
  })

  it("shows nothing without platform.audit.read", () => {
    mocks.allowed = false
    render(<Page />)
    expect(screen.getByText("admin.audit.noAccess")).toBeInTheDocument()
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it("debounces the text filters into one request and keeps the rows meanwhile", async () => {
    render(<Page />)
    await screen.findByText("events.write")
    vi.useFakeTimers()
    const input = screen.getByLabelText("admin.audit.col.permission")
    fireEvent.change(input, { target: { value: "ev" } })
    fireEvent.change(input, { target: { value: "events.read" } })
    const before = mocks.get.mock.calls.length
    expect(mocks.get.mock.calls.filter(([path]) => String(path).includes("permission="))).toHaveLength(0)
    expect(screen.getByText("events.write")).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(350) })
    expect(mocks.get.mock.calls.length).toBe(before + 1)
    expect(mocks.get).toHaveBeenCalledWith("/api/admin/audit-log?permission=events.read")
  })

  it("filters by status within the loaded records and shows the filtered empty state", async () => {
    answer([row(), row({ ID: "r2", ResponseStatus: 403, Permission: "users.write" })])
    render(<Page />)
    await screen.findByText("users.write")
    fireEvent.keyDown(screen.getByRole("button", { name: "admin.audit.filter.status" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "admin.audit.filter.statusServer" }))
    expect(await screen.findByText("admin.audit.emptyFiltered")).toBeInTheDocument()
  })

  it("shows the empty state, and a load error with retry", async () => {
    answer([])
    const { unmount } = render(<Page />)
    expect(await screen.findByText("admin.audit.empty")).toBeInTheDocument()
    unmount()
    mocks.get.mockReset()
    answer([row()])
    mocks.get.mockRejectedValueOnce(new Error("boom"))
    render(<Page />)
    expect(await screen.findByText("admin.audit.loadError")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "error.load.retry" }))
    await waitFor(() => expect(screen.getByText("events.write")).toBeInTheDocument())
  })
})
