/**
 * page.test.tsx: the events index (UI-TABLES.md): rows with counts, filters in the address, RBAC-gated actions,
 * archive / delete confirmations, bulk archive.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"

const h = vi.hoisted(() => ({ canWrite: true }))

vi.mock("@/i18n/t", () => ({ t: (key: string, vars?: Record<string, unknown>) => vars ? `${key}:${JSON.stringify(vars)}` : key }))
vi.mock("@/lib/origins", () => ({ eventDomain: "cybericebox-dev.pp.ua", apiOrigin: "", idOrigin: "" }))
vi.mock("@/api/tablePrefs", () => ({ getTablePrefs: () => Promise.resolve(null), putTablePrefs: () => Promise.resolve({}), deleteTablePrefs: () => Promise.resolve() }))
vi.mock("@/lib/useRole", () => ({
  useRole: () => ({ me: null, role: "admin", isLoading: false, permissions: ["*"], can: (p: string) => (p === "events.write" ? h.canWrite : true) }),
}))
vi.mock("@/api/events/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/events/catalog")>()),
  listEventsIndex: vi.fn(),
  getEventFacets: vi.fn().mockResolvedValue(null),
  listEventOrganizers: vi.fn().mockResolvedValue([{ UserID: "u1", Name: "Олена", Email: "o@example.test" }]),
  archiveEvent: vi.fn(),
  deleteEvent: vi.fn(),
  bulkArchiveEvents: vi.fn(),
}))
import { listEventsIndex, archiveEvent, deleteEvent, bulkArchiveEvents } from "@/api/events/catalog"
import Page from "./page"
const setTestUrl = (q: string) => window.history.replaceState(null, "", q ? `/test/?${q}` : "/test/")

const mockList = vi.mocked(listEventsIndex)
const base = { AvailableFrom: "2026-03-01T00:00:00Z", ArchiveAt: "2026-03-08T00:00:00Z", Status: "active" as const, LifecycleStatus: "started" as const, CreatedAt: "2026-01-01T00:00:00Z", UpdatedAt: "2026-01-02T00:00:00Z" }
const spring = { ...base, ID: "e1", Tag: "springctf", Name: "Spring CTF", ParticipantsCount: 40, TeamsCount: 10, StandsReady: 8, StandsTotal: 10 }
const autumn = { ...base, ID: "e2", Tag: "autumn", Name: "Autumn CTF", Status: "archived" as const }

describe("events index", () => {
  beforeEach(() => {
    setTestUrl("")
    window.localStorage.clear()
    vi.clearAllMocks()
    h.canWrite = true
    mockList.mockResolvedValue({ Items: [spring, autumn], Total: 2, Page: 1, PageSize: 50 })
  })

  it("shows the found count, the counts of each event and a link to its panel", async () => {
    render(<Page />)
    expect(await screen.findByRole("link", { name: "Spring CTF" })).toHaveAttribute("href", "/events/detail?id=e1")
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2")
    expect(screen.getByText("40")).toBeInTheDocument()
    expect(screen.getByText("8 / 10")).toBeInTheDocument()
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 50, sortBy: "updated", sortDir: "desc" }))
  })

  it("makes every column sortable on the server", async () => {
    render(<Page />)
    await screen.findByText("Spring CTF")
    fireEvent.click(screen.getByRole("button", { name: /admin.events.col.participants/ }))
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "participants", sortDir: "desc" })))
  })

  it("sends a chosen status filter, keeps it in the address and resets it", async () => {
    render(<Page />)
    await screen.findByText("Spring CTF")
    fireEvent.click(screen.getByRole("button", { name: /admin.table.addFilter/ }))
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /admin.events.col.status/ }))
    fireEvent.click(await screen.findByRole("checkbox", { name: "admin.events.lifecycle.started" }))
    await waitFor(() => expect(mockList.mock.calls.at(-1)![0].bag.status?.v).toEqual(["started"]))
    expect(window.location.search).toContain("f.status=in%3Astarted")
    fireEvent.click(screen.getByRole("button", { name: "admin.table.resetFilters" }))
    await waitFor(() => expect(mockList.mock.calls.at(-1)![0].bag).toEqual({}))
  })

  it("offers the organizers as a filter field", async () => {
    render(<Page />)
    await screen.findByText("Spring CTF")
    fireEvent.click(screen.getByRole("button", { name: /admin.table.addFilter/ }))
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /admin.events.filterOrganizer/ }))
    expect(await screen.findByRole("checkbox", { name: "Олена" })).toBeInTheDocument()
  })

  it("hides create, archive, delete and the select column without events.write", async () => {
    h.canWrite = false
    render(<Page />)
    await screen.findByText("Spring CTF")
    expect(screen.queryByText("admin.events.create.button")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /admin.events.action.archive/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /admin.events.action.delete/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: "admin.table.selectAll" })).not.toBeInTheDocument()
  })

  it("keeps row actions visible and does not offer Archive for an archived event", async () => {
    render(<Page />)
    await screen.findByText("Spring CTF")
    expect(screen.getAllByRole("button", { name: /admin.events.action.archive/ })).toHaveLength(1)
    expect(screen.getAllByRole("button", { name: /admin.events.action.delete/ })).toHaveLength(2)
  })

  it("archives one event after a danger confirmation, with the public warning for a running event", async () => {
    vi.mocked(archiveEvent).mockResolvedValue({ ...spring, Status: "archived" })
    render(<Page />)
    await screen.findByText("Spring CTF")
    fireEvent.click(screen.getByRole("button", { name: /admin.events.action.archive/ }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("admin.events.archive.publicTitle")).toBeInTheDocument()
    expect(archiveEvent).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "admin.events.archive.confirm" }))
    await waitFor(() => expect(archiveEvent).toHaveBeenCalledWith("e1"))
  })

  it("deletes one event only after a confirmation", async () => {
    vi.mocked(deleteEvent).mockResolvedValue(undefined)
    render(<Page />)
    await screen.findByText("Spring CTF")
    fireEvent.click(screen.getAllByRole("button", { name: /admin.events.action.delete/ })[0])
    expect(deleteEvent).not.toHaveBeenCalled()
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "admin.events.delete.confirm" }))
    await waitFor(() => expect(deleteEvent).toHaveBeenCalledWith("e1"))
  })

  it("archives the selected events in bulk after a confirmation that names the count; archived rows cannot be selected", async () => {
    vi.mocked(bulkArchiveEvents).mockResolvedValue([{ EventID: "e1", Ok: true }])
    render(<Page />)
    await screen.findByText("Spring CTF")
    expect(screen.getByRole("checkbox", { name: /selectRow.*Autumn CTF/ })).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: "admin.table.selectAll" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.events.bulk.archive" }))
    expect(bulkArchiveEvents).not.toHaveBeenCalled()
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(/admin.events.bulk.archive.title.\w+:{"count":1}/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "admin.events.archive.confirm" }))
    await waitFor(() => expect(bulkArchiveEvents).toHaveBeenCalledWith(["e1"]))
  })

  it("offers a retry when the list fails to load", async () => {
    mockList.mockRejectedValueOnce(new Error("offline"))
    render(<Page />)
    expect(await screen.findByText("admin.events.loadError")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "error.load.retry" }))
    expect(await screen.findByText("Spring CTF")).toBeInTheDocument()
  })

  it("restores filter, sort and page from the address and has one h1", async () => {
    setTestUrl("f.status=in%3Astarted&sort=name&dir=asc&page=2")
    render(<Page />)
    await waitFor(() => expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ page: 2, sortBy: "name", sortDir: "asc" })))
    expect(mockList.mock.calls.at(-1)![0].bag.status?.v).toEqual(["started"])
    expect(await screen.findAllByRole("heading", { level: 1 })).toHaveLength(1)
  })
})
