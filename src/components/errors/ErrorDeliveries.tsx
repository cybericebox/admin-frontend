"use client"
import { useEffect, useState } from "react"
import { getErrorGroup, type ErrorDelivery } from "@/api/errorJournal"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"

export function ErrorDeliveries({ groupID, initial, onNotified }: { groupID: string; initial: ErrorDelivery[]; onNotified?: (time: string | null) => void }) {
  const [rows, setRows] = useState(initial)
  const [failure, setFailure] = useState<{ cause: unknown } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const detail = await getErrorGroup(groupID)
        if (active) { setRows(detail.Deliveries ?? []); setFailure(null); onNotified?.(detail.Group.LastNotifiedAt) }
      } catch (cause) { if (active) setFailure({ cause }) }
      finally { if (active) setRefreshing(false) }
    }
    // Delivery outcomes change after the journal entry arrives; keep this small
    // independent read from replacing optimistic status changes in the parent.
    if (reload) void refresh()
    const timer = setInterval(() => void refresh(), 15000)
    return () => { active = false; clearInterval(timer) }
  }, [groupID, reload, onNotified])
  return <section className="shrink-0 space-y-3 rounded-lg border border-border bg-card p-4" aria-label={t("admin.errors.delivery.title")}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-foreground">{t("admin.errors.delivery.title")}</h2>
      <Button type="button" variant="outline" size="sm" busy={refreshing} onClick={() => { setRefreshing(true); setReload((value) => value + 1) }}>{t("admin.errors.delivery.refresh")}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{t("admin.errors.delivery.help")}</p>
    <div className="max-h-64 min-h-24 overflow-auto">
      {failure ? <LoadError compact message={t("admin.errors.delivery.loadError")} error={failure.cause} className="min-h-24" onRetry={() => setReload((value) => value + 1)} />
        : rows.length === 0 ? <EmptyState compact className="min-h-24" message={t("admin.errors.delivery.empty")} />
          : <ul className="divide-y divide-border">
            {rows.map((row) => {
              const state = row.DeliveredAt ? "sent" : row.CancelledAt ? "cancelled" : row.Attempts > 0 ? "retrying" : "queued"
              return <li key={row.ID} className="space-y-1 py-3 first:pt-0 last:pb-0 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <p className="font-medium text-foreground [overflow-wrap:anywhere]">{row.Channel === "prepare" ? t("admin.errors.delivery.preparation") : row.Label ? t("admin.errors.settings.resultTarget", { label: row.Label, target: row.Target }) : row.Target}</p>
                  <p className={state === "sent" ? "text-[var(--ib-ok)]" : "text-muted-foreground"}>{t(`admin.errors.delivery.${state}`)}</p>
                </div>
                <p className="text-xs text-muted-foreground">{t("admin.errors.delivery.details", { channel: t(`admin.errors.settings.channel.${row.Channel}`), attempts: row.Attempts })}</p>
                {(row.DeliveredAt || row.LastAttemptAt) && <p className="text-xs text-muted-foreground">{t(row.DeliveredAt ? "admin.errors.delivery.sentAt" : "admin.errors.delivery.attemptAt", { time: formatDateTime(row.DeliveredAt ?? row.LastAttemptAt!) })}</p>}
                {!row.DeliveredAt && !row.CancelledAt && row.NextAttemptAt && <p className="text-xs text-muted-foreground">{t("admin.errors.delivery.nextAt", { time: formatDateTime(row.NextAttemptAt) })}</p>}
                {row.LastError && <p className="text-xs text-destructive [overflow-wrap:anywhere]">{row.LastError}</p>}
              </li>
            })}
          </ul>}
    </div>
  </section>
}
