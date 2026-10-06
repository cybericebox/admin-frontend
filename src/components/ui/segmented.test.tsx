import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Segmented } from "./segmented"

const options = [
  { value: "light", label: "Світла" },
  { value: "dark", label: "Темна" },
  { value: "system", label: "Системна" },
] as const

describe("Segmented", () => {
  it("is a radiogroup with a roving tabindex: only the checked radio is in the Tab order", () => {
    render(<Segmented value="dark" onChange={() => {}} options={options} label="Тема" />)
    expect(screen.getByRole("radiogroup", { name: "Тема" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Темна" })).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("radio", { name: "Світла" })).toHaveAttribute("tabindex", "-1")
  })

  it("arrows move and select, wrapping around; Home and End jump", () => {
    const onChange = vi.fn()
    render(<Segmented value="system" onChange={onChange} options={options} label="Тема" />)
    const system = screen.getByRole("radio", { name: "Системна" })
    fireEvent.keyDown(system, { key: "ArrowRight" })
    expect(onChange).toHaveBeenLastCalledWith("light")
    fireEvent.keyDown(system, { key: "ArrowLeft" })
    expect(onChange).toHaveBeenLastCalledWith("dark")
    fireEvent.keyDown(system, { key: "Home" })
    expect(onChange).toHaveBeenLastCalledWith("light")
    fireEvent.keyDown(screen.getByRole("radio", { name: "Світла" }), { key: "End" })
    expect(onChange).toHaveBeenLastCalledWith("system")
  })

  it("skips disabled options", () => {
    const onChange = vi.fn()
    render(<Segmented value="light" onChange={onChange} label="Тема" options={[options[0], { ...options[1], disabled: true }, options[2]]} />)
    fireEvent.keyDown(screen.getByRole("radio", { name: "Світла" }), { key: "ArrowRight" })
    expect(onChange).toHaveBeenLastCalledWith("system")
  })
})
