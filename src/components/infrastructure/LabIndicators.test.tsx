import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { LabQueueIndicator, queueReasonLabel, standQueueLabs } from "./LabIndicators"
import { formatDateTime } from "@/lib/locale"
import type { StandQueue } from "@/api/infrastructure"

const queue = { Position: 2, Length: 4, Reason: "WaitingForTurn", Attempt: 0, RetryAt: null, WaitingSince: null }
const clock = (iso: string) => formatDateTime(iso, { hour: "2-digit", minute: "2-digit" })

describe("lab queue indicator", () => {
  it("shows the queue place while pods wait to be sent, nothing once all are sent", () => {
    const { rerender } = render(<LabQueueIndicator queue={queue} />)
    expect(screen.getByText("У черзі 2/4")).toBeInTheDocument()
    rerender(<LabQueueIndicator queue={{ ...queue, Position: 0, Reason: "" }} />)
    expect(screen.queryByText(/У черзі/)).not.toBeInTheDocument()
  })

  it("shows a lab waiting for a new node even when every pod is sent", () => {
    render(<LabQueueIndicator queue={{ ...queue, Position: 0, Reason: "NodeStarting", WaitingSince: "2026-10-19T10:05:00Z" }} />)
    expect(screen.getByText("Чекає на вузол")).toBeInTheDocument()
  })
})

describe("stand queue labs", () => {
  it("counts the labs the indicator speaks about", () => {
    const stand: StandQueue = { QueuedLabs: 3, Position: 1, Length: 4, Reason: "InsufficientResources", NodeStartingLabs: 2 }
    expect(standQueueLabs(stand)).toBe(3)
    expect(standQueueLabs({ ...stand, QueuedLabs: 0, Position: 0, Reason: "NodeStarting" })).toBe(2)
    expect(standQueueLabs(null)).toBe(0)
  })
})

describe("queue reason text", () => {
  it("says since when a lab waits for a new node", () => {
    expect(queueReasonLabel("NodeStarting", { WaitingSince: "2026-10-19T10:05:00Z" })).toBe(`Усі поди надіслано, частина чекає на новий вузол кластера з ${clock("2026-10-19T10:05:00Z")}`)
    expect(queueReasonLabel("NodeStarting")).toBe("Усі поди надіслано, частина чекає на новий вузол кластера")
  })

  it("gives the attempt and the retry time of a withdrawn launch", () => {
    expect(queueReasonLabel("Withdrawn", { Attempt: 3, RetryAt: "2026-10-19T10:20:00Z" }))
      .toBe(`Запуск відкликано: не всі поди отримали вузол вчасно. Спроба 3, повтор о ${clock("2026-10-19T10:20:00Z")}`)
    expect(queueReasonLabel("Withdrawn")).toBe("Запуск відкликано: не всі поди отримали вузол вчасно, повтор буде автоматично")
  })

  it("names every scheduler wait reason, never the generic text", () => {
    for (const reason of ["TenantQuota", "DoesNotFitNow", "ReservationMissing", "ReservationNotActive", "ReservationFull"]) {
      expect(queueReasonLabel(reason)).not.toBe(queueReasonLabel("SomethingNew"))
    }
  })
})
