"use client"

import { useEffect, useMemo, useState } from "react"
import { Info, RotateCw } from "lucide-react"
import { bulkRecreateStands, getStandFacets, listStandEvents, listStandsIndex, type Stand, type StandEventOption } from "@/api/infrastructure"
import { EventSiteLink } from "@/components/events/EventSiteLink"
import { ImageWarningIcon, LabQueueIndicator, standQueueLabs } from "@/components/infrastructure/LabIndicators"
import { ResourceCell } from "@/components/infrastructure/ResourceCell"
import { STAND_KIND_FILTERS, STAND_STATUS_FILTERS, StandStatusBadge, teamLabel } from "@/components/infrastructure/labView"
import { IndexTable, TimeText } from "@/components/table/IndexTable"
import { useIndexList, type ColumnDef } from "@/components/table/useIndexList"
import type { FilterDef } from "@/components/table/filters"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "@/components/ui/toast"
import { overloadOr } from "@/i18n/apiError"
import { tPlural } from "@/i18n/plural"
import { t } from "@/i18n/t"
import { formatListDateTime } from "@/lib/locale"
import { standReasonText } from "@/lib/standReason"
import { usePolling } from "@/lib/usePolling"

const IDENTITY = "event"
const BULK_LIMIT = 50
const standId = (stand: Stand) => `${stand.EventID}:${stand.TeamID}`
const standName = (stand: Stand) => `${stand.EventName || stand.EventTag} · ${teamLabel(stand)}`

/** The «Стенди» tab: team stands on the table standard, with «Перестворити» one by one and in bulk. */
export function StandsTab({ canWrite, initialStatus, onDetails }: { canWrite: boolean; initialStatus?: string; onDetails: (stand: Stand) => void }) {
  const [events, setEvents] = useState<StandEventOption[]>([])
  useEffect(() => {
    let active = true
    listStandEvents().then((items) => { if (active) setEvents(items ?? []) }).catch(() => { /* the event filter just has no options */ })
    return () => { active = false }
  }, [])

  const columns = useMemo<ColumnDef<Stand>[]>(() => [
    { key: IDENTITY, label: t("admin.labs.stands.col.event"), sort: "event", width: 260, cell: (s) => <span className="block min-w-0"><span className="ib-table__name block truncate">{s.EventName || s.EventTag}</span><EventSiteLink tag={s.EventTag} path="/manage/labs" tooltip={t("admin.labs.stands.openManage")} /></span> },
    { key: "team", label: t("admin.labs.stands.col.team"), sort: "team", width: 180, cell: (s) => teamLabel(s) },
    { key: "status", label: t("admin.labs.stands.col.status"), sort: "status", width: 200, cell: (s) => <span className="inline-flex flex-wrap items-center gap-1.5"><StandStatusBadge status={s.Status} /><LabQueueIndicator queue={s.Queue} labs={standQueueLabs(s.Queue)} />{s.ImageWarning && <ImageWarningIcon />}</span> },
    { key: "reason", label: t("admin.labs.stands.col.reason"), sort: "reason", dim: true, width: 220, cell: (s) => s.Reason ? standReasonText(s.Reason) : "—" },
    { key: "cpu", label: t("admin.labs.resources.cpu"), sort: "cpu", firstDesc: true, width: 150, cell: (s) => <ResourceCell resources={s.Resources} kind="cpu" /> },
    { key: "memory", label: t("admin.labs.resources.memory"), sort: "memory", firstDesc: true, width: 150, cell: (s) => <ResourceCell resources={s.Resources} kind="memory" /> },
    { key: "updated", label: t("admin.labs.stands.col.time"), sort: "updatedAt", firstDesc: true, dim: true, width: 170, cell: (s) => <TimeText iso={s.UpdatedAt}>{formatListDateTime(s.UpdatedAt)}</TimeText> },
    { key: "generation", label: t("admin.labs.stands.col.generation"), sort: "generation", firstDesc: true, dim: true, width: 120, cell: (s) => s.Generation },
  ], [])

  const defs = useMemo<FilterDef[]>(() => [
    { key: "event", label: t("admin.labs.stands.col.event"), type: "choice", single: true, ops: ["in"], options: events.map((e) => ({ value: e.ID, label: e.Name || e.Tag })) },
    { key: "status", label: t("admin.labs.stands.col.status"), type: "choice", single: true, ops: ["in"], options: STAND_STATUS_FILTERS.map((value) => ({ value, label: t(`admin.labs.stands.status.${value}`) })) },
    { key: "kind", label: t("admin.labs.stands.filterKind"), type: "choice", single: true, ops: ["in"], options: STAND_KIND_FILTERS.map((value) => ({ value, label: t(`admin.labs.stands.kind.${value}`) })) },
  ], [events])

  const list = useIndexList<Stand>({
    table: "admin.labs.stands", columns, identity: IDENTITY, defs, defaultSort: { key: "updatedAt", dir: "desc" },
    fetch: listStandsIndex, rowId: standId, selectable: (s) => s.Status !== "removed", selectLimit: BULK_LIMIT,
  })
  // A link from the dashboard (?status=failed) opens the tab already filtered, unless the address has its own filter.
  useEffect(() => {
    if (initialStatus && !new URLSearchParams(window.location.search).has("f.status")) list.setBag({ status: { op: "in", v: [initialStatus] } })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])
  usePolling(async () => { list.reload() }, true)

  const [target, setTarget] = useState<Stand | null>(null)
  const [bulk, setBulk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const refs = target ? [{ EventID: target.EventID, TeamID: target.TeamID }] : [...list.selected].map((id) => { const [EventID, TeamID] = id.split(":"); return { EventID, TeamID } })
      const results = await bulkRecreateStands(refs)
      const done = results.filter((r) => r.Ok).length
      if (done < refs.length) toast.error(t("admin.labs.stands.bulk.partial", { done, skipped: refs.length - done }))
      else toast.success(target ? t("admin.labs.stands.recreated") : tPlural("admin.labs.stands.bulk.done", done))
      setTarget(null); setBulk(false); list.setSelected(new Set()); list.reload()
    } catch (err) { setError(overloadOr(err, t("admin.labs.stands.bulk.error"))) } finally { setBusy(false) }
  }

  return <div className="ib-index">
    <IndexTable<Stand>
      list={list} columns={columns} identity={IDENTITY} facets={(def) => getStandFacets(def.key, { search: list.request.search, bag: list.bag })} title={t("admin.labs.stands.title")} rowId={standId} rowLabel={standName}
      defs={defs} searchLabel={t("admin.labs.stands.search")} emptyLabel={t("admin.labs.stands.emptyFiltered")} emptyInitialLabel={t("admin.labs.stands.empty")} errorLabel={t("admin.labs.error.stands")}
      actionsLabel={t("admin.labs.stands.col.actions")} actionsWidth={canWrite ? 230 : 64} selectable={(s) => s.Status !== "removed"}
      bulk={canWrite ? <Button type="button" variant="outline" size="sm" onClick={() => { setError(null); setBulk(true) }}><RotateCw aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />{t("admin.labs.stands.recreate")}</Button> : undefined}
      rowActions={(s) => <span className="flex items-center justify-end gap-1">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("admin.labs.actionOnPair", { action: t("admin.labs.detail.open"), name: s.EventName || s.EventTag, who: teamLabel(s) })} onClick={() => onDetails(s)}><Info aria-hidden="true" className="h-4 w-4" /></Button>
        {canWrite && s.Status !== "removed" && <Button type="button" variant="outline" size="sm" className="min-w-max" onClick={() => { setError(null); setTarget(s) }}><RotateCw aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />{t("admin.labs.stands.recreate")}</Button>}
      </span>}
    />
    <ConfirmDialog open={target !== null || bulk} onCancel={() => { if (!busy) { setTarget(null); setBulk(false) } }} tone="danger" busy={busy} busyLabel={t("busy.recreating")} error={error}
      title={target ? t("admin.labs.stands.recreate.title") : tPlural("admin.labs.stands.bulk.title", list.selected.size)}
      description={target ? t("admin.labs.stands.recreate.body", { event: target.EventName || target.EventTag, team: teamLabel(target) }) : t("admin.labs.stands.bulk.body")}
      confirmLabel={t("admin.labs.stands.recreate.confirm")} onConfirm={() => void run()} />
  </div>
}
