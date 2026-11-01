import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), blob: vi.fn() }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: api.get, apiPost: api.post, apiGetBlob: api.blob }))
vi.mock("@/i18n/t", () => ({ t: (key: string, vars?: Record<string, unknown>) => vars ? `${key}:${JSON.stringify(vars)}` : key }))
vi.mock("@/components/notifications/editor/EmailPreview", () => ({ EmailPreview: () => <div>email preview</div> }))
vi.mock("@/components/notifications/editor/InAppPreview", () => ({ InAppPreview: () => <div>in-app preview</div> }))
import { BroadcastDetail } from "./BroadcastDetail"

const broadcast = { ID: "b1", Channels: ["email"], Subject: "Новини", Preheader: "", EmailBody: [], EmailStyling: null, InAppTitle: "", InAppBody: "", InAppLink: "", Audience: { Kind: "all" }, RecipientCount: 120, SentCount: 40, FailedCount: 2, Status: "sending", CreatedAt: "2026-10-01T10:00:00Z", FinishedAt: null, CreatedByName: "Олена" }
const delivery = { DispatchID: "d1", RecipientUserID: "11111111-1111-1111-1111-111111111111", RecipientEmail: "ann@example.test", DispatchStatus: "done", Channel: "email", TargetStatus: "error", Error: "mailbox full" }

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockImplementation((path: string) => path.includes("/deliveries") ? Promise.resolve({ Items: [delivery], Total: 120, Page: 1, PageSize: 50 }) : Promise.resolve(broadcast))
})

describe("BroadcastDetail", () => {
  it("pages the deliveries, filters them by status and keeps the rows while the next page loads", async () => {
    render(<BroadcastDetail id="b1" />)
    expect(await screen.findByText("ann@example.test")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.table.next" }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining("/deliveries?page=2&pageSize=50")))
    expect(screen.getByText("ann@example.test")).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("button", { name: "admin.notif.broadcast.deliveryFilter" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "admin.notif.broadcast.delivery.error" }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining("page=1&pageSize=50&status=error")))
  })

  it("exports the deliveries as CSV with the chosen status", async () => {
    api.blob.mockResolvedValue({ blob: new Blob(["x"]), filename: "d.csv" })
    URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn()
    render(<BroadcastDetail id="b1" />)
    await screen.findByText("ann@example.test")
    fireEvent.click(screen.getByRole("button", { name: /admin.notif.broadcast.exportCsv/ }))
    await waitFor(() => expect(api.blob).toHaveBeenCalledWith("/api/notifications/broadcasts/b1/deliveries/export"))
  })

  it("cancels a sending broadcast only after a danger confirmation", async () => {
    api.post.mockResolvedValue({ ...broadcast, Status: "canceled" })
    render(<BroadcastDetail id="b1" />)
    await screen.findByText("ann@example.test")
    fireEvent.click(screen.getByRole("button", { name: "admin.notif.broadcast.cancel" }))
    const dialog = await screen.findByRole("dialog")
    expect(api.post).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "admin.notif.broadcast.cancel.confirm" }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/notifications/broadcasts/b1/cancel", {}))
    await waitFor(() => expect(screen.queryByRole("button", { name: "admin.notif.broadcast.cancel" })).not.toBeInTheDocument())
  })

  it("offers to copy the broadcast into a new one, and no cancel for a finished one", async () => {
    api.get.mockImplementation((path: string) => path.includes("/deliveries") ? Promise.resolve({ Items: [], Total: 0 }) : Promise.resolve({ ...broadcast, Status: "done" }))
    render(<BroadcastDetail id="b1" />)
    expect(await screen.findByRole("link", { name: "admin.notif.broadcast.copy" })).toHaveAttribute("href", "/notifications/broadcasts/new?copy=b1")
    expect(screen.queryByRole("button", { name: "admin.notif.broadcast.cancel" })).not.toBeInTheDocument()
  })
})
