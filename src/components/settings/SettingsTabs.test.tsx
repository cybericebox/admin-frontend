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
