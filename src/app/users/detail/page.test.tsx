import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), del: vi.fn(), push: vi.fn(), canWrite: true, permissions: ["*"] }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("id=user-1"), useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/api/client", () => ({ apiGet: mocks.get, apiPatch: mocks.patch, apiDelete: mocks.del }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({
  can: (permission: string) => mocks.canWrite || permission === "users.read",
  permissions: mocks.permissions, me: { ID: "admin-1" },
}) }))

import Page from "./page"

const user = {
  ID: "user-1", FirstName: "Олена", LastName: "Коваль", Email: "olena@example.test",
  Role: "user", Status: "active", EmailConfirmed: true, Picture: "",
  SignInMethods: ["email"], LastSeen: "", CreatedAt: "2026-09-01T00:00:00Z",
}

describe("admin user detail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockReset()
    mocks.patch.mockReset()
    mocks.del.mockReset()
    mocks.canWrite = true
    mocks.permissions = ["*"]
    mocks.get.mockResolvedValue(user)
    mocks.patch.mockResolvedValue(undefined)
    mocks.del.mockResolvedValue(undefined)
  })

  it("loads user details and blocks the account through the admin API", async () => {
    render(<Page />)
    expect(await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })).toBeInTheDocument()
    expect(screen.getByText("olena@example.test")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.userDetail.block" }))
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("/api/users/user-1/status", { Status: "blocked" }))
  })

  it("shows a read-only profile without mutation permissions", async () => {
    mocks.canWrite = false
    render(<Page />)
    expect(await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "admin.userDetail.block" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "admin.userDetail.delete" })).not.toBeInTheDocument()
  })

  it("shows a retry for a temporary detail request failure", async () => {
    mocks.get.mockRejectedValueOnce(new Error("offline"))
    render(<Page />)
    expect(await screen.findByText("admin.userDetail.loadError")).toBeInTheDocument()
    expect(screen.queryByText("admin.userDetail.notFound")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "error.load.retry" }))
    expect(await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })).toBeInTheDocument()
  })

  it("does not offer a blocked-status action for an incomplete account", async () => {
    mocks.get.mockResolvedValue({ ...user, Status: "incomplete" })
    render(<Page />)
    expect(await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "admin.userDetail.block" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "admin.userDetail.unblock" })).not.toBeInTheDocument()
  })

  it("reports a failed deletion inside the dialog and keeps it open", async () => {
    mocks.del.mockRejectedValueOnce(new Error("delete failed"))
    render(<Page />)
    await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })
    fireEvent.click(screen.getByRole("button", { name: "admin.userDetail.delete" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "admin.userDetail.delete" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("admin.userDetail.actionError")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("refreshes the account status after blocking", async () => {
    mocks.get.mockResolvedValueOnce(user).mockResolvedValueOnce({ ...user, Status: "blocked" })
    render(<Page />)
    await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })
    fireEvent.click(screen.getByRole("button", { name: "admin.userDetail.block" }))
    expect(await screen.findByRole("button", { name: "admin.userDetail.unblock" })).toBeInTheDocument()
  })

  it("deletes the account only after confirmation and returns to users", async () => {
    render(<Page />)
    await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })
    fireEvent.click(screen.getByRole("button", { name: "admin.userDetail.delete" }))
    expect(mocks.del).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "admin.userDetail.delete" }))
    await waitFor(() => expect(mocks.del).toHaveBeenCalledWith("/api/users/user-1"))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/users"))
  })

  it("changes a role through the admin API and refreshes the displayed role", async () => {
    mocks.get.mockResolvedValueOnce(user).mockResolvedValueOnce({ ...user, Role: "admin_viewer" })
    render(<Page />)
    await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })
    fireEvent.keyDown(screen.getByRole("button", { name: "admin.userDetail.changeRole" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "role.admin_viewer" }))
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("/api/users/user-1/role", { Role: "admin_viewer" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "admin.userDetail.changeRole" })).toHaveTextContent("role.admin_viewer"))
  })

  it("hides all account mutations for a super administrator from an ordinary administrator", async () => {
    mocks.permissions = ["users"]
    mocks.get.mockResolvedValue({ ...user, Role: "super_admin" })
    render(<Page />)
    expect(await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "admin.userDetail.changeRole" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "admin.userDetail.block" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "admin.userDetail.delete" })).not.toBeInTheDocument()
    expect(screen.getByText("admin.userDetail.protectedSuperAdmin")).toBeInTheDocument()
  })

  it("shows the block optimistically and keeps other controls enabled while the save is pending", async () => {
    let finish: () => void = () => {}
    mocks.patch.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    render(<Page />)
    await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })
    fireEvent.click(screen.getByRole("button", { name: "admin.userDetail.block" }))
    expect(await screen.findByRole("button", { name: "admin.userDetail.unblock" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "admin.userDetail.changeRole" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "admin.userDetail.delete" })).toBeEnabled()
    expect(screen.queryByText("admin.loading")).not.toBeInTheDocument()
    finish()
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1))
  })

  it("rolls the role back and reports an error when the save fails, without a loader", async () => {
    mocks.patch.mockRejectedValueOnce(new Error("nope"))
    render(<Page />)
    await screen.findByRole("heading", { level: 1, name: "Олена Коваль" })
    fireEvent.keyDown(screen.getByRole("button", { name: "admin.userDetail.changeRole" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "role.admin_viewer" }))
    expect(screen.getByRole("button", { name: "admin.userDetail.changeRole" })).toHaveTextContent("role.admin_viewer")
    await waitFor(() => expect(screen.getByRole("button", { name: "admin.userDetail.changeRole" })).toHaveTextContent("role.user"))
    expect(screen.queryByText("admin.loading")).not.toBeInTheDocument()
  })
})
