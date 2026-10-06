"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Pencil, RefreshCw, X } from "lucide-react"
import { getTimeline, type Reservation } from "@/api/resourceCalendar"
import { AnalyticsChart } from "@/components/analytics/AnalyticsChart"
import type { ChartTheme } from "@/components/analytics/chartTheme"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { SelectMenu } from "@/components/ui/select-menu"
import { t } from "@/i18n/t"
import { formatBytes, formatCpu } from "@/lib/infrastructureMonitoring"
import { formatDateTime } from "@/lib/locale"
import { attentionIDs, buildMaintenanceTracks, buildTimelineModel, rangeFrom, type Bar, type MaintenanceBand, type Resource } from "@/lib/resourceCalendar"
import { RefreshIndicator } from "@/components/infrastructure/RefreshIndicator"
import { TableState, TableWrap } from "@/components/common/DsTable"
import { Badge, BLOCK, Th, formatAmount, formatWindow, useCalendarResource } from "./resourceView"
import { timelineOption } from "./timelineOption"

const DAY_OPTIONS = [1, 3, 7, 14, 31]
const startOfToday = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()) }

// Legend swatches use the same tokens as the chart (series colours, --ib-warn, --ib-danger), so both themes match.
type Swatch = { label: string; color: string; dashed?: boolean; fill?: number }

function Legend({ items }: { items: Swatch[] }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--ib-fs-13)] text-muted-foreground" aria-label={t("admin.resources.timeline.legend")}>
    {items.map((item) => <li key={item.label} className="flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-3 w-4 rounded-sm border" style={{ borderColor: item.color, borderStyle: item.dashed ? "dashed" : "solid", background: `color-mix(in srgb, ${item.color} ${item.fill ?? 40}%, transparent)` }} />{item.label}
    </li>)}
  </ul>
}

/** Hatched amber band: «the agent gives the platform no capacity here». */
const MAINTENANCE_BAND = "block h-full w-full rounded-sm border border-[var(--ib-warn)] bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--ib-warn)_35%,transparent)_0_4px,color-mix(in_srgb,var(--ib-warn)_8%,transparent)_4px_8px)] focus-visible:outline-2 focus-visible:outline-[var(--ib-action)]"

function maintenanceText(band: MaintenanceBand) {
  const { window } = band
  const from = formatDateTime(window.From, { dateStyle: "short", timeStyle: "short" })
  const to = window.To ? formatDateTime(window.To, { dateStyle: "short", timeStyle: "short" }) : t("admin.resources.timeline.maintenanceNoEnd")
  const hasLeft = window.Left.CPUMillicores > 0 || window.Left.MemoryBytes > 0
  return [window.Name, window.Reason, `${from} – ${to}`, hasLeft ? t("admin.resources.timeline.maintenanceLeft", { amount: formatAmount(window.Left) }) : ""].filter(Boolean).join("\n")
}

export type TimelineTabProps = {
  canWrite: boolean
  onEdit: (target: { eventID: string; name: string }) => void
  onReplan: (reservation: Reservation) => void
  onCancel: (target: { eventID: string; name: string }) => void
  /** Bumped by the page after a save, so the chart reloads. */
  version: number
}

export function TimelineTab({ canWrite, onEdit, onReplan, onCancel, version }: TimelineTabProps) {
  const [start, setStart] = useState(startOfToday)
  const [days, setDays] = useState(7)
  const range = useMemo(() => rangeFrom(start, days), [start, days])
  const { data, error, updatedAt, refreshing, refresh } = useCalendarResource(() => getTimeline(range.from, range.to), true, `${range.from}|${range.to}|${version}`)

  const cpu = useMemo(() => (data ? buildTimelineModel(data, "cpu") : null), [data])
  const memory = useMemo(() => (data ? buildTimelineModel(data, "memory") : null), [data])
  const tracks = useMemo(() => (data ? buildMaintenanceTracks(data) : []), [data])
  const attention = useMemo(() => (data ? attentionIDs(data) : new Set<string>()), [data])
  const shift = (direction: -1 | 1) => setStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + direction * days))

  const empty = data !== null && (data.Reservations ?? []).length === 0 && (cpu?.pool ?? 0) === 0 && cpu?.capacity === null
  const charts: { resource: Resource; model: typeof cpu }[] = [{ resource: "cpu", model: cpu }, { resource: "memory", model: memory }]

  function chartOption(resource: Resource, model: NonNullable<typeof cpu>) {
    const format = (value: number) => (resource === "cpu" ? formatCpu(value) : formatBytes(value))
    return (theme: ChartTheme) => timelineOption(model, resource, theme, {
      capacity: t("admin.resources.timeline.capacity"), pool: t("admin.resources.timeline.pool"), conflict: t("admin.resources.timeline.conflict"), format,
      tooltip: (bar: Bar) => `${bar.label}<br/>${formatWindow(new Date(bar.from).toISOString(), new Date(bar.to).toISOString())}<br/>${format(bar.size)}${bar.covered ? "" : `<br/>${t("admin.resources.uncovered")}`}`,
    })
  }

  function openBar(bar: Bar) {
    if (bar.kind === "event" && bar.eventID) onEdit({ eventID: bar.eventID, name: bar.label })
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" size="icon" aria-label={t("admin.resources.timeline.prev")} onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
      <Button type="button" variant="outline" onClick={() => setStart(startOfToday())}>{t("admin.resources.timeline.today")}</Button>
      <Button type="button" variant="outline" size="icon" aria-label={t("admin.resources.timeline.next")} onClick={() => shift(1)}><ChevronRight className="h-4 w-4" aria-hidden /></Button>
      <SelectMenu value={String(days)} onChange={(value) => setDays(Number(value))} ariaLabel={t("admin.resources.timeline.range")} className="min-w-36 text-sm"
        options={DAY_OPTIONS.map((value) => ({ value: String(value), label: t("admin.resources.timeline.days", { count: value }) }))} />
      <span className="text-sm text-muted-foreground tabular-nums">{formatWindow(range.from, range.to)}</span>
      <span className="ml-auto flex items-center gap-2">
        <RefreshIndicator updatedAt={updatedAt} refreshing={refreshing} />
        <Button type="button" variant="ghost" size="icon" aria-label={t("admin.resources.refresh")} onClick={() => void refresh(true)}><RefreshCw className="h-4 w-4" aria-hidden /></Button>
      </span>
    </div>

    {error && data === null ? <LoadError className={BLOCK} message={t("admin.resources.timeline.loadError")} error={error} onRetry={() => void refresh(true)} />
      : data === null ? <LoadingArea className={BLOCK} label={t("admin.loading")} />
      : empty ? <EmptyState className={BLOCK} message={t("admin.resources.timeline.empty")} />
      : <>
        <Legend items={[
          { label: t("admin.resources.timeline.kindEvent"), color: "var(--ib-s1)" },
          { label: t("admin.resources.timeline.kindBooking"), color: "var(--ib-s3)" },
          { label: t("admin.resources.uncovered"), color: "var(--ib-warn)", dashed: true, fill: 25 },
          { label: t("admin.resources.timeline.pool"), color: "var(--ib-line)", fill: 60 },
          { label: t("admin.resources.timeline.conflict"), color: "var(--ib-danger)", fill: 15 },
          ...(tracks.length > 0 ? [{ label: t("admin.resources.timeline.maintenanceLegend"), color: "var(--ib-warn)", fill: 30 }] : []),
        ]} />
        {charts.map(({ resource, model }) => model && <Card key={resource}>
          <CardHeader className="pb-0"><CardTitle className="text-base">{t(resource === "cpu" ? "admin.resources.cpu" : "admin.resources.memory")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-3">
            <AnalyticsChart height={260} option={chartOption(resource, model)} ariaLabel={t("admin.resources.timeline.chartLabel", { resource: t(resource === "cpu" ? "admin.resources.cpu" : "admin.resources.memory") })}
              onEvents={{ click: (params: { data?: { bar?: Bar } }) => { if (params.data?.bar) openBar(params.data.bar) } }} />
            {model.capacity === null && <p className="text-sm text-muted-foreground">{t("admin.resources.timeline.noCapacity")}</p>}
            {model.unlimited && <p className="text-sm text-muted-foreground" data-testid={`unlimited-${resource}`}>{t("admin.resources.timeline.unlimited", { resource: t(resource === "cpu" ? "admin.resources.cpu" : "admin.resources.memory") })}</p>}
          </CardContent>
        </Card>)}

        {(tracks.length > 0 || !data.MaintenanceReported) && <Card data-testid="timeline-maintenance">
          <CardHeader className="pb-0"><CardTitle className="text-base">{t("admin.resources.timeline.maintenance")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-3">
            {tracks.map((track) => <div key={track.agentID} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 truncate font-medium" title={track.agentName}>{track.agentName}</span>
              <div className="relative h-7 flex-1 rounded-sm bg-muted" role="group" aria-label={t("admin.resources.timeline.maintenanceTrack", { agent: track.agentName })}>
                {track.bands.map((band) => <div key={`${band.window.From}-${band.window.Name}`} className="absolute inset-y-0" style={{ left: `${band.left}%`, width: `max(${band.width}%, 24px)` }}>
                  <HoverTooltip text={maintenanceText(band)} className="flex h-full w-full">
                    <button type="button" className={MAINTENANCE_BAND} aria-label={maintenanceText(band).replace(/\n/g, ", ")} />
                  </HoverTooltip>
                </div>)}
              </div>
            </div>)}
            {!data.MaintenanceReported && <p className="text-sm text-muted-foreground" data-testid="maintenance-not-reported">{t("admin.resources.timeline.maintenanceNotReported")}</p>}
          </CardContent>
        </Card>}

        {(data.Conflicts ?? []).length > 0 && <Card data-testid="timeline-conflicts">
          <CardHeader className="pb-0"><CardTitle className="text-base">{t("admin.resources.timeline.conflicts")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 pt-3 text-sm">
            {(data.Conflicts ?? []).map((conflict) => <div key={`${conflict.From}-${conflict.To}`} className="flex flex-wrap items-center gap-2">
              <Badge tone="danger">{t(conflict.PoolShort ? "admin.resources.conflict.pool" : "admin.resources.conflict.range")}</Badge>
              <span className="tabular-nums">{formatWindow(conflict.From, conflict.To)}</span>
              <span className="text-muted-foreground">{t("admin.resources.conflict.short", { amount: formatAmount(conflict.Short) })}</span>
              {conflict.Unplaced > 0 && <span className="text-muted-foreground">{t("admin.resources.conflict.unplaced", { count: conflict.Unplaced })}</span>}
            </div>)}
          </CardContent>
        </Card>}

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base">{t("admin.resources.timeline.reservations")}</CardTitle></CardHeader>
          <CardContent className="pt-3">
            <TableWrap label={t("admin.resources.timeline.reservations")} rows={4}>
              <table aria-label={t("admin.resources.timeline.reservations")} className="ib-table">
                <thead><tr>
                  <Th>{t("admin.resources.col.reservation")}</Th><Th>{t("admin.resources.col.window")}</Th><Th>{t("admin.resources.col.size")}</Th><Th>{t("admin.resources.col.used")}</Th><Th>{t("admin.resources.col.placement")}</Th><Th>{t("admin.resources.col.state")}</Th><Th className="w-28"><span className="sr-only">{t("admin.resources.col.actions")}</span></Th>
                </tr></thead>
                {(data.Reservations ?? []).length === 0 ? <TableState colSpan={7} kind="empty" message={t("admin.resources.timeline.noReservations")} /> : <tbody>
                  {(data.Reservations ?? []).map((reservation) => {
                    const name = reservation.Kind === "event" ? reservation.EventName || reservation.EventTag : t("admin.resources.timeline.kindBooking")
                    return <tr key={reservation.ID} data-testid={`reservation-${reservation.ID}`}>
                      <td><span className="block font-medium leading-tight">{name}</span><span className="text-xs text-muted-foreground">{t(reservation.Kind === "event" ? "admin.resources.timeline.kindEvent" : "admin.resources.timeline.kindBooking")}</span></td>
                      <td className="ib-table__dim">{formatWindow(reservation.From, reservation.To)}</td>
                      <td>{formatAmount(reservation.Size)}</td>
                      <td className="ib-table__dim">{formatAmount(reservation.Used)}</td>
                      <td className="ib-table__dim">{(reservation.Placement ?? []).map((share) => `${share.AgentName} ×${share.Units}`).join(", ") || "—"}</td>
                      <td><span className="inline-flex flex-wrap gap-1.5">
                        {!reservation.Covered && <Badge tone="warn">{t("admin.resources.uncovered")}</Badge>}
                        {reservation.Unplaced > 0 && <Badge tone="danger">{t("admin.resources.unplaced", { count: reservation.Unplaced })}</Badge>}
                        {attention.has(reservation.ID) && reservation.Covered && <Badge tone="danger">{t("admin.resources.timeline.inConflict")}</Badge>}
                        {(reservation.Alarms ?? []).length > 0 && <Badge tone="warn">{t("admin.resources.alarmsCount", { count: (reservation.Alarms ?? []).length })}</Badge>}
                      </span></td>
                      <td className="ib-table__actions">{reservation.Kind === "event" && <span className="inline-flex items-center gap-1">
                        <HoverTooltip text={t(canWrite ? "admin.resources.edit" : "admin.resources.view")}><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`${t(canWrite ? "admin.resources.edit" : "admin.resources.view")}: ${name}`} onClick={() => onEdit({ eventID: reservation.EventID, name })}><Pencil className="h-4 w-4" aria-hidden /></Button></HoverTooltip>
                        {canWrite && <HoverTooltip text={t("admin.resources.replan.action")}><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`${t("admin.resources.replan.action")}: ${name}`} onClick={() => onReplan(reservation)}><RefreshCw className="h-4 w-4" aria-hidden /></Button></HoverTooltip>}
                        {canWrite && <HoverTooltip text={t("admin.resources.cancel.action")}><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[var(--ib-danger)] hover:bg-[var(--ib-danger-bg)] hover:text-[var(--ib-danger)]" aria-label={`${t("admin.resources.cancel.action")}: ${name}`} onClick={() => onCancel({ eventID: reservation.EventID, name })}><X className="h-4 w-4" aria-hidden /></Button></HoverTooltip>}
                      </span>}</td>
                    </tr>
                  })}
                </tbody>}
              </table>
            </TableWrap>
          </CardContent>
        </Card>
      </>}
  </div>
}
