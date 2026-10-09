"use client"

import type { Stats } from "@/api/resourceCalendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TableState, TableWrap } from "@/components/common/DsTable"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"
import { Badge, BLOCK, Th, formatAmount, formatWindow } from "./resourceView"
import { ObservationFacts } from "./ObservationFacts"

export function StatsTab({ stats, error, onRetry }: { stats: Stats | null; error: unknown; onRetry: () => void }) {
  if (error && stats === null) return <LoadError className={BLOCK} message={t("admin.resources.stats.loadError")} error={error} onRetry={onRetry} />
  if (stats === null) return <LoadingArea className={BLOCK} label={t("admin.loading")} />
  const agents = stats.Agents ?? []
  const events = stats.Events ?? []
  return <div className="space-y-4">
    {error != null && <LoadError compact message={t("admin.resources.stats.loadError")} error={error} onRetry={onRetry} />}
    <Card>
      <CardHeader className="pb-0"><CardTitle className="text-base">{t("admin.resources.observation.title")}</CardTitle></CardHeader>
      <CardContent className="pt-3"><ObservationFacts observation={stats.Observation ?? null} stale={error != null} /></CardContent>
    </Card>
    <p className="text-xs text-muted-foreground">{t("admin.resources.stats.accountingHelp")}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.resources.stats.testPool")}</p><p className="mt-1 text-sm font-medium tabular-nums">{formatAmount(stats.TestPool)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.resources.stats.testLabsHeld")}</p><p className="mt-1 text-sm font-medium tabular-nums">{formatAmount(stats.TestLabsHeld)}</p></CardContent></Card>
    </div>
    <Card>
      <CardHeader className="pb-0"><CardTitle className="text-base">{t("admin.resources.stats.agents")}</CardTitle></CardHeader>
      <CardContent className="pt-3">
        <TableWrap label={t("admin.resources.stats.agents")} rows={3} className="border-0"><table aria-label={t("admin.resources.stats.agents")} className="ib-table">
          <thead><tr><Th>{t("admin.resources.col.agent")}</Th><Th>{t("admin.resources.col.capacity")}</Th><Th>{t("admin.resources.col.allocated")}</Th><Th>{t("admin.resources.col.inUse")}</Th><Th>{t("admin.resources.col.free")}</Th></tr></thead>
          {agents.length === 0 ? <TableState colSpan={5} kind="empty" message={t("admin.resources.stats.noAgents")} /> : <tbody>{agents.map((agent) => <tr key={agent.ID} data-testid={`agent-stat-${agent.ID}`}>
            <td><span className="block font-medium leading-tight">{agent.Name}</span>
              <span className="inline-flex gap-1.5">{!agent.Used && <Badge>{t("admin.resources.stats.notUsed")}</Badge>}{!agent.Connected && <Badge tone="warn">{t("admin.resources.stats.offline")}</Badge>}</span></td>
            <td >{formatAmount(agent.Capacity)}</td>
            <td >{formatAmount(agent.Allocated)}</td>
            <td >{formatAmount(agent.InUse)}</td>
            <td >{formatAmount(agent.Free)}</td>
          </tr>)}</tbody>}</table></TableWrap>
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="pb-0"><CardTitle className="text-base">{t("admin.resources.stats.events")}</CardTitle></CardHeader>
      <CardContent className="pt-3">
        <TableWrap label={t("admin.resources.stats.events")} rows={3} className="border-0"><table aria-label={t("admin.resources.stats.events")} className="ib-table">
          <thead><tr><Th>{t("admin.resources.col.event")}</Th><Th>{t("admin.resources.col.window")}</Th><Th>{t("admin.resources.col.allocated")}</Th><Th>{t("admin.resources.col.inUse")}</Th><Th>{t("admin.resources.col.free")}</Th></tr></thead>
          {events.length === 0 ? <TableState colSpan={5} kind="empty" message={t("admin.resources.stats.noEvents")} /> : <tbody>{events.map((event) => <tr key={event.ReservationID} data-testid={`event-stat-${event.ReservationID}`}>
            <td><span className="block font-medium leading-tight">{event.EventName || event.EventTag}</span>{!event.Covered && <Badge tone="warn">{t("admin.resources.uncovered")}</Badge>}</td>
            <td className="ib-table__dim">{formatWindow(event.From, event.To)}</td>
            <td >{formatAmount(event.Allocated)}</td>
            <td >{formatAmount(event.InUse)}</td>
            <td >{formatAmount(event.Free)}</td>
          </tr>)}</tbody>}</table></TableWrap>
      </CardContent>
    </Card>
  </div>
}
