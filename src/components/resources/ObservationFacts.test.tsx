import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ResourceObservation } from "@/api/labLifecycle"
import type { Stats } from "@/api/resourceCalendar"
import { resourceObservation } from "@/test/labLifecycle"
import { StatsTab } from "./StatsTab"
import { ObservationFacts } from "./ObservationFacts"
import { useCalendarResource } from "./resourceView"

const observation: ResourceObservation = {
  ...resourceObservation,
  Held: { CPUMillicores: "500", MemoryBytes: "209715200", SnapshotQuotaBytes: "1048576" },
  PendingStarts: { CPUMillicores: "250", MemoryBytes: "104857600" },
  GroupServices: { CPUMillicores: "50", MemoryBytes: "83886080" },
}
const amount = { CPUMillicores: 500, MemoryBytes: 209715200 }
const stats: Stats = {
  At: "2026-10-08T12:00:00Z", TestPool: amount, TestLabsHeld: amount, PendingChangeRequests: 0, OpenAlarms: 0,
  Agents: [{ ID: "a1", Name: "Agent", Priority: 1, Used: true, Connected: true, Capacity: amount, Allocated: amount, InUse: amount, Free: { CPUMillicores: 0, MemoryBytes: 0 } }],
  Events: [{ ReservationID: "r1", EventID: "e1", EventName: "Cup", EventTag: "cup", From: "2026-10-08T10:00:00Z", To: "2026-10-08T14:00:00Z", Allocated: amount, InUse: amount, Free: { CPUMillicores: 0, MemoryBytes: 0 }, Covered: true }],
  Observation: observation,
}
const renderStats = (value: Stats = stats, error: unknown = null) => render(<StatsTab stats={value} error={error} onRetry={vi.fn()} />)
const fact = (label: string) => screen.getByText(label).closest("div")!

describe("aggregate resource observations", () => {
  it("uses the shared centered empty state for a missing observation", () => {
    const { container } = render(<ObservationFacts observation={null} />)
    expect(container.querySelector("[data-empty-state]")).toHaveTextContent("Невідомо")
    expect(container.querySelector("[data-empty-state]")).toHaveClass("items-center", "justify-center", "min-h-112", "sm:min-h-56")
    expect(screen.queryByTestId("observation-held")).not.toBeInTheDocument()
  })
  it("displays held once with pending and group amounts only as included breakdowns", () => {
    renderStats()
    expect(screen.getByTestId("observation-held")).toHaveTextContent("500 мілі-ядер · 200 МіБ")
    expect(screen.getByTestId("observation-held")).not.toHaveTextContent("800")
    expect(fact("Запуски в очікуванні (входять до загального обсягу)")).toHaveTextContent("250 мілі-ядер · 100 МіБ")
    expect(fact("Сервіси групи (входять до загального обсягу)")).toHaveTextContent("50 мілі-ядер · 80 МіБ")
    expect(screen.getByTestId("observation-state")).toHaveTextContent("Неповні спостереження")
    expect(screen.getByTestId("observation-storage")).toHaveTextContent("Невідомо")
    expect(fact("Утримана квота знімків")).toHaveTextContent("1 МіБ")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("preserves a legacy numeric summary with centered unknown observation rather than zero amounts", () => {
    const { container } = renderStats({ ...stats, Observation: undefined })
    expect(screen.getByTestId("agent-stat-a1")).toHaveTextContent("500 мілі-ядер · 200 МіБ")
    expect(screen.getByTestId("event-stat-r1")).toHaveTextContent("Cup")
    expect(container.querySelector("[data-empty-state]")).toHaveTextContent("Невідомо")
    expect(screen.queryByTestId("observation-held")).not.toBeInTheDocument()
  })

  it("marks zero incomplete held as unknown contributors while retaining snapshot reservation", () => {
    renderStats({ ...stats, Observation: { ...observation, Held: { CPUMillicores: "0", MemoryBytes: "0", SnapshotQuotaBytes: "1048576" }, PendingStarts: { CPUMillicores: "0", MemoryBytes: "0" }, GroupServices: { CPUMillicores: "0", MemoryBytes: "0" } } })
    expect(screen.getByTestId("observation-held")).toHaveTextContent("Невідомо")
    expect(screen.getByTestId("observation-held")).not.toHaveTextContent("0 Б")
    expect(screen.getByTestId("observation-state")).toHaveTextContent("Неповні спостереження")
    expect(fact("Утримана квота знімків")).toHaveTextContent("1 МіБ")
    expect(screen.getByTestId("observation-storage")).toHaveTextContent("Невідомо")
  })

  it("renders producer-confirmed zero compute independently from retained quota and available actual zero storage", () => {
    renderStats({ ...stats, Observation: { ...observation, Complete: true, Held: { CPUMillicores: "0", MemoryBytes: "0", SnapshotQuotaBytes: "1048576" }, PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "0" } })
    expect(screen.getByTestId("observation-held")).toHaveTextContent("0 vCPU · 0 Б")
    expect(screen.getByTestId("observation-state")).toHaveTextContent("Спостереження актуальні")
    expect(screen.getByTestId("observation-storage")).toHaveTextContent("0 Б")
    expect(fact("Утримана квота знімків")).toHaveTextContent("1 МіБ")
  })

  it("does not confirm missing observation timestamp even with Complete=true and an available storage claim", () => {
    renderStats({ ...stats, Observation: { ...observation, Complete: true, ObservedAt: null, PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "1048576" } })
    expect(screen.getByTestId("observation-state")).toHaveTextContent("Неповні спостереження")
    expect(screen.getByTestId("observation-held")).toHaveTextContent("500 мілі-ядер · 200 МіБ")
    expect(screen.getByTestId("observation-storage")).toHaveTextContent("Невідомо")
  })

  it("shows explicitly known physical storage independently from unknown runtime contributors", () => {
    renderStats({ ...stats, Observation: { ...observation, Complete: false, PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "2097152" } })
    expect(screen.getByTestId("observation-state")).toHaveTextContent("Неповні спостереження")
    expect(screen.getByTestId("observation-storage")).toHaveTextContent("2 МіБ")
    expect(fact("Утримана квота знімків")).toHaveTextContent("1 МіБ")
  })

  it("preserves exact decimal resource digits above safe integers", () => {
    renderStats({ ...stats, Observation: { ...observation, Held: { CPUMillicores: "9007199254740993", MemoryBytes: "9007199254740993", SnapshotQuotaBytes: "9007199254740993" } } })
    expect(screen.getByTestId("observation-held")).toHaveTextContent("9 007 199 254 740 993 mCPU · 9 007 199 254 740 993 Б")
    expect(fact("Утримана квота знімків")).toHaveTextContent("9 007 199 254 740 993 Б")
  })

  it("changes held compute only when a new producer response reports release and keeps snapshot quota", () => {
    const { rerender } = renderStats()
    const held = screen.getByTestId("observation-held")
    rerender(<StatsTab stats={{ ...stats, At: "2026-10-08T12:01:00Z" }} error={null} onRetry={vi.fn()} />)
    expect(screen.getByTestId("observation-held")).toBe(held)
    expect(held).toHaveTextContent("500 мілі-ядер · 200 МіБ")
    rerender(<StatsTab stats={{ ...stats, Observation: { ...observation, Complete: true, Held: { ...observation.Held, CPUMillicores: "50", MemoryBytes: "83886080" }, PendingStarts: { CPUMillicores: "0", MemoryBytes: "0" } } }} error={null} onRetry={vi.fn()} />)
    expect(held).toHaveTextContent("50 мілі-ядер · 80 МіБ")
    expect(fact("Утримана квота знімків")).toHaveTextContent("1 МіБ")
  })

  it("keeps the same held and reservation nodes during pending refresh and after refresh failure", async () => {
    let fail!: (error: Error) => void
    const load = vi.fn<() => Promise<Stats>>().mockResolvedValueOnce({ ...stats, Observation: { ...observation, Complete: true, PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "1048576" } }).mockImplementationOnce(() => new Promise((_, reject) => { fail = reject }))
    function PollingStats() {
      const resource = useCalendarResource(load, true)
      return <><button onClick={() => void resource.refresh(true)}>Refresh fixture</button><StatsTab stats={resource.data} error={resource.error} onRetry={() => void resource.refresh(true)} /></>
    }
    render(<PollingStats />)
    const held = await screen.findByTestId("observation-held")
    const reservation = screen.getByTestId("event-stat-r1")
    fireEvent.click(screen.getByRole("button", { name: "Refresh fixture" }))
    expect(held).toHaveTextContent("500 мілі-ядер · 200 МіБ")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    fail(new Error("offline"))
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Не вдалося завантажити статистику"))
    expect(screen.getByTestId("observation-held")).toBe(held)
    expect(screen.getByTestId("event-stat-r1")).toBe(reservation)
    expect(held).toHaveTextContent("500 мілі-ядер · 200 МіБ")
    expect(screen.getByTestId("observation-state")).toHaveTextContent("Неповні спостереження")
    expect(screen.getByTestId("observation-storage")).toHaveTextContent("Невідомо")
  })
})
