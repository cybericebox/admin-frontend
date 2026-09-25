"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { apiGet } from "@/api/client"
import type { OffsetPage } from "@/api/pagination"
import { t } from "@/i18n/t"
import { statusLabelKey } from "@/lib/templateStatus"
import { useUserNames } from "@/lib/userNames"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { StatusPill } from "./StatusPill"
import { notifTypeLabel } from "@/utils/notifType"
import { LoadingArea } from "@/components/ui/spinner"
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
type ListResp = OffsetPage<Dispatch>

const PAGE = 25
const STATUSES = ["pending", "started", "done"]

export function LogsTab() {
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [offset, setOffset] = useState(0)
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
  params.set("limit", String(PAGE))
  params.set("offset", String(offset))
  if (userFilter) params.set("user", userFilter.id)
  const query = params.toString()
  const error = errorQuery === query
  const loading = !error && data?.query !== query

  useEffect(() => {
    let cancelled = false
    apiGet<ListResp>(`/api/notifications/dispatches?${query}`)
      .then((page) => { if (!cancelled) { setData({ query, page }); setErrorQuery(null) } })
      .catch(() => { if (!cancelled) setErrorQuery(query) })
    return () => { cancelled = true }
  }, [query])

  function openDetail(id: string) {
    const my = ++reqId.current
    setDetail(null); setDetailError(false); setOpen(true)
    apiGet<DispatchDetail>(`/api/notifications/dispatches/${id}`)
      .then((d) => { if (my === reqId.current) setDetail(d) })
      .catch(() => { if (my === reqId.current) setDetailError(true) })
  }

  const total = data?.page.Total ?? 0
  const rows = data?.query === query ? data.page.Items : []
  const names = useUserNames(rows.map(r => r.RecipientUserID))

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap gap-3">
        <input
          value={type}
          onChange={(e) => { setOffset(0); setType(e.target.value) }}
          placeholder={t("admin.notif.logs.allTypes")}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <SelectMenu value={status} onChange={(next) => { setOffset(0); setStatus(next) }} ariaLabel={t("admin.notif.logs.status")} options={[{ value: "", label: t("admin.notif.logs.allStatuses") }, ...STATUSES.map((s) => ({ value: s, label: t(statusLabelKey(s)) }))]} className="min-w-40" />
      </div>

      {userFilter && (
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent/10 px-3 py-1 text-sm text-foreground">
          <span>{t("admin.notif.logs.filteredBy")}: {userFilter.name}</span>
          <button
            onClick={() => { setUserFilter(null); setOffset(0) }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="✕"
          >
            ✕
          </button>
        </div>
      )}

      {error ? (
        <p className="py-8 text-center text-sm text-destructive">{t("admin.notif.loadError")}</p>
      ) : loading ? (
        <LoadingArea label={t("admin.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState message={t(type || status || userFilter ? "admin.notif.logs.emptyFiltered" : "admin.notif.logs.empty")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.type")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.recipient")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.status")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.notif.logs.created")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.ID} onClick={() => openDetail(d.ID)} className="cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2 font-medium text-foreground">{notifTypeLabel(d.NotificationType)}</td>
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
                          setOffset(0)
                        }}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                        title={t("admin.notif.logs.filterByUser")}
                      >
                        ⊞
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2"><StatusPill status={d.Status} label={t(statusLabelKey(d.Status))} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(d.CreatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{offset + 1}–{Math.min(offset + PAGE, total)} / {total}</span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>{t("admin.notif.logs.prev")}</Button>
          <Button variant="outline" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>{t("admin.notif.logs.next")}</Button>
        </div>
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
                    <span className="font-medium text-foreground">{tg.Channel}</span>
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
