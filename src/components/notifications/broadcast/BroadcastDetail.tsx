"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Download } from "lucide-react"
import { t } from "@/i18n/t"
import { ApiError, apiGetBlob } from "@/api/client"
import { toast } from "@/components/ui/toast"
import { overloadOr } from "@/i18n/apiError"
import { SelectMenu } from "@/components/ui/select-menu"
import { TablePagination } from "@/components/ui/table-pagination"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { BROADCAST_VARIABLES, broadcastDeliveriesExportPath, cancelBroadcast, getBroadcast, listBroadcastDeliveries, type Broadcast, type DeliveriesPage, type DeliveryStatus } from "@/api/notifications/broadcasts"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { NotFoundBlock } from "@/components/ErrorPage"
import { PageHeader } from "@/components/ui/page-header"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { StatusPill } from "@/components/notifications/StatusPill"
import { EmailPreview } from "@/components/notifications/editor/EmailPreview"
import { InAppPreview } from "@/components/notifications/editor/InAppPreview"
import { statusLabelKey } from "@/lib/templateStatus"
import { audienceLabel } from "./AudiencePicker"
import { broadcastSample, broadcastChannelLabel, broadcastHeading, broadcastPillStatus, broadcastStatusLabel } from "./broadcastLabels"

const POLL_MS = 5_000
const DELIVERY_STATUSES: DeliveryStatus[] = ["error", "done", "waiting"]

function Deliveries({ id, sending }: { id: string; sending: boolean }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [status, setStatus] = useState<DeliveryStatus | "">("")
  // The rows stay on screen while another page or filter loads (no blink); only the first load shows the loader.
  const [data, setData] = useState<DeliveriesPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [reload, setReload] = useState(0)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setLoading(true); setError(null) } })
    listBroadcastDeliveries(id, { page, pageSize, status })
      .then((next) => { if (active) setData(next) })
      .catch((cause) => { if (active) setError({ cause }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, page, pageSize, status, reload])

  // While the broadcast is still sending, the list refreshes together with its counters.
  useEffect(() => {
    if (!sending) return
    const timer = window.setInterval(() => setReload((n) => n + 1), POLL_MS)
    return () => window.clearInterval(timer)
  }, [sending])

  async function exportCsv() {
    setExporting(true)
    try {
      const { blob, filename } = await apiGetBlob(broadcastDeliveriesExportPath(id, status))
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename ?? "deliveries.csv"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(overloadOr(err, t("admin.notif.broadcast.exportError")))
    } finally {
      setExporting(false)
    }
  }

  const rows = data?.Items ?? []
  const total = data?.Total ?? 0
  const firstLoad = data === null
  return (
    <section aria-labelledby="bc-deliveries" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="bc-deliveries" className="text-sm font-semibold text-foreground">{t("admin.notif.broadcast.deliveries")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <SelectMenu value={status} onChange={(value) => { setStatus(value as DeliveryStatus | ""); setPage(1) }} ariaLabel={t("admin.notif.broadcast.deliveryFilter")} className="min-w-44 text-sm"
            options={[{ value: "", label: t("admin.notif.broadcast.deliveryAll") }, ...DELIVERY_STATUSES.map((value) => ({ value, label: t(`admin.notif.broadcast.delivery.${value}`) }))]} />
          <Button type="button" variant="outline" size="sm" busy={exporting} busyLabel={t("busy.exporting")} onClick={() => void exportCsv()}><Download aria-hidden="true" className="mr-2 h-4 w-4" />{t("admin.notif.broadcast.exportCsv")}</Button>
        </div>
      </div>
      <div className="flex min-h-56 flex-col rounded-md border border-border" aria-busy={loading}>
        {error && firstLoad ? (
          <LoadError message={t("admin.notif.broadcast.loadError")} error={error.cause} compact className="flex-1" onRetry={() => setReload((n) => n + 1)} />
        ) : firstLoad ? (
          <LoadingArea compact className="flex-1" label={t("admin.loading")} />
        ) : rows.length === 0 ? (
          <EmptyState compact className="flex-1" message={t(status ? "admin.notif.broadcast.deliveriesEmptyFiltered" : "admin.notif.broadcast.deliveriesEmpty")} />
        ) : (
          <div className="overflow-auto">
            <table className={`ib-table${loading ? " is-refreshing" : ""}`} aria-label={t("admin.notif.broadcast.deliveries")}>
              <thead>
                <tr>
                  <th scope="col">{t("admin.notif.logs.recipient")}</th>
                  <th scope="col">{t("admin.notif.logs.channel")}</th>
                  <th scope="col">{t("admin.notif.logs.status")}</th>
                  <th scope="col">{t("admin.notif.logs.error")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.DispatchID}-${row.Channel}-${index}`}>
                    <td>{row.RecipientEmail || <span className="font-mono text-xs text-muted-foreground">{row.RecipientUserID.slice(0, 8)}</span>}</td>
                    <td>{broadcastChannelLabel(row.Channel)}</td>
                    <td><StatusPill status={row.TargetStatus} label={t(statusLabelKey(row.TargetStatus))} /></td>
                    <td className="max-w-80">{row.Error ? <HoverTooltip text={row.Error} truncated className="max-w-full"><span className="block truncate text-xs text-destructive">{row.Error}</span></HoverTooltip> : <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && !firstLoad && <LoadError message={t("admin.notif.broadcast.loadError")} error={error.cause} compact onRetry={() => setReload((n) => n + 1)} />}
      </div>
      <TablePagination page={page} pageSize={pageSize} total={total} busy={loading} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1) }} />
    </section>
  )
}

export function BroadcastDetail({ id }: { id: string }) {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [reload, setReload] = useState(0)
  const sending = broadcast?.Status === "sending"
  const [cancelling, setCancelling] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState("")
  async function runCancel() {
    setCancelBusy(true)
    setCancelError("")
    try {
      setBroadcast(await cancelBroadcast(id))
      setCancelling(false)
      toast.success(t("admin.notif.broadcast.canceled"))
    } catch (err) {
      setCancelError(overloadOr(err, t("admin.notif.broadcast.cancel.error")))
    } finally {
      setCancelBusy(false)
    }
  }

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
  const crumbs = (label: string) => [{ label: t("admin.notif.broadcast.title"), href: "/notifications/broadcasts" }, { label }]

  if (error && !broadcast) {
    const missing = error.cause instanceof ApiError && error.cause.status === 404
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t("admin.notif.broadcast.title")} />
        <div className="frost-panel frost-in flex flex-1 flex-col rounded-lg p-8">
          {missing ? <NotFoundBlock title={t("admin.notif.broadcast.notFound")} />
            : <LoadError message={t("admin.notif.broadcast.loadError")} error={error.cause} className="flex-1" onRetry={() => { setError(null); setReload((n) => n + 1) }} />}
        </div>
      </div>
    )
  }
  if (!broadcast) return <LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />

  const hasEmail = broadcast.Channels.includes("email")
  const hasInApp = broadcast.Channels.includes("in_app")
  const fact = (label: string, value: React.ReactNode) => <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm text-foreground">{value}</dd></div>

  return (
    <div className="flex flex-col gap-4">
    <PageHeader title={broadcastHeading(broadcast)} crumbs={crumbs(broadcastHeading(broadcast))}
      actions={<>
        <StatusPill status={broadcastPillStatus(broadcast.Status)} label={broadcastStatusLabel(broadcast.Status)} />
        <Button asChild variant="outline"><Link href={`/notifications/broadcasts/new?copy=${encodeURIComponent(broadcast.ID)}`}>{t("admin.notif.broadcast.copy")}</Link></Button>
        {sending && <Button variant="outline" onClick={() => { setCancelError(""); setCancelling(true) }}>{t("admin.notif.broadcast.cancel")}</Button>}
      </>} />
    <ConfirmDialog open={cancelling} onCancel={() => { if (!cancelBusy) setCancelling(false) }} tone="danger" busy={cancelBusy} busyLabel={t("busy.finishing")} error={cancelError}
      title={t("admin.notif.broadcast.cancel.title")} description={t("admin.notif.broadcast.cancel.body")} confirmLabel={t("admin.notif.broadcast.cancel.confirm")} onConfirm={() => void runCancel()} />
    <div className="frost-panel frost-in rounded-lg p-6">

      <dl className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {fact(t("admin.notif.broadcast.channels"), broadcast.Channels.map(broadcastChannelLabel).join(", "))}
        {fact(t("admin.notif.broadcast.audience.title"), audienceLabel(broadcast.Audience))}
        {fact(t("admin.notif.broadcast.col.recipients"), broadcast.RecipientCount)}
        {fact(t("admin.notif.broadcast.col.delivery"), <>{broadcast.SentCount} / <span className={broadcast.FailedCount > 0 ? "text-destructive" : undefined}>{broadcast.FailedCount}</span></>)}
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
    </div>
  )
}
