"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { apiGet } from "@/api/client"
import type { CursorPage } from "@/api/pagination"
import { t } from "@/i18n/t"
import { statusLabelKey } from "@/lib/templateStatus"
import { useUserNames } from "@/lib/userNames"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { StatusPill } from "./StatusPill"
import { isSmtpTest, journalTypeValues, notifChannelLabel, notifTypeLabel } from "@/utils/notifType"
import { useNotificationTypes } from "./templateTypes"
import { LoadingArea, Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { SelectMenu } from "@/components/ui/select-menu"
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
type ListResp = CursorPage<Dispatch>

const PAGE_SIZES = [25, 50, 100]
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

export function LogsTab() {
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [eventFilter, setEventFilter] = useState("")
  const [channel, setChannel] = useState("")
  const [result, setResult] = useState("")
  const [transport, setTransport] = useState("")
  const eventOptions = useEventOptions(useRole().can("events.read"))
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [reload, setReload] = useState(0)
  const types = useNotificationTypes()
  const [userFilter, setUserFilter] = useState<{ id: string; name: string } | null>(null)
  const [data, setData] = useState<{ query: string; page: ListResp } | null>(null)
  const [errorQuery, setErrorQuery] = useState<{ query: string; cause: unknown } | null>(null)
  const [detail, setDetail] = useState<DispatchDetail | null>(null)
  const [open, setOpen] = useState(false)
  const reqId = useRef(0)
  const [detailError, setDetailError] = useState<{ cause: unknown } | null>(null)
  const [detailID, setDetailID] = useState("")

  const params = new URLSearchParams()
  if (type) params.set("type", type)
  if (status) params.set("status", status)
  if (eventFilter) params.set("event", eventFilter)
  if (channel) params.set("channel", channel)
  if (result) params.set("result", result)
  if (transport) params.set("transport", transport)
  params.set("limit", String(pageSize))
  if (cursors[page - 1]) params.set("cursor", cursors[page - 1]!)
  if (userFilter) params.set("user", userFilter.id)
  const requestQuery = params.toString()
  const query = `${requestQuery}&reload=${reload}`
  const failure = errorQuery?.query === query ? errorQuery : null
  const error = failure !== null
  const loading = !error && data?.query !== query

  useEffect(() => {
    let cancelled = false
    apiGet<ListResp>(`/api/notifications/dispatches?${requestQuery}`)
      .then((page) => { if (!cancelled) { setData({ query, page }); setErrorQuery(null) } })
      .catch((cause) => { if (!cancelled) setErrorQuery({ query, cause }) })
    return () => { cancelled = true }
  }, [query, requestQuery])

  function openDetail(id: string) {
    const my = ++reqId.current
    setDetail(null); setDetailError(null); setDetailID(id); setOpen(true)
    apiGet<DispatchDetail>(`/api/notifications/dispatches/${id}`)
      .then((d) => { if (my === reqId.current) setDetail(d) })
      .catch((cause) => { if (my === reqId.current) setDetailError({ cause }) })
  }

  function resetPage() { setPage(1); setCursors([null]); setData(null) }

  const total = data?.query === query ? data.page.Total : 0
  const rows = data?.query === query ? data.page.Items : []
  const nextCursor = data?.query === query ? data.page.NextCursor : undefined
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const names = useUserNames(rows.map(r => r.RecipientUserID))

  return (
    <div className="frost-panel frost-in flex h-full min-h-0 flex-col overflow-hidden rounded-lg p-6">
      <div className="mb-3 flex flex-wrap gap-3">
        <SelectMenu value={type} onChange={(next) => { resetPage(); setType(next) }} ariaLabel={t("admin.notif.logs.type")} options={[{ value: "", label: t("admin.notif.logs.allTypes") }, ...journalTypeValues(types.map((kind) => kind.Type)).map((kind) => ({ value: kind, label: notifTypeLabel(kind) }))]} className="min-w-48" />
        <SelectMenu value={status} onChange={(next) => { resetPage(); setStatus(next) }} ariaLabel={t("admin.notif.logs.status")} options={[{ value: "", label: t("admin.notif.logs.allStatuses") }, ...STATUSES.map((s) => ({ value: s, label: t(statusLabelKey(s)) }))]} className="min-w-40" />
        {eventOptions.length > 0 && <SelectMenu value={eventFilter} onChange={(next) => { resetPage(); setEventFilter(next) }} ariaLabel={t("admin.notif.logs.event")} options={[{ value: "", label: t("admin.notif.logs.allEvents") }, ...eventOptions]} className="min-w-48 max-w-72" />}
        <SelectMenu value={channel} onChange={(next) => { resetPage(); setChannel(next) }} ariaLabel={t("admin.notif.logs.channel")} options={[{ value: "", label: t("admin.notif.logs.allChannels") }, ...CHANNELS.map((c) => ({ value: c, label: notifChannelLabel(c) }))]} className="min-w-36" />
        <SelectMenu value={result} onChange={(next) => { resetPage(); setResult(next) }} ariaLabel={t("admin.notif.logs.result")} options={[{ value: "", label: t("admin.notif.logs.allResults") }, ...RESULTS.map((r) => ({ value: r.value, label: t(r.label) }))]} className="min-w-40" />
        <SelectMenu value={transport} onChange={(next) => { resetPage(); setTransport(next) }} ariaLabel={t("admin.notif.logs.transport")} options={[{ value: "", label: t("admin.notif.logs.allTransports") }, ...TRANSPORTS.map((tr) => ({ value: tr, label: mailTransportLabel(tr) }))]} className="min-w-40" />
      </div>

      {userFilter && (
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent/10 px-3 py-1 text-sm text-foreground">
          <span>{t("admin.notif.logs.filteredByName", { name: userFilter.name })}</span>
          <button
            onClick={() => { resetPage(); setUserFilter(null) }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="✕"
          >
            ✕
          </button>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-auto" aria-busy={loading}>
      {error ? (
        <LoadError message={t("admin.notif.loadError")} error={failure?.cause} onRetry={() => setReload((value) => value + 1)} className="h-full" />
      ) : loading ? (
        <LoadingArea className="h-full" label={t("admin.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState message={t(type || status || eventFilter || channel || result || transport || userFilter ? "admin.notif.logs.emptyFiltered" : "admin.notif.logs.empty")} className="h-full" />
      ) : (
        <div className="min-w-[1080px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border bg-background text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.type")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.recipient")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.event")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.delivery")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.status")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.created")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.ID} onClick={() => openDetail(d.ID)} className="cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2 font-medium text-foreground"><button type="button" onClick={(event) => { event.stopPropagation(); openDetail(d.ID) }} className="text-left hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{notifTypeLabel(d.NotificationType)}</button>{d.BroadcastID && <Link href={`/notifications/broadcasts/detail?id=${encodeURIComponent(d.BroadcastID)}`} onClick={(event) => event.stopPropagation()} className="ml-2 text-xs font-normal text-primary hover:underline">{t("admin.notif.logs.openBroadcast")}</Link>}{isSmtpTest(d.NotificationType) && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-normal text-muted-foreground">{t("admin.notif.logs.testBadge")}</span>}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {names[d.RecipientUserID] ? (
                        <Link
                          href={names[d.RecipientUserID].href}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-foreground hover:underline"
                        >
                          {names[d.RecipientUserID].name}
                        </Link>
                      ) : (
                        d.RecipientName ? <span className="font-medium text-foreground">{d.RecipientName}</span> : <span className="font-mono text-xs text-muted-foreground">
                          {d.RecipientUserID.slice(0, 8)}
                        </span>
                      )}
                      <HoverTooltip text={t("admin.notif.logs.filterByUser")}><button
                        type="button"
                        aria-label={t("admin.notif.logs.filterByUser")}
                        onClick={(e) => {
                          e.stopPropagation()
                          setUserFilter({
                            id: d.RecipientUserID,
                            name: names[d.RecipientUserID]?.name ?? d.RecipientUserID,
                          })
                          resetPage()
                        }}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                      >
                        ⊞
                      </button></HoverTooltip>
                    </div>
                    {d.RecipientEmail && <div className="text-xs text-muted-foreground">{d.RecipientEmail}</div>}
                  </td>
                  <td className="px-3 py-2 text-foreground">{d.ScopeEventID ? (d.EventName || <span className="font-mono text-xs text-muted-foreground">{d.ScopeEventID.slice(0, 8)}</span>) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2">
                    {d.Targets && d.Targets.length > 0
                      ? <div className="flex flex-col gap-1.5">{d.Targets.map((target, i) => <TargetLine key={`${target.Channel}-${i}`} target={target} />)}</div>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2"><StatusPill status={d.Status} label={t(statusLabelKey(d.Status))} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(d.CreatedAt).toLocaleString("uk-UA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      <div className="mt-auto grid shrink-0 grid-cols-1 items-center gap-3 border-t border-border pt-4 text-sm text-muted-foreground sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-3"><span>{t("admin.table.totalCount", { total })}</span><span>{t("admin.table.pageOf", { page, pages: pageCount })}</span>{loading && <Spinner size="sm" label={t("admin.table.updating")} />}</div>
        <div className="flex gap-2 sm:justify-center">
          <Button variant="outline" size="sm" disabled={loading || page === 1} onClick={() => setPage(page - 1)}>{t("admin.table.previous")}</Button>
          <Button variant="outline" size="sm" disabled={loading || !nextCursor} onClick={() => { if (nextCursor) { setCursors((current) => [...current.slice(0, page), nextCursor]); setPage(page + 1) } }}>{t("admin.table.next")}</Button>
        </div>
        <div className="flex items-center gap-2 sm:justify-end"><span>{t("admin.table.perPage")}</span><SelectMenu value={String(pageSize)} onChange={(value) => { resetPage(); setPageSize(Number(value)) }} ariaLabel={t("admin.table.perPage")} options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))} className="w-20" disabled={loading} /></div>
      </div>

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
