"use client"
import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Archive, LayoutDashboard, Trash2, TriangleAlert } from "lucide-react"
import { t } from "@/i18n/t"
import { tPlural } from "@/i18n/plural"
import { overloadOr } from "@/i18n/apiError"
import { useRole } from "@/lib/useRole"
import {
  archiveEvent, bulkArchiveEvents, deleteEvent, getEventFacets, listEventOrganizers, listEventsIndex, type EventOrganizer, type EventRow,
} from "@/api/events/catalog"
import { eventErrorMessage } from "@/lib/eventErrors"
import { EventStatusBadge, type DisplayStatus } from "@/components/events/EventStatusBadge"
import { EventSiteLink } from "@/components/events/EventSiteLink"
import { useEventSiteAddress } from "@/lib/eventSite"
import { IndexTable, TimeText } from "@/components/table/IndexTable"
import { useIndexList, type ColumnDef } from "@/components/table/useIndexList"
import type { FacetSource } from "@/components/table/FilterBar"
import type { FilterDef } from "@/components/table/filters"
import { formatListDateTime } from "@/lib/locale"
import { isUnsetEventDate } from "@/lib/eventDates"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { LoadingArea } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const STATUS_FILTERS: DisplayStatus[] = ["not_available", "not_published", "published", "started", "finished", "withdrawn", "archived"]
const IDENTITY = "name"
const BULK_LIMIT = 200

type Confirming = { kind: "archive" | "delete"; event: EventRow }

function archiveWarning(event: EventRow | undefined): "moderators" | "public" | null {
  if (!event || event.Status !== "active") return null
  if (event.LifecycleStatus === "not_published" || event.LifecycleStatus === "withdrawn") return "moderators"
  return "public"
}

const eventName = (event: EventRow) => event.Name || event.Tag
const standsText = (event: EventRow) => event.StandsTotal === undefined || event.StandsTotal === null ? "—" : `${event.StandsReady ?? 0} / ${event.StandsTotal}`
const count = (value: number | undefined | null) => value === undefined || value === null ? "—" : String(value)

/** The «Панель заходу» (event /manage) of a row: visible, not hover-only. */
function PanelLink({ tag }: { tag: string }) {
  const { address } = useEventSiteAddress(tag, "/manage")
  if (!address) return null
  return <HoverTooltip text={t("admin.events.action.panel")}>
    <Button asChild type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
      <a href={address} target="_blank" rel="noopener noreferrer" aria-label={`${t("admin.events.action.panel")}: ${tag}`}><LayoutDashboard aria-hidden="true" className="h-4 w-4" /></a>
    </Button>
  </HoverTooltip>
}

function EventsList() {
  const { can } = useRole()
  const writable = can("events.write")
  const [organizers, setOrganizers] = useState<EventOrganizer[]>([])
  useEffect(() => {
    let active = true
    listEventOrganizers().then((items) => { if (active) setOrganizers(items) }).catch(() => { /* the organizer filter just has no options */ })
    return () => { active = false }
  }, [])

  const columns = useMemo<ColumnDef<EventRow>[]>(() => [
    { key: IDENTITY, label: t("admin.events.col.name"), sort: "name", width: 280, cell: (ev) => <Link className="ib-table__name block min-w-0 truncate hover:underline" title={eventName(ev)} href={`/events/detail?id=${encodeURIComponent(ev.ID)}`}>{eventName(ev)}</Link> },
    { key: "tag", label: t("admin.events.col.tag"), sort: "tag", width: 260, cell: (ev) => <EventSiteLink tag={ev.Tag} /> },
    { key: "status", label: t("admin.events.col.status"), sort: "status", width: 170, cell: (ev) => <EventStatusBadge event={ev} /> },
    { key: "availableFrom", label: t("admin.events.col.availableFrom"), sort: "availableFrom", firstDesc: true, dim: true, width: 170, cell: (ev) => <TimeText iso={ev.AvailableFrom}>{formatListDateTime(ev.AvailableFrom)}</TimeText> },
    { key: "archiveAt", label: t("admin.events.col.archiveAt"), sort: "archiveAt", firstDesc: true, dim: true, width: 170, cell: (ev) => isUnsetEventDate(ev.ArchiveAt) ? t("admin.events.notScheduled") : <TimeText iso={ev.ArchiveAt}>{formatListDateTime(ev.ArchiveAt)}</TimeText> },
    { key: "participants", label: t("admin.events.col.participants"), sort: "participants", firstDesc: true, width: 130, cell: (ev) => count(ev.ParticipantsCount) },
    { key: "teams", label: t("admin.events.col.teams"), sort: "teams", firstDesc: true, width: 110, cell: (ev) => count(ev.TeamsCount) },
    { key: "stands", label: t("admin.events.col.stands"), sort: "stands", firstDesc: true, width: 130, cell: (ev) => standsText(ev) },
    { key: "updated", label: t("admin.events.col.updated"), sort: "updated", firstDesc: true, dim: true, width: 170, cell: (ev) => <TimeText iso={ev.UpdatedAt}>{formatListDateTime(ev.UpdatedAt)}</TimeText> },
  ], [])

  const defs = useMemo<FilterDef[]>(() => [
    { key: "status", label: t("admin.events.col.status"), type: "choice", ops: ["in"], options: STATUS_FILTERS.map((value) => ({ value, label: t(`admin.events.lifecycle.${value}`) })) },
    { key: "period", label: t("admin.events.filterPeriod"), type: "date" },
    { key: "organizer", label: t("admin.events.filterOrganizer"), type: "choice", ops: ["in"], options: organizers.map((o) => ({ value: o.UserID, label: o.Name || o.Email })) },
    { key: "infrastructure", label: t("admin.events.filterInfrastructure"), type: "boolean", ops: ["is"] },
  ], [organizers])

  const list = useIndexList<EventRow>({
    table: "admin.events", columns, identity: IDENTITY, defs, defaultSort: { key: "updated", dir: "desc" },
    fetch: listEventsIndex, rowId: (ev) => ev.ID, selectable: (ev) => ev.Status !== "archived", selectLimit: BULK_LIMIT,
  })
  const facets: FacetSource = (def, others) => getEventFacets(def.key, list.request.search, others)

  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [bulkArchive, setBulkArchive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  function closeConfirm() { if (!busy) { setConfirming(null); setBulkArchive(false); setConfirmError(null) } }

  async function runConfirm() {
    if (!confirming) return
    setBusy(true)
    setConfirmError(null)
    try {
      if (confirming.kind === "archive") await archiveEvent(confirming.event.ID)
      else await deleteEvent(confirming.event.ID)
      toast.success(t(confirming.kind === "archive" ? "admin.events.archived" : "admin.events.deleted"))
      setConfirming(null)
      list.reload()
    } catch (e) {
      setConfirmError(eventErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function runBulkArchive() {
    setBusy(true)
    setConfirmError(null)
    try {
      const ids = [...list.selected]
      const results = await bulkArchiveEvents(ids)
      const done = results.filter((r) => r.Ok).length
      const skipped = ids.length - done
      if (skipped > 0) toast.error(t("admin.events.bulk.partial", { done, skipped }))
      else toast.success(tPlural("admin.events.bulk.done", done))
      setBulkArchive(false)
      list.setSelected(new Set())
      list.reload()
    } catch (err) {
      setConfirmError(overloadOr(err, t("admin.events.bulk.error")))
    } finally {
      setBusy(false)
    }
  }

  const earlyArchiveWarning = confirming?.kind === "archive" ? archiveWarning(confirming.event) : null

  return (
    <div className="ib-index">
      <IndexTable<EventRow>
        list={list} columns={columns} identity={IDENTITY} title={t("admin.nav.events")} rowId={(ev) => ev.ID} rowLabel={eventName}
        defs={defs} facets={facets} searchLabel={t("admin.events.search")}
        emptyLabel={t("admin.events.empty")} emptyInitialLabel={t("admin.events.emptyInitial")} errorLabel={t("admin.events.loadError")}
        actions={writable ? <Button className="h-10 shrink-0 text-sm" asChild><Link href="/events/new">{t("admin.events.create.button")}</Link></Button> : undefined}
        actionsLabel={t("admin.events.col.actions")} actionsWidth={writable ? 150 : 56}
        selectable={(ev) => ev.Status !== "archived"}
        bulk={writable ? <Button type="button" variant="outline" size="sm" onClick={() => { setConfirmError(null); setBulkArchive(true) }}>{t("admin.events.bulk.archive")}</Button> : undefined}
        rowActions={(ev) => <span className="flex justify-end gap-1">
          <PanelLink tag={ev.Tag} />
          {writable && ev.Status !== "archived" && (
            <HoverTooltip text={t("admin.events.action.archive")}>
              <Button type="button" variant="ghost" size="icon" aria-label={`${t("admin.events.action.archive")}: ${eventName(ev)}`} className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setConfirmError(null); setConfirming({ kind: "archive", event: ev }) }}>
                <Archive aria-hidden="true" className="h-4 w-4" />
              </Button>
            </HoverTooltip>
          )}
          {writable && (
            <HoverTooltip text={t("admin.events.action.delete")}>
              <Button type="button" variant="ghost" size="icon" aria-label={`${t("admin.events.action.delete")}: ${eventName(ev)}`} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setConfirmError(null); setConfirming({ kind: "delete", event: ev }) }}>
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </Button>
            </HoverTooltip>
          )}
        </span>}
      />

      <ConfirmDialog open={confirming !== null} onCancel={closeConfirm} tone="danger" busy={busy} busyLabel={t(confirming?.kind === "delete" ? "busy.deleting" : "busy.archiving")} error={confirmError}
        title={t(confirming?.kind === "delete" ? "admin.events.delete.title" : "admin.events.archive.title", { name: confirming ? eventName(confirming.event) : "" })}
        description={t(confirming?.kind === "delete" ? "admin.events.delete.body" : "admin.events.archive.body")}
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

      <ConfirmDialog open={bulkArchive} onCancel={closeConfirm} tone="danger" busy={busy} busyLabel={t("busy.archiving")} error={confirmError}
        title={tPlural("admin.events.bulk.archive.title", list.selected.size)} description={t("admin.events.bulk.archive.body")}
        confirmLabel={t("admin.events.archive.confirm")} onConfirm={() => void runBulkArchive()} />
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
