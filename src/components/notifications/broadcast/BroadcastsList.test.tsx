import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BroadcastsList } from "./BroadcastsList"

const api = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock("@/api/notifications/broadcasts", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/notifications/broadcasts")>()), listBroadcastsPage: api.list }))
vi.mock("@/api/tablePrefs", () => ({ getTablePrefs: () => Promise.resolve(null), putTablePrefs: () => Promise.resolve({}), deleteTablePrefs: () => Promise.resolve() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/notifications/broadcasts", useSearchParams: () => new URLSearchParams() }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

const row = (id: string, extra = {}) => ({
  ID: id, ScopeEventID: null, EventName: "", CreatedBy: "u1", CreatedByName: "Ірина", Channels: ["email", "in_app"], Subject: `Тема ${id}`, Preheader: "",
  EmailBody: [], EmailStyling: {}, InAppTitle: "", InAppBody: "", InAppLink: "", Audience: { Kind: "roles", Roles: ["admin"] },
  RecipientCount: 5, SentCount: 4, FailedCount: 1, Status: "done", CreatedAt: "2026-09-01T10:00:00Z", FinishedAt: null, ...extra,
})

describe("broadcast history", () => {
  beforeEach(() => { api.list.mockReset() })

  it("shows the empty state and the send link", async () => {
    api.list.mockResolvedValue({ Items: [], Total: 0 })
    render(<BroadcastsList />)
    expect(await screen.findByText("Розсилок ще не було")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Надіслати повідомлення" })).toHaveAttribute("href", "/notifications/broadcasts/new")
  })

  it("shows the load error and retries", async () => {
    api.list.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ Items: [row("a")], Total: 1 })
    render(<BroadcastsList />)
    fireEvent.click(await screen.findByRole("button", { name: "Спробувати ще раз" }))
    expect(await screen.findByText("Тема a")).toBeInTheDocument()
  })

  it("lists rows with a link to the details, newest first from the server", async () => {
    api.list.mockResolvedValue({ Items: [row("a"), row("b", { Subject: "", InAppTitle: "Заголовок" })], Total: 2 })
    render(<BroadcastsList />)
    expect(await screen.findByRole("link", { name: "Тема a" })).toHaveAttribute("href", "/notifications/broadcasts/detail?id=a")
    expect(screen.getByRole("link", { name: "Заголовок" })).toBeInTheDocument()
    await waitFor(() => expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, sortBy: "created", sortDir: "desc", status: "", search: "" })))
  })
})
