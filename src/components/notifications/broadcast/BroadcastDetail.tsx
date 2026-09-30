"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { t } from "@/i18n/t"
import { ApiError } from "@/api/client"
import { BROADCAST_VARIABLES, getBroadcast, listBroadcastDeliveries, type Broadcast, type BroadcastDelivery } from "@/api/notifications/broadcasts"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { NotFoundScreen } from "@/components/NotFoundScreen"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { StatusPill } from "@/components/notifications/StatusPill"
import { EmailPreview } from "@/components/notifications/editor/EmailPreview"
import { InAppPreview } from "@/components/notifications/editor/InAppPreview"
import { statusLabelKey } from "@/lib/templateStatus"
import { BroadcastEngagement } from "./BroadcastEngagement"
import { audienceLabel } from "./AudiencePicker"
import { broadcastSample, broadcastChannelLabel, broadcastHeading, broadcastPillStatus, broadcastStatusLabel } from "./broadcastLabels"

const DELIVERY_PAGE = 50
const POLL_MS = 5_000

function Deliveries({ id, sending }: { id: string; sending: boolean }) {
  const [rows, setRows] = useState<BroadcastDelivery[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ cause: unknown } | null>(null)

  const load = useCallback((offset: number) => {
    setLoading(true)
    setError(null)
    listBroadcastDeliveries(id, { limit: DELIVERY_PAGE, offset })
      .then((page) => { setRows((current) => (offset === 0 ? page : [...current, ...page])); setMore(page.length === DELIVERY_PAGE) })
      .catch((cause) => setError({ cause }))
      .finally(() => setLoading(false))
  }, [id])

  // While the broadcast is still sending, the list refreshes together with its counters.
  useEffect(() => {
    queueMicrotask(() => load(0))
    if (!sending) return
    const timer = window.setInterval(() => load(0), POLL_MS)
    return () => window.clearInterval(timer)
  }, [load, sending])

  return (
    <section aria-labelledby="bc-deliveries" className="space-y-2">
      <h2 id="bc-deliveries" className="text-sm font-semibold text-foreground">{t("admin.notif.broadcast.deliveries")}</h2>
      <div className="flex min-h-56 flex-col rounded-md border border-border" aria-busy={loading}>
        {error && rows.length === 0 ? (
          <LoadError message={t("admin.notif.broadcast.loadError")} error={error.cause} compact className="flex-1" onRetry={() => load(0)} />
        ) : loading && rows.length === 0 ? (
          <LoadingArea compact className="flex-1" label={t("admin.loading")} />
        ) : rows.length === 0 ? (
          <EmptyState compact className="flex-1" message={t("admin.notif.broadcast.deliveriesEmpty")} />
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("admin.notif.logs.recipient")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.logs.channel")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.logs.status")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.notif.logs.error")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.DispatchID}-${row.Channel}-${index}`} className="border-b border-border/50">
                    <td className="px-3 py-2 text-foreground">{row.RecipientEmail || <span className="font-mono text-xs text-muted-foreground">{row.RecipientUserID.slice(0, 8)}</span>}</td>
                    <td className="px-3 py-2 text-foreground">{broadcastChannelLabel(row.Channel)}</td>
                    <td className="px-3 py-2"><StatusPill status={row.TargetStatus} label={t(statusLabelKey(row.TargetStatus))} /></td>
                    <td className="max-w-80 px-3 py-2">{row.Error ? <HoverTooltip text={row.Error} truncated className="max-w-full"><span className="block truncate text-xs text-destructive">{row.Error}</span></HoverTooltip> : <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && <LoadError message={t("admin.notif.broadcast.loadError")} error={error.cause} compact onRetry={() => load(rows.length)} />}
            {more && !error && <div className="flex justify-center p-3"><Button variant="outline" size="sm" busy={loading} onClick={() => load(rows.length)}>{t("admin.notif.broadcast.loadMore")}</Button></div>}
          </div>
        )}
      </div>
    </section>
  )
}

export function BroadcastDetail({ id }: { id: string }) {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [reload, setReload] = useState(0)
  const sending = broadcast?.Status === "sending"

  useEffect(() => {
    let cancelled = false
    getBroadcast(id)
      .then((row) => { if (!cancelled) { setBroadcast(row); setError(null) } })
      .catch((cause) => { if (!cancelled) setError({ cause }) })
    return () => { cancelled = true }
  }, [id, reload])

  useEffect(() => {
    if (!sending) return
    const timer = window.setInterval(() => setReload((n) => n + 1), POLL_MS)
    return () => window.clearInterval(timer)
  }, [sending])

  const previewValues = useMemo(() => Object.fromEntries(BROADCAST_VARIABLES.map((name) => [name, broadcastSample(name)])), [])
  const back = <Link href="/notifications/broadcasts" className="text-sm text-primary hover:underline">← {t("admin.notif.broadcast.title")}</Link>

  if (error && !broadcast) {
    const missing = error.cause instanceof ApiError && error.cause.status === 404
    return (
      <div className="frost-panel frost-in flex h-full flex-col rounded-lg p-8">
        {missing ? <NotFoundScreen block title={t("admin.notif.broadcast.notFound")} />
          : <>{back}<LoadError message={t("admin.notif.broadcast.loadError")} error={error.cause} className="flex-1" onRetry={() => { setError(null); setReload((n) => n + 1) }} /></>}
      </div>
    )
  }
  if (!broadcast) return <LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />

  const hasEmail = broadcast.Channels.includes("email")
  const hasInApp = broadcast.Channels.includes("in_app")
  const fact = (label: string, value: React.ReactNode) => <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm text-foreground">{value}</dd></div>

  return (
    <div className="frost-panel frost-in rounded-lg p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
        {back}
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-foreground">{broadcastHeading(broadcast)}</h1>
        <StatusPill status={broadcastPillStatus(broadcast.Status)} label={broadcastStatusLabel(broadcast.Status)} />
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {fact(t("admin.notif.broadcast.channels"), broadcast.Channels.map(broadcastChannelLabel).join(", "))}
        {fact(t("admin.notif.broadcast.audience.title"), audienceLabel(broadcast.Audience))}
        {fact(t("admin.notif.broadcast.col.recipients"), broadcast.RecipientCount)}
        {fact(t("admin.notif.broadcast.col.delivery"), <>{broadcast.SentCount} / <span className={broadcast.FailedCount > 0 ? "text-destructive" : undefined}>{broadcast.FailedCount}</span><BroadcastEngagement broadcast={broadcast} /></>)}
        {fact(t("admin.notif.broadcast.col.author"), broadcast.CreatedByName || "—")}
        {fact(t("admin.notif.logs.created"), new Date(broadcast.CreatedAt).toLocaleString("uk-UA"))}
        {broadcast.FinishedAt && fact(t("admin.notif.broadcast.finished"), new Date(broadcast.FinishedAt).toLocaleString("uk-UA"))}
      </dl>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {hasEmail && (
          <div className="min-w-0">
            <div className="mb-2 text-sm font-semibold text-foreground">{t("admin.notif.broadcast.previewEmail")}</div>
            <EmailPreview notificationType="broadcast" subject={broadcast.Subject} preheader={broadcast.Preheader} body={broadcast.EmailBody ?? []} styling={broadcast.EmailStyling ?? {}} />
          </div>
        )}
        {hasInApp && (
          <div className="min-w-0">
            <div className="mb-2 text-sm font-semibold text-foreground">{t("admin.notif.broadcast.previewInApp")}</div>
            <InAppPreview title={broadcast.InAppTitle} body={broadcast.InAppBody} link={broadcast.InAppLink} icon="bell" tone="neutral" accentColor="" surface="inbox" autoDismissMs={null} actions={[]} previewValues={previewValues} />
          </div>
        )}
      </div>

      <Deliveries id={id} sending={sending} />
    </div>
  )
}
