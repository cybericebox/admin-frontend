import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { DateTimePicker } from "./date-time-picker"

describe("DateTimePicker", () => {
  it("uses the shared placeholder color until a date is selected", () => {
    const { rerender } = render(<DateTimePicker value="" onChange={vi.fn()} aria-label="Архівація" />)
    expect(screen.getByText("Оберіть дату й час", { selector: "span" })).toHaveClass("text-placeholder")
    rerender(<DateTimePicker value="2026-09-01T09:30" onChange={vi.fn()} aria-label="Архівація" />)
    expect(screen.getByText("1 вересня 2026, 09:30")).not.toHaveClass("text-placeholder")
  })

  it("uses a styled calendar, preserves the time and emits a local date-time", () => {
    const onChange = vi.fn()
    render(<DateTimePicker value="2026-09-01T09:30" onChange={onChange} aria-label="Початок" />)
    fireEvent.click(screen.getByRole("button", { name: "Початок" }))
    const calendar = screen.getByRole("dialog", { name: "Оберіть дату й час" })
    expect(calendar.parentElement).toBe(document.body)
    expect(screen.getByRole("grid", { name: "Календар" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "15 вересня 2026" }))
    expect(onChange).toHaveBeenCalledWith("2026-09-15T09:30")
  })
})
