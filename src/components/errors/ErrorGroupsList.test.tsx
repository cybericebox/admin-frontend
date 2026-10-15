import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ErrorFilters, ErrorGroup, ErrorStreamEvent } from "@/api/errorJournal"

const mocks = vi.hoisted(() => ({ list: vi.fn(), onEvent: null as ((event: ErrorStreamEvent) => void) | null }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }))
vi.mock("@/api/errorJournal", async (original) => ({ ...(await original<object>()), listErrorGroups: mocks.list }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))
vi.mock("@/lib/errorStream", () => ({ useErrorStream: ({ onEvent }: { onEvent: (event: ErrorStreamEvent) => void }) => { mocks.onEvent = onEvent; return "live" } }))
vi.mock("@/components/ui/select-menu", () => ({ SelectMenu: ({ value, onChange, options, ariaLabel }: {
  value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; ariaLabel: string
}) => <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel}>
  {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
</select> }))

import { ErrorGroupsList } from "./ErrorGroupsList"

const open: ErrorGroup = {
  ID: "open-group", Kind: "job", Source: "lab_access_sync", Title: "Agent unavailable", Status: "open", Occurrences: 1,
  FirstSeenAt: "2026-10-15T06:00:00Z", LastSeenAt: "2026-10-15T06:00:00Z", ResolvedAt: null, LastNotifiedAt: null,
}
const resolved: ErrorGroup = { ...open, ID: "resolved-group", Title: "Queue recovered", Status: "resolved" }

describe("error journal status filters", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/errors")
    mocks.list.mockReset()
    mocks.list.mockImplementation((filters: ErrorFilters) => {
      const items = [open, resolved].filter((group) => !filters.status || group.Status === filters.status)
      return Promise.resolve({ Items: items, Total: items.length, Limit: 50, Offset: 0 })
    })
  })
  afterEach(cleanup)

  it("requests only open errors when opened without a status filter", async () => {
    render(<ErrorGroupsList />)
    expect(await screen.findByText(open.Title)).toBeInTheDocument()
    expect(screen.queryByText(resolved.Title)).not.toBeInTheDocument()
    expect(mocks.list.mock.lastCall?.[0].status).toBe("open")
    expect(screen.getByLabelText("admin.errors.filter.status")).toHaveValue("open")
  })

  it("preserves an explicit all-status choice when the page is reopened", async () => {
    const first = render(<ErrorGroupsList />)
    await screen.findByText(open.Title)
    fireEvent.change(screen.getByLabelText("admin.errors.filter.status"), { target: { value: "" } })
    expect(await screen.findByText(resolved.Title)).toBeInTheDocument()
    first.unmount()
    render(<ErrorGroupsList />)
    expect(await screen.findByText(resolved.Title)).toBeInTheDocument()
    expect(mocks.list.mock.lastCall?.[0].status).toBe("")
  })

  it("honours a shared link to resolved errors", async () => {
    window.history.replaceState(null, "", "/errors?status=resolved")
    render(<ErrorGroupsList />)
    expect(await screen.findByText(resolved.Title)).toBeInTheDocument()
    expect(screen.queryByText(open.Title)).not.toBeInTheDocument()
  })

  it("removes an error from the default list when a live update resolves it", async () => {
    render(<ErrorGroupsList />)
    await screen.findByText(open.Title)
    act(() => mocks.onEvent?.({ Group: { ...open, Status: "resolved" }, Sample: null, New: false }))
    await waitFor(() => expect(screen.queryByText(open.Title)).not.toBeInTheDocument())
  })
})
