import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { DateTimePicker } from "./date-time-picker"

describe("DateTimePicker", () => {
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
