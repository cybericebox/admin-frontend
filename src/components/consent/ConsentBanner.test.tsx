import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { ConsentBanner } from "./ConsentBanner"
import { openConsentSettings, readConsent } from "@/lib/consent"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))

const clear = () => { document.cookie = "cib_consent=; path=/; max-age=0" }

describe("ConsentBanner", () => {
  afterEach(clear)

  it("asks when no choice exists and hides after a choice", () => {
    render(<ConsentBanner gaId="G-TEST" policyHref="https://example.com/cookies" />)
    expect(screen.getByRole("region", { name: "consent.title" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "consent.policyLink" })).toHaveAttribute("href", "https://example.com/cookies")
    fireEvent.click(screen.getByRole("button", { name: "consent.reject" }))
    expect(readConsent()).toBe("denied")
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("stays hidden when a choice exists, and reopens from «Налаштування cookie»", () => {
    document.cookie = "cib_consent=granted; path=/"
    render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />)
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    act(() => openConsentSettings())
    const region = screen.getByRole("region")
    expect(region).toHaveFocus()
    fireEvent.keyDown(region, { key: "Escape" })
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    expect(readConsent()).toBe("granted")
  })

  it("Esc does not count as consent", () => {
    render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />)
    fireEvent.keyDown(screen.getByRole("region"), { key: "Escape" })
    expect(screen.getByRole("region")).toBeInTheDocument()
    expect(readConsent()).toBeNull()
  })

  it("stays hidden when GA is not configured", () => {
    render(<ConsentBanner gaId="" policyHref="/cookies" />)
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })
})
