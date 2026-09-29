import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { ConsentBanner } from "./ConsentBanner"
import { openConsentSettings, readConsent } from "@/lib/consent"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))

const clear = () => { document.cookie = "cib_consent=; path=/; max-age=0" }
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }))

describe("ConsentBanner", () => {
  afterEach(clear)

  it("banner: a general line, customize and accept all; accept all grants analytics", () => {
    render(<ConsentBanner gaId="G-TEST" policyHref="https://example.com/cookies" />)
    const region = screen.getByRole("region", { name: "consent.label" })
    expect(region).toHaveTextContent("consent.text")
    expect(screen.getByRole("link", { name: "consent.policyLinkNewTab" })).toHaveAttribute("href", "https://example.com/cookies")
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["consent.customize", "consent.acceptAll"])
    click("consent.acceptAll")
    expect(readConsent()).toEqual({ analytics: true })
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("customize → save choice with analytics off (the default)", () => {
    render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />)
    click("consent.customize")
    const panel = screen.getByRole("dialog")
    expect(panel).toHaveFocus()
    expect(screen.getByRole("switch", { name: "consent.necessary.switch" })).toBeDisabled()
    expect(screen.getByRole("switch", { name: "consent.necessary.switch" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("switch", { name: "consent.analytics.title" })).toHaveAttribute("aria-checked", "false")
    click("consent.saveChoice")
    expect(readConsent()).toEqual({ analytics: false })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("customize → save choice with analytics on", () => {
    render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />)
    click("consent.customize")
    fireEvent.click(screen.getByRole("switch", { name: "consent.analytics.title" }))
    click("consent.saveChoice")
    expect(readConsent()).toEqual({ analytics: true })
  })

  it("the policy link opens a new tab and keeps the panel and its unsaved toggles", () => {
    render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />)
    click("consent.customize")
    fireEvent.click(screen.getByRole("switch", { name: "consent.analytics.title" }))
    const link = screen.getByRole("link", { name: "consent.policyLinkNewTab" })
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
    fireEvent.click(link)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "consent.analytics.title" })).toHaveAttribute("aria-checked", "true")
    expect(readConsent()).toBeNull()
  })

  it("the panel has only save choice and accept all; saving with analytics off drops _ga", () => {
    document.cookie = "_ga=GA1.1.1; path=/"
    render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />)
    click("consent.customize")
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["consent.saveChoice", "consent.acceptAll"])
    expect(screen.queryByRole("button", { name: "consent.rejectAll" })).not.toBeInTheDocument()
    click("consent.saveChoice")
    expect(readConsent()).toEqual({ analytics: false })
    expect(document.cookie).not.toMatch(/(^|; )_ga=/)
  })

  it("Esc never consents: from the panel it steps back to the banner", () => {
    render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />)
    fireEvent.keyDown(screen.getByRole("region"), { key: "Escape" })
    expect(screen.getByRole("region")).toBeInTheDocument()
    click("consent.customize")
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(screen.getByRole("region")).toBeInTheDocument()
    expect(readConsent()).toBeNull()
  })

  it("stays hidden when a choice exists; «Налаштування файлів cookie» opens the panel with the stored choice", () => {
    document.cookie = "cib_consent=analytics:granted; path=/"
    const trigger = document.createElement("button")
    document.body.appendChild(trigger)
    trigger.focus()
    render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />)
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    act(() => openConsentSettings())
    const panel = screen.getByRole("dialog")
    expect(panel).toHaveFocus()
    expect(screen.getByRole("switch", { name: "consent.analytics.title" })).toHaveAttribute("aria-checked", "true")
    fireEvent.keyDown(panel, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(readConsent()).toEqual({ analytics: true })
    trigger.remove()
  })

  it("stays hidden when GA is not configured", () => {
    render(<ConsentBanner gaId="" policyHref="/cookies" />)
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })
})

describe("ConsentBanner without GA", () => {
  afterEach(clear)

  it("never asks on its own but opens the panel on request", () => {
    render(<ConsentBanner policyHref="/cookies" />)
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    act(() => openConsentSettings())
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})
