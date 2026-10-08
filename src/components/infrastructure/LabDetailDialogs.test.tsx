import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { StandDetailDialog, TestLabDetailDialog } from "./LabDetailDialogs"
import type { Stand, TestLab } from "@/api/infrastructure"
import { managedLab } from "@/test/labLifecycle"

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

const stand = { EventID: "event-1", TeamID: "team-1", TeamName: "Команда", EventName: "Захід", Status: "ready" } as Stand
const standDetail = (lifecycle = true) => ({
  TeamID: "team-1", TeamName: "Команда", Moderators: false, Status: "ready", Reason: "", Generation: 1, LaboratoriesAvailable: true,
  Labs: [{ ChallengeID: "question-1", ChallengeName: "Питання", Status: "ready", Reason: "", Live: detail().Live, LiveUnavailable: false,
    ...(lifecycle ? { Lab: managedLab, Questions: [{ EventChallengeID: "00000000-0000-4000-8000-000000000001", Name: "Перше залежне завдання" }, { EventChallengeID: "00000000-0000-4000-8000-000000000002", Name: "Друге залежне завдання" }] } : {}),
  }],
})

describe("managed stand detail", () => {
  it("renders a shared lab once for both questions and keeps solved devices read-only even for writers", async () => {
    apiGet.mockResolvedValue(standDetail())
    render(<StandDetailDialog stand={stand} canWrite onClose={() => {}} />)
    expect(await screen.findByText("Перше залежне завдання")).toBeInTheDocument()
    expect(screen.getByText("Друге залежне завдання")).toBeInTheDocument()
    expect(document.querySelectorAll(`[data-lab-id="${managedLab.ID}"]`)).toHaveLength(1)
    expect(screen.getAllByText("web")).toHaveLength(1)
    expect(screen.getByText("snapshot capture failed")).toBeInTheDocument()
    expect(screen.getByText("Розмір знімків")).toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Скинути|Запустити|Зупинити|Перезапустити/ })).not.toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
  })

  it("preserves legacy inspection and device permissions when lifecycle fields are absent", async () => {
    apiGet.mockResolvedValue(standDetail(false))
    render(<StandDetailDialog stand={stand} canWrite onClose={() => {}} />)
    expect(await screen.findByRole("switch", { name: /web/ })).toBeEnabled()
    expect(screen.getByRole("button", { name: /Скинути до образу: web/ })).toBeEnabled()
    expect(screen.queryByText("Спостереження актуальне")).not.toBeInTheDocument()
  })

  it("preserves lifecycle facts and physical amounts when a background detail request fails", async () => {
    apiGet.mockResolvedValueOnce(standDetail()).mockRejectedValue(new Error("offline"))
    render(<StandDetailDialog stand={stand} canWrite onClose={() => {}} />)
    expect(await screen.findByText("snapshot capture failed")).toBeInTheDocument()
    const facts = document.querySelector(`[data-lab-id="${managedLab.ID}"]`)
    const later = Date.now() + 20_001
    vi.spyOn(Date, "now").mockReturnValue(later)
    fireEvent(document, new Event("visibilitychange"))
    expect(await screen.findByText("Не вдалося завантажити стан лабораторії.")).toBeInTheDocument()
    expect(document.querySelector(`[data-lab-id="${managedLab.ID}"]`)).toBe(facts)
    expect(facts).toHaveTextContent("250 мілі-ядер · 100 МіБ")
    expect(facts).toHaveTextContent("9 007 199 254 740 993 Б")
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
  })

  it("withdraws an open reset confirmation when polling closes its managed lab", async () => {
    const open = { ...standDetail(), Labs: [{ ...standDetail().Labs[0], Lab: { ...managedLab, ClosedAt: null, CloseReason: null } }] }
    apiGet.mockResolvedValueOnce(open).mockResolvedValue(standDetail())
    render(<StandDetailDialog stand={stand} canWrite onClose={() => {}} />)
    fireEvent.click(await screen.findByRole("button", { name: /Скинути до образу: web/ }))
    expect(screen.getByRole("button", { name: "Скинути" })).toBeInTheDocument()
    const later = Date.now() + 20_001
    vi.spyOn(Date, "now").mockReturnValue(later)
    fireEvent(document, new Event("visibilitychange"))
    await waitFor(() => expect(screen.queryByRole("button", { name: "Скинути" })).not.toBeInTheDocument())
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Скинути до образу/ })).not.toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
  })
})

beforeEach(() => { vi.restoreAllMocks(); apiGet.mockReset(); apiPost.mockReset(); apiGet.mockResolvedValue(detail()) })

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
