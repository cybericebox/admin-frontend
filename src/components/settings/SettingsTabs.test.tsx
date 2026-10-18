import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

let pathname = "/settings/tasks/"
vi.mock("next/navigation", () => ({ usePathname: () => pathname }))

import { SettingsTabs } from "./SettingsTabs"

describe("SettingsTabs", () => {
  it("links the four sections in order and marks the active one", () => {
    render(<SettingsTabs />)
    const links = screen.getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual(["Загальні", "Пошта", "Завдання", "Зберігання даних"])
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/settings", "/settings/mail", "/settings/tasks", "/settings/data-retention"])
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([null, null, "page", null])
  })

  it("marks Зберігання даних on its own route", () => {
    pathname = "/settings/data-retention"
    render(<SettingsTabs />)
    expect(screen.getByRole("link", { name: "Зберігання даних" })).toHaveAttribute("aria-current", "page")
  })
})

describe("SettingsTabs on narrow screens", () => {
  it("scrolls inside itself and brings the active tab into view", () => {
    pathname = "/settings/data-retention"
    const scrollTo = vi.fn()
    const rect = (left: number, width: number) => ({ left, width, right: left + width, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
    const proto = HTMLElement.prototype
    Object.defineProperty(proto, "scrollTo", { configurable: true, value: scrollTo })
    const spies = [
      vi.spyOn(proto, "scrollWidth", "get").mockReturnValue(600),
      vi.spyOn(proto, "clientWidth", "get").mockReturnValue(300),
      vi.spyOn(proto, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        return this.tagName === "NAV" ? rect(0, 300) : rect(450, 140)
      }),
    ]
    render(<SettingsTabs />)
    expect(screen.getByRole("navigation")).toHaveClass("ib-tabs--scroll")
    expect(scrollTo).toHaveBeenCalledWith({ left: 450 + 140 + 16 - 300, behavior: "auto" })
    spies.forEach((spy) => spy.mockRestore())
    Reflect.deleteProperty(proto, "scrollTo")
  })
})
