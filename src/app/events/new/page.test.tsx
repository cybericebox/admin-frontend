import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import NewEventPage from "./page"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))
vi.mock("@/lib/origins", () => ({ eventDomain: "cybericebox-dev.pp.ua", apiOrigin: "", mainOrigin: "" }))
vi.mock("@/api/events/catalog", () => ({ createEvent: vi.fn(), listEventManagers: vi.fn(), getInfrastructureAvailable: vi.fn() }))
vi.mock("@/components/events/EventManagersCard", () => ({ EventManagersCard: ({ eventID }: { eventID: string }) => <div>Managers for {eventID}</div> }))
vi.mock("@/components/ui/date-time-picker", () => ({ DateTimePicker: ({ value, onChange, "aria-label": label }: { value: string; onChange: (value: string) => void; "aria-label": string }) => <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} /> }))

import { createEvent, getInfrastructureAvailable, listEventManagers } from "@/api/events/catalog"

describe("new event page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getInfrastructureAvailable).mockResolvedValue(true)
  })

  it("creates an unpublished open-ended event and opens moderator assignment", async () => {
    vi.mocked(createEvent).mockResolvedValue({ ID: "event-1", Name: "Internal", Tag: "winter", ArchiveAt: null, AvailableFrom: "2026-10-01T09:00:00Z", Status: "pending", CreatedAt: "", UpdatedAt: "" })
    vi.mocked(listEventManagers).mockResolvedValue([])
    render(<NewEventPage />)

    expect(screen.getByRole("button", { description: "admin.events.field.nameHelp" })).toBeInTheDocument()
    expect(screen.getByRole("button", { description: "admin.events.field.tagHelp" })).toBeInTheDocument()
    expect(screen.getByRole("button", { description: "admin.events.field.availableFromHelp" })).toBeInTheDocument()
    expect(screen.getByRole("button", { description: "admin.events.field.archiveAtHelp" })).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: /admin.events.field.name/ }), { target: { value: "Internal" } })
    fireEvent.change(screen.getByRole("textbox", { name: /admin.events.field.tag/ }), { target: { value: "winter" } })
    fireEvent.change(screen.getByLabelText("admin.events.field.availableFrom"), { target: { value: "2026-10-01T09:00" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.events.dialog.submit" }))

    await waitFor(() => expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ Name: "Internal", Tag: "winter", ArchiveAt: null, InfrastructureAllowed: true })))
    expect(await screen.findByText("Managers for event-1")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "admin.events.create.finish" })).toHaveAttribute("href", "/events/detail?id=event-1")
  })

  it("preserves a created event and retries loading its managers after a partial failure", async () => {
    vi.mocked(createEvent).mockResolvedValue({ ID: "event-1", Name: "Internal", Tag: "winter", ArchiveAt: null, AvailableFrom: "2026-10-01T09:00:00Z", Status: "pending", CreatedAt: "", UpdatedAt: "" })
    vi.mocked(listEventManagers).mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce([])
    render(<NewEventPage />)

    fireEvent.change(screen.getByRole("textbox", { name: /admin.events.field.name/ }), { target: { value: "Internal" } })
    fireEvent.change(screen.getByRole("textbox", { name: /admin.events.field.tag/ }), { target: { value: "winter" } })
    fireEvent.change(screen.getByLabelText("admin.events.field.availableFrom"), { target: { value: "2026-10-01T09:00" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.events.dialog.submit" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("admin.events.access.loadError")
    expect(screen.getByRole("link", { name: "admin.events.create.finish" })).toHaveAttribute("href", "/events/detail?id=event-1")
    fireEvent.click(screen.getByRole("button", { name: "error.load.retry" }))
    expect(await screen.findByText("Managers for event-1")).toBeInTheDocument()
    expect(vi.mocked(createEvent)).toHaveBeenCalledTimes(1)
  })

  it("disables infrastructure tasks when infrastructure is not connected", async () => {
    vi.mocked(getInfrastructureAvailable).mockResolvedValue(false)
    vi.mocked(createEvent).mockResolvedValue({ ID: "event-1", Name: "Internal", Tag: "winter", ArchiveAt: null, AvailableFrom: "2026-10-01T09:00:00Z", Status: "pending", CreatedAt: "", UpdatedAt: "" })
    vi.mocked(listEventManagers).mockResolvedValue([])
    render(<NewEventPage />)

    const toggle = screen.getByRole("switch", { name: "admin.events.field.infrastructure" })
    expect(toggle).toBeChecked()
    await waitFor(() => expect(toggle).toBeDisabled())
    expect(toggle).not.toBeChecked()
    expect(screen.getByText("admin.events.field.infrastructureUnavailable")).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: /admin.events.field.name/ }), { target: { value: "Internal" } })
    fireEvent.change(screen.getByRole("textbox", { name: /admin.events.field.tag/ }), { target: { value: "winter" } })
    fireEvent.change(screen.getByLabelText("admin.events.field.availableFrom"), { target: { value: "2026-10-01T09:00" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.events.dialog.submit" }))
    await waitFor(() => expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ InfrastructureAllowed: false })))
  })
})
