// Cookie consent (Google Consent Mode v2): denied by default; accept all / save choice
// map to analytics_storage only; the choice is one cookie on the parent domain.
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
    delete process.env.NEXT_PUBLIC_COOKIE_DOMAIN
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

  it("the boot script grants analytics only for a stored analytics:granted", () => {
    const run = (cookie: string) => {
      const w = { dataLayer: [] as ArrayLike<unknown>[] }
      new Function("window", "document", "dataLayer", consent.gtagBootScript("G-TEST"))(w, { cookie }, w.dataLayer)
      return w.dataLayer.map((a) => Array.from(a)).filter((c) => c[0] === "consent").map((c) => c[1])
    }
    expect(run("")).toEqual(["default"])
    expect(run("cib_consent=analytics:denied")).toEqual(["default"])
    expect(run("cib_theme=dark; cib_consent=analytics:granted")).toEqual(["default", "update"])
  })

  it("accept all grants analytics_storage only", () => {
    expect(consent.consentUpdate(consent.ACCEPT_ALL)).toEqual({ analytics_storage: "granted" })
    consent.saveConsent(consent.ACCEPT_ALL)
    expect(calls).toEqual([["consent", "update", { analytics_storage: "granted" }]])
    expect(consent.readConsent()).toEqual({ analytics: true })
  })

  it("customize: save choice with analytics on grants it", () => {
    consent.saveConsent({ analytics: true })
    expect(calls).toEqual([["consent", "update", { analytics_storage: "granted" }]])
    expect(consent.readConsent()).toEqual({ analytics: true })
  })

  it("customize: save choice with analytics off keeps everything denied", () => {
    document.cookie = "_ga=GA1.1.1; path=/"
    consent.saveConsent({ analytics: false })
    expect(calls).toEqual([["consent", "update", { analytics_storage: "denied" }]])
    expect(consent.readConsent()).toEqual({ analytics: false })
    expect(document.cookie).not.toMatch(/_ga/)
  })

  it("save choice with analytics off after accepting drops GA cookies", () => {
    document.cookie = "_ga=GA1.1.1; path=/"
    document.cookie = "_ga_TEST=GS1.1; path=/"
    consent.saveConsent({ analytics: false })
    expect(calls).toEqual([["consent", "update", { analytics_storage: "denied" }]])
    expect(consent.readConsent()).toEqual({ analytics: false })
    expect(document.cookie).not.toMatch(/_ga/)
  })

  it("writes the choice per category to one cookie on the parent domain", () => {
    expect(consent.consentCookie(consent.ACCEPT_ALL, { domain: "cybericebox.com", secure: true })).toBe(
      "cib_consent=analytics:granted; path=/; max-age=31536000; SameSite=Lax; domain=.cybericebox.com; Secure",
    )
    expect(consent.consentCookie({ analytics: false }, { secure: false })).toBe("cib_consent=analytics:denied; path=/; max-age=31536000; SameSite=Lax")
    process.env.NEXT_PUBLIC_COOKIE_DOMAIN = "cybericebox.com"
    const writes: string[] = []
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!
    Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: (s: string) => writes.push(s) })
    try {
      consent.saveConsent(consent.ACCEPT_ALL)
    } finally {
      Object.defineProperty(document, "cookie", desc)
    }
    expect(writes[0]).toMatch(/^cib_consent=analytics:granted; .*domain=\.cybericebox\.com/)
  })

  it("reads the stored choice back from the cookie string", () => {
    expect(consent.parseConsent("cib_theme=dark; cib_consent=analytics:granted")).toEqual({ analytics: true })
    expect(consent.parseConsent("cib_consent=analytics:denied")).toEqual({ analytics: false })
    expect(consent.parseConsent("xcib_consent=analytics:granted")).toBeNull()
    expect(consent.parseConsent("cib_consent=granted")).toBeNull()
    expect(consent.parseConsent("")).toBeNull()
  })

  it("shows the banner only when GA is configured and no choice exists", () => {
    expect(consent.shouldShowBanner("G-TEST", null)).toBe(true)
    expect(consent.shouldShowBanner("G-TEST", { analytics: true })).toBe(false)
    expect(consent.shouldShowBanner("G-TEST", { analytics: false })).toBe(false)
    expect(consent.shouldShowBanner(undefined, null)).toBe(false)
    expect(consent.shouldShowBanner("", null)).toBe(false)
  })
})
