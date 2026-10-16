import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { VariableRichText } from "./VariableRichText"
import { InAppBodyEditor } from "./InAppBodyEditor"

const editors = [VariableRichText, InAppBodyEditor]
afterEach(() => vi.useRealTimers())
describe.each(editors)("unknown variable tooltip in $name", (Editor) => {
  it("uses the shared tooltip on keyboard focus and Escape without changing stored tokens", () => {
    const change = vi.fn()
    const { container } = render(<Editor value="Hi {{.ghost}}" onChange={change} variables={[{ name: "Name" }]} />)
    const pill = container.querySelector<HTMLElement>('[data-var="ghost"]')!
    expect(pill).not.toHaveAttribute("title")
    expect(pill).toHaveAttribute("tabindex", "0")
    fireEvent.focus(pill)
    const tooltip = screen.getByRole("tooltip")
    expect(tooltip).toHaveTextContent("ghost")
    expect(pill).toHaveAttribute("aria-describedby", tooltip.id)
    fireEvent.keyDown(pill, { key: "Escape" })
    expect(screen.queryByRole("tooltip")).toBeNull()
    expect(change).not.toHaveBeenCalled()
  })
  it("opens on Tab focus after a pointer click in the editable field", () => {
    const { container } = render(<Editor value="Hi {{.ghost}}" onChange={vi.fn()} variables={[{ name: "Name" }]} />)
    const textbox = screen.getByRole("textbox")
    const pill = container.querySelector<HTMLElement>('[data-var="ghost"]')!
    fireEvent.pointerDown(textbox, { pointerType: "mouse" })
    fireEvent.focus(textbox)
    fireEvent.keyDown(textbox, { key: "Tab" })
    fireEvent.focus(pill)
    expect(screen.getByRole("tooltip")).toHaveTextContent("ghost")
  })
  it("associates an inline field error with the editable control", () => {
    render(<Editor value="" onChange={vi.fn()} variables={[]} error="Complete the subject" />)
    const textbox = screen.getByRole("textbox")
    const error = screen.getByText("Complete the subject")
    expect(textbox).toHaveAttribute("aria-invalid", "true")
    expect(textbox).toHaveAttribute("aria-describedby", error.id)
  })
  it("closes a pinned hint when editing resumes outside the pill", () => {
    const { container } = render(<Editor value="{{.ghost}}" onChange={vi.fn()} variables={[{ name: "Name" }]} />)
    const pill = container.querySelector<HTMLElement>('[data-var="ghost"]')!
    fireEvent.click(pill)
    expect(screen.getByRole("tooltip")).toHaveTextContent("ghost")
    fireEvent.input(screen.getByRole("textbox"))
    expect(screen.queryByRole("tooltip")).toBeNull()
  })
  it("opens on hover after the common delay and on a touch tap", async () => {
    vi.useFakeTimers()
    const { container } = render(<Editor value="{{.ghost}}" onChange={vi.fn()} variables={[{ name: "Name" }]} />)
    const pill = container.querySelector<HTMLElement>('[data-var="ghost"]')!
    fireEvent.pointerOver(pill, { pointerType: "mouse" })
    expect(screen.queryByRole("tooltip")).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(screen.getByRole("tooltip")).toHaveTextContent("ghost")
    fireEvent.keyDown(pill, { key: "Escape" })
    fireEvent.pointerDown(pill, { pointerType: "touch" })
    fireEvent.click(pill)
    expect(screen.getByRole("tooltip")).toHaveTextContent("ghost")
  })
})
