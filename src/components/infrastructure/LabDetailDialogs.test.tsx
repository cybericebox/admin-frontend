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

  it("names each device by its topology name and type, and states the started pods positively", async () => {
    apiGet.mockResolvedValue({
      ID: "lab-1", GroupName: "t-1", Status: "ready",
      Live: {
        Phase: "Ready", Ready: true, Queue: { Position: 0, Length: 1, Reason: "", Message: "", Pods: 3, Pending: 0 }, ImageWarning: "", GroupImageWarning: "",
        Devices: [
          { Name: "web", LogicalName: "web", Type: "container", Ready: true, Reason: "", Scheduling: null, Snapshot: null },
          { Name: "sw-1f15b9e9bb8d5c1d84c6b7a8547cdd98", LogicalName: "lan", Type: "unmanaged-switch", Ready: true, Reason: "", Scheduling: null, Snapshot: null },
          { Name: "vpn", Type: "vpn", Ready: true, Reason: "", Scheduling: null, Snapshot: null },
        ],
      },
    })
    render(<TestLabDetailDialog lab={lab} canWrite={false} onClose={() => {}} />)
    expect(await screen.findByText("Запущено подів: 3 з 3")).toBeInTheDocument()
    expect(screen.queryByText(/Не запущено подів/)).not.toBeInTheDocument()
    expect(screen.queryByText(/У черзі/)).not.toBeInTheDocument()
    expect(screen.getByText("Контейнер")).toBeInTheDocument()
    expect(screen.getByText("Комутатор")).toBeInTheDocument()
    expect(screen.getByText("VPN-шлюз")).toBeInTheDocument()
    expect(screen.getByText("lan")).toBeInTheDocument()
    expect(screen.queryByText(/sw-1f15b9e9/)).not.toBeInTheDocument()
  })

  it("counts the pods that already started when some still wait", async () => {
    apiGet.mockResolvedValue({
      ID: "lab-1", GroupName: "t-1", Status: "creating",
      Live: { Phase: "Provisioning", Ready: false, Queue: { Position: 1, Length: 2, Reason: "WaitingForTurn", Message: "", Pods: 3, Pending: 2 }, ImageWarning: "", GroupImageWarning: "", Devices: [] },
    })
    render(<TestLabDetailDialog lab={lab} canWrite={false} onClose={() => {}} />)
    expect(await screen.findByText("Запущено подів: 1 з 3")).toBeInTheDocument()
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
