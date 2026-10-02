import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ApiError } from "@/api/client"
import type { ChangeRequest } from "@/api/resourceCalendar"
import { t } from "@/i18n/t"
import { ChangeRequestsTab } from "./ChangeRequestsTab"

const apiGet = vi.fn()
const apiPost = vi.fn()
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  apiGet: (...a: unknown[]) => apiGet(...a), apiPost: (...a: unknown[]) => apiPost(...a),
}))

const request = (over: Partial<ChangeRequest> = {}): ChangeRequest => ({
  ID: "c1", ReservationID: "r1", EventID: "e1", EventName: "CTF", EventTag: "ctf", RequestedBy: "u1", RequestedAt: "2026-10-05T08:00:00Z",
  Size: { CPUMillicores: 4000, MemoryBytes: 1024 ** 3 }, Dynamic: null, WindowStart: null, WindowEnd: null, Reason: "More teams", Status: "pending",
  DecidedBy: "", DecidedAt: null, DecisionNote: "", CurrentSize: { CPUMillicores: 2000, MemoryBytes: 512 * 1024 ** 2 }, CurrentFrom: "2026-10-05T08:00:00Z", CurrentTo: "2026-10-05T14:00:00Z", ...over,
})
const apiError = (status: number, code: number) => new ApiError(status, {}, "x", undefined, code)

beforeEach(() => { apiGet.mockReset(); apiPost.mockReset() })

describe("ChangeRequestsTab", () => {
  it("loads pending requests by default and filters by status", async () => {
    apiGet.mockResolvedValue([request()])
    render(<ChangeRequestsTab canWrite version={0} onDecided={vi.fn()} />)
    expect(await screen.findByTestId("request-c1")).toBeTruthy()
    expect(apiGet.mock.calls[0][0]).toContain("status=pending")
    fireEvent.keyDown(screen.getByRole("button", { name: t("admin.resources.requests.filterStatus") }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: t("admin.resources.requests.status.rejected") }))
    await waitFor(() => expect(apiGet.mock.calls.at(-1)?.[0]).toContain("status=rejected"))
  })

  it("approves with a note", async () => {
    apiGet.mockResolvedValue([request()])
    apiPost.mockResolvedValue(request({ Status: "approved" }))
    const onDecided = vi.fn()
    render(<ChangeRequestsTab canWrite version={0} onDecided={onDecided} />)
    await screen.findByTestId("request-c1")
    fireEvent.click(screen.getByRole("button", { name: t("admin.resources.requests.approve") }))
    fireEvent.change(await screen.findByRole("textbox", { name: t("admin.resources.requests.note") }), { target: { value: "ok" } })
    fireEvent.click(screen.getAllByRole("button", { name: t("admin.resources.requests.approve") }).at(-1)!)
    await waitFor(() => expect(onDecided).toHaveBeenCalled())
    expect(apiPost.mock.calls[0][0]).toContain("/change-requests/c1/decision")
    expect(apiPost.mock.calls[0][1]).toEqual({ Approve: true, Note: "ok" })
  })

  it("on 72504 asks to approve anyway and repeats with AllowConflicts", async () => {
    apiGet.mockResolvedValue([request()])
    apiPost.mockRejectedValueOnce(apiError(409, 72504)).mockResolvedValueOnce(request({ Status: "approved" }))
    const onDecided = vi.fn()
    render(<ChangeRequestsTab canWrite version={0} onDecided={onDecided} />)
    await screen.findByTestId("request-c1")
    fireEvent.click(screen.getByRole("button", { name: t("admin.resources.requests.approve") }))
    fireEvent.click(screen.getAllByRole("button", { name: t("admin.resources.requests.approve") }).at(-1)!)
    expect(await screen.findByText(t("admin.resources.conflict.title"))).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: t("admin.resources.conflict.confirm") }))
    await waitFor(() => expect(onDecided).toHaveBeenCalled())
    expect(apiPost.mock.calls[1][1]).toMatchObject({ Approve: true, AllowConflicts: true })
  })

  it("rejects through a danger confirm, with no conflict step", async () => {
    apiGet.mockResolvedValue([request()])
    apiPost.mockResolvedValue(request({ Status: "rejected" }))
    render(<ChangeRequestsTab canWrite version={0} onDecided={vi.fn()} />)
    await screen.findByTestId("request-c1")
    fireEvent.click(screen.getByRole("button", { name: t("admin.resources.requests.reject") }))
    fireEvent.click(screen.getAllByRole("button", { name: t("admin.resources.requests.reject") }).at(-1)!)
    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    expect(apiPost.mock.calls[0][1]).toMatchObject({ Approve: false })
  })

  it("hides the decision buttons without infrastructure.write", async () => {
    apiGet.mockResolvedValue([request()])
    render(<ChangeRequestsTab canWrite={false} version={0} onDecided={vi.fn()} />)
    await screen.findByTestId("request-c1")
    expect(screen.queryByRole("button", { name: t("admin.resources.requests.approve") })).toBeNull()
  })

  it("shows the centered empty state", async () => {
    apiGet.mockResolvedValue([])
    const { container } = render(<ChangeRequestsTab canWrite version={0} onDecided={vi.fn()} />)
    await waitFor(() => expect(container.querySelector("[data-empty-state]")).toBeTruthy())
  })
})
