"use client"
import type { Broadcast } from "@/api/notifications/broadcasts"
import { formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"

/** «Відкрито 42 % (приблизно)» and «Переходи 7» of the emails sent with tracking; nothing when none were tracked. */
export function BroadcastEngagement({ broadcast }: { broadcast: Pick<Broadcast, "TrackedCount" | "OpenedCount" | "ClickedCount"> }) {
  const tracked = broadcast.TrackedCount ?? 0
  if (tracked <= 0) return null
  const share = formatNumber(((broadcast.OpenedCount ?? 0) / tracked) * 100, { maximumFractionDigits: 0 })
  return (
    <div className="mt-0.5 text-xs text-muted-foreground">
      <span>{t("admin.notif.broadcast.opened", { value: share })}</span>
      <span className="ml-2">{t("admin.notif.broadcast.clicked", { count: formatNumber(broadcast.ClickedCount ?? 0) })}</span>
    </div>
  )
}
