import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ApiError } from "@/api/client"
import type { EventSchedule } from "@/api/events/catalog"
import type { Reservation, ReservationResult } from "@/api/resourceCalendar"
import { t } from "@/i18n/t"
import { PREVIEW_DELAY_MS, ReservationEditor, formFromResult, inputFromForm, needsWindow } from "./ReservationEditor"

const apiGet = vi.fn()
const apiPut = vi.fn()
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  apiGet: (...a: unknown[]) => apiGet(...a), apiPut: (...a: unknown[]) => apiPut(...a),
}))

const MIB = 1024 ** 2
const GIB = 1024 ** 3
const reservation: Reservation = {
  ID: "r1", Kind: "event", EventID: "e1", EventName: "CTF", EventTag: "ctf", OwnerID: "", From: "2026-10-05T08:00:00Z", To: "2026-10-05T13:00:00Z", Teams: 4,
  PerTeam: { CPUMillicores: 500, MemoryBytes: 512 * MIB }, LargestDevice: { CPUMillicores: 0, MemoryBytes: 0 }, BufferPercent: 15, Dynamic: { CPUMillicores: 0, MemoryBytes: 0 },
  TailGapMinutes: 60, StartLeadMinutes: 60, Size: { CPUMillicores: 2300, MemoryBytes: 2048 * MIB }, Placement: [{ AgentID: "a1", AgentName: "Київ", Units: 4 }], Unplaced: 0, Covered: true,
  Used: { CPUMillicores: 0, MemoryBytes: 0 }, Alarms: null,
}
const result = (over: Partial<ReservationResult> = {}): ReservationResult => ({ Reservation: reservation, Conflicts: [], Saved: true, ...over })
const apiError = (status: number, code: number) => new ApiError(status, {}, "x", undefined, code)

const target = { eventID: "e1", name: "CTF" }
function renderEditor(props: Partial<Parameters<typeof ReservationEditor>[0]> = {}) {
  const handlers = { onClose: vi.fn(), onSaved: vi.fn(), onCancelReservation: vi.fn() }
  render(<ReservationEditor target={target} canWrite {...handlers} {...props} />)
  return handlers
}

beforeEach(() => { apiGet.mockReset(); apiPut.mockReset() })

const scheduled: EventSchedule = { Configured: true, StartAt: "2026-10-05T10:00:00Z", FinishAt: "2026-10-05T12:00:00Z" }
const unscheduled: EventSchedule = { Configured: false, StartAt: null, FinishAt: null }
/** The reservation answers (or fails with) its GET; the event schedule answers the lifecycle GET. */
function serve(reservationOrError: ReservationResult | Error = result(), schedule: EventSchedule | Error = scheduled) {
  apiGet.mockImplementation((url: string) => {
    const answer = url.endsWith("/manage/lifecycle") ? schedule : reservationOrError
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
  })
}

describe("form mapping", () => {
  it("shows the saved reservation as real values with the two offsets", () => {
    const form = formFromResult(result())
    expect(form).toMatchObject({ teams: "4", buffer: "15", dynamicGB: "0", startLead: "60", tailGap: "60", fixed: false })
    expect(inputFromForm(form)).toEqual({ Teams: 4, BufferPercent: 15, Dynamic: { CPUMillicores: 0, MemoryBytes: 0 }, StartLeadMinutes: 60, TailGapMinutes: 60 })
  })

  it("turns the memory of the extra room from GB into an amount whose CPU follows the memory", () => {
    const input = inputFromForm({ ...formFromResult(result()), dynamicGB: "2.5" })
    expect(input).toMatchObject({ Dynamic: { CPUMillicores: 625, MemoryBytes: 2.5 * GIB } })
  })

  it("sends a fixed window instead of the offsets", () => {
    const input = inputFromForm({ ...formFromResult(result()), fixed: true })
    expect(input).toMatchObject({ WindowStart: expect.any(String), WindowEnd: expect.any(String) })
    expect(input).not.toHaveProperty("StartLeadMinutes")
    expect(input).not.toHaveProperty("TailGapMinutes")
  })

  it("rejects a fixed window with one end missing or an end before the start", () => {
    expect(inputFromForm({ ...formFromResult(result()), fixed: true, end: "" })).toBe("window")
    expect(inputFromForm({ ...formFromResult(result()), fixed: true, end: "2026-01-01T00:00" })).toBe("window")
  })

  it("rejects a missing number", () => {
    expect(inputFromForm({ ...formFromResult(result()), teams: "" })).toBeNull()
    expect(inputFromForm({ ...formFromResult(result()), teams: "0" })).toBeNull()
    expect(inputFromForm({ ...formFromResult(result()), tailGap: "" })).toBeNull()
  })
})

describe("required window", () => {
  it("needs the window only for an event without a schedule", () => {
    expect(needsWindow(scheduled)).toBe(false)
    expect(needsWindow(unscheduled)).toBe(true)
    expect(needsWindow({ Configured: true, FinishAt: null })).toBe(true)
    expect(needsWindow(null)).toBe(false)
  })
})

describe("ReservationEditor", () => {
  it("shows the field labels, the GB summary and the used memory, with CPU only in a hint", async () => {
    serve(result({ Reservation: { ...reservation, Size: { CPUMillicores: 2300, MemoryBytes: 3.4 * GIB }, Used: { CPUMillicores: 0, MemoryBytes: 1.2 * GIB } } }))
    renderEditor()
    const summary = await screen.findByTestId("editor-summary")
    expect(summary.textContent).toContain(t("admin.resources.editor.summary.total", { gb: "3,4" }))
    expect(summary.textContent).toContain(t("admin.resources.editor.summary.used", { used: "1,2", total: "3,4" }))
    expect(summary.textContent).not.toMatch(/мілі|MiB|МіБ/)
    for (const key of ["teams", "buffer", "dynamic", "startLead", "tailGap"]) {
      expect(screen.getByLabelText(t(`admin.resources.editor.${key}`))).toBeTruthy()
    }
    expect(screen.queryByText(/Хвіст|Динамічні завдання|за планом/)).toBeNull()
  })

  it("never shows a fit verdict, even when the reservation is not covered", async () => {
    serve(result({ Reservation: { ...reservation, Covered: false, Unplaced: 2 }, Conflicts: [{ From: "2026-10-05T09:00:00Z", To: "2026-10-05T10:00:00Z", ReservationIDs: ["r2"], PoolShort: false, Unplaced: 2, Short: { CPUMillicores: 100, MemoryBytes: 0 } }] }))
    renderEditor()
    await screen.findByTestId("editor-summary")
    expect(screen.queryByText(/не вміщується/i)).toBeNull()
    expect(screen.queryByText(t("admin.resources.uncovered"))).toBeNull()
    expect(screen.queryByTestId("editor-conflicts")).toBeNull()
  })

  it("saves without asking about conflicts and without a preview button", async () => {
    serve()
    apiPut.mockResolvedValue(result({ Reservation: { ...reservation, Teams: 5 } }))
    const { onSaved } = renderEditor()
    fireEvent.change(await screen.findByLabelText(t("admin.resources.editor.teams")), { target: { value: "5" } })
    expect(screen.queryByRole("button", { name: /перегляд/i })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: t("admin.resources.editor.save") }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const save = apiPut.mock.calls.find(([, body]) => body.DryRun === undefined)
    expect(save?.[1]).toMatchObject({ Teams: 5, AllowConflicts: true })
    expect(screen.queryByText(t("admin.resources.conflict.title"))).toBeNull()
  })

  it("updates the summary through a debounced dry run after an edit", async () => {
    serve()
    apiPut.mockResolvedValue(result({ Reservation: { ...reservation, Size: { CPUMillicores: 4000, MemoryBytes: 8 * GIB } } }))
    renderEditor()
    fireEvent.change(await screen.findByLabelText(t("admin.resources.editor.teams")), { target: { value: "8" } })
    expect(apiPut).not.toHaveBeenCalled()
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1), { timeout: PREVIEW_DELAY_MS + 1500 })
    expect(apiPut.mock.calls[0][1]).toMatchObject({ Teams: 8, DryRun: true, AllowConflicts: true })
    await waitFor(() => expect(screen.getByTestId("editor-summary").textContent).toContain("8"))
  })

  it("does not save an unchanged reservation", async () => {
    serve()
    renderEditor()
    await screen.findByTestId("editor-summary")
    expect(screen.getByRole("button", { name: t("admin.resources.editor.save") })).toBeDisabled()
  })

  it("offers the fixed date and time instead of the offsets", async () => {
    serve()
    renderEditor()
    fireEvent.click(await screen.findByRole("switch", { name: t("admin.resources.editor.fixed") }))
    expect(screen.getByRole("button", { name: t("admin.resources.editor.windowStart") })).toBeTruthy()
    expect(screen.queryByLabelText(t("admin.resources.editor.startLead"))).toBeNull()
  })

  it("forces the fixed window when the event has no schedule and asks for it on save", async () => {
    serve(apiError(404, 32513), unscheduled)
    apiPut.mockRejectedValue(new Error("no schedule"))
    renderEditor()
    const start = await screen.findByRole("button", { name: t("admin.resources.editor.windowStart") })
    expect(start.getAttribute("aria-required")).toBe("true")
    expect(screen.getByRole("switch", { name: t("admin.resources.editor.fixed") })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(t("admin.resources.editor.teams")), { target: { value: "3" } })
    fireEvent.click(screen.getByRole("button", { name: t("admin.resources.editor.save") }))
    expect(await screen.findByText(t("admin.resources.editor.windowRequired"))).toBeTruthy()
    expect(apiPut.mock.calls.every(([, body]) => body.DryRun === true)).toBe(true)
  })

  it("prefills a new reservation from the plan", async () => {
    serve(apiError(404, 32513))
    apiPut.mockResolvedValue(result({ Reservation: { ...reservation, Teams: 12 } }))
    renderEditor()
    expect(await screen.findByDisplayValue("12")).toBeTruthy()
    expect(apiPut.mock.calls[0][1]).toEqual({ DryRun: true, AllowConflicts: true })
    expect(screen.queryByRole("button", { name: t("admin.resources.editor.cancelReservation") })).toBeNull()
  })

  it("offers the cancel action for a saved reservation", async () => {
    serve()
    const { onCancelReservation } = renderEditor()
    fireEvent.click(await screen.findByRole("button", { name: t("admin.resources.editor.cancelReservation") }))
    expect(onCancelReservation).toHaveBeenCalledWith(target)
  })

  it("is read-only without infrastructure.write", async () => {
    serve()
    renderEditor({ canWrite: false })
    await screen.findByTestId("editor-summary")
    expect(screen.queryByRole("button", { name: t("admin.resources.editor.save") })).toBeNull()
  })
})
