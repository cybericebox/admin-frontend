import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HoverTooltip } from "./hover-tooltip"

const hover = (element: Element) => { fireEvent.pointerEnter(element, { pointerType: "mouse" }); act(() => { vi.advanceTimersByTime(300) }) }
const leave = (element: Element) => { fireEvent.pointerLeave(element); act(() => { vi.advanceTimersByTime(200) }) }

describe("HoverTooltip", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("opens after 300 ms of hover, not before", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Кнопка</button></HoverTooltip>)
    const trigger = screen.getByRole("button", { name: "Кнопка" })
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" })
    act(() => { vi.advanceTimersByTime(299) })
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole("tooltip")).toHaveTextContent("Пояснення")
  })

  it("never opens on a touch pointer", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Кнопка</button></HoverTooltip>)
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Кнопка" }), { pointerType: "touch" })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("stays open while the pointer travels from the trigger onto the bubble (hoverable)", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Кнопка</button></HoverTooltip>)
    const trigger = screen.getByRole("button", { name: "Кнопка" })
    hover(trigger)
    const bubble = screen.getByRole("tooltip")
    fireEvent.pointerLeave(trigger, { relatedTarget: bubble })
    act(() => { vi.advanceTimersByTime(60) })
    fireEvent.pointerEnter(bubble, { relatedTarget: trigger })
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
    leave(bubble)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("closes on pointer leave even when its trigger keeps focus", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Кнопка</button></HoverTooltip>)
    const trigger = screen.getByRole("button", { name: "Кнопка" })
    hover(trigger)
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
    leave(trigger)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("closes when the pointer moves outside after opening", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Кнопка</button></HoverTooltip>)
    hover(screen.getByRole("button", { name: "Кнопка" }))
    fireEvent.pointerMove(document.body)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("closes when the pointer leaves the browser window and when the browser loses focus", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Кнопка</button></HoverTooltip>)
    const trigger = screen.getByRole("button", { name: "Кнопка" })
    hover(trigger)
    fireEvent.pointerOut(window, { relatedTarget: null })
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    hover(trigger)
    fireEvent.blur(window)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("Esc dismisses an open tooltip", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Кнопка</button></HoverTooltip>)
    hover(screen.getByRole("button", { name: "Кнопка" }))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("opens at once on keyboard focus for an icon label", () => {
    render(<HoverTooltip text="Пояснення"><button type="button">Кнопка</button></HoverTooltip>)
    fireEvent.focus(screen.getByRole("button", { name: "Кнопка" }))
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
  })

  it("places a long tooltip below when it would be clipped above", () => {
    const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const height = this.getAttribute("role") === "tooltip" ? 300 : 20
      return { left: 100, right: 120, top: 80, bottom: 80 + height, width: 20, height,
        x: 100, y: 80, toJSON: () => ({}) } as DOMRect
    })
    try {
      render(<HoverTooltip text={"Довга підказка ".repeat(30)}><button type="button">Кнопка</button></HoverTooltip>)
      hover(screen.getByRole("button", { name: "Кнопка" }))
      expect(screen.getByRole("tooltip")).toHaveStyle({ top: "107px", transform: "translate(-50%, 0)" })
    } finally {
      bounds.mockRestore()
    }
  })

  it("opens a truncated hint only when the text overflows", () => {
    render(<HoverTooltip text="Повний текст" truncated><span>Повний текст</span></HoverTooltip>)
    const text = screen.getByText("Повний текст")
    hover(text)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    Object.defineProperty(text, "scrollWidth", { configurable: true, value: 200 })
    Object.defineProperty(text, "clientWidth", { configurable: true, value: 100 })
    hover(text)
    expect(screen.getByRole("tooltip")).toHaveTextContent("Повний текст")
  })

  describe("help variant", () => {
    const help = () => render(<HoverTooltip text="Назва, яку бачать учасники." help describe><button type="button" aria-label="Довідка">?</button></HoverTooltip>)

    it("describes the trigger permanently, keeping the long text out of its name", () => {
      help()
      const trigger = screen.getByRole("button", { name: "Довідка" })
      expect(trigger).toHaveAccessibleDescription("Назва, яку бачать учасники.")
      expect(trigger).toHaveAttribute("aria-expanded", "false")
    })

    it("does not open on focus, a click toggles it and Esc closes it and returns focus", () => {
      help()
      const trigger = screen.getByRole("button", { name: "Довідка" })
      fireEvent.focus(trigger)
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

      fireEvent.click(trigger)
      expect(screen.getByRole("tooltip")).toBeInTheDocument()
      expect(trigger).toHaveAttribute("aria-expanded", "true")
      fireEvent.click(trigger)
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

      fireEvent.click(trigger)
      fireEvent.keyDown(document, { key: "Escape" })
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })

    it("closes on a press outside and stays open when the pointer leaves", () => {
      help()
      const trigger = screen.getByRole("button", { name: "Довідка" })
      fireEvent.click(trigger)
      leave(trigger)
      expect(screen.getByRole("tooltip")).toBeInTheDocument()
      fireEvent.pointerDown(document.body)
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    })
  })
})
