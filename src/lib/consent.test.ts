// Analytics consent (Google Consent Mode v2): denied by default, accept grants analytics only,
// the choice is one cookie on the parent domain, the banner asks only when needed.
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import * as consent from "./consent"

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void }

function clearCookies() {
  for (const c of document.cookie.split("; ").filter(Boolean)) document.cookie = `${c.split("=")[0]}=; path=/; max-age=0`
}

describe("consent", () => {
  let calls: unknown[][]
  beforeEach(() => {
    clearCookies()
    calls = []
    ;(window as GtagWindow).gtag = (...args: unknown[]) => calls.push(args)
  })
  afterEach(() => {
    delete (window as GtagWindow).gtag
    delete process.env.NEXT_PUBLIC_DOMAIN
    clearCookies()
  })

  it("defaults every Consent Mode signal to denied", () => {
    expect(consent.CONSENT_DEFAULTS).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    })
    const boot = consent.gtagBootScript("G-TEST")
    expect(boot.indexOf('"consent","default"')).toBeLessThan(boot.indexOf('"config"'))
    expect(boot).toContain('"ad_storage":"denied"')
  })

  it("accept grants analytics_storage only", () => {
    expect(consent.consentUpdate("granted")).toEqual({ analytics_storage: "granted" })
    consent.saveConsent("granted")
    expect(calls).toEqual([["consent", "update", { analytics_storage: "granted" }]])
    expect(consent.readConsent()).toBe("granted")
  })

  it("reject keeps everything denied and drops GA cookies", () => {
    document.cookie = "_ga=GA1.1.1; path=/"
    document.cookie = "_ga_TEST=GS1.1; path=/"
    consent.saveConsent("denied")
    expect(calls).toEqual([["consent", "update", { analytics_storage: "denied" }]])
    expect(consent.readConsent()).toBe("denied")
    expect(document.cookie).not.toMatch(/_ga/)
  })

  it("writes one cookie on the parent domain", () => {
    expect(consent.consentCookie("granted", { domain: "cybericebox.com", secure: true })).toBe(
      "cib_consent=granted; path=/; max-age=31536000; SameSite=Lax; domain=.cybericebox.com; Secure",
    )
    expect(consent.consentCookie("denied", { secure: false })).toBe("cib_consent=denied; path=/; max-age=31536000; SameSite=Lax")
    process.env.NEXT_PUBLIC_DOMAIN = "cybericebox.com"
    const writes: string[] = []
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!
    Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: (s: string) => writes.push(s) })
    try {
      consent.saveConsent("granted")
    } finally {
      Object.defineProperty(document, "cookie", desc)
    }
    expect(writes[0]).toMatch(/^cib_consent=granted; .*domain=\.cybericebox\.com/)
  })

  it("reads the stored choice back from the cookie string", () => {
    expect(consent.parseConsent("ib_theme=dark; cib_consent=granted")).toBe("granted")
    expect(consent.parseConsent("cib_consent=denied")).toBe("denied")
    expect(consent.parseConsent("xcib_consent=granted")).toBeNull()
    expect(consent.parseConsent("")).toBeNull()
  })

  it("shows the banner only when GA is configured and no choice exists", () => {
    expect(consent.shouldShowBanner("G-TEST", null)).toBe(true)
    expect(consent.shouldShowBanner("G-TEST", "granted")).toBe(false)
    expect(consent.shouldShowBanner("G-TEST", "denied")).toBe(false)
    expect(consent.shouldShowBanner(undefined, null)).toBe(false)
    expect(consent.shouldShowBanner("", null)).toBe(false)
  })
})
