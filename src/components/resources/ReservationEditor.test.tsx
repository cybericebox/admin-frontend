import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ApiError } from "@/api/client"
import type { Reservation, ReservationResult } from "@/api/resourceCalendar"
import { t } from "@/i18n/t"
import { ReservationEditor, formFromResult, inputFromForm } from "./ReservationEditor"

const apiGet = vi.fn()
const apiPut = vi.fn()
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  apiGet: (...a: unknown[]) => apiGet(...a), apiPut: (...a: unknown[]) => apiPut(...a),
}))

const MIB = 1024 ** 2
const reservation: Reservation = {
  ID: "r1", Kind: "event", EventID: "e1", EventName: "CTF", EventTag: "ctf", OwnerID: "", From: "2026-10-05T08:00:00Z", To: "2026-10-05T13:00:00Z", Teams: 4,
  PerTeam: { CPUMillicores: 500, MemoryBytes: 512 * MIB }, LargestDevice: { CPUMillicores: 0, MemoryBytes: 0 }, BufferPercent: 15, Dynamic: { CPUMillicores: 0, MemoryBytes: 0 },
  TailGapMinutes: 60, Size: { CPUMillicores: 2300, MemoryBytes: 2048 * MIB }, Placement: [{ AgentID: "a1", AgentName: "Київ", Units: 4 }], Unplaced: 0, Covered: true,
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

describe("form mapping", () => {
  it("shows the saved window end without the tail gap and sends only the filled fields", () => {
    const form = formFromResult(result())
    expect(new Date(`${form.end}`).getTime() - new Date(form.start).getTime()).toBe(4 * 3600_000)
    expect(inputFromForm({ ...formFromResult(result()), teams: "", buffer: "", tailGap: "", start: "", end: "", perTeam: { cpu: "", memoryMiB: "" }, dynamic: { cpu: "", memoryMiB: "" } })).toEqual({})
  })

  it("rejects a window with only one end or an end before the start", () => {
    expect(inputFromForm({ ...formFromResult(result()), end: "" })).toBe("window")
    expect(inputFromForm({ ...formFromResult(result()), end: "2026-01-01T00:00" })).toBe("window")
  })
})

describe("ReservationEditor", () => {
  it("previews with DryRun and shows the placement and the conflicts", async () => {
    apiGet.mockResolvedValue(result())
    apiPut.mockResolvedValue(result({ Conflicts: [{ From: "2026-10-05T09:00:00Z", To: "2026-10-05T10:00:00Z", ReservationIDs: ["r2"], PoolShort: false, Unplaced: 1, Short: { CPUMillicores: 100, MemoryBytes: 0 } }] }))
    renderEditor()
    fireEvent.click(await screen.findByRole("button", { name: t("admin.resources.editor.preview") }))
    expect(await screen.findByTestId("editor-preview")).toBeTruthy()
    expect(screen.getByTestId("editor-conflicts")).toBeTruthy()
    expect(apiPut).toHaveBeenCalledTimes(1)
    expect(apiPut.mock.calls[0][1]).toMatchObject({ DryRun: true })
    expect(apiPut.mock.calls[0][1]).not.toHaveProperty("AllowConflicts")
  })

  it("on 72504 asks to save anyway and repeats the save with AllowConflicts", async () => {
    apiGet.mockResolvedValue(result())
    apiPut.mockRejectedValueOnce(apiError(409, 72504)).mockResolvedValueOnce(result({ Reservation: { ...reservation, Covered: false } }))
    const { onSaved } = renderEditor()
    fireEvent.click(await screen.findByRole("button", { name: t("admin.resources.editor.save") }))
    expect(await screen.findByText(t("admin.resources.conflict.title"))).toBeTruthy()
    expect(apiPut).toHaveBeenCalledTimes(1)
    expect(apiPut.mock.calls[0][1]).toMatchObject({ DryRun: false })
    fireEvent.click(screen.getByRole("button", { name: t("admin.resources.conflict.confirm") }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(apiPut).toHaveBeenCalledTimes(2)
    expect(apiPut.mock.calls[1][1]).toMatchObject({ DryRun: false, AllowConflicts: true })
  })

  it("keeps the editor open and saves nothing when the conflict confirm is cancelled", async () => {
    apiGet.mockResolvedValue(result())
    apiPut.mockRejectedValueOnce(apiError(409, 72504))
    const { onSaved } = renderEditor()
    fireEvent.click(await screen.findByRole("button", { name: t("admin.resources.editor.save") }))
    await screen.findByText(t("admin.resources.conflict.title"))
    fireEvent.click(screen.getByRole("button", { name: t("confirm.cancel") }))
    await waitFor(() => expect(screen.queryByText(t("admin.resources.conflict.title"))).toBeNull())
    expect(onSaved).not.toHaveBeenCalled()
    expect(apiPut).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: t("admin.resources.editor.save") })).toBeTruthy()
  })

  it("opens an empty form when the event has no reservation (32513)", async () => {
    apiGet.mockRejectedValue(apiError(404, 32513))
    renderEditor()
    expect(await screen.findByText(t("admin.resources.editor.description"))).toBeTruthy()
    expect(screen.queryByRole("button", { name: t("admin.resources.editor.cancelReservation") })).toBeNull()
  })

  it("offers the cancel action for a saved reservation", async () => {
    apiGet.mockResolvedValue(result())
    const { onCancelReservation } = renderEditor()
    fireEvent.click(await screen.findByRole("button", { name: t("admin.resources.editor.cancelReservation") }))
    expect(onCancelReservation).toHaveBeenCalledWith(target)
  })

  it("is read-only without infrastructure.write", async () => {
    apiGet.mockResolvedValue(result())
    renderEditor({ canWrite: false })
    await screen.findByText(t("admin.resources.editor.descriptionSaved"))
    expect(screen.queryByRole("button", { name: t("admin.resources.editor.save") })).toBeNull()
  })
})
