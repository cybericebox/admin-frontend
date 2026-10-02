import { beforeEach, describe, expect, it, vi } from "vitest"
import { StrictMode } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const post = vi.hoisted(() => vi.fn())
const FakeApiError = vi.hoisted(() => class FakeApiError extends Error {
  constructor(public status: number, public retryAfter?: number) { super("x") }
})
vi.mock("@/api/client", () => ({ apiPost: post, ApiError: FakeApiError }))
vi.mock("@/i18n/t", () => ({ t: (key: string, v?: Record<string, number>) => key === "admin.users.invite.summary" && v ? `${v.invited} / ${v.skipped} / ${v.failed}` : key }))
const callerRole = vi.hoisted(() => ({ value: "super_admin" }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true, role: callerRole.value }) }))

import InviteUsersDialog from "./InviteUsersDialog"
import { toast } from "@/components/ui/toast"

describe("InviteUsersDialog", () => {
  beforeEach(() => { vi.clearAllMocks(); post.mockResolvedValue([{ Email: "new@example.test" }]) })

  it("submits a bulk invitation with the least-privileged default role", async () => {
    render(<InviteUsersDialog open onOpenChange={vi.fn()} />)
    const input = screen.getByPlaceholderText("admin.users.invite.emailPlaceholder")
    fireEvent.change(input, { target: { value: "new@example.test" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "admin.users.invite.submit" }))
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/users/invite", { Entries: [{ Email: "new@example.test", FirstName: "", LastName: "", Role: "user" }] }))
    expect(await screen.findByText("admin.users.invite.outcome.invited")).toBeInTheDocument()
  })

  it("keeps the request failed state available for retry", async () => {
    post.mockRejectedValueOnce(new Error("offline"))
    const error = vi.spyOn(toast, "error")
    render(<InviteUsersDialog open onOpenChange={vi.fn()} />)
    const input = screen.getByPlaceholderText("admin.users.invite.emailPlaceholder")
    fireEvent.change(input, { target: { value: "new@example.test" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "admin.users.invite.submit" }))
    await waitFor(() => expect(error).toHaveBeenCalledWith("admin.users.invite.error"))
    expect(screen.getByRole("button", { name: "admin.users.invite.submit" })).toBeEnabled()
  })

  it("shows the wait time when the server answers 429", async () => {
    post.mockRejectedValueOnce(new FakeApiError(429, 30))
    const error = vi.spyOn(toast, "error")
    render(<InviteUsersDialog open onOpenChange={vi.fn()} />)
    const input = screen.getByPlaceholderText("admin.users.invite.emailPlaceholder")
    fireEvent.change(input, { target: { value: "new@example.test" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "admin.users.invite.submit" }))
    await waitFor(() => expect(error).toHaveBeenCalledWith("admin.users.invite.rateLimited"))
  })

  it("does not claim success for an address missing from a partial response", async () => {
    post.mockResolvedValueOnce([{ Email: "first@example.test" }])
    render(<InviteUsersDialog open onOpenChange={vi.fn()} />)
    const input = screen.getByPlaceholderText("admin.users.invite.emailPlaceholder")
    for (const email of ["first@example.test", "second@example.test"]) {
      fireEvent.change(input, { target: { value: email } })
      fireEvent.keyDown(input, { key: "Enter" })
    }
    fireEvent.click(screen.getByRole("button", { name: "admin.users.invite.submit" }))
    expect(await screen.findByText("admin.users.invite.outcome.failed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.users.invite.retry" })).toBeEnabled()
  })

  it("does not offer an empty resubmission when every address is already registered", async () => {
    post.mockResolvedValueOnce([{ Email: "new@example.test", Code: "user_exists" }])
    render(<InviteUsersDialog open onOpenChange={vi.fn()} />)
    const input = screen.getByPlaceholderText("admin.users.invite.emailPlaceholder")
    fireEvent.change(input, { target: { value: "new@example.test" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "admin.users.invite.submit" }))
    expect(await screen.findByText("admin.users.invite.outcome.exists")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.users.invite.submit" })).toBeDisabled()
  })

  it("counts one successful invitation once under StrictMode", async () => {
    const success = vi.spyOn(toast, "success")
    render(<StrictMode><InviteUsersDialog open onOpenChange={vi.fn()} /></StrictMode>)
    const input = screen.getByPlaceholderText("admin.users.invite.emailPlaceholder")
    fireEvent.change(input, { target: { value: "new@example.test" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "admin.users.invite.submit" }))
    await waitFor(() => expect(success).toHaveBeenCalledWith("1 / 0 / 0"))
    expect(success).toHaveBeenCalledTimes(1)
  })

  it("does not close while an invitation request is in flight", async () => {
    let complete: ((value: Array<{ Email: string }>) => void) | undefined
    post.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve }))
    const onOpenChange = vi.fn()
    render(<InviteUsersDialog open onOpenChange={onOpenChange} />)
    const input = screen.getByPlaceholderText("admin.users.invite.emailPlaceholder")
    fireEvent.change(input, { target: { value: "new@example.test" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "admin.users.invite.submit" }))
    expect(complete).toBeDefined()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    complete?.([{ Email: "new@example.test" }])
    expect(await screen.findByText("admin.users.invite.outcome.invited")).toBeInTheDocument()
  })

  it("imports a CSV with names and per-row roles and sends the batch", async () => {
    post.mockResolvedValueOnce([{ Email: "first@example.test" }, { Email: "second@example.test" }])
    render(<InviteUsersDialog open onOpenChange={vi.fn()} />)
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(fileInput).not.toBeNull()
    const csv = "Last_Name,EMAIL,first_name,role\nKoval,first@example.test,Olena,admin\n,second@example.test,,\n,FIRST@example.test,,\n"
    fireEvent.change(fileInput!, { target: { files: [new File([csv], "users.csv", { type: "text/csv" })] } })
    expect(await screen.findByText("first@example.test")).toBeInTheDocument()
    expect(screen.getByText("users.csv")).toBeInTheDocument()
    expect(screen.getByText("second@example.test")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.users.invite.submit" }))
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/users/invite", { Entries: [
      { Email: "first@example.test", FirstName: "Olena", LastName: "Koval", Role: "admin" },
      { Email: "second@example.test", FirstName: "", LastName: "", Role: "user" },
    ] }))
  })

  it("shows invalid addresses as chips and blocks sending until they are removed", async () => {
    render(<InviteUsersDialog open onOpenChange={vi.fn()} />)
    const input = screen.getByPlaceholderText("admin.users.invite.emailPlaceholder")
    fireEvent.paste(input, { clipboardData: { getData: () => "ok@example.test broken" } })
    expect(await screen.findByText("broken")).toBeInTheDocument()
    expect(screen.getByText("admin.users.invite.invalidCount")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.users.invite.submit" })).toBeDisabled()
    fireEvent.click(screen.getAllByRole("button", { name: "admin.users.invite.removeChip" })[1])
    expect(screen.getByRole("button", { name: "admin.users.invite.submit" })).toBeEnabled()
  })

  it("sends pasted addresses with the selected assignable role", async () => {
    post.mockResolvedValueOnce([{ Email: "first@example.test" }, { Email: "second@example.test" }])
    render(<InviteUsersDialog open onOpenChange={vi.fn()} />)
    const input = screen.getByPlaceholderText("admin.users.invite.emailPlaceholder")
    fireEvent.paste(input, { clipboardData: { getData: () => "first@example.test; SECOND@example.test first@example.test" } })
    expect(await screen.findByText("first@example.test")).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("button", { name: "role.user" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "role.admin" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.users.invite.submit" }))
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/users/invite", { Entries: [{ Email: "first@example.test", FirstName: "", LastName: "", Role: "admin" }, { Email: "second@example.test", FirstName: "", LastName: "", Role: "admin" }] }))
  })

  it("offers an admin no role of admin or above", async () => {
    callerRole.value = "admin"
    try {
      render(<InviteUsersDialog open onOpenChange={vi.fn()} />)
      fireEvent.keyDown(screen.getByRole("button", { name: "role.user" }), { key: "ArrowDown" })
      expect(await screen.findByRole("menuitemradio", { name: "role.admin_viewer" })).toBeInTheDocument()
      expect(screen.queryByRole("menuitemradio", { name: "role.admin" })).not.toBeInTheDocument()
      expect(screen.queryByRole("menuitemradio", { name: "role.super_admin" })).not.toBeInTheDocument()
    } finally {
      callerRole.value = "super_admin"
    }
  })
})
