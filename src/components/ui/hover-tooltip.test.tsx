import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HoverTooltip } from "./hover-tooltip"

describe("HoverTooltip", () => {
  it("closes on pointer leave even when its trigger keeps focus", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Довідка</button></HoverTooltip>)
    const trigger = screen.getByRole("button", { name: "Довідка" })

    fireEvent.pointerEnter(trigger)
    fireEvent.focus(trigger)
    fireEvent.click(trigger)
    expect(screen.getByRole("tooltip")).toBeInTheDocument()

    fireEvent.pointerLeave(trigger)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("closes when the pointer moves outside after opening", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Довідка</button></HoverTooltip>)
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Довідка" }))
    expect(screen.getByRole("tooltip")).toBeInTheDocument()

    fireEvent.pointerMove(document.body)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("closes when the pointer leaves the browser window", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Довідка</button></HoverTooltip>)
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Довідка" }))
    expect(screen.getByRole("tooltip")).toBeInTheDocument()

    fireEvent.pointerOut(window, { relatedTarget: null })
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("closes when the browser loses focus", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Довідка</button></HoverTooltip>)
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Довідка" }))
    expect(screen.getByRole("tooltip")).toBeInTheDocument()

    fireEvent.blur(window)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })
})
