"use client"
import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import {
  listEventsPage, archiveEvent, deleteEvent, type Event,
} from "@/api/events/catalog"
import { eventErrorMessage } from "@/lib/eventErrors"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { EventStatusBadge, type DisplayStatus } from "@/components/events/EventStatusBadge"
import { SortTh, TableState, TableWrap, Th, TimeText } from "@/components/common/DsTable"
import { useUrlState } from "@/lib/useUrlState"
import { formatListDateTime } from "@/lib/locale"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { SelectMenu } from "@/components/ui/select-menu"
import { LoadingArea } from "@/components/ui/spinner"
import { TablePagination } from "@/components/ui/table-pagination"
import { EventSiteLink } from "@/components/events/EventSiteLink"
import { FieldHelp } from "@/components/ui/field-help"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { isUnsetEventDate } from "@/lib/eventDates"
import { Archive, Trash2, TriangleAlert } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const STATUS_FILTERS: DisplayStatus[] = ["not_available", "not_published", "published", "started", "finished", "withdrawn", "archived"]

type Confirming = { kind: "archive" | "delete"; event: Event }

function archiveWarning(event: Event | undefined): "moderators" | "public" | null {
  if (!event || event.Status !== "active") return null
  if (event.LifecycleStatus === "not_published" || event.LifecycleStatus === "withdrawn") return "moderators"
  return "public"
}

const DEFAULTS = { q: "", status: "all", page: "1", size: "50", sort: "updated", dir: "desc" }

function EventsList() {
  const { can } = useRole()
  const writable = can("events.write")

  const [query, setQuery] = useUrlState(DEFAULTS)
  const debounced = query.q
  const statusFilter = query.status
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Number(query.size) || 50
  const sortBy = query.sort
  const sortDir: "asc" | "desc" = query.dir === "asc" ? "asc" : "desc"
  const [search, setSearch] = useState(query.q)
  const [rows, setRows] = useState<Event[]>([])
  const [total, setTotal] = useState(0)
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
    const id = setTimeout(() => setQuery({ q: next, page: "1" }), 300)
    return () => clearTimeout(id)
  }, [search, debounced, setQuery])

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
    // The request effect raises `loading` itself; raising it here left it stuck (rows unclickable)
    // whenever nothing changed and so no request followed.
    setQuery({ page: String(next) })
  }

  function sort(field: string) {
    const nextDir = field === sortBy ? sortDir === "asc" ? "desc" : "asc"
      : ["availableFrom", "archiveAt", "updated"].includes(field) ? "desc" : "asc"
    setQuery({ sort: field, dir: nextDir, page: "1" })
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
        setTotal((prev) => Math.max(0, prev - 1))
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

  const filtered = !!(debounced || statusFilter !== "all")
  const firstLoad = loading && rows.length === 0
  const stateKind = error ? "error" : firstLoad ? "loading" : rows.length === 0 ? "empty" : null
  const colCount = writable ? 7 : 6

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title={t("admin.nav.events")} count={firstLoad ? undefined : total}
        actions={writable ? <Button className="h-10 shrink-0 text-sm" asChild><Link href="/events/new">{t("admin.events.create.button")}</Link></Button> : undefined}
        filters={<>
          <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.events.search")} aria-label={t("admin.events.search")}
            className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm" />
          <SelectMenu value={statusFilter} onChange={(value) => setQuery({ status: value, page: "1" })}
            options={[{ value: "all", label: t("admin.events.filterAll") }, ...STATUS_FILTERS.map((value) => ({ value, label: t(`admin.events.lifecycle.${value}`) }))]}
            ariaLabel={t("admin.events.filterStatus")} className="h-10 min-w-44 text-sm" />
        </>} />

      <div ref={tableScrollRef} className="flex min-h-0 flex-1 flex-col overflow-auto" aria-busy={loading}>
        <TableWrap label={t("admin.nav.events")} rows={8} className="min-h-0">
          <table className={`ib-table${loading && !firstLoad ? " is-refreshing" : ""}`} aria-label={t("admin.nav.events")}>
            <thead>
              <tr>
                <SortTh label={t("admin.events.col.name")} field="name" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.nameHelp")} /></SortTh>
                <SortTh label={t("admin.events.col.tag")} field="tag" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.tagHelp")} /></SortTh>
                <SortTh label={t("admin.events.col.status")} field="status" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.statusHelp")} /></SortTh>
                <SortTh label={t("admin.events.col.availableFrom")} field="availableFrom" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.availableFromHelp")} /></SortTh>
                <SortTh label={t("admin.events.col.archiveAt")} field="archiveAt" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.archiveAtHelp")} /></SortTh>
                <SortTh label={t("admin.events.col.updated")} field="updated" activeField={sortBy} direction={sortDir} onSort={sort}><FieldHelp text={t("admin.events.col.updatedHelp")} /></SortTh>
                {writable && <Th className="ib-table__actions"><span className="sr-only">{t("admin.events.col.actions")}</span></Th>}
              </tr>
            </thead>
            {stateKind ? (
              <TableState colSpan={colCount} kind={stateKind}
                message={error ? t("admin.events.loadError") : t(filtered ? "admin.events.empty" : "admin.events.emptyInitial")}
                error={error?.cause} onRetry={() => { setError(null); setLoading(true); setReloadKey((value) => value + 1) }} />
            ) : (
              <tbody className={loading ? "pointer-events-none" : undefined}>
                {rows.map((ev) => (
                  <tr key={ev.ID} className="group">
                    <td>
                      <Link className="ib-table__name hover:underline" href={`/events/detail?id=${encodeURIComponent(ev.ID)}`}>{ev.Name || ev.Tag}</Link>
                    </td>
                    <td><EventSiteLink tag={ev.Tag} /></td>
                    <td><EventStatusBadge event={ev} /></td>
                    <td className="ib-table__dim"><TimeText iso={ev.AvailableFrom}>{formatListDateTime(ev.AvailableFrom)}</TimeText></td>
                    <td className="ib-table__dim">{isUnsetEventDate(ev.ArchiveAt) ? t("admin.events.notScheduled") : <TimeText iso={ev.ArchiveAt}>{formatListDateTime(ev.ArchiveAt)}</TimeText>}</td>
                    <td className="ib-table__dim"><TimeText iso={ev.UpdatedAt}>{formatListDateTime(ev.UpdatedAt)}</TimeText></td>
                    {writable && <td className="ib-table__actions">
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
            )}
          </table>
        </TableWrap>
      </div>
      <TablePagination page={page} pageSize={pageSize} total={total} busy={loading}
        onPage={goToPage} onPageSize={(size) => setQuery({ size: String(size), page: "1" })} />

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

export default function Page() {
  return (
    <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}>
      <EventsList />
    </Suspense>
  )
}
