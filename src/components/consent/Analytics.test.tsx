// @vitest-environment jsdom
// Without analytics consent nothing of GA is on the page; a later «no» switches a loaded gtag off.
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/script", () => ({ default: ({ id, src }: { id: string; src?: string }) => <script data-script={id} data-src={src} /> }))
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/" }))
vi.mock("./ConsentBanner", () => ({ ConsentBanner: () => null }))

import { Analytics } from "./Analytics"
import { CONSENT_CHANGE_EVENT, gaDisableKey } from "@/lib/consent"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const setConsent = (value: string | null) => {
  document.cookie = value === null ? "cib_consent=; path=/; max-age=0" : `cib_consent=${value}; path=/`
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT))
}

describe("Analytics", () => {
  let host: HTMLElement
  let root: ReturnType<typeof createRoot>
  beforeEach(() => {
    setConsent(null)
    host = document.body.appendChild(document.createElement("div"))
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    delete (window as unknown as Record<string, unknown>)[gaDisableKey("G-TEST")]
  })

  const scripts = () => host.querySelectorAll("script[data-script]")

  it("without an id mounts nothing of GA, even with consent", async () => {
    await act(async () => { root.render(<Analytics />) })
    await act(async () => { setConsent("analytics:granted,functional:denied") })
    expect(scripts()).toHaveLength(0)
  })

  it("renders no GA script before a choice and after a «no»", async () => {
    await act(async () => { root.render(<Analytics gaId="G-TEST" />) })
    expect(scripts()).toHaveLength(0)
    await act(async () => { setConsent("analytics:denied,functional:denied") })
    expect(scripts()).toHaveLength(0)
  })

  it("loads GA once analytics is allowed, and a later «no» turns it off", async () => {
    await act(async () => { root.render(<Analytics gaId="G-TEST" />) })
    await act(async () => { setConsent("analytics:granted,functional:denied") })
    expect(scripts()).toHaveLength(2)
    expect((window as unknown as Record<string, unknown>)[gaDisableKey("G-TEST")]).toBeFalsy()
    await act(async () => { setConsent("analytics:denied,functional:denied") })
    expect((window as unknown as Record<string, unknown>)[gaDisableKey("G-TEST")]).toBe(true)
  })
})
