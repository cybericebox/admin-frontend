"use client"

import { useSyncExternalStore } from "react"
import { eventDomain } from "@/lib/origins"
import { withAdminOrigin } from "@/lib/returnOrigin"

const subscribe = () => () => {}
const serverHere = () => ""
const browserHere = () => window.location.href
const domainNow = () => eventDomain

/**
 * The address of an event's site page. `domain` is the event domain, `base` is
 * the address without the admin return marker, `address` is what a link should open:
 * into an event's /manage it carries this admin page, so the event offers the way back.
 * The domain comes from env.
 */
export function useEventSiteAddress(tag: string, path = ""): { domain: string; base: string; address: string } {
  const domain = useSyncExternalStore(subscribe, domainNow, domainNow)
  const here = useSyncExternalStore(subscribe, browserHere, serverHere)
  const base = domain ? `https://${tag}.${domain}${path}` : ""
  const address = base && /^\/manage(\/|$)/.test(path) ? withAdminOrigin(base, here) : base
  return { domain, base, address }
}
