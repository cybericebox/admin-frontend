import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ get: vi.fn(), allowed: true }))
vi.mock("@/api/client", () => ({ apiGet: mocks.get }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/lib/origins", async (original) => ({ ...(await original<object>()), exercisesOrigin: "https://exercises.example.test" }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => mocks.allowed || permission !== "platform.audit.read" }) }))

import Page from "./page"

const ACTOR = "11111111-1111-4111-8111-111111111111"
const EVENT = "22222222-2222-4222-8222-222222222222"
const row = (over: object = {}) => ({ ID: "r1", ActorID: ACTOR, Permission: "events.write", Method: "PATCH", Route: "/api/events/:id", ResponseStatus: 200, CreatedAt: new Date().toISOString(), Target: `event:${EVENT}`, ...over })

const pageOf = (rows: object[], next = "") => ({ Items: rows, NextCursor: next })

function answer(rows: object[], next = "") {
  mocks.get.mockImplementation((path: string) => {
    if (path.startsWith("/api/users/")) return Promise.resolve({ ID: ACTOR, FirstName: "Олена", LastName: "Коваль", Email: "o@example.test" })
    if (path.startsWith("/api/users?")) return Promise.resolve({ Items: [{ ID: ACTOR, FirstName: "Олена", LastName: "Коваль", Email: "o@example.test" }], Total: 1 })
    return Promise.resolve(pageOf(rows, next))
  })
}

/** «+ Додати фільтр» → the field → its value (a choice) in the editor that opens. */
async function addChoice(field: string, option: string) {
  fireEvent.click(screen.getByRole("button", { name: /admin.table.addFilter/ }))
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: new RegExp(field) }))
  fireEvent.click(await screen.findByRole("checkbox", { name: option }))
}

describe("admin audit log page", () => {
  beforeEach(() => { window.history.replaceState(null, "", "/audit/"); mocks.get.mockReset(); mocks.allowed = true; answer([row()]) })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it("lists records with the actor and the target as links", async () => {
    render(<Page />)
    const actor = await screen.findByRole("link", { name: "Олена Коваль" })
    expect(actor).toHaveAttribute("href", `/users/detail?id=${ACTOR}`)
    expect(screen.getByRole("link", { name: /admin.audit.target.event 22222222/ })).toHaveAttribute("href", `/events/detail?id=${EVENT}`)
    expect(screen.getByText("events.write")).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith("/api/admin/audit-log")
  })

  it("keeps the filters in the address as chips and starts from them", async () => {
    render(<Page />)
    await screen.findByText("events.write")
    await addChoice("admin.audit.filter.status", "admin.audit.filter.status_5xx")
    await waitFor(() => expect(window.location.search).toBe("?f.status=in%3A5xx"))
    cleanup()
    render(<Page />)
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith("/api/admin/audit-log?status=5xx"))
    expect(screen.getByRole("button", { name: /admin.table.filterEdit/ })).toBeInTheDocument()
  })

  it("shows nothing without platform.audit.read", () => {
    mocks.allowed = false
    render(<Page />)
    expect(screen.getByText("admin.audit.noAccess")).toBeInTheDocument()
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it("sends a text filter once it is applied and keeps the rows meanwhile", async () => {
    render(<Page />)
    await screen.findByText("events.write")
    fireEvent.click(screen.getByRole("button", { name: /admin.table.addFilter/ }))
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /admin.audit.col.permission/ }))
    fireEvent.change(await screen.findByLabelText("admin.audit.col.permission"), { target: { value: "events.read" } })
    fireEvent.click(await screen.findByRole("button", { name: "admin.table.apply" }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/admin/audit-log?permission=events.read"))
    expect(screen.getByText("events.write")).toBeInTheDocument()
  })

  it("sends status, method and target filters to the server", async () => {
    render(<Page />)
    await screen.findByText("events.write")
    await addChoice("admin.audit.filter.status", "admin.audit.filter.status_5xx")
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/admin/audit-log?status=5xx"))
    fireEvent.keyDown(document.body, { key: "Escape" })
    await addChoice("admin.audit.filter.method", "DELETE")
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/admin/audit-log?method=DELETE&status=5xx"))
    fireEvent.keyDown(document.body, { key: "Escape" })
    await addChoice("admin.audit.filter.kindLabel", "admin.audit.target.team")
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/admin/audit-log?method=DELETE&status=5xx&targetKind=team"))
  })

  it("has quick filters: errors and today", async () => {
    render(<Page />)
    await screen.findByText("events.write")
    fireEvent.click(screen.getByRole("button", { name: "admin.audit.preset.errors" }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/admin/audit-log?status=5xx"))
    expect(screen.getByRole("button", { name: "admin.audit.preset.errors" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "admin.audit.preset.today" }))
    await waitFor(() => expect(mocks.get.mock.calls.some(([path]) => String(path).includes("status=5xx") && String(path).includes("from="))).toBe(true))
    fireEvent.click(screen.getByRole("button", { name: "admin.table.resetFilters" }))
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith("/api/admin/audit-log"))
  })

  it("appends the next page with «show more» and keeps the earlier rows", async () => {
    mocks.get.mockImplementation((path: string) => {
      if (path.startsWith("/api/users")) return Promise.resolve({ ID: ACTOR, FirstName: "О", LastName: "К", Email: "o@example.test" })
      return Promise.resolve(path.includes("cursor=c1") ? pageOf([row({ ID: "r2", Permission: "users.write" })]) : pageOf([row()], "c1"))
    })
    render(<Page />)
    await screen.findByText("events.write")
    fireEvent.click(screen.getByRole("button", { name: "admin.audit.showMore" }))
    expect(await screen.findByText("users.write")).toBeInTheDocument()
    expect(screen.getByText("events.write")).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith("/api/admin/audit-log?cursor=c1")
    expect(screen.queryByRole("button", { name: "admin.audit.showMore" })).not.toBeInTheDocument()
  })

  it("keeps the rows while a changed filter loads and ignores the stale answer", async () => {
    render(<Page />)
    await screen.findByText("events.write")
    let resolve: (value: unknown) => void = () => {}
    mocks.get.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    fireEvent.click(screen.getByRole("button", { name: "admin.audit.preset.errors" }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/admin/audit-log?status=5xx"))
    expect(screen.getByText("events.write")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.audit.preset.errors" }))
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith("/api/admin/audit-log"))
    await screen.findByText("events.write")
    resolve(pageOf([row({ ID: "old", Permission: "stale.perm" })]))
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText("stale.perm")).not.toBeInTheDocument()
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
