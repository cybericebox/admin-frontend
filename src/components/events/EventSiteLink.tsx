"use client"

import { useSyncExternalStore } from "react"
import { publicDomain } from "@/lib/origins"
import { t } from "@/i18n/t"
import { ExternalLink } from "lucide-react"
import { withAdminOrigin } from "@/lib/returnOrigin"
import { HoverTooltip } from "@/components/ui/hover-tooltip"

const subscribe = () => () => {}
const serverDomain = () => publicDomain
const serverHere = () => ""
const browserHere = () => window.location.href
const browserDomain = () => publicDomain || window.location.hostname.replace(/^(admin|www)\./i, "")

export function EventSiteLink({ tag, path = "", tooltip }: { tag: string; path?: string; tooltip?: string }) {
  const domain = useSyncExternalStore(subscribe, browserDomain, serverDomain)
  const here = useSyncExternalStore(subscribe, browserHere, serverHere)
  const base = domain ? `https://${tag}.${domain}${path}` : ""
  // Into an event's /manage the link carries this admin page, so the event offers the way back.
  const address = base && /^\/manage(\/|$)/.test(path) ? withAdminOrigin(base, here) : base
  const hint = tooltip ?? t("admin.events.action.openSite")
  if (!address) return <span className="font-mono text-xs text-muted-foreground">{tag}</span>
  return <HoverTooltip text={hint}>
    <a href={address} target="_blank" rel="noopener noreferrer"
      aria-label={`${hint}: ${base}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md text-muted-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <span className="break-all font-mono text-xs">{tag}.{domain}</span>
      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
    </a>
  </HoverTooltip>
}
