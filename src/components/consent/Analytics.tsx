"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Script from "next/script"
import { usePathname } from "next/navigation"
import { analyticsPageLocation, CONSENT_CHANGE_EVENT, gaDisableKey, gtagBootScript, readConsent, shouldLoadAnalytics } from "@/lib/consent"
import { ConsentBanner } from "./ConsentBanner"

// Google Analytics (gtag), loaded only after the visitor allowed analytics, in browser idle time: without consent
// nothing is sent at all. The inline boot sets the Consent Mode defaults and the stored choice before gtag.js runs
// and reduces the page address to origin + path (see lib/consent). reCAPTCHA is not part of consent (strictly necessary).
// The gtag scripts are rendered only in the browser: the static export is built with the NEXT_PUBLIC_GOOGLE_ANALYTICS_ID placeholder
// (always non-empty), so a build-time check would put gtag.js into the HTML even when the runtime id is empty.
// Without a GA id only the consent panel is mounted, so «Налаштування файлів cookie» still works.
type GtagWindow = Window & { gtag?: (...args: unknown[]) => void }

const subscribe = (onChange: () => void) => {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange)
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange)
}
// "ssr" on the server and during hydration: GA waits for the client.
const consentSnapshot = () => (readConsent()?.analytics ? "granted" : "off")

export function Analytics({ gaId: rawId }: { gaId?: string }) {
  // A blank or whitespace id (an unset build variable) is no id: no gtag script is rendered.
  const gaId = rawId?.trim()
  const consent = useSyncExternalStore(subscribe, consentSnapshot, () => "ssr")
  const allowed = consent !== "ssr" && shouldLoadAnalytics(gaId, readConsent())
  // Once loaded, gtag.js stays in the page: a later «no» switches it off with GA's own opt-out flag.
  const [loaded, setLoaded] = useState(false)
  if (allowed && !loaded) setLoaded(true)
  const pathname = usePathname()

  useEffect(() => {
    if (!gaId || !loaded) return
    ;(window as unknown as Record<string, unknown>)[gaDisableKey(gaId)] = !allowed
  }, [gaId, allowed, loaded])

  // A client-side navigation: GA's history page views read the address set here (origin + path only).
  useEffect(() => {
    if (allowed) (window as GtagWindow).gtag?.("set", { page_location: analyticsPageLocation(window.location) })
  }, [allowed, pathname])

  return (
    <>
      {gaId && loaded && (
        <>
          <Script id="ga-init" strategy="lazyOnload">
            {gtagBootScript(gaId)}
          </Script>
          <Script id="ga" strategy="lazyOnload" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} />
        </>
      )}
      <ConsentBanner gaId={gaId || undefined} />
    </>
  )
}
