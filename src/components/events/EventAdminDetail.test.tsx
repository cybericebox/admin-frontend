import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const mock = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), managers: vi.fn(), setInfra: vi.fn(), canWrite: true, me: { ID: "user-1" } as { ID: string } | null }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/lib/origins", () => ({ publicDomain: "cybericebox-dev.pp.ua", apiOrigin: "", mainOrigin: "/", idOrigin: "" }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ me: mock.me, can: (permission: string) => permission === "events.write" ? mock.canWrite : true }) }))
vi.mock("@/api/events/catalog", () => ({ getEvent: mock.get, updateEvent: mock.update, listEventManagers: mock.managers, setEventInfrastructure: mock.setInfra }))
vi.mock("@/components/events/EventAnalyticsTab", () => ({ EventAnalyticsTab: ({ eventID, tag, canOpenJournal }: { eventID: string; tag: string; canOpenJournal: boolean }) => <div>analytics:{eventID}:{tag}:{String(canOpenJournal)}</div> }))
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
    mock.me = { ID: "user-1" }
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

  it("turns infrastructure on before publication after a confirmation", async () => {
    mock.get.mockResolvedValue({ ...event, LifecycleStatus: "not_published", InfrastructureAllowed: false })
    mock.setInfra.mockResolvedValue({ ...event, InfrastructureAllowed: true, UpdatedAt: "later" })
    const success = vi.spyOn(toast, "success")
    render(<EventAdminDetail id="event-1" />)
    const toggle = await screen.findByRole("switch", { name: "admin.events.field.infrastructure" })
    expect(toggle).toBeEnabled()
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(screen.getByRole("button", { name: "admin.events.field.infrastructureHelp" })).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(mock.setInfra).not.toHaveBeenCalled()
    expect(await screen.findByText("admin.events.infra.confirmOnTitle")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.events.infra.confirmOn" }))
    await waitFor(() => expect(mock.setInfra).toHaveBeenCalledWith("event-1", true))
    await waitFor(() => expect(success).toHaveBeenCalledWith("admin.events.infra.savedOn"))
    await waitFor(() => expect(screen.getByRole("switch", { name: "admin.events.field.infrastructure" })).toHaveAttribute("aria-checked", "true"))
  })

  it("cancelling the confirmation changes nothing", async () => {
    mock.get.mockResolvedValue({ ...event, InfrastructureAllowed: true })
    render(<EventAdminDetail id="event-1" />)
    fireEvent.click(await screen.findByRole("switch", { name: "admin.events.field.infrastructure" }))
    expect(await screen.findByText("admin.events.infra.confirmOffTitle")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "confirm.cancel" }))
    expect(mock.setInfra).not.toHaveBeenCalled()
    expect(screen.getByRole("switch", { name: "admin.events.field.infrastructure" })).toHaveAttribute("aria-checked", "true")
  })

  it("keeps the dialog open with the reason when the server refuses", async () => {
    mock.get.mockResolvedValue({ ...event, InfrastructureAllowed: true })
    mock.setInfra.mockRejectedValue(new Error("refused"))
    render(<EventAdminDetail id="event-1" />)
    fireEvent.click(await screen.findByRole("switch", { name: "admin.events.field.infrastructure" }))
    fireEvent.click(await screen.findByRole("button", { name: "admin.events.infra.confirmOff" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("admin.events.err.generic")
    expect(screen.getByText("admin.events.infra.confirmOffTitle")).toBeInTheDocument()
  })

  it("locks the switch after publication and explains why in a tooltip", async () => {
    mock.get.mockResolvedValue({ ...event, LifecycleStatus: "published", InfrastructureAllowed: true })
    render(<EventAdminDetail id="event-1" />)
    const toggle = await screen.findByRole("switch", { name: "admin.events.field.infrastructure" })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute("aria-checked", "true")
    fireEvent.mouseEnter(toggle.parentElement as HTMLElement)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("admin.events.infra.locked")
  })

  it("keeps the switch read-only without events.write", async () => {
    mock.canWrite = false
    render(<EventAdminDetail id="event-1" />)
    expect(await screen.findByRole("switch", { name: "admin.events.field.infrastructure" })).toBeDisabled()
  })

  it("keeps the event editable when loading managers fails and lets the user retry access", async () => {
    mock.managers.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce([])
    render(<EventAdminDetail id="event-1" />)

    expect(await screen.findByDisplayValue("Spring CTF")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.events.dialog.submit" })).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("admin.events.access.loadError")

    fireEvent.click(screen.getByRole("button", { name: "error.load.retry" }))
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

  it("keeps the details and access under «Огляд» and opens «Аналітика» as a second tab", async () => {
    render(<EventAdminDetail id="event-1" />)
    expect(await screen.findByDisplayValue("Spring CTF")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "admin.events.tabs.overview" })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByText(/^analytics:/)).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "admin.events.tabs.analytics" }))
    expect(await screen.findByText(/^analytics:event-1:spring:/)).toBeInTheDocument()
    expect(screen.queryByDisplayValue("Spring CTF")).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "admin.events.tabs.overview" }))
    expect(await screen.findByDisplayValue("Spring CTF")).toBeInTheDocument()
  })

  it("offers the attempts journal only to the event's assigned owner or manager", async () => {
    const open = async () => {
      render(<EventAdminDetail id="event-1" />)
      await screen.findByDisplayValue("Spring CTF")
      await waitFor(() => expect(mock.managers).toHaveBeenCalled())
      await screen.findByText("access:true")
      fireEvent.mouseDown(screen.getByRole("tab", { name: "admin.events.tabs.analytics" }))
    }
    mock.managers.mockResolvedValue([{ UserID: "user-1", Role: 1, CreatedAt: "" }])
    await open()
    expect(await screen.findByText("analytics:event-1:spring:true")).toBeInTheDocument()
  })

  it.each([
    ["a viewer of the event", [{ UserID: "user-1", Role: 2, CreatedAt: "" }]],
    ["someone else's assignment", [{ UserID: "other", Role: 0, CreatedAt: "" }]],
    ["no assignment", []],
  ])("hides the journal for %s", async (_name, list) => {
    mock.managers.mockResolvedValue(list)
    render(<EventAdminDetail id="event-1" />)
    await screen.findByText("access:true")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "admin.events.tabs.analytics" }))
    expect(await screen.findByText("analytics:event-1:spring:false")).toBeInTheDocument()
  })
})
