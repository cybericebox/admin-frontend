import { afterEach, describe, expect, it, vi } from "vitest"
import { THEME_BOOT_SCRIPT, applyTheme, readThemeChoice, setThemeChoice } from "./theme"

describe("shared platform theme", () => {
  afterEach(() => {
    document.cookie = "cib_theme=; path=/; max-age=0"
    vi.unstubAllGlobals()
  })

  it("uses the same cookie as the landing and ID apps", () => {
    setThemeChoice("dark")
    expect(readThemeChoice()).toBe("dark")
    expect(document.documentElement.dataset.theme).toBe("dark")
  })

  it("writes the cookie on NEXT_PUBLIC_COOKIE_DOMAIN only", async () => {
    const writes: string[] = []
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!
    Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: (s: string) => writes.push(s) })
    try {
      vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", "cybericebox.com")
      vi.resetModules()
      ;(await import("./theme")).setThemeChoice("dark")
      vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", "")
      vi.resetModules()
      ;(await import("./theme")).setThemeChoice("dark")
    } finally {
      Object.defineProperty(document, "cookie", desc)
      vi.unstubAllEnvs()
    }
    expect(writes[0]).toContain("domain=.cybericebox.com")
    expect(writes[1]).not.toContain("domain=")
  })

  it("resolves the boot script before first paint", () => {
    document.cookie = "cib_theme=dark; path=/"
    new Function(THEME_BOOT_SCRIPT)()
    expect(document.documentElement.dataset.theme).toBe("dark")
  })

  it("follows the OS appearance in system mode", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })))
    applyTheme("system")
    expect(document.documentElement.dataset.theme).toBe("dark")
  })
})
