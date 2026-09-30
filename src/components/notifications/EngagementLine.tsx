"use client"
import { t } from "@/i18n/t"
import { HoverTooltip } from "@/components/ui/hover-tooltip"

/** Engagement of one email target; every field is optional so an older backend still renders. */
export type TargetEngagement = {
  Channel: string
  Tracked?: boolean
  FirstOpenedAt?: string | null
  LastOpenedAt?: string | null
  OpenCount?: number
  FirstClickedAt?: string | null
  LastClickedAt?: string | null
  ClickCount?: number
}

export type DispatchLink = {
  Index: number
  Label: string
  ClickCount: number
  FirstClickedAt?: string | null
  LastClickedAt?: string | null
}

const DASH = "—"

/** Only an email target sent with tracking has meaningful engagement. */
export function isTrackedEmail(target: TargetEngagement): boolean {
  return target.Channel === "email" && target.Tracked === true
}

/** «Відкрито (приблизно)» value: the first open time, «Не відкрито», or a dash for an untracked email. */
export function openedText(target: TargetEngagement): string {
  if (!isTrackedEmail(target)) return DASH
  return target.FirstOpenedAt ? new Date(target.FirstOpenedAt).toLocaleString("uk-UA") : t("admin.notif.logs.notOpened")
}

/** «Переходи» value: the click count, or a dash for an untracked email. */
export function clicksText(target: TargetEngagement): string {
  if (!isTrackedEmail(target)) return DASH
  return String(target.ClickCount ?? 0)
}

/** Opened and clicks of one email target: two short labelled values. Nothing for other channels. */
export function EngagementLine({ target }: { target: TargetEngagement }) {
  if (target.Channel !== "email") return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
      <HoverTooltip text={t("admin.notif.logs.openedHint")}>
        <span>{t("admin.notif.logs.opened")}: <span className="text-foreground">{openedText(target)}</span></span>
      </HoverTooltip>
      <span>{t("admin.notif.logs.clicks")}: <span className="text-foreground">{clicksText(target)}</span></span>
    </div>
  )
}

/** The followed links of a dispatch with per-link click counts; nothing when no link was followed. */
export function LinksList({ links }: { links: DispatchLink[] | undefined }) {
  const followed = (links ?? []).filter((link) => link.ClickCount > 0)
  if (followed.length === 0) return null
  return (
    <div className="mt-3 rounded-md border border-border p-3 text-sm">
      <div className="font-medium text-foreground">{t("admin.notif.logs.links")}</div>
      <ul className="mt-1 space-y-1">
        {followed.map((link) => (
          <li key={link.Index} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-muted-foreground" title={link.Label}>{link.Label}</span>
            <span className="shrink-0 tabular-nums text-foreground">{link.ClickCount}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
