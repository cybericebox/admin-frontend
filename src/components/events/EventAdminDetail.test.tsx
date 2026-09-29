import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const mock = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), managers: vi.fn(), canWrite: true }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/lib/origins", () => ({ publicDomain: "cybericebox-dev.pp.ua", apiOrigin: "", mainOrigin: "/", idOrigin: "" }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => permission === "events.write" ? mock.canWrite : true }) }))
vi.mock("@/api/events/catalog", () => ({ getEvent: mock.get, updateEvent: mock.update, listEventManagers: mock.managers }))
vi.mock("@/components/events/EventManagersCard", () => ({ EventManagersCard: ({ editable }: { editable: boolean }) => <div>access:{String(editable)}</div> }))
vi.mock("@/components/ui/date-time-picker", () => ({ DateTimePicker: ({ value, onChange, "aria-label": label }: { value: string; onChange: (value: string) => void; "aria-label": string }) => <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} /> }))

import { EventAdminDetail } from "./EventAdminDetail"
import { toast } from "@/components/ui/toast"

const event = {
  ID: "event-1", Tag: "spring", Name: "Spring CTF", Status: "pending" as const,
  AvailableFrom: "2026-10-01T09:00:00Z", ArchiveAt: "2026-10-08T09:00:00Z", CreatedAt: "", UpdatedAt: "",
}

describe("EventAdminDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.canWrite = true
    mock.get.mockResolvedValue(event)
    mock.managers.mockResolvedValue([])
  })

  it("loads the event record and its separate access section", async () => {
    render(<EventAdminDetail id="event-1" />)
    expect(await screen.findByDisplayValue("Spring CTF")).toBeInTheDocument()
    expect(screen.getByDisplayValue("spring")).toBeInTheDocument()
    expect(screen.getByText("access:true")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /admin.events.action.openSite/ })).toHaveAttribute("href", "https://spring.cybericebox-dev.pp.ua")
    expect(screen.getByRole("button", { name: "admin.events.field.nameHelp" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.events.field.tagHelp" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.events.field.availableFromHelp" })).toBeInTheDocument()
    const nameHelp = screen.getByRole("button", { name: "admin.events.field.nameHelp" })
    fireEvent.mouseEnter(nameHelp)
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
    fireEvent.mouseLeave(nameHelp)
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument())
    expect(mock.get).toHaveBeenCalledWith("event-1")
    expect(mock.managers).toHaveBeenCalledWith("event-1")
  })

  it("shows the immutable infrastructure flag read-only", async () => {
    mock.get.mockResolvedValue({ ...event, InfrastructureAllowed: true })
    render(<EventAdminDetail id="event-1" />)
    expect(await screen.findByTestId("event-infrastructure")).toHaveTextContent("admin.events.field.infrastructure: admin.events.field.infrastructureYes")
    expect(screen.queryByRole("checkbox", { name: "admin.events.field.infrastructure" })).not.toBeInTheDocument()
  })

  it("keeps the event editable when loading managers fails and lets the user retry access", async () => {
    mock.managers.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce([])
    render(<EventAdminDetail id="event-1" />)

    expect(await screen.findByDisplayValue("Spring CTF")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.events.dialog.submit" })).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("admin.events.access.loadError")

    fireEvent.click(screen.getByRole("button", { name: "admin.events.access.retry" }))
    await waitFor(() => expect(screen.queryByText("admin.events.access.loadError")).not.toBeInTheDocument())
    expect(mock.managers).toHaveBeenCalledTimes(2)
  })

  it("shows an error instead of loading forever when the route has no event id", () => {
    render(<EventAdminDetail id="" />)
    expect(screen.getByRole("alert")).toHaveTextContent("admin.events.loadError")
    expect(mock.get).not.toHaveBeenCalled()
  })

  it("updates the platform name, tag and window through the platform event API", async () => {
    mock.update.mockResolvedValue({ ...event, Name: "Autumn CTF", Tag: "autumn" })
    const success = vi.spyOn(toast, "success")
    render(<EventAdminDetail id="event-1" />)
    expect(await screen.findByRole("button", { name: "admin.events.dialog.submit" })).toBeDisabled()
    fireEvent.change(await screen.findByRole("textbox", { name: /admin.events.field.name/ }), { target: { value: "Autumn CTF" } })
    fireEvent.change(screen.getByRole("textbox", { name: /admin.events.field.tag/ }), { target: { value: "autumn" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.events.dialog.submit" }))
    await waitFor(() => expect(mock.update).toHaveBeenCalledWith("event-1", expect.objectContaining({ Name: "Autumn CTF", Tag: "autumn" })))
    await waitFor(() => expect(success).toHaveBeenCalledWith("admin.events.details.saved"))
    expect(screen.getByRole("button", { name: "admin.events.dialog.submit" })).toBeDisabled()
  })

  it("keeps platform fields and access read-only for admins without events.write", async () => {
    mock.canWrite = false
    render(<EventAdminDetail id="event-1" />)
    expect(await screen.findByDisplayValue("Spring CTF")).toBeDisabled()
    expect(screen.getByDisplayValue("spring")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "admin.events.dialog.submit" })).not.toBeInTheDocument()
    expect(screen.getByText("access:false")).toBeInTheDocument()
  })
})
