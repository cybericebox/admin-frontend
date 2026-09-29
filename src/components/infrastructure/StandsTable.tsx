"use client"

import { RotateCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FieldHelp } from "@/components/ui/field-help"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Input } from "@/components/ui/input"
import { LoadError } from "@/components/ui/load-error"
import { SelectMenu } from "@/components/ui/select-menu"
import { LoadingArea } from "@/components/ui/spinner"
import { TablePagination } from "@/components/ui/table-pagination"
import { EventSiteLink } from "@/components/events/EventSiteLink"
import type { Stand, StandEventOption } from "@/api/infrastructure"
import { formatDateTime } from "@/lib/locale"
import { t } from "@/i18n/t"

export const STAND_STATUS_FILTERS = ["active", "creating", "ready", "failed", "removed"] as const

const STATUS_STYLE: Record<string, string> = {
  creating: "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]",
  ready: "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]",
  failed: "bg-[var(--ib-danger-bg)] text-[var(--ib-danger)]",
  removed: "bg-secondary/40 text-muted-foreground",
}

export function StandStatusBadge({ status }: { status: string }) {
  const known = status in STATUS_STYLE
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${known ? STATUS_STYLE[status] : STATUS_STYLE.removed}`}>{t(known ? `admin.labs.stands.status.${status}` : "admin.labs.unknownState")}</span>
}

export function teamLabel(stand: Stand): string {
  return stand.Moderators || !stand.TeamName ? t("admin.labs.moderatorsTeam") : stand.TeamName
}

export type StandsFilters = { eventId: string; status: string; search: string; page: number; pageSize: number }

export function StandsTable({ filters, searchInput, onSearchInput, onFilters, events, items, total, loading, error, errorCause, canWrite, onRetry, onRecreate }: {
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
}) {
  const block = "flex min-h-64 items-center justify-center"
  return <Card>
    <CardHeader><CardTitle className="text-base">{t("admin.labs.stands.title")}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input type="search" value={searchInput} onChange={(event) => onSearchInput(event.target.value)} placeholder={t("admin.labs.stands.search")} aria-label={t("admin.labs.stands.search")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm" />
        <FieldHelp text={t("admin.labs.stands.searchHelp")} />
        <SelectMenu value={filters.eventId || "all"} onChange={(value) => onFilters({ eventId: value === "all" ? "" : value, page: 1 })}
          options={[{ value: "all", label: t("admin.labs.stands.allEvents") }, ...events.map((event) => ({ value: event.ID, label: event.Name || event.Tag }))]}
          ariaLabel={t("admin.labs.stands.filterEvent")} className="h-10 min-w-44 text-sm" />
        <SelectMenu value={filters.status || "all"} onChange={(value) => onFilters({ status: value === "all" ? "" : value, page: 1 })}
          options={[{ value: "all", label: t("admin.labs.stands.allStatuses") }, ...STAND_STATUS_FILTERS.map((value) => ({ value, label: t(`admin.labs.stands.status.${value}`) }))]}
          ariaLabel={t("admin.labs.stands.filterStatus")} className="h-10 min-w-44 text-sm" />
        <FieldHelp text={t("admin.labs.stands.statusHelp")} />
      </div>
      <div className="relative" aria-busy={loading}>
        {error ? <LoadError message={error} error={errorCause} onRetry={onRetry} className={block} />
          : items === null ? <LoadingArea className={block} label={t("admin.loading")} />
          : items.length === 0 ? <EmptyState message={t(filters.eventId || filters.status || filters.search ? "admin.labs.stands.emptyFiltered" : "admin.labs.stands.empty")} className={block} />
          : <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.stands.col.event")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.stands.col.team")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.stands.col.status")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.stands.col.reason")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.stands.col.time")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.stands.col.generation")}</th>
                  {canWrite && <th scope="col" className="w-12 px-3 py-2"><span className="sr-only">{t("admin.labs.stands.col.actions")}</span></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((stand) => <tr key={`${stand.EventID}:${stand.TeamID}`} className="border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2"><span className="block font-medium text-foreground">{stand.EventName || stand.EventTag}</span><EventSiteLink tag={stand.EventTag} path="/manage/labs" tooltip={t("admin.labs.stands.openManage")} /></td>
                  <td className="px-3 py-2">{teamLabel(stand)}</td>
                  <td className="px-3 py-2"><StandStatusBadge status={stand.Status} /></td>
                  <td className="max-w-xs break-words px-3 py-2 text-muted-foreground">{stand.Reason || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(stand.UpdatedAt)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{stand.Generation}</td>
                  {canWrite && <td className="px-3 py-2">
                    {stand.Status !== "removed" && <HoverTooltip text={t("admin.labs.stands.recreate")}>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label={`${t("admin.labs.stands.recreate")}: ${stand.EventName || stand.EventTag}, ${teamLabel(stand)}`} onClick={() => onRecreate(stand)}>
                        <RotateCw aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </HoverTooltip>}
                  </td>}
                </tr>)}
              </tbody>
            </table>
          </div>}
      </div>
      <TablePagination page={filters.page} pageSize={filters.pageSize} total={total} busy={loading}
        onPage={(page) => onFilters({ page })} onPageSize={(pageSize) => onFilters({ pageSize, page: 1 })} />
    </CardContent>
  </Card>
}
