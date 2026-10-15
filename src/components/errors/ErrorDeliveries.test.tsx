import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/api/errorJournal", () => ({ getErrorGroup: mocks.get }))
vi.mock("@/i18n/t", () => ({ t: (key: string, vars?: object) => vars ? `${key} ${JSON.stringify(vars)}` : key }))
import { ErrorDeliveries } from "./ErrorDeliveries"
import type { ErrorDelivery } from "@/api/errorJournal"
const row = (over: Partial<ErrorDelivery> = {}): ErrorDelivery => ({ ID: "1", Channel: "email", Target: "ops@example.test", Label: "", Attempts: 0, LastError: "", CreatedAt: "2026-10-15T10:00:00Z", LastAttemptAt: null, NextAttemptAt: "2026-10-15T10:01:00Z", DeliveredAt: null, ...over })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe("error delivery outcomes", () => {
  it("shows queued, retrying, sent and cancelled outcomes with actionable error details", () => {
    render(<ErrorDeliveries groupID="error-1" initial={[row(), row({ ID: "2", Attempts: 2, LastError: "provider unavailable" }), row({ ID: "3", Attempts: 1, DeliveredAt: "2026-10-15T10:00:10Z" }), row({ ID: "4", CancelledAt: "2026-10-15T10:00:10Z" })]} />)
    for (const status of ["queued", "retrying", "sent", "cancelled"]) expect(screen.getByText(`admin.errors.delivery.${status}`)).toBeInTheDocument()
    expect(screen.getByText("provider unavailable")).toBeInTheDocument()
    expect(screen.getAllByText(/admin.errors.delivery.nextAt/)).toHaveLength(2)
  })
  it("labels preparation work even when the root queue entry has no target", () => {
    render(<ErrorDeliveries groupID="error-1" initial={[row({ Channel: "prepare", Target: "", Attempts: 1, LastError: "recipient lookup failed" })]} />)
    expect(screen.getByText("admin.errors.delivery.preparation")).toBeInTheDocument()
    expect(screen.getByText(/admin.errors.delivery.details/)).toHaveTextContent("admin.errors.settings.channel.prepare")
    expect(screen.getByText("recipient lookup failed")).toBeInTheDocument()
  })
  it("refreshes delivery outcomes without changing parent group state", async () => {
    const onNotified = vi.fn()
    mocks.get.mockResolvedValue({ Group: { LastNotifiedAt: "2026-10-15T10:00:10Z", Status: "open" }, Deliveries: [row({ Attempts: 1, DeliveredAt: "2026-10-15T10:00:10Z" })] })
    render(<ErrorDeliveries groupID="error-1" initial={[row()]} onNotified={onNotified} />)
    fireEvent.click(screen.getByRole("button", { name: "admin.errors.delivery.refresh" }))
    expect(await screen.findByText("admin.errors.delivery.sent")).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith("error-1")
    expect(onNotified).toHaveBeenCalledWith("2026-10-15T10:00:10Z")
    expect(onNotified.mock.calls[0]).toHaveLength(1)
  })
})
