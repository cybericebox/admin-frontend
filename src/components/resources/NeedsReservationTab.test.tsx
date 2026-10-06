import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { Event } from "@/api/events/catalog"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))

import { NeedsReservationTab, eventsNeedingReservation } from "./NeedsReservationTab"

const event = (over: Partial<Event>): Event => ({
  ID: "e1", Tag: "e1", Name: "Cup", AvailableFrom: "2026-11-01T10:00:00Z", ArchiveAt: null, Status: "active", LifecycleStatus: "published",
  InfrastructureAllowed: true, CreatedAt: "", UpdatedAt: "", ...over,
})

describe("eventsNeedingReservation", () => {
  it("keeps only live infrastructure events with no reservation", () => {
    const events = [
      event({ ID: "need" }),
      event({ ID: "reserved" }),
      event({ ID: "noinfra", InfrastructureAllowed: false }),
      event({ ID: "archived", Status: "archived" }),
      event({ ID: "finished", LifecycleStatus: "finished" }),
    ]
    expect(eventsNeedingReservation(events, new Set(["reserved"])).map((e) => e.ID)).toEqual(["need"])
  })
})

describe("NeedsReservationTab", () => {
  it("opens the reservation editor for the event", () => {
    const onEdit = vi.fn()
    render(<NeedsReservationTab events={[event({ ID: "need", Name: "Spring Cup" })]} error={null} onRetry={vi.fn()} canRead onEdit={onEdit} />)
    fireEvent.click(screen.getByRole("button", { name: /admin.resources.editor.open/ }))
    expect(onEdit).toHaveBeenCalledWith({ eventID: "need", name: "Spring Cup" })
  })

  it("shows the empty state when every event is reserved", () => {
    render(<NeedsReservationTab events={[]} error={null} onRetry={vi.fn()} canRead onEdit={vi.fn()} />)
    expect(screen.getByText("admin.resources.needs.empty")).toBeInTheDocument()
  })

  it("hides the action without read access", () => {
    render(<NeedsReservationTab events={[event({})]} error={null} onRetry={vi.fn()} canRead={false} onEdit={vi.fn()} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
