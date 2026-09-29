import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CONSENT_OPEN_EVENT } from "@/lib/consent"
import { CookieSettingsMenuItem } from "./CookieSettingsMenuItem"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))

describe("CookieSettingsMenuItem", () => {
  afterEach(() => vi.useRealTimers())

  it("is a link to the cookie policy that opens the consent panel instead of navigating", () => {
    vi.useFakeTimers()
    const opened = vi.fn()
    window.addEventListener(CONSENT_OPEN_EVENT, opened)
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <CookieSettingsMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    const link = screen.getByRole("menuitem", { name: "consent.settings" })
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toMatch(/\/cookies$/)
    const notPrevented = fireEvent.click(link)
    expect(notPrevented).toBe(false) // navigation cancelled
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument() // the menu closed
    vi.runAllTimers()
    expect(opened).toHaveBeenCalledTimes(1)
    window.removeEventListener(CONSENT_OPEN_EVENT, opened)
  })
})
