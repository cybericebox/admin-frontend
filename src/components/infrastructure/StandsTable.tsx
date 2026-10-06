"use client"

import { Info, RotateCw } from "lucide-react"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { TableState, TableWrap, Th, TimeText } from "@/components/common/DsTable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FieldHelp } from "@/components/ui/field-help"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Input } from "@/components/ui/input"
import { SelectMenu } from "@/components/ui/select-menu"
import { TablePagination } from "@/components/ui/table-pagination"
import { ResourceCell } from "@/components/infrastructure/ResourceCell"
import { ImageWarningIcon, QueueBadge } from "@/components/infrastructure/LabIndicators"
import { EventSiteLink } from "@/components/events/EventSiteLink"
import type { Stand, StandEventOption } from "@/api/infrastructure"
import { formatListDateTime } from "@/lib/locale"
import { t } from "@/i18n/t"

export const STAND_STATUS_FILTERS = ["active", "creating", "ready", "failed", "removed"] as const

const STATUS_TONE: Record<string, BadgeTone> = { creating: "warn", ready: "ok", failed: "danger", removed: "neutral" }

export function StandStatusBadge({ status }: { status: string }) {
  const known = status in STATUS_TONE
  return <Badge size="sm" tone={known ? STATUS_TONE[status] : "neutral"}>{t(known ? `admin.labs.stands.status.${status}` : "admin.labs.unknownState")}</Badge>
}

export function teamLabel(stand: Stand): string {
  return stand.Moderators || !stand.TeamName ? t("admin.labs.moderatorsTeam") : stand.TeamName
}

export const STAND_KIND_FILTERS = ["event", "moderators"] as const

export type StandsFilters = { eventId: string; status: string; kind: string; search: string; page: number; pageSize: number }

export function StandsTable({ filters, searchInput, onSearchInput, onFilters, events, items, total, loading, error, errorCause, canWrite, onRetry, onRecreate, onDetails }: {
  filters: StandsFilters
  searchInput: string
  onSearchInput: (value: string) => void
  onFilters: (patch: Partial<StandsFilters>) => void
  events: StandEventOption[]
  items: Stand[] | null
  total: number
  loading: boolean
  error: string
  errorCause?: unknown
  canWrite: boolean
  onRetry: () => void
  onRecreate: (stand: Stand) => void
  onDetails: (stand: Stand) => void
}) {
  const label = t("admin.labs.stands.title")
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-1.5 text-base">{t("admin.labs.stands.title")}<FieldHelp text={t("admin.labs.stands.titleHelp")} /></CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input type="search" value={searchInput} onChange={(event) => onSearchInput(event.target.value)} placeholder={t("admin.labs.stands.search")} aria-label={t("admin.labs.stands.search")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm" />
        <FieldHelp text={t("admin.labs.stands.searchHelp")} />
        <SelectMenu value={filters.eventId || "all"} onChange={(value) => onFilters({ eventId: value === "all" ? "" : value, page: 1 })}
          options={[{ value: "all", label: t("admin.labs.stands.allEvents") }, ...events.map((event) => ({ value: event.ID, label: event.Name || event.Tag }))]}
          ariaLabel={t("admin.labs.stands.filterEvent")} className="h-10 min-w-44 text-sm" />
        <SelectMenu value={filters.kind || "all"} onChange={(value) => onFilters({ kind: value === "all" ? "" : value, page: 1 })}
          options={[{ value: "all", label: t("admin.labs.stands.allKinds") }, ...STAND_KIND_FILTERS.map((value) => ({ value, label: t(`admin.labs.stands.kind.${value}`) }))]}
          ariaLabel={t("admin.labs.stands.filterKind")} className="h-10 min-w-44 text-sm" />
        <FieldHelp text={t("admin.labs.stands.kindHelp")} />
        <SelectMenu value={filters.status || "all"} onChange={(value) => onFilters({ status: value === "all" ? "" : value, page: 1 })}
          options={[{ value: "all", label: t("admin.labs.stands.allStatuses") }, ...STAND_STATUS_FILTERS.map((value) => ({ value, label: t(`admin.labs.stands.status.${value}`) }))]}
          ariaLabel={t("admin.labs.stands.filterStatus")} className="h-10 min-w-44 text-sm" />
        <FieldHelp text={t("admin.labs.stands.statusHelp")} />
      </div>
      <TableWrap label={label} rows={7}>
        <table aria-label={label} aria-busy={loading} className="ib-table">
          <thead>
            <tr>
              <Th>{t("admin.labs.stands.col.event")}</Th>
              <Th>{t("admin.labs.stands.col.team")}</Th>
              <Th>{t("admin.labs.stands.col.status")}</Th>
              <Th><span className="inline-flex items-center gap-1.5">{t("admin.labs.stands.col.reason")}<FieldHelp text={t("admin.labs.stands.col.reasonHelp")} /></span></Th>
              <Th>{t("admin.labs.resources.cpu")}</Th>
              <Th>{t("admin.labs.resources.memory")}</Th>
              <Th>{t("admin.labs.stands.col.time")}</Th>
              <Th num><span className="inline-flex items-center gap-1.5">{t("admin.labs.stands.col.generation")}<FieldHelp text={t("admin.labs.stands.col.generationHelp")} /></span></Th>
              <Th className="ib-table__actions"><span className="sr-only">{t("admin.labs.stands.col.actions")}</span></Th>
            </tr>
          </thead>
          {error ? <TableState colSpan={9} kind="error" message={error} error={errorCause} onRetry={onRetry} />
            : items === null ? <TableState colSpan={9} kind="loading" />
            : items.length === 0 ? <TableState colSpan={9} kind="empty" message={t(filters.eventId || filters.status || filters.kind || filters.search ? "admin.labs.stands.emptyFiltered" : "admin.labs.stands.empty")} />
            : <tbody>
              {items.map((stand) => <tr key={`${stand.EventID}:${stand.TeamID}`}>
                <td><span className="ib-table__name block">{stand.EventName || stand.EventTag}</span><EventSiteLink tag={stand.EventTag} path="/manage/labs" tooltip={t("admin.labs.stands.openManage")} /></td>
                <td>{teamLabel(stand)}</td>
                <td><span className="inline-flex flex-wrap items-center gap-1.5"><StandStatusBadge status={stand.Status} />{stand.Queue && <QueueBadge position={stand.Queue.Position} length={stand.Queue.Length} reason={stand.Queue.Reason} labs={stand.Queue.QueuedLabs} />}{stand.ImageWarning && <ImageWarningIcon />}</span></td>
                <td className="ib-table__dim">{stand.Reason || "—"}</td>
                <td><ResourceCell resources={stand.Resources} kind="cpu" /></td>
                <td><ResourceCell resources={stand.Resources} kind="memory" /></td>
                <td className="ib-table__dim"><TimeText iso={stand.UpdatedAt}>{formatListDateTime(stand.UpdatedAt)}</TimeText></td>
                <td className="ib-table__num ib-table__dim">{stand.Generation}</td>
                <td className="ib-table__actions"><span className="inline-flex items-center gap-1">
                  <HoverTooltip text={t("admin.labs.detail.open")}>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("admin.labs.actionOnPair", { action: t("admin.labs.detail.open"), name: stand.EventName || stand.EventTag, who: teamLabel(stand) })} onClick={() => onDetails(stand)}>
                      <Info aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </HoverTooltip>
                  {canWrite && stand.Status !== "removed" && <HoverTooltip text={t("admin.labs.stands.recreate")}>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[var(--ib-danger)] hover:bg-[var(--ib-danger-bg)] hover:text-[var(--ib-danger)]" aria-label={t("admin.labs.actionOnPair", { action: t("admin.labs.stands.recreate"), name: stand.EventName || stand.EventTag, who: teamLabel(stand) })} onClick={() => onRecreate(stand)}>
                      <RotateCw aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </HoverTooltip>}
                </span></td>
              </tr>)}
            </tbody>}
        </table>
      </TableWrap>
      <TablePagination page={filters.page} pageSize={filters.pageSize} total={total} busy={loading}
        onPage={(page) => onFilters({ page })} onPageSize={(pageSize) => onFilters({ pageSize, page: 1 })} />
    </CardContent>
  </Card>
}
