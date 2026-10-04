import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { NumberInput, parseNumberInput } from "./number-input"

describe("NumberInput", () => {
  it("is a text field, so no native spinners", () => {
    render(<NumberInput aria-label="n" value="" onChange={() => {}} />)
    expect(screen.getByLabelText("n")).toHaveAttribute("type", "text")
    expect(screen.getByLabelText("n")).toHaveAttribute("inputmode", "numeric")
  })

  it("accepts digits only for integers", () => {
    const onChange = vi.fn()
    render(<NumberInput aria-label="n" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText("n"), { target: { value: "12a" } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("n"), { target: { value: "50000" } })
    expect(onChange).toHaveBeenCalledWith("50000")
  })

  it("accepts one decimal separator, comma normalized to a dot", () => {
    const onChange = vi.fn()
    render(<NumberInput aria-label="n" decimal value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText("n"), { target: { value: "0,5" } })
    expect(onChange).toHaveBeenCalledWith("0.5")
    onChange.mockClear()
    fireEvent.change(screen.getByLabelText("n"), { target: { value: "1.2.3" } })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe("parseNumberInput", () => {
  it("maps empty to not set, positives to numbers and the rest to NaN", () => {
    expect(parseNumberInput("")).toBeNull()
    expect(parseNumberInput("14")).toBe(14)
    expect(parseNumberInput("0.5")).toBe(0.5)
    expect(parseNumberInput("0")).toBeNaN()
    expect(parseNumberInput("0.")).toBeNaN()
    expect(parseNumberInput(".")).toBeNaN()
    expect(parseNumberInput("1.5", true)).toBeNaN()
    expect(parseNumberInput("50000", true)).toBe(50000)
  })
})
