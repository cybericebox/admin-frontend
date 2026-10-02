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
import { attentionIDs, buildTimelineModel, rangeFrom, type Bar, type Resource } from "@/lib/resourceCalendar"
import { RefreshIndicator } from "@/components/infrastructure/RefreshIndicator"
import { Badge, BLOCK, THEAD, TROW, Th, formatAmount, formatWindow, useCalendarResource } from "./resourceView"
import { timelineOption } from "./timelineOption"

const DAY_OPTIONS = [1, 3, 7, 14, 31]
const startOfToday = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()) }

function Legend({ items }: { items: { label: string; className: string }[] }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label={t("admin.resources.timeline.legend")}>
    {items.map((item) => <li key={item.label} className="flex items-center gap-1.5"><span aria-hidden className={`inline-block h-3 w-4 rounded-sm border ${item.className}`} />{item.label}</li>)}
  </ul>
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
          { label: t("admin.resources.timeline.kindEvent"), className: "border-[#0091EA] bg-[#0091EA]/40" },
          { label: t("admin.resources.timeline.kindBooking"), className: "border-[#22C55E] bg-[#22C55E]/40" },
          { label: t("admin.resources.uncovered"), className: "border-dashed border-[#F59E0B] bg-[#F59E0B]/25" },
          { label: t("admin.resources.timeline.pool"), className: "border-border bg-muted" },
          { label: t("admin.resources.timeline.conflict"), className: "border-[#EF4444] bg-[#EF4444]/15" },
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
            {(data.Reservations ?? []).length === 0 ? <EmptyState compact message={t("admin.resources.timeline.noReservations")} /> : <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}><tr>
                  <Th>{t("admin.resources.col.reservation")}</Th><Th>{t("admin.resources.col.window")}</Th><Th>{t("admin.resources.col.size")}</Th><Th>{t("admin.resources.col.used")}</Th><Th>{t("admin.resources.col.placement")}</Th><Th>{t("admin.resources.col.state")}</Th><Th className="w-28"><span className="sr-only">{t("admin.resources.col.actions")}</span></Th>
                </tr></thead>
                <tbody>
                  {(data.Reservations ?? []).map((reservation) => {
                    const name = reservation.Kind === "event" ? reservation.EventName || reservation.EventTag : t("admin.resources.timeline.kindBooking")
                    return <tr key={reservation.ID} className={TROW} data-testid={`reservation-${reservation.ID}`}>
                      <td className="px-3 py-2"><span className="block font-medium">{name}</span><span className="text-xs text-muted-foreground">{t(reservation.Kind === "event" ? "admin.resources.timeline.kindEvent" : "admin.resources.timeline.kindBooking")}</span></td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{formatWindow(reservation.From, reservation.To)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatAmount(reservation.Size)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{formatAmount(reservation.Used)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{(reservation.Placement ?? []).map((share) => `${share.AgentName} ×${share.Units}`).join(", ") || "—"}</td>
                      <td className="px-3 py-2"><span className="inline-flex flex-wrap gap-1.5">
                        {!reservation.Covered && <Badge tone="warn">{t("admin.resources.uncovered")}</Badge>}
                        {reservation.Unplaced > 0 && <Badge tone="danger">{t("admin.resources.unplaced", { count: reservation.Unplaced })}</Badge>}
                        {attention.has(reservation.ID) && reservation.Covered && <Badge tone="danger">{t("admin.resources.timeline.inConflict")}</Badge>}
                        {(reservation.Alarms ?? []).length > 0 && <Badge tone="warn">{t("admin.resources.alarmsCount", { count: (reservation.Alarms ?? []).length })}</Badge>}
                      </span></td>
                      <td className="px-3 py-2">{reservation.Kind === "event" && <span className="inline-flex items-center gap-1">
                        <HoverTooltip text={t(canWrite ? "admin.resources.edit" : "admin.resources.view")}><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`${t(canWrite ? "admin.resources.edit" : "admin.resources.view")}: ${name}`} onClick={() => onEdit({ eventID: reservation.EventID, name })}><Pencil className="h-4 w-4" aria-hidden /></Button></HoverTooltip>
                        {canWrite && <HoverTooltip text={t("admin.resources.replan.action")}><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`${t("admin.resources.replan.action")}: ${name}`} onClick={() => onReplan(reservation)}><RefreshCw className="h-4 w-4" aria-hidden /></Button></HoverTooltip>}
                        {canWrite && <HoverTooltip text={t("admin.resources.cancel.action")}><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[var(--ib-danger)] hover:bg-[var(--ib-danger-bg)] hover:text-[var(--ib-danger)]" aria-label={`${t("admin.resources.cancel.action")}: ${name}`} onClick={() => onCancel({ eventID: reservation.EventID, name })}><X className="h-4 w-4" aria-hidden /></Button></HoverTooltip>}
                      </span>}</td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>}
          </CardContent>
        </Card>
      </>}
  </div>
}
