import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { InboxButton } from "./InboxButton"

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))
const access = vi.hoisted(() => ({ allowed: true }))
vi.mock("@/api/client", () => ({ apiGet: api.get, apiPatch: api.patch }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => access.allowed }) }))

describe("top-bar inbox", () => {
  beforeEach(() => {
    api.get.mockReset()
    api.patch.mockReset()
    access.allowed = true
    api.get.mockResolvedValue([{ ID: "1", Title: "Запрошення", Body: "Деталі запрошення", Link: "", ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z" }])
    api.patch.mockResolvedValue(undefined)
  })

  it("opens personal inbox in place and marks the selected message read", async () => {
    render(<InboxButton />)
    expect(await screen.findByText("1")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Вхідні/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Вхідні: 1 непрочитаних" }))
    fireEvent.click(await screen.findByRole("button", { name: /Запрошення/ }))
    expect(screen.getByText("Деталі запрошення")).toBeInTheDocument()
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/api/notifications/inbox/1/read", {}))
  })

  it("marks all messages read without leaving the current page", async () => {
    render(<InboxButton />)
    fireEvent.click(await screen.findByRole("button", { name: "Вхідні: 1 непрочитаних" }))
    fireEvent.click(await screen.findByRole("button", { name: "Позначити все прочитаним" }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/api/notifications/inbox/read-all", {}))
    expect(screen.getByRole("button", { name: "Вхідні" })).toBeInTheDocument()
  })

  it("centers the unframed shared icon and disables read-all when the inbox is empty", async () => {
    api.get.mockResolvedValue([])
    render(<InboxButton />)
    fireEvent.click(screen.getByRole("button", { name: "Вхідні" }))
    const empty = await screen.findByText("Повідомлень поки немає.")
    expect(empty.closest("[data-empty-state]")?.querySelector("svg path")?.getAttribute("d"))
      .toBe("M4.5 5.5h15L21.5 18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2l2-12.5Z")
    expect(empty.closest("[data-empty-state]")?.querySelector("span")).not.toHaveClass("border")
    expect(empty.closest("[data-empty-state]")?.querySelector("svg")).toHaveClass("h-8", "w-8")
    expect(screen.getByRole("button", { name: "Позначити все прочитаним" })).toBeDisabled()
    expect(document.querySelectorAll("svg.lucide-bell")).toHaveLength(2)
  })

  it("is absent without access to own notifications", () => {
    access.allowed = false
    render(<InboxButton />)
    expect(screen.queryByRole("button", { name: /Вхідні/ })).not.toBeInTheDocument()
  })
})
