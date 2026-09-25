"use client"

import { useSyncExternalStore } from "react"
import { publicDomain } from "@/lib/origins"
import { t } from "@/i18n/t"
import { ExternalLink } from "lucide-react"
import { HoverTooltip } from "@/components/ui/hover-tooltip"

const subscribe = () => () => {}
const serverDomain = () => publicDomain
const browserDomain = () => publicDomain || window.location.hostname.replace(/^(admin|www)\./i, "")

export function EventSiteLink({ tag }: { tag: string }) {
  const domain = useSyncExternalStore(subscribe, browserDomain, serverDomain)
  const address = domain ? `https://${tag}.${domain}` : ""
  if (!address) return <span className="font-mono text-xs text-muted-foreground">{tag}</span>
  return <HoverTooltip text={t("admin.events.action.openSite")}>
    <a href={address} target="_blank" rel="noopener noreferrer"
      aria-label={`${t("admin.events.action.openSite")}: ${address}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md text-muted-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <span className="break-all font-mono text-xs">{tag}.{domain}</span>
      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
    </a>
  </HoverTooltip>
}
