"use client"
import { useEffect, useRef, useState } from "react"
import { apiGet } from "@/api/client"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { StatusPill } from "./StatusPill"
import { formatNotifType } from "@/utils/notifType"

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
type ListResp = { Dispatches: Dispatch[]; Total: number }

const PAGE = 25
const STATUSES = ["pending", "started", "done"]

export function LogsTab() {
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<ListResp | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<DispatchDetail | null>(null)
  const [open, setOpen] = useState(false)
  const reqId = useRef(0)
  const [detailError, setDetailError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)
    const params = new URLSearchParams()
    if (type) params.set("type", type)
    if (status) params.set("status", status)
    params.set("limit", String(PAGE))
    params.set("offset", String(offset))
    apiGet<ListResp>(`/api/notifications/dispatches?${params.toString()}`)
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [type, status, offset])

  function openDetail(id: string) {
    const my = ++reqId.current
    setDetail(null); setDetailError(false); setOpen(true)
    apiGet<DispatchDetail>(`/api/notifications/dispatches/${id}`)
      .then((d) => { if (my === reqId.current) setDetail(d) })
      .catch(() => { if (my === reqId.current) setDetailError(true) })
  }

  const total = data?.Total ?? 0
  const rows = data?.Dispatches ?? []

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap gap-3">
        <input
          value={type}
          onChange={(e) => { setOffset(0); setType(e.target.value) }}
          placeholder={t("admin.notif.logs.allTypes")}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          value={status}
          onChange={(e) => { setOffset(0); setStatus(e.target.value) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{t("admin.notif.logs.allStatuses")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error ? (
        <p className="py-8 text-center text-sm text-destructive">{t("admin.notif.loadError")}</p>
      ) : loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.notif.logs.empty")}</p>
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
                  <td className="px-3 py-2 font-medium text-foreground">{formatNotifType(d.NotificationType)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.RecipientUserID.slice(0, 8)}</td>
                  <td className="px-3 py-2"><StatusPill status={d.Status} /></td>
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
            <p className="py-4 text-sm text-muted-foreground">{t("admin.loading")}</p>
          ) : detail.Targets.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t("admin.notif.logs.noTargets")}</p>
          ) : (
            <div className="space-y-2">
              {detail.Targets.map((tg, i) => (
                <div key={`${tg.Channel}-${i}`} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{tg.Channel}</span>
                    <StatusPill status={tg.Status} />
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
