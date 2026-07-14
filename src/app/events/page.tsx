"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import {
  listEvents, archiveEvent, deleteEvent, type Event, type EventStatus,
} from "@/api/events/catalog"
import { eventErrorMessage } from "@/lib/eventErrors"
import { EventDialog } from "@/components/events/EventDialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"

const PAGE = 50

const STATUS_STYLE: Record<EventStatus, string> = {
  pending: "bg-secondary/40 text-muted-foreground",
  active: "bg-primary/15 text-primary",
  archived: "bg-secondary/40 text-muted-foreground",
}

function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>
      {t(`admin.events.status.${status}`)}
    </span>
  )
}

function fmt(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString()
}

type Confirming = { kind: "archive" | "delete"; event: Event }

export default function Page() {
  const { can } = useRole()
  const writable = can("events.write")

  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [rows, setRows] = useState<Event[]>([])
  const [cursor, setCursor] = useState("")
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const firstPageReq = useRef(0)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const buildFilter = useCallback(
    (cur: string) => ({
      ...(debounced ? { search: debounced } : {}),
      ...(cur ? { cursor: cur } : {}),
      pageSize: PAGE,
    }),
    [debounced],
  )

  // Reset pagination synchronously during render when the filter changes.
  const [appliedFilterKey, setAppliedFilterKey] = useState(debounced)
  if (debounced !== appliedFilterKey) {
    setAppliedFilterKey(debounced)
    setLoading(true); setError(false); setRows([]); setCursor(""); setHasMore(false)
  }

  const reload = useCallback(() => {
    const myReq = ++firstPageReq.current
    setLoading(true); setError(false)
    listEvents(buildFilter(""))
      .then((d) => {
        if (myReq !== firstPageReq.current) return
        setRows(d.Events); setCursor(d.NextCursor); setHasMore(d.HasMore)
      })
      .catch(() => { if (myReq === firstPageReq.current) setError(true) })
      .finally(() => { if (myReq === firstPageReq.current) setLoading(false) })
  }, [buildFilter])

  useEffect(() => {
    let cancelled = false
    const myReq = ++firstPageReq.current
    listEvents(buildFilter(""))
      .then((d) => {
        if (cancelled || myReq !== firstPageReq.current) return
        setRows(d.Events); setCursor(d.NextCursor); setHasMore(d.HasMore)
      })
      .catch(() => { if (!cancelled && myReq === firstPageReq.current) setError(true) })
      .finally(() => { if (!cancelled && myReq === firstPageReq.current) setLoading(false) })
    return () => { cancelled = true }
  }, [buildFilter])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !cursor) return
    setLoadingMore(true)
    listEvents(buildFilter(cursor))
      .then((d) => {
        setRows((prev) => [...prev, ...d.Events])
        setCursor(d.NextCursor); setHasMore(d.HasMore)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [hasMore, loadingMore, cursor, buildFilter])

  const loadMoreRef = useRef(loadMore)
  useEffect(() => { loadMoreRef.current = loadMore })
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current() },
      { rootMargin: "200px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // create → refetch first page; edit → replace the row in place.
  const onCreated = useCallback(() => { reload() }, [reload])
  const onEdited = useCallback((updated: Event) => {
    setRows((prev) => prev.map((r) => (r.ID === updated.ID ? updated : r)))
  }, [])

  function closeConfirm(next: boolean) {
    if (!next) { setConfirming(null); setConfirmError(null) }
  }

  async function runConfirm() {
    if (!confirming) return
    setConfirmBusy(true); setConfirmError(null)
    try {
      if (confirming.kind === "archive") {
        const updated = await archiveEvent(confirming.event.ID)
        setRows((prev) => prev.map((r) => (r.ID === updated.ID ? updated : r)))
      } else {
        await deleteEvent(confirming.event.ID)
        setRows((prev) => prev.filter((r) => r.ID !== confirming.event.ID))
      }
      setConfirming(null)
    } catch (e) {
      setConfirmError(eventErrorMessage(e))
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="frost-panel frost-in rounded-lg p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.events.search")}
          className="max-w-sm"
        />
        {writable && (
          <Button className="ml-auto" onClick={() => setCreateOpen(true)}>{t("admin.events.create.button")}</Button>
        )}
      </div>

      <EventDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={onCreated} />
      <EventDialog
        open={editing !== null}
        event={editing ?? undefined}
        onOpenChange={(v) => { if (!v) setEditing(null) }}
        onSaved={onEdited}
      />

      {error ? (
        <p className="py-8 text-center text-sm text-destructive">{t("admin.events.loadError")}</p>
      ) : loading ? (
        <div className="flex justify-center py-8"><Spinner label={t("admin.loading")} /></div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.events.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("admin.events.col.tag")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.events.col.name")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.events.col.status")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.events.col.window")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.events.col.updated")}</th>
                {writable && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => (
                <tr key={ev.ID} className="border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">{ev.Tag}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{ev.Name || "—"}</span>
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={ev.Status} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(ev.AvailableFrom)} → {fmt(ev.ArchiveAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {ev.UpdatedAt ? new Date(ev.UpdatedAt).toLocaleDateString() : "—"}
                  </td>
                  {writable && (
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(ev)}>
                          {t("admin.events.action.edit")}
                        </Button>
                        {ev.Status !== "archived" && (
                          <Button variant="outline" size="sm" onClick={() => setConfirming({ kind: "archive", event: ev })}>
                            {t("admin.events.action.archive")}
                          </Button>
                        )}
                        <Button variant="destructive" size="sm" onClick={() => setConfirming({ kind: "delete", event: ev })}>
                          {t("admin.events.action.delete")}
                        </Button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div ref={sentinelRef} className="h-6" />
      {loadingMore && <p className="py-2 text-center text-xs text-muted-foreground">{t("admin.events.loadingMore")}</p>}
      {!loading && !hasMore && rows.length > 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">{t("admin.events.endOfList")}</p>
      )}

      <Dialog open={confirming !== null} onOpenChange={closeConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(confirming?.kind === "delete" ? "admin.events.delete.title" : "admin.events.archive.title")}
            </DialogTitle>
            <DialogDescription>
              {t(confirming?.kind === "delete" ? "admin.events.delete.body" : "admin.events.archive.body")}
            </DialogDescription>
          </DialogHeader>
          {confirmError && <p className="text-sm text-destructive">{confirmError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={confirmBusy}>{t("admin.events.dialog.cancel")}</Button>
            </DialogClose>
            <Button
              variant={confirming?.kind === "delete" ? "destructive" : "default"}
              disabled={confirmBusy}
              onClick={runConfirm}
            >
              {t(confirming?.kind === "delete" ? "admin.events.delete.confirm" : "admin.events.archive.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
