import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BroadcastsList } from "./BroadcastsList"

const api = vi.hoisted(() => ({ list: vi.fn(), push: vi.fn() }))
vi.mock("@/api/notifications/broadcasts", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/notifications/broadcasts")>()), listBroadcasts: api.list }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

const row = (id: string, extra = {}) => ({
  ID: id, ScopeEventID: null, EventName: "", CreatedBy: "u1", CreatedByName: "Ірина", Channels: ["email", "in_app"], Subject: `Тема ${id}`, Preheader: "",
  EmailBody: [], EmailStyling: {}, InAppTitle: "", InAppBody: "", InAppLink: "", Audience: { Kind: "roles", Roles: ["admin"] },
  RecipientCount: 5, SentCount: 4, FailedCount: 1, Status: "done", CreatedAt: "2026-09-01T10:00:00Z", FinishedAt: null, ...extra,
})

describe("broadcast history", () => {
  beforeEach(() => { api.list.mockReset(); api.push.mockReset() })

  it("shows a loader while the list loads", () => {
    api.list.mockReturnValue(new Promise(() => {}))
    render(<BroadcastsList />)
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: "Надіслати повідомлення" })).toHaveAttribute("href", "/notifications/broadcasts/new")
  })

  it("shows the empty state", async () => {
    api.list.mockResolvedValue({ Items: [], Total: 0 })
    render(<BroadcastsList />)
    expect(await screen.findByText("Розсилок ще не було")).toBeInTheDocument()
  })

  it("shows the load error and retries", async () => {
    api.list.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ Items: [row("a")], Total: 1 })
    render(<BroadcastsList />)
    fireEvent.click(await screen.findByRole("button", { name: "Спробувати ще раз" }))
    expect(await screen.findByText("Тема a")).toBeInTheDocument()
  })

  it("lists rows, opens the details and pages by cursor", async () => {
    api.list.mockResolvedValueOnce({ Items: [row("a")], Total: 2, NextCursor: "c2" }).mockResolvedValueOnce({ Items: [row("b", { Subject: "", InAppTitle: "Заголовок" })], Total: 2 })
    render(<BroadcastsList />)
    expect(await screen.findByText("Тема a")).toBeInTheDocument()
    expect(screen.getByText("Електронна пошта, У застосунку")).toBeInTheDocument()
    expect(screen.getByText("Ірина")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Тема a").closest("tr")!)
    expect(api.push).toHaveBeenCalledWith("/notifications/broadcasts/detail?id=a")
    fireEvent.click(screen.getByRole("button", { name: "Далі" }))
    expect(await screen.findByText("Заголовок")).toBeInTheDocument()
    expect(api.list).toHaveBeenLastCalledWith({ limit: 25, cursor: "c2" })
    await waitFor(() => expect(screen.getByRole("button", { name: "Далі" })).toBeDisabled())
  })
})
