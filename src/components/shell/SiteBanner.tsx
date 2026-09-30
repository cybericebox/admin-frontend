"use client"

import { useCallback, useEffect, useState } from "react"
import { X } from "lucide-react"
import { fetchSiteBanners, type BannerLevel, type SiteBannerDTO } from "@/api/notifications/banners"
import { onServiceRestored } from "@/lib/serviceStatus"
import { t } from "@/i18n/t"
import { cn } from "@/utils/cn"
import { HoverTooltip } from "@/components/ui/hover-tooltip"

/*
 * Site banner look (shared markup, copy it into the other frontends):
 *   <div role="status" class="border-b px-4 py-2.5 md:px-6 {tone}">   full-width bar under the navbar
 *     <p class="flex-1 text-sm">text + optional <a class="font-medium underline"> link</p>
 *     <button aria-label="close" class="rounded-md p-1.5 hover:bg-[var(--ib-hover)]">X</button>   only when Dismissible
 *   </div>
 * Tones (ds-v2 tokens, calm tinted background, NO left accent border, NO shadow):
 *   info     bg var(--ib-soft)      text var(--ib-ink)   border var(--ib-line)
 *   warning  bg var(--ib-warn-bg)   text var(--ib-warn)  border var(--ib-warn) at 25%
 *   critical bg var(--ib-danger-bg) text var(--ib-danger) border var(--ib-danger) at 25%
 * Data: GET /api/banners every ~60 s and on tab focus; critical first; the first non-dismissed one is shown.
 * Dismissal: localStorage key `ib:banner:${ID}:${Version}` = "1" (Version changes when the text is edited).
 */

const TONE: Record<BannerLevel, string> = {
  info: "border-[var(--ib-line)] bg-[var(--ib-soft)] text-[var(--ib-ink)]",
  warning: "border-[color-mix(in_srgb,var(--ib-warn)_25%,transparent)] bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]",
  critical: "border-[color-mix(in_srgb,var(--ib-danger)_25%,transparent)] bg-[var(--ib-danger-bg)] text-[var(--ib-danger)]",
}

const POLL_MS = 60_000

export type SiteBannerView = Pick<SiteBannerDTO, "Text" | "LinkURL" | "LinkLabel" | "Level" | "Dismissible">

function safeHref(href: string): string | null {
  const trimmed = href.trim()
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return null
}

/** Pure presentation of one banner; also used by the admin banner editor preview. */
export function SiteBanner({ banner, onDismiss, className }: { banner: SiteBannerView; onDismiss?: () => void; className?: string }) {
  const href = safeHref(banner.LinkURL ?? "")
  const external = href ? /^https?:\/\//i.test(href) : false
  return (
    <div role="status" aria-live="polite" data-level={banner.Level} className={cn("flex items-start gap-3 border-b px-4 py-2.5 md:px-6", TONE[banner.Level] ?? TONE.info, className)}>
      <p className="min-w-0 flex-1 text-sm leading-6">
        <span>{banner.Text}</span>
        {href && <>{" "}<a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="font-medium underline underline-offset-2">{banner.LinkLabel || t("admin.shell.banner.more")}</a></>}
      </p>
      {banner.Dismissible && (
        <HoverTooltip text={t("admin.shell.banner.close")}>
          <button type="button" aria-label={t("admin.shell.banner.close")} onClick={onDismiss} className="rounded-md p-1.5 hover:bg-[var(--ib-hover)] focus-visible:outline-2 focus-visible:outline-primary">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </HoverTooltip>
      )}
    </div>
  )
}

function storageKey(banner: SiteBannerDTO): string {
  return `ib:banner:${banner.ID}:${banner.Version}`
}

function isDismissed(banner: SiteBannerDTO): boolean {
  try { return window.localStorage.getItem(storageKey(banner)) === "1" } catch { return false }
}

function rememberDismissed(banner: SiteBannerDTO): void {
  try { window.localStorage.setItem(storageKey(banner), "1") } catch { /* storage unavailable: dismissal lasts until reload */ }
}

/** Polls the public banner endpoint and renders the first banner the visitor has not dismissed. */
export function SiteBannerBar() {
  const [banners, setBanners] = useState<SiteBannerDTO[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    let active = true
    const refresh = () => {
      if (document.visibilityState === "hidden") return
      fetchSiteBanners()
        .then((items) => { if (active) setBanners(items) })
        .catch(() => { /* A banner outage must not block administration. */ })
    }
    refresh()
    const unsubscribe = onServiceRestored(refresh)
    const timer = window.setInterval(refresh, POLL_MS)
    document.addEventListener("visibilitychange", refresh)
    return () => { active = false; unsubscribe(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh) }
  }, [])

  const current = banners.find((banner) => !dismissed.includes(storageKey(banner)) && !(banner.Dismissible && isDismissed(banner)))
  const dismiss = useCallback(() => {
    if (!current) return
    rememberDismissed(current)
    setDismissed((keys) => [...keys, storageKey(current)])
  }, [current])

  if (!current) return null
  return <SiteBanner banner={current} onDismiss={current.Dismissible ? dismiss : undefined} />
}
