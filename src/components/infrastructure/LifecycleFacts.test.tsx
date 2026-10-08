import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { allocation, managedLab } from "@/test/labLifecycle"
import { AllocationFacts, LifecycleFacts } from "./LifecycleFacts"

function fact(label: string) {
  return screen.getByText(label).closest("div")!
}

describe("operator lifecycle facts", () => {
  it("keeps solved closure separate from stop failure, held resources and unknown physical storage", () => {
    const { container } = render(<LifecycleFacts lab={managedLab} />)
    expect(container.querySelector(`[data-lab-id="${managedLab.ID}"]`)).toBeInTheDocument()
    expect(screen.getByText("Закрито: усі залежні завдання виконано")).toBeInTheDocument()
    expect(fact("Фактичний стан")).toHaveTextContent("Зупинка не завершилась")
    expect(screen.getByText("Знімок не створено")).toBeInTheDocument()
    expect(screen.getByText("Спостереження застаріле або відсутнє")).toBeInTheDocument()
    expect(fact("Утримані ресурси")).toHaveTextContent("250 мілі-ядер · 100 МіБ")
    expect(fact("Фізичне сховище")).toHaveTextContent("Невідомо")
    expect(fact("Фізичне сховище")).not.toHaveTextContent("0 Б")
    expect(screen.getByText("snapshot capture failed")).toBeInTheDocument()
    expect(screen.getByText("CaptureFailed")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("displays confirmed compute release independently from retained snapshot quota", () => {
    render(<LifecycleFacts lab={{ ...managedLab, ObservedRevision: "12", ActualState: "Stopped", SnapshotState: "Succeeded", FailureCode: "", FailureMessage: "", ActualStoppedAt: "2026-10-08T12:02:00Z", Resources: { ...allocation, RuntimeState: "Released", AllocatedRequests: { CPUMillicores: "0", MemoryBytes: "0" }, ReleasedRequests: { CPUMillicores: "250", MemoryBytes: "104857600" }, ReleasedAt: "2026-10-08T12:02:00Z" } }} />)
    expect(screen.getByText("Спостереження актуальне")).toBeInTheDocument()
    expect(fact("Підтверджено звільнено")).toHaveTextContent("250 мілі-ядер · 100 МіБ")
    expect(fact("Утримана квота знімків")).toHaveTextContent("9 007 199 254 740 993 Б")
    expect(screen.getByText("Збережено")).toBeInTheDocument()
    expect(screen.getByText("Зберігається файловий стан, а не памʼять процесів чи незаписані мережеві зміни.")).toBeInTheDocument()
  })

  it("renders unavailable measured usage as unknown and raw failure data as plain text", () => {
    const { rerender } = render(<AllocationFacts current resources={{ ...allocation, UsageAvailable: false, PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "1048576" }} />)
    expect(fact("Виміряне використання")).toHaveTextContent("Невідомо")
    expect(fact("Фізичне сховище")).toHaveTextContent("1 МіБ")
    rerender(<LifecycleFacts lab={{ ...managedLab, FailureMessage: "<img src=x onerror=alert(1)>" }} />)
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("masks stale positive release and usage claims while preserving conservative held amounts and quota", () => {
    render(<LifecycleFacts lab={{ ...managedLab, Resources: { ...allocation, RuntimeState: "Released", ReleasedRequests: { CPUMillicores: "250", MemoryBytes: "104857600" }, ReleasedAt: "2026-10-08T12:00:00Z", PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "1048576", StorageState: "Deleted" } }} />)
    expect(fact("Підтверджено звільнено")).toHaveTextContent("Невідомо")
    expect(fact("Виміряне використання")).toHaveTextContent("Невідомо")
    expect(fact("Звільнення ресурсів виконання")).toHaveTextContent("Невідомо")
    expect(fact("Фізичне сховище")).toHaveTextContent("Невідомо")
    expect(fact("Збереження сховища")).toHaveTextContent("Невідомо")
    expect(fact("Утримані ресурси")).toHaveTextContent("250 мілі-ядер · 100 МіБ")
    expect(fact("Утримана квота знімків")).toHaveTextContent("9 007 199 254 740 993 Б")
  })

  it("requires an explicit current parent observation before standalone allocation can confirm availability", () => {
    render(<AllocationFacts resources={allocation} />)
    expect(fact("Виміряне використання")).toHaveTextContent("Невідомо")
    expect(fact("Підтверджено звільнено")).toHaveTextContent("Невідомо")
  })
})
