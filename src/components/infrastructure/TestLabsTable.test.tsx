import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { TestLabsTable } from "./TestLabsTable"
import type { TestLab } from "@/api/infrastructure"

const base = { ID: "lab-1", GroupName: "t-1", ExerciseID: "e1", ExerciseName: "Тест доступу v3", VariantNumber: 1, AuthorID: "a1", AuthorName: "Анна Лі", AuthorEmail: "ann@example.test", CreatedAt: "2026-10-01T09:00:00Z", ExpiresAt: "2026-10-09T09:00:00Z", Expired: false } as TestLab

function renderRow(lab: TestLab) {
  render(<TestLabsTable filters={{ search: "", page: 1, pageSize: 10 }} searchInput="" onSearchInput={() => {}} onFilters={() => {}} items={[lab]} total={1} loading={false} error="" canWrite={false} onRetry={() => {}} onTerminate={() => {}} onDetails={() => {}} />)
}

describe("test labs row state", () => {
  it("shows only the ready status for a lab whose pods are all dispatched", () => {
    renderRow({ ...base, Status: "ready", Queue: { Position: 0, Length: 1, Reason: "", Message: "", Pods: 3, Pending: 0 } })
    expect(screen.getByText("Готова")).toBeInTheDocument()
    expect(screen.queryByText(/У черзі/)).not.toBeInTheDocument()
  })

  it("shows the queue position while the lab waits", () => {
    renderRow({ ...base, Status: "queued", Queue: { Position: 2, Length: 4, Reason: "WaitingForTurn", Message: "", Pods: 3, Pending: 3 } })
    expect(screen.getByText("У черзі 2/4")).toBeInTheDocument()
  })
})
