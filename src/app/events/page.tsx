"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import {
  listEventsPage, archiveEvent, deleteEvent, type Event, type EventLifecycleStatus,
} from "@/api/events/catalog"
import { eventErrorMessage } from "@/lib/eventErrors"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { SelectMenu } from "@/components/ui/select-menu"
import { LoadingArea } from "@/components/ui/spinner"
import { TablePagination } from "@/components/ui/table-pagination"
import { SortableHeader } from "@/components/ui/sortable-header"
import { EventSiteLink } from "@/components/events/EventSiteLink"
import { FieldHelp } from "@/components/ui/field-help"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { isUnsetEventDate } from "@/lib/eventDates"
import { Archive, Trash2, TriangleAlert } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

type DisplayStatus = EventLifecycleStatus | "not_available" | "archived"
const STATUS_FILTERS: DisplayStatus[] = ["not_available", "not_published", "published", "started", "finished", "withdrawn", "archived"]

const STATUS_STYLE: Record<DisplayStatus, string> = {
  not_available: "bg-secondary/40 text-muted-foreground",
  not_published: "bg-secondary/40 text-muted-foreground",
  published: "bg-primary/15 text-primary",
  started: "bg-primary/15 text-primary",
  finished: "bg-secondary/40 text-muted-foreground",
  withdrawn: "bg-secondary/40 text-muted-foreground",
  archived: "bg-secondary/40 text-muted-foreground",
}

function StatusBadge({ event }: { event: Event }) {
  const status: DisplayStatus = event.Status === "archived" ? "archived" : event.Status === "pending" ? "not_available" : event.LifecycleStatus ?? "not_published"
  return (
    <HoverTooltip text={t(`admin.events.lifecycle.help.${status}`)}>
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`} tabIndex={0} aria-label={`${t(`admin.events.lifecycle.${status}`)}: ${t(`admin.events.lifecycle.help.${status}`)}`}>{t(`admin.events.lifecycle.${status}`)}</span>
    </HoverTooltip>
  )
}

function fmt(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("uk-UA", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

type Confirming = { kind: "archive" | "delete"; event: Event }

function archiveWarning(event: Event | undefined): "moderators" | "public" | null {
  if (!event || event.Status !== "active") return null
  if (event.LifecycleStatus === "not_published" || event.LifecycleStatus === "withdrawn") return "moderators"
  return "public"
}

export default function Page() {
  const { can } = useRole()
  const writable = can("events.write")

  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [rows, setRows] = useState<Event[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState("updated")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const tableScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const next = search.trim()
    // An unchanged query must not reset the page the user already moved to.
    if (next === debounced) return
    const id = setTimeout(() => { setDebounced(next); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [search, debounced])

  const filter = { search: debounced, status: statusFilter === "all" ? "" : statusFilter, page, pageSize, sortBy, sortDir }

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setLoading(true); setError(null) } })
    listEventsPage(filter)
      .then((d) => {
        if (!active) return
        setRows(d.Items); setTotal(d.Total ?? 0)
      })
      .catch((cause) => { if (active) setError({ cause }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  // The primitive filter fields, rather than a new object identity, own this request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, statusFilter, page, pageSize, sortBy, sortDir, reloadKey])

  function goToPage(next: number) {
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0
    setLoading(true)
    setPage(next)
  }

  function sort(field: string) {
    const nextDir = field === sortBy ? sortDir === "asc" ? "desc" : "asc"
      : ["availableFrom", "archiveAt", "updated"].includes(field) ? "desc" : "asc"
    setSortBy(field)
    setSortDir(nextDir)
    goToPage(1)
  }


  function closeConfirm() {
    if (!confirmBusy) { setConfirming(null); setConfirmError(null) }
  }

  async function runConfirm() {
    if (!confirming) return
    setConfirmBusy(true)
    setConfirmError(null)
    try {
      if (confirming.kind === "archive") {
        const updated = await archiveEvent(confirming.event.ID)
        setRows((prev) => prev.map((r) => (r.ID === updated.ID ? updated : r)))
        toast.success(t("admin.events.archived"))
      } else {
        await deleteEvent(confirming.event.ID)
        setRows((prev) => prev.filter((r) => r.ID !== confirming.event.ID))
        toast.success(t("admin.events.deleted"))
      }
      setConfirming(null)
    } catch (e) {
      setConfirmError(eventErrorMessage(e))
    } finally {
      setConfirmBusy(false)
    }
  }

  const earlyArchiveWarning = confirming?.kind === "archive" ? archiveWarning(confirming.event) : null

  return (
    <div className="frost-panel frost-in flex h-full min-h-0 flex-col overflow-hidden rounded-lg p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder={t("admin.events.search")} aria-label={t("admin.events.search")}
          className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm" />
        <SelectMenu value={statusFilter} onChange={(value) => { setStatusFilter(value); goToPage(1) }}
          options={[{ value: "all", label: t("admin.events.filterAll") }, ...STATUS_FILTERS.map((value) => ({ value, label: t(`admin.events.lifecycle.${value}`) }))]}
          ariaLabel={t("admin.events.filterStatus")} className="h-10 min-w-44 text-sm" />
        {writable && (
          <Button className="ml-auto h-10 shrink-0 text-sm" asChild><Link href="/events/new">{t("admin.events.create.button")}</Link></Button>
        )}
      </div>

      <div ref={tableScrollRef} className="relative min-h-0 flex-1 overflow-auto" aria-busy={loading}>
      {error ? (
        <LoadError message={t("admin.events.loadError")} error={error.cause} onRetry={() => { setError(null); setLoading(true); setReloadKey((value) => value + 1) }} className="h-full" />
      ) : loading && rows.length === 0 ? (
        <LoadingArea className="h-full" label={t("admin.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState message={t(debounced || statusFilter !== "all" ? "admin.events.empty" : "admin.events.emptyInitial")} className="h-full" />
      ) : (
        <div className={loading ? "pointer-events-none" : undefined}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <SortableHeader label={t("admin.events.col.name")} field="name" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.nameHelp")} /></SortableHeader>
                <SortableHeader label={t("admin.events.col.tag")} field="tag" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.tagHelp")} /></SortableHeader>
                <SortableHeader label={t("admin.events.col.status")} field="status" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.statusHelp")} /></SortableHeader>
                <SortableHeader label={t("admin.events.col.availableFrom")} field="availableFrom" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.availableFromHelp")} /></SortableHeader>
                <SortableHeader label={t("admin.events.col.archiveAt")} field="archiveAt" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.archiveAtHelp")} /></SortableHeader>
                <SortableHeader label={t("admin.events.col.updated")} field="updated" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.updatedHelp")} /></SortableHeader>
                {writable && <th scope="col" className="sticky top-0 z-10 w-24 bg-card px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => (
                <tr key={ev.ID} className="group border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2">
                    <Link className="font-medium text-primary hover:underline" href={`/events/detail?id=${encodeURIComponent(ev.ID)}`}>{ev.Name || ev.Tag}</Link>
                  </td>
                  <td className="px-3 py-2"><EventSiteLink tag={ev.Tag} /></td>
                  <td className="px-3 py-2"><StatusBadge event={ev} /></td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmt(ev.AvailableFrom)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{isUnsetEventDate(ev.ArchiveAt) ? t("admin.events.notScheduled") : fmt(ev.ArchiveAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {ev.UpdatedAt ? new Date(ev.UpdatedAt).toLocaleString("uk-UA", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                  </td>
                  {writable && <td className="w-24 px-3 py-2">
                    <span className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none">
                        {ev.Status !== "archived" && (
                          <HoverTooltip text={t("admin.events.action.archive")}>
                            <Button type="button" variant="ghost" size="icon" aria-label={t("admin.events.action.archive")}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => setConfirming({ kind: "archive", event: ev })}>
                              <Archive aria-hidden="true" className="h-4 w-4" />
                            </Button>
                          </HoverTooltip>
                        )}
                        <HoverTooltip text={t("admin.events.action.delete")}>
                          <Button type="button" variant="ghost" size="icon" aria-label={t("admin.events.action.delete")}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setConfirming({ kind: "delete", event: ev })}>
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </Button>
                        </HoverTooltip>
                    </span>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
      <TablePagination page={page} pageSize={pageSize} total={total} busy={loading}
        onPage={goToPage} onPageSize={(size) => { setPageSize(size); goToPage(1) }} />

      <ConfirmDialog open={confirming !== null} onCancel={closeConfirm} tone="danger" busy={confirmBusy} error={confirmError}
        title={t(confirming?.kind === "delete" ? "admin.events.delete.title" : "admin.events.archive.title")}
        description={t(confirming?.kind === "delete" ? "admin.events.delete.body" : "admin.events.archive.body")}
        cancelLabel={t("admin.events.dialog.cancel")}
        confirmLabel={t(confirming?.kind === "delete" ? "admin.events.delete.confirm" : "admin.events.archive.confirm")}
        onConfirm={() => void runConfirm()}>
        {earlyArchiveWarning && (
          <Alert variant={earlyArchiveWarning === "public" ? "destructive" : "warning"}>
            <TriangleAlert aria-hidden="true" className="h-4 w-4" />
            <div>
              <AlertTitle>{t(`admin.events.archive.${earlyArchiveWarning}Title`)}</AlertTitle>
              <AlertDescription>{t(`admin.events.archive.${earlyArchiveWarning}Body`)}</AlertDescription>
            </div>
          </Alert>
        )}
      </ConfirmDialog>
    </div>
  )
}
