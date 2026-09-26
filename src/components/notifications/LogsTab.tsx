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
import { notifChannelLabel, notifTypeLabel } from "@/utils/notifType"
import { useNotificationTypes } from "./templateTypes"
import { LoadingArea, Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { SelectMenu } from "@/components/ui/select-menu"

type Dispatch = {
  ID: string
  NotificationType: string
  RecipientUserID: string
  Status: string
  CreatedAt: string
  UpdatedAt: string
}
type Target = { Channel: string; Status: string; Error: string; Attempts: number; UpdatedAt: string }
type DispatchDetail = Dispatch & { Targets: Target[] }
type ListResp = CursorPage<Dispatch>

const PAGE_SIZES = [25, 50, 100]
const STATUSES = ["pending", "started", "done"]

export function LogsTab() {
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [reload, setReload] = useState(0)
  const types = useNotificationTypes()
  const [userFilter, setUserFilter] = useState<{ id: string; name: string } | null>(null)
  const [data, setData] = useState<{ query: string; page: ListResp } | null>(null)
  const [errorQuery, setErrorQuery] = useState<string | null>(null)
  const [detail, setDetail] = useState<DispatchDetail | null>(null)
  const [open, setOpen] = useState(false)
  const reqId = useRef(0)
  const [detailError, setDetailError] = useState(false)

  const params = new URLSearchParams()
  if (type) params.set("type", type)
  if (status) params.set("status", status)
  params.set("limit", String(pageSize))
  if (cursors[page - 1]) params.set("cursor", cursors[page - 1]!)
  if (userFilter) params.set("user", userFilter.id)
  const requestQuery = params.toString()
  const query = `${requestQuery}&reload=${reload}`
  const error = errorQuery === query
  const loading = !error && data?.query !== query

  useEffect(() => {
    let cancelled = false
    apiGet<ListResp>(`/api/notifications/dispatches?${requestQuery}`)
      .then((page) => { if (!cancelled) { setData({ query, page }); setErrorQuery(null) } })
      .catch(() => { if (!cancelled) setErrorQuery(query) })
    return () => { cancelled = true }
  }, [query, requestQuery])

  function openDetail(id: string) {
    const my = ++reqId.current
    setDetail(null); setDetailError(false); setOpen(true)
    apiGet<DispatchDetail>(`/api/notifications/dispatches/${id}`)
      .then((d) => { if (my === reqId.current) setDetail(d) })
      .catch(() => { if (my === reqId.current) setDetailError(true) })
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
        <SelectMenu value={type} onChange={(next) => { resetPage(); setType(next) }} ariaLabel={t("admin.notif.logs.type")} options={[{ value: "", label: t("admin.notif.logs.allTypes") }, ...types.map((kind) => ({ value: kind.Type, label: notifTypeLabel(kind.Type) }))]} className="min-w-48" />
        <SelectMenu value={status} onChange={(next) => { resetPage(); setStatus(next) }} ariaLabel={t("admin.notif.logs.status")} options={[{ value: "", label: t("admin.notif.logs.allStatuses") }, ...STATUSES.map((s) => ({ value: s, label: t(statusLabelKey(s)) }))]} className="min-w-40" />
      </div>

      {userFilter && (
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent/10 px-3 py-1 text-sm text-foreground">
          <span>{t("admin.notif.logs.filteredBy")}: {userFilter.name}</span>
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
        <div className="flex flex-col items-center gap-3 py-8"><p role="alert" className="text-sm text-destructive">{t("admin.notif.loadError")}</p><Button variant="outline" onClick={() => setReload((value) => value + 1)}>{t("admin.events.access.retry")}</Button></div>
      ) : loading ? (
        <LoadingArea className="h-full" label={t("admin.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState message={t(type || status || userFilter ? "admin.notif.logs.emptyFiltered" : "admin.notif.logs.empty")} />
      ) : (
        <div className="min-w-[760px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border bg-background text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.type")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.recipient")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.status")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.created")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.ID} onClick={() => openDetail(d.ID)} className="cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2 font-medium text-foreground"><button type="button" onClick={(event) => { event.stopPropagation(); openDetail(d.ID) }} className="text-left hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{notifTypeLabel(d.NotificationType)}</button></td>
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
                        <span className="font-mono text-xs text-muted-foreground">
                          {d.RecipientUserID.slice(0, 8)}
                        </span>
                      )}
                      <button
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
                        title={t("admin.notif.logs.filterByUser")}
                      >
                        ⊞
                      </button>
                    </div>
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
        <div className="flex items-center gap-3"><span>{t("admin.table.total")}: {total}</span><span>{t("admin.table.page")} {page} {t("admin.table.of")} {pageCount}</span>{loading && <Spinner size="sm" label={t("admin.table.updating")} />}</div>
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
            <p className="py-4 text-sm text-destructive">{t("admin.notif.loadError")}</p>
          ) : !detail ? (
            <LoadingArea compact label={t("admin.loading")} />
          ) : detail.Targets.length === 0 ? (
            <EmptyState message={t("admin.notif.logs.noTargets")} compact />
          ) : (
            <div className="space-y-2">
              {detail.Targets.map((tg, i) => (
                <div key={`${tg.Channel}-${i}`} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{notifChannelLabel(tg.Channel)}</span>
                    <StatusPill status={tg.Status} label={t(statusLabelKey(tg.Status))} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{t("admin.notif.logs.attempts")}: {tg.Attempts}</div>
                  {tg.Error && <div className="mt-1 text-xs text-destructive">{t("admin.notif.logs.error")}: {tg.Error}</div>}
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
