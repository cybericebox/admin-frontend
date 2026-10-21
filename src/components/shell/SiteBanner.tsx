"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import * as Popover from "@radix-ui/react-popover"
import { X } from "lucide-react"
import { dismissPersonalBanner, fetchSiteBanners, type BannerLevel, type SiteBannerDTO } from "@/api/notifications/banners"
import { getPulseLoop } from "@/lib/pulse"
import { t } from "@/i18n/t"
import { cn } from "@/utils/cn"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { keepBrand } from "@/i18n/brand"
import { siteBannerDismissedKey } from "@/lib/storageKeys"

/*
 * Site banner look (shared markup, copy it into the other frontends):
 *   <div role="status" class="border-b px-4 py-2.5 md:px-6 {tone}">   full-width bar above the navbar
 *     <p class="flex-1 text-sm">text + optional <a class="font-medium underline"> link</p>
 *     <button aria-label="close" class="rounded-md p-1.5 hover:bg-[var(--ib-hover)]">X</button>   only when Dismissible
 *   </div>
 * Tones (ds-v2 tokens, calm tinted background, NO left accent border, NO shadow):
 *   info     bg var(--ib-soft)      text var(--ib-ink)   border var(--ib-line)
 *   warning  bg var(--ib-warn-bg)   text var(--ib-warn)  border var(--ib-warn) at 25%
 *   critical bg var(--ib-danger-bg) text var(--ib-danger) border var(--ib-danger) at 25%
 * Data: GET /api/notifications/banners, refetched only when the shared pulse (lib/pulse) reports a new Banners version (and once on load); critical first; one non-dismissed banner is shown; the rest are available in an anchored panel.
 * Dismissal: personal banners PATCH /api/notifications/banners/:id/dismiss; site/system banners use the localStorage key `cib_site_banner_dismissed_${ID}_${Version}` = "1" (Version changes when the text is edited).
 */

const TONE: Record<BannerLevel, string> = {
  info: "border-[var(--ib-line)] bg-[var(--ib-soft)] text-[var(--ib-ink)]",
  warning: "border-[color-mix(in_srgb,var(--ib-warn)_25%,transparent)] bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]",
  critical: "border-[color-mix(in_srgb,var(--ib-danger)_25%,transparent)] bg-[var(--ib-danger-bg)] text-[var(--ib-danger)]",
}

export type SiteBannerView = Pick<SiteBannerDTO, "Text" | "LinkURL" | "LinkLabel" | "Level" | "Dismissible">

function safeHref(href: string): string | null {
  const trimmed = href.trim()
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return null
}

/** Pure presentation of one banner; also used by the admin banner editor preview. */
export function SiteBanner({ banner, onDismiss, extraAction, className }: { banner: SiteBannerView; onDismiss?: () => void; extraAction?: ReactNode; className?: string }) {
  const href = safeHref(banner.LinkURL ?? "")
  const external = href ? /^https?:\/\//i.test(href) : false
  return (
    <div role="status" aria-live="polite" data-level={banner.Level} className={cn("flex items-start gap-3 border-b px-4 py-2.5 md:px-6", TONE[banner.Level] ?? TONE.info, className)}>
      <p className="min-w-0 flex-1 text-sm leading-6">
        <span>{keepBrand(banner.Text)}</span>
        {href && <>{" "}<a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="admin-tap font-medium underline underline-offset-2">{keepBrand(banner.LinkLabel || t("admin.shell.banner.more"))}</a></>}
        {extraAction && <span className="ml-3 inline-block align-middle">{extraAction}</span>}
      </p>
      {banner.Dismissible && (
        <HoverTooltip text={t("admin.shell.banner.close")}>
          <button type="button" aria-label={t("admin.shell.banner.close")} onClick={onDismiss} className="admin-tap rounded-md p-1.5 hover:bg-[var(--ib-hover)] focus-visible:outline-2 focus-visible:outline-primary">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </HoverTooltip>
      )}
    </div>
  )
}

function storageKey(banner: SiteBannerDTO): string {
  return siteBannerDismissedKey(banner.ID, banner.Version)
}

function isDismissed(banner: SiteBannerDTO): boolean {
  try { return window.localStorage.getItem(storageKey(banner)) === "1" } catch { return false }
}

function rememberDismissed(banner: SiteBannerDTO): void {
  try { window.localStorage.setItem(storageKey(banner), "1") } catch { /* storage unavailable: dismissal lasts until reload */ }
}

/** Loads the banner list when the shared pulse reports a new version, and renders the primary banner and a disclosure for the rest. */
export function SiteBannerBar() {
  const panelTitle = useId()
  const panelTitleRef = useRef<HTMLHeadingElement>(null)
  const [banners, setBanners] = useState<SiteBannerDTO[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    let active = true
    let loaded: string | null = null
    let loading = false
    let wanted: string | null = null
    const load = () => {
      if (loading || wanted === null) return
      const version = wanted
      loading = true
      fetchSiteBanners()
        .then((items) => { if (active) { loaded = version; setBanners(items) } })
        .catch(() => { /* A banner outage must not block administration; the next pulse retries. */ })
        .finally(() => { loading = false; if (active && wanted !== version && wanted !== loaded) load() })
    }
    const unsubscribe = getPulseLoop().subscribe((pulse) => {
      wanted = String(pulse.Banners)
      if (wanted !== loaded) load()
    })
    return () => { active = false; unsubscribe() }
  }, [])

  const visible = banners.filter((banner) => !banner.Dismissible || (!dismissed.includes(storageKey(banner)) && !isDismissed(banner)))
  function dismiss(banner: SiteBannerDTO) {
    if (banner.Kind === "personal") void dismissPersonalBanner(banner.ID).catch(() => { /* hidden here; the server shows it again if it did not save */ })
    else rememberDismissed(banner)
    setDismissed((keys) => [...keys, storageKey(banner)])
  }

  if (visible.length === 0) return null
  const [primary, ...remaining] = visible
  const category = new Intl.PluralRules("uk").select(remaining.length)
  return <div className="shrink-0">
    <Popover.Root modal={false}>
      <SiteBanner banner={primary} onDismiss={primary.Dismissible ? () => dismiss(primary) : undefined} extraAction={remaining.length > 0 ? <Popover.Trigger asChild>
        <button type="button" className="admin-tap rounded-sm text-sm font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">{t(`siteBanner.moreAnnouncements.${category}`, { count: remaining.length })}</button>
      </Popover.Trigger> : undefined} />
      {remaining.length > 0 && <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={16} aria-labelledby={panelTitle} onOpenAutoFocus={(event) => { event.preventDefault(); panelTitleRef.current?.focus() }} className="z-50 w-[min(640px,calc(100vw-32px))] max-h-[min(60dvh,480px)] overflow-auto rounded-lg border border-border bg-background focus:outline-none">
          <h2 ref={panelTitleRef} id={panelTitle} tabIndex={-1} className="px-4 py-3 text-sm font-semibold text-foreground focus:outline-none">{t("siteBanner.others")}</h2>
          {remaining.map((banner) => <SiteBanner key={storageKey(banner)} banner={banner} onDismiss={banner.Dismissible ? () => dismiss(banner) : undefined} />)}
        </Popover.Content>
      </Popover.Portal>}
    </Popover.Root>
  </div>
}
