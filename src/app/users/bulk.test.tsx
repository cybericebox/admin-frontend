import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/api/client", () => ({ apiGet: mocks.get, apiPost: mocks.post, mediaUrl: (src: string) => src, ApiError: class extends Error {} }))
vi.mock("@/i18n/t", () => ({ t: (key: string, vars?: Record<string, unknown>) => vars ? `${key}:${JSON.stringify(vars)}` : key }))
vi.mock("@/components/ui/toast", () => ({ toast: mocks.toast }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true, me: { ID: "me" }, role: "admin" }) }))
vi.mock("@/components/users/InviteUsersDialog", () => ({ default: () => null }))

import Page from "./page"

const row = (id: string, over: Record<string, unknown> = {}) => ({ ID: id, FirstName: id, LastName: "Тест", Email: `${id}@example.test`, Role: "user", Status: "active", CreatedAt: "2026-09-01T00:00:00Z", ...over })

describe("admin users table standard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.history.replaceState(null, "", "/test/")
    mocks.get.mockResolvedValue({ Items: [row("anna"), row("boris", { Status: "incomplete" }), row("me", { ID: "me" }), row("root", { Role: "super_admin" })], Total: 4 })
    mocks.post.mockResolvedValue({ Results: [{ ID: "anna", Ok: true }] })
  })

  it("shows the found count in the header, avatar with the name and a sortable column for every data column", async () => {
    render(<Page />)
    await screen.findByText("anna Тест")
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("4")
    for (const column of ["user", "email", "role", "status", "signIn", "lastSeen", "created"]) expect(screen.getByRole("button", { name: new RegExp(`admin.users.col.${column}`) })).toBeInTheDocument()
  })

  it("sends a chosen filter to the API, keeps it in the URL and resets it in one click", async () => {
    render(<Page />)
    await screen.findByText("anna Тест")
    expect(screen.queryByRole("button", { name: "admin.table.resetFilters" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /admin.table.addFilter/ }))
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /admin.users.filterConfirmed/ }))
    fireEvent.click(await screen.findByRole("radio", { name: "admin.table.no" }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(expect.stringContaining("emailConfirmed=false")))
    expect(window.location.search).toContain("f.confirmed=is%3Afalse")
    fireEvent.click(screen.getByRole("button", { name: "admin.table.resetFilters" }))
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith("/api/users?page=1&pageSize=50&sortBy=created&sortDir=desc"))
    expect(window.location.search).toBe("")
  })

  it("keeps the view: hiding a column removes it and the choice is remembered", async () => {
    const { unmount } = render(<Page />)
    await screen.findByText("anna Тест")
    fireEvent.click(screen.getByRole("button", { name: /admin.table.columns/ }))
    fireEvent.click(await screen.findByRole("checkbox", { name: "admin.users.col.email" }))
    await waitFor(() => expect(screen.queryByRole("columnheader", { name: /admin.users.col.email/ })).not.toBeInTheDocument())
    unmount()
    render(<Page />)
    await screen.findByText("anna Тест")
    expect(screen.queryByRole("columnheader", { name: /admin.users.col.email/ })).not.toBeInTheDocument()
  })

  it("does not let the viewer or a higher role be selected", async () => {
    render(<Page />)
    await screen.findByText("anna Тест")
    expect(screen.getByRole("checkbox", { name: /selectRow.*anna/ })).toBeEnabled()
    expect(screen.getByRole("checkbox", { name: /selectRow.*me Тест/ })).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: /selectRow.*root/ })).toBeDisabled()
  })

  it("runs a bulk action only after a confirmation that names the count", async () => {
    render(<Page />)
    await screen.findByText("anna Тест")
    fireEvent.click(screen.getByRole("checkbox", { name: "admin.table.selectAll" }))
    expect(screen.getByRole("region", { name: "admin.table.selection.label" })).toHaveTextContent("\"count\":2")
    fireEvent.click(screen.getByRole("button", { name: "admin.users.bulk.block" }))
    expect(mocks.post).not.toHaveBeenCalled()
    expect(await screen.findByText(/admin.users.bulk.block.title.\w+:{"count":2}/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.users.bulk.block.confirm" }))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/api/users/bulk/block", { UserIDs: ["anna", "boris"] }))
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(expect.stringContaining("admin.users.bulk.partial")))
    expect(screen.queryByRole("region", { name: "admin.table.selection.label" })).not.toBeInTheDocument()
  })

  it("offers «send again» on an incomplete sign-up only", async () => {
    render(<Page />)
    await screen.findByText("anna Тест")
    const buttons = screen.getAllByRole("button", { name: /admin.users.resend.button/ })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/api/users/boris/invitation/resend", {}))
  })
})
