"use client"

import type { Stats } from "@/api/resourceCalendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"
import { Badge, BLOCK, THEAD, TROW, Th, formatAmount, formatWindow } from "./resourceView"

export function StatsTab({ stats, error, onRetry }: { stats: Stats | null; error: unknown; onRetry: () => void }) {
  if (error && stats === null) return <LoadError className={BLOCK} message={t("admin.resources.stats.loadError")} error={error} onRetry={onRetry} />
  if (stats === null) return <LoadingArea className={BLOCK} label={t("admin.loading")} />
  const agents = stats.Agents ?? []
  const events = stats.Events ?? []
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.resources.stats.testPool")}</p><p className="mt-1 text-sm font-medium tabular-nums">{formatAmount(stats.TestPool)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.resources.stats.testLabsHeld")}</p><p className="mt-1 text-sm font-medium tabular-nums">{formatAmount(stats.TestLabsHeld)}</p></CardContent></Card>
    </div>
    <Card>
      <CardHeader className="pb-0"><CardTitle className="text-base">{t("admin.resources.stats.agents")}</CardTitle></CardHeader>
      <CardContent className="pt-3">
        {agents.length === 0 ? <EmptyState compact message={t("admin.resources.stats.noAgents")} /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className={THEAD}><tr><Th>{t("admin.resources.col.agent")}</Th><Th>{t("admin.resources.col.capacity")}</Th><Th>{t("admin.resources.col.allocated")}</Th><Th>{t("admin.resources.col.inUse")}</Th><Th>{t("admin.resources.col.free")}</Th></tr></thead>
          <tbody>{agents.map((agent) => <tr key={agent.ID} className={TROW} data-testid={`agent-stat-${agent.ID}`}>
            <td className="px-3 py-2"><span className="block font-medium">{agent.Name}</span>
              <span className="inline-flex gap-1.5">{!agent.Used && <Badge>{t("admin.resources.stats.notUsed")}</Badge>}{!agent.Connected && <Badge tone="warn">{t("admin.resources.stats.offline")}</Badge>}</span></td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatAmount(agent.Capacity)}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatAmount(agent.Allocated)}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatAmount(agent.InUse)}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatAmount(agent.Free)}</td>
          </tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="pb-0"><CardTitle className="text-base">{t("admin.resources.stats.events")}</CardTitle></CardHeader>
      <CardContent className="pt-3">
        {events.length === 0 ? <EmptyState compact message={t("admin.resources.stats.noEvents")} /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className={THEAD}><tr><Th>{t("admin.resources.col.event")}</Th><Th>{t("admin.resources.col.window")}</Th><Th>{t("admin.resources.col.allocated")}</Th><Th>{t("admin.resources.col.inUse")}</Th><Th>{t("admin.resources.col.free")}</Th></tr></thead>
          <tbody>{events.map((event) => <tr key={event.ReservationID} className={TROW} data-testid={`event-stat-${event.ReservationID}`}>
            <td className="px-3 py-2"><span className="block font-medium">{event.EventName || event.EventTag}</span>{!event.Covered && <Badge tone="warn">{t("admin.resources.uncovered")}</Badge>}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{formatWindow(event.From, event.To)}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatAmount(event.Allocated)}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatAmount(event.InUse)}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatAmount(event.Free)}</td>
          </tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
  </div>
}
