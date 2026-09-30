"use client"

import { useSyncExternalStore } from "react"
import { publicDomain } from "@/lib/origins"
import { withAdminOrigin } from "@/lib/returnOrigin"

const subscribe = () => () => {}
const serverDomain = () => publicDomain
const serverHere = () => ""
const browserHere = () => window.location.href
const browserDomain = () => publicDomain || window.location.hostname.replace(/^(admin|www)\./i, "")

/**
 * The address of an event's site page. `domain` is the shared public domain, `base` is
 * the address without the admin return marker, `address` is what a link should open:
 * into an event's /manage it carries this admin page, so the event offers the way back.
 * Both are empty until the domain is known.
 */
export function useEventSiteAddress(tag: string, path = ""): { domain: string; base: string; address: string } {
  const domain = useSyncExternalStore(subscribe, browserDomain, serverDomain)
  const here = useSyncExternalStore(subscribe, browserHere, serverHere)
  const base = domain ? `https://${tag}.${domain}${path}` : ""
  const address = base && /^\/manage(\/|$)/.test(path) ? withAdminOrigin(base, here) : base
  return { domain, base, address }
}
