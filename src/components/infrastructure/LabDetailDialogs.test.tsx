import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TestLabDetailDialog } from "./LabDetailDialogs"
import type { TestLab } from "@/api/infrastructure"

const apiGet = vi.fn()
const apiPost = vi.fn()
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: (...args: unknown[]) => apiGet(...args), apiPost: (...args: unknown[]) => apiPost(...args) }))

const lab = { ID: "lab-1", ExerciseName: "Вебуразливість", AuthorName: "Анна Лі", AuthorEmail: "ann@example.test", Status: "ready" } as TestLab
const detail = () => ({
  ID: "lab-1", GroupName: "t-1", Status: "creating",
  Live: {
    Phase: "Provisioning", Ready: false, Queue: null, ImageWarning: "", GroupImageWarning: "",
    Devices: [
      { Name: "web", Ready: false, Reason: "", Scheduling: { State: "Failed", QueuedAt: null, DispatchedAt: null, StartedAt: null, Failure: { Reason: "ImagePull", Message: "pull denied", RestartCount: 3, At: null } }, Snapshot: { LastSnapshotAt: null, RestoredAt: null, SizeBytes: 0, Warning: "", Rescue: false } },
      { Name: "db", Ready: true, Reason: "", Scheduling: null, Snapshot: null },
    ],
  },
})

beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); apiGet.mockResolvedValue(detail()) })

describe("test lab detail", () => {
  it("shows devices with the failure and lets a writer switch rescue at once, keeping other controls enabled", async () => {
    let finish: () => void = () => {}
    apiPost.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    render(<TestLabDetailDialog lab={lab} canWrite onClose={() => {}} />)
    expect(await screen.findByText("pull denied")).toBeInTheDocument()
    const toggle = screen.getByRole("switch", { name: /web/ })
    expect(toggle).toHaveAttribute("aria-checked", "false")
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-checked", "true")
    expect(toggle).toBeEnabled()
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(expect.stringContaining("/devices/web/rescue"), { Enable: true }))
    finish()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))
  })

  it("is read-only without write access", async () => {
    render(<TestLabDetailDialog lab={lab} canWrite={false} onClose={() => {}} />)
    expect(await screen.findByText("pull denied")).toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Скинути/ })).not.toBeInTheDocument()
  })

  it("resets a device only after a confirmation", async () => {
    apiPost.mockResolvedValue({})
    render(<TestLabDetailDialog lab={lab} canWrite onClose={() => {}} />)
    fireEvent.click(await screen.findByRole("button", { name: /Скинути до образу: web/ }))
    expect(apiPost).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Скинути" }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(expect.stringContaining("/devices/web/reset"), {}))
  })
})
