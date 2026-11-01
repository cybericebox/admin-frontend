"use client"
import { ListFilter } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { apiGet, apiPost } from "@/api/client"
import { t } from "@/i18n/t"
import { statusLabelKey } from "@/lib/templateStatus"
import { useUserNames } from "@/lib/userNames"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { StatusPill } from "./StatusPill"
import { isSmtpTest, journalTypeValues, notifChannelLabel, notifTypeLabel } from "@/utils/notifType"
import { useNotificationTypes } from "./templateTypes"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "@/components/ui/toast"
import { overloadOr } from "@/i18n/apiError"
import { tPlural } from "@/i18n/plural"
import { formatListDateTime } from "@/lib/locale"
import { IndexTable } from "@/components/table/IndexTable"
import { useIndexList, type ColumnDef, type ListQuery } from "@/components/table/useIndexList"
import { isComplete, type FilterDef } from "@/components/table/filters"
import { listEvents } from "@/api/events/catalog"
import { useRole } from "@/lib/useRole"
import { mailTransportLabel } from "@/utils/notifType"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { smtpErrorView } from "@/utils/smtpError"

// W7 journal fields (ScopeEventID … Targets) are optional so an older backend
// without them still renders the list.
type Target = {
  Channel: string
  Status: string
  Error: string
  Attempts: number
  Transport?: string
  ErrorKind?: string
  ErrorCode?: string
  FallbackError?: string
  FallbackErrorKind?: string
  FallbackErrorCode?: string
  UpdatedAt: string
}
type Dispatch = {
  ID: string
  NotificationType: string
  RecipientUserID: string
  Status: string
  ScopeEventID?: string | null
  EventName?: string
  RecipientEmail?: string
  RecipientName?: string
  BroadcastID?: string | null
  Targets?: Target[]
  CreatedAt: string
  UpdatedAt: string
}
type DispatchDetail = Dispatch & { Targets: Target[] }
const STATUSES = ["pending", "started", "done"]
const CHANNELS = ["email", "in_app"]
const RESULTS = [{ value: "done", label: "admin.notif.logs.resultDone" }, { value: "error", label: "admin.notif.logs.resultError" }, { value: "deferred", label: "admin.notif.logs.resultDeferred" }]
const TRANSPORTS = ["event", "platform", "env"]
const EVENT_OPTIONS_LIMIT = 100

type EventOption = { value: string; label: string }

// Loads the event picker options once; without events.read the filter is hidden.
function useEventOptions(enabled: boolean): EventOption[] {
  const [options, setOptions] = useState<EventOption[]>([])
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    listEvents({ pageSize: EVENT_OPTIONS_LIMIT })
      .then((page) => { if (!cancelled) setOptions(page.Items.map((event) => ({ value: event.ID, label: event.Name }))) })
      .catch(() => { /* The event filter is optional: keep it hidden on failure. */ })
    return () => { cancelled = true }
  }, [enabled])
  return options
}

// A compact error line for the journal row: the human text, the raw error in the tooltip.
function ErrorText({ view, prefix = "", className }: { view: ReturnType<typeof smtpErrorView>; prefix?: string; className: string }) {
  if (!view) return null
  const full = view.technical ? `${view.text}\n${view.technical}` : view.text
  return <HoverTooltip text={full} truncated className="max-w-full self-start"><span className={`max-w-72 truncate text-xs ${className}`}>{prefix}{view.text}</span></HoverTooltip>
}

// The error of a detail card: the human line, with the raw text under «Технічні деталі».
function DetailError({ label, view, tone }: { label: string; view: ReturnType<typeof smtpErrorView>; tone: string }) {
  if (!view) return null
  return (
    <div className="mt-1 text-xs">
      <div className={tone}>{label}: {view.text}</div>
      {view.technical && (
        <details className="mt-0.5 text-muted-foreground">
          <summary className="cursor-pointer">{t("admin.notif.logs.technical")}</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words font-mono">{view.technical}</pre>
        </details>
      )}
    </div>
  )
}

const NIL_UUID = "00000000-0000-0000-0000-000000000000"

// The dispatch recipient: «Name (email)», the email alone without a name, «—» with neither.
// A link to the user page only for a real user id.
export function RecipientRow({ userID, name, email }: { userID?: string; name?: string; email?: string }) {
  const text = name && email ? `${name} (${email})` : name || email || "—"
  const linkable = !!userID && userID !== NIL_UUID && text !== "—"
  return (
    <div className="mb-2 flex flex-wrap gap-1 text-sm">
      <span className="text-muted-foreground">{t("admin.notif.logs.recipientUser")}:</span>
      {linkable ? (
        <Link href={`/users/detail?id=${userID}`} className="text-foreground hover:underline">{text}</Link>
      ) : (
        <span className="text-foreground">{text}</span>
      )}
    </div>
  )
}

function TargetLine({ target }: { target: Target }) {
  const transport = mailTransportLabel(target.Transport)
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-foreground">{notifChannelLabel(target.Channel)}</span>
        <StatusPill status={target.Status} label={t(statusLabelKey(target.Status))} />
        {transport && <span className="text-xs text-muted-foreground">{transport}</span>}
        {target.Attempts > 1 && <span className="text-xs text-muted-foreground">· {t("admin.notif.logs.attemptsLine", { count: target.Attempts })}</span>}
      </div>
      {target.FallbackError && <ErrorText view={smtpErrorView(target.FallbackErrorKind, target.FallbackErrorCode, target.FallbackError)} prefix={t("admin.notif.logs.fallbackPrefix")} className="text-muted-foreground" />}
      {target.Error && <ErrorText view={smtpErrorView(target.ErrorKind, target.ErrorCode, target.Error)} className={target.Status === "deferred" ? "text-muted-foreground" : "text-destructive"} />}
    </div>
  )
}

type DispatchPage = { Items?: Dispatch[] | null; Total?: number }

const ERROR_RESULTS = new Set(["error", "failed"])
const hasFailedTarget = (dispatch: Dispatch) => (dispatch.Targets ?? []).some((target) => ERROR_RESULTS.has(target.Status))
const dayAfter = (date: string) => new Date(new Date(`${date}T00:00:00`).getTime() + 86400e3).toISOString()

/** The query of the list, minus paging and sort: the filters the facets are counted under (GET …/dispatches/facets, the field's own filter ignored by the server). */
function dispatchFilters(query: { search: string; bag: ListQuery["bag"] }): URLSearchParams {
  const p = new URLSearchParams()
  const value = (key: string) => (isComplete(query.bag[key]) ? query.bag[key].v[0] : "")
  for (const key of ["type", "status", "event", "channel", "result", "transport", "user"]) if (value(key)) p.set(key, value(key))
  const recipient = query.search || value("recipient")
  if (recipient) p.set("recipient", recipient)
  const period = query.bag.period
  if (isComplete(period)) {
    const [a = "", b = ""] = period.v
    if (period.op !== "before" && a) p.set("from", new Date(`${a}T00:00:00`).toISOString())
    if (period.op === "before" && a) p.set("to", dayAfter(a))
    if (period.op === "between" && b) p.set("to", dayAfter(b))
  }
  return p
}

async function getDispatchFacets(field: string, query: { search: string; bag: ListQuery["bag"] }): Promise<Record<string, number> | null> {
  const p = dispatchFilters(query)
  p.set("field", field)
  try { return (await apiGet<{ Counts?: Record<string, number> } | null>(`/api/notifications/dispatches/facets?${p}`))?.Counts ?? null } catch { return null }
}

/** GET /api/notifications/dispatches in the offset mode (page, pageSize, sortBy, sortDir) with the journal filters. */
function listDispatches(query: ListQuery): Promise<DispatchPage> {
  const p = dispatchFilters(query)
  p.set("page", String(query.page))
  p.set("pageSize", String(query.pageSize))
  p.set("sortBy", query.sortBy)
  p.set("sortDir", query.sortDir)
  return apiGet<DispatchPage>(`/api/notifications/dispatches?${p}`)
}

const COLUMNS = [
  { key: "type", width: 240 }, { key: "recipient", width: 260 }, { key: "event", width: 200 },
  { key: "delivery", width: 360 }, { key: "status", width: 140 }, { key: "created", width: 180 },
]

export function LogsTab() {
  const { can } = useRole()
  const canResend = can("notifications.broadcast")
  const eventOptions = useEventOptions(can("events.read"))
  const types = useNotificationTypes()
  const defs = useMemo<FilterDef[]>(() => [
    { key: "type", label: t("admin.notif.logs.type"), type: "choice", single: true, ops: ["in"], options: journalTypeValues(types.map((kind) => kind.Type)).map((kind) => ({ value: kind, label: notifTypeLabel(kind) })) },
    { key: "status", label: t("admin.notif.logs.status"), type: "choice", single: true, ops: ["in"], options: STATUSES.map((s) => ({ value: s, label: t(statusLabelKey(s)) })) },
    { key: "result", label: t("admin.notif.logs.result"), type: "choice", single: true, ops: ["in"], options: RESULTS.map((r) => ({ value: r.value, label: t(r.label) })) },
    { key: "channel", label: t("admin.notif.logs.channel"), type: "choice", single: true, ops: ["in"], options: CHANNELS.map((c) => ({ value: c, label: notifChannelLabel(c) })) },
    { key: "transport", label: t("admin.notif.logs.transport"), type: "choice", single: true, ops: ["in"], options: TRANSPORTS.map((tr) => ({ value: tr, label: mailTransportLabel(tr) ?? tr })) },
    { key: "event", label: t("admin.notif.logs.event"), type: "choice", single: true, ops: ["in"], options: eventOptions },
    { key: "recipient", label: t("admin.notif.logs.recipient"), type: "text", ops: ["contains"] },
    { key: "period", label: t("admin.notif.logs.created"), type: "date" },
    { key: "user", label: t("admin.notif.logs.recipientUser"), type: "text", ops: ["is"] },
  ], [types, eventOptions])

  const list = useIndexList<Dispatch>({
    table: "admin.notif.logs", columns: COLUMNS, identity: "type", defs, defaultSort: { key: "created", dir: "desc" },
    fetch: listDispatches, rowId: (d) => d.ID, selectable: hasFailedTarget, selectLimit: 200,
  })
  const names = useUserNames(list.rows.map((r) => r.RecipientUserID))

  const [detail, setDetail] = useState<DispatchDetail | null>(null)
  const [open, setOpen] = useState(false)
  const reqId = useRef(0)
  const [detailError, setDetailError] = useState<{ cause: unknown } | null>(null)
  const [detailID, setDetailID] = useState("")
  function openDetail(id: string) {
    const my = ++reqId.current
    setDetail(null); setDetailError(null); setDetailID(id); setOpen(true)
    apiGet<DispatchDetail>(`/api/notifications/dispatches/${id}`)
      .then((d) => { if (my === reqId.current) setDetail(d) })
      .catch((cause) => { if (my === reqId.current) setDetailError({ cause }) })
  }

  // A link from elsewhere (an error sample) opens that dispatch: /notifications/logs?dispatch=<id>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("dispatch")
    if (id) queueMicrotask(() => openDetail(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns: ColumnDef<Dispatch>[] = [
    { key: "type", label: t("admin.notif.logs.type"), sort: "type", width: 240, cell: (d) => <button type="button" onClick={() => openDetail(d.ID)} className="max-w-full truncate text-left font-medium hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{notifTypeLabel(d.NotificationType)}{isSmtpTest(d.NotificationType) && <Badge size="sm" className="ml-2">{t("admin.notif.logs.testBadge")}</Badge>}</button> },
    { key: "recipient", label: t("admin.notif.logs.recipient"), sort: "recipient", width: 260, cell: (d) => <span className="block min-w-0">
      <span className="flex items-center gap-1">
        {names[d.RecipientUserID]
          ? <Link href={names[d.RecipientUserID].href} className="truncate font-medium text-foreground hover:underline">{names[d.RecipientUserID].name}</Link>
          : d.RecipientName ? <span className="truncate font-medium text-foreground">{d.RecipientName}</span> : <span className="font-mono text-xs text-muted-foreground">{d.RecipientUserID.slice(0, 8)}</span>}
        <HoverTooltip text={t("admin.notif.logs.filterByUser")}><button type="button" aria-label={t("admin.notif.logs.filterByUser")} onClick={() => list.setBag({ ...list.bag, user: { op: "is", v: [d.RecipientUserID] } })} className="admin-tap ml-0.5 inline-flex items-center rounded-sm text-muted-foreground hover:text-foreground"><ListFilter aria-hidden="true" className="h-3.5 w-3.5" /></button></HoverTooltip>
      </span>
      {d.RecipientEmail && <span className="block truncate text-xs text-muted-foreground">{d.RecipientEmail}</span>}
    </span> },
    { key: "event", label: t("admin.notif.logs.event"), sort: "event", width: 200, cell: (d) => d.ScopeEventID ? (d.EventName || <span className="font-mono text-xs text-muted-foreground">{d.ScopeEventID.slice(0, 8)}</span>) : <span className="text-muted-foreground">—</span> },
    { key: "delivery", label: t("admin.notif.logs.delivery"), width: 360, cell: (d) => d.Targets && d.Targets.length > 0 ? <span className="flex flex-col gap-1.5 py-1">{d.Targets.map((target, i) => <TargetLine key={`${target.Channel}-${i}`} target={target} />)}</span> : <span className="text-muted-foreground">—</span> },
    { key: "status", label: t("admin.notif.logs.status"), sort: "status", width: 140, cell: (d) => <StatusPill status={d.Status} label={t(statusLabelKey(d.Status))} /> },
    { key: "created", label: t("admin.notif.logs.created"), sort: "created", firstDesc: true, dim: true, width: 180, cell: (d) => formatListDateTime(d.CreatedAt) },
  ]

  const [resending, setResending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  async function resend() {
    setBusy(true)
    setResendError(null)
    try {
      const ids = [...list.selected]
      const res = await apiPost<{ Results?: { DispatchID: string; Ok: boolean }[] }>("/api/notifications/dispatches/resend", { DispatchIDs: ids })
      const done = (res.Results ?? []).filter((r) => r.Ok).length
      if (done < ids.length) toast.error(t("admin.notif.logs.resend.partial", { done, skipped: ids.length - done }))
      else toast.success(tPlural("admin.notif.logs.resend.done", done))
      setResending(false); list.setSelected(new Set()); list.reload()
    } catch (err) { setResendError(overloadOr(err, t("admin.notif.logs.resend.error"))) } finally { setBusy(false) }
  }

  return (
    <div className="ib-index">
      <IndexTable<Dispatch>
        list={list} columns={columns} identity="type" title={t("admin.nav.notif.logs")} rowId={(d) => d.ID} rowLabel={(d) => notifTypeLabel(d.NotificationType)}
        defs={defs} facets={(def) => getDispatchFacets(def.key, { search: list.request.search, bag: list.bag })} searchLabel={t("admin.notif.logs.search")} emptyLabel={t("admin.notif.logs.emptyFiltered")} emptyInitialLabel={t("admin.notif.logs.empty")} errorLabel={t("admin.notif.loadError")}
        actionsLabel={t("admin.notif.logs.actions")} selectable={hasFailedTarget}
        bulk={canResend ? <Button type="button" variant="outline" size="sm" onClick={() => { setResendError(null); setResending(true) }}>{t("admin.notif.logs.resend")}</Button> : undefined}
      />

      <ConfirmDialog open={resending} onCancel={() => { if (!busy) setResending(false) }} busy={busy} busyLabel={t("busy.sending")} error={resendError}
        title={tPlural("admin.notif.logs.resend.title", list.selected.size)} description={t("admin.notif.logs.resend.body")}
        confirmLabel={t("admin.notif.logs.resend.confirm")} onConfirm={() => void resend()} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("admin.notif.logs.targets")}</DialogTitle></DialogHeader>
          {detailError ? (
            <LoadError message={t("admin.notif.loadError")} error={detailError.cause} compact onRetry={() => openDetail(detailID)} />
          ) : !detail ? (
            <LoadingArea compact label={t("admin.loading")} />
          ) : detail.Targets.length === 0 ? (
            <EmptyState message={t("admin.notif.logs.noTargets")} compact />
          ) : (
            <div className="space-y-2">
              <RecipientRow userID={detail.RecipientUserID} name={detail.RecipientName} email={detail.RecipientEmail} />
              {detail.Targets.map((tg, i) => (
                <div key={`${tg.Channel}-${i}`} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{notifChannelLabel(tg.Channel)}</span>
                    <StatusPill status={tg.Status} label={t(statusLabelKey(tg.Status))} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("admin.notif.logs.attemptsLine", { count: tg.Attempts })}
                    {tg.Transport && <> · {t("admin.notif.logs.transportLine", { transport: mailTransportLabel(tg.Transport) })}</>}
                  </div>
                  <DetailError label={t("admin.notif.logs.fallback")} view={smtpErrorView(tg.FallbackErrorKind, tg.FallbackErrorCode, tg.FallbackError)} tone="text-muted-foreground" />
                  <DetailError label={t(tg.Status === "deferred" ? "admin.notif.logs.reason" : "admin.notif.logs.error")} view={smtpErrorView(tg.ErrorKind, tg.ErrorCode, tg.Error)} tone={tg.Status === "deferred" ? "text-muted-foreground" : "text-destructive"} />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("admin.notif.logs.close")}</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
