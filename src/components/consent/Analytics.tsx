"use client"

import { useSyncExternalStore } from "react"
import Script from "next/script"
import { gtagBootScript } from "@/lib/consent"
import { ConsentBanner } from "./ConsentBanner"
import { COOKIE_POLICY_HREF } from "./CookieSettingsMenuItem"

// Google Analytics (gtag) under Consent Mode v2. The inline boot sets the denied defaults and the
// stored choice before gtag.js runs (see lib/consent). The cookie policy lives on the main site.
// The gtag scripts are rendered only in the browser: the static export is built with the NEXT_PUBLIC_GOOGLE_ANALYTICS_ID placeholder
// (always non-empty), so a build-time check would put gtag.js into the HTML even when the runtime id is empty.
// Without a GA id only the consent panel is mounted, so «Налаштування файлів cookie» still works.
const subscribe = () => () => {}

export function Analytics({ gaId: rawId }: { gaId?: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  // A blank or whitespace id (an unset build variable) is no id: no gtag script is rendered.
  const gaId = rawId?.trim()
  return (
    <>
      {mounted && gaId && (
        <>
          <Script id="ga-init" strategy="afterInteractive">
            {gtagBootScript(gaId)}
          </Script>
          <Script id="ga" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} />
        </>
      )}
      <ConsentBanner gaId={gaId || undefined} policyHref={COOKIE_POLICY_HREF} />
    </>
  )
}
